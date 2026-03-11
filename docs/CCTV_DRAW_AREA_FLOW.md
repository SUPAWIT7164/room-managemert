# ฟังก์ชันวาดพื้นที่สำหรับนับคนในพื้นที่ (CCTV)

## ภาพรวมระบบ

- ใช้ภาพนิ่งจากกล้อง CCTV (snapshot / JPEG)
- ทำ image processing เพื่อ detect คน
- นับเฉพาะคนที่อยู่ภายในพื้นที่ที่ผู้ใช้วาด (ROI)
- ประมวลผลซ้ำอัตโนมัติทุก 1–5 นาที (ตั้งค่าได้จาก frontend)

---

## Flow การทำงานแบบ Step-by-Step

### 1. Frontend (Vue/Nuxt) — หน้า /cctv

| ขั้นตอน | รายละเอียด |
|--------|-------------|
| 1.1 | ผู้ใช้กด **"วาดพื้นที่"** → โหลด snapshot จาก `/api/cctv/snapshot?cameraId=...` แสดงใน `<img>` |
| 1.2 | ผู้ใช้คลิกบน canvas (ซ้อนทับภาพ) เพื่อเพิ่มจุดของ polygon (พิกัดถูก normalize เป็น 0–1 ตามขนาด canvas) |
| 1.3 | กด **"เสร็จสิ้น"** เมื่อมีอย่างน้อย 3 จุด → เปิด dialog ตั้งชื่อพื้นที่ → บันทึกพื้นที่ (id, name, roi) |
| 1.4 | พื้นที่ทั้งหมดถูกส่งไป backend ผ่าน **PUT /api/cctv/areas** (และโหลดผ่าน **GET /api/cctv/areas**) เก็บใน DB ตาราง `cctv_area_config` |
| 1.5 | ผู้ใช้เลือกช่วงรีเฟรช (1–5 นาที) แล้วกด **"เริ่มนับคน"** |
| 1.6 | ทุก X นาที (และครั้งแรกทันที) เรียก **POST /api/cctv/count-people** สำหรับแต่ละพื้นที่ โดยส่ง `{ cameraId, roi }` |
| 1.7 | แสดงผลจำนวนคนต่อพื้นที่ (และ timestamp ล่าสุด) จาก response `{ success, cameraId, count, timestamp }` |

### 2. Backend (Express) — POST /api/cctv/count-people

| ขั้นตอน | รายละเอียด |
|--------|-------------|
| 2.1 | รับ body: `{ cameraId?, roi? }` — roi = array ของจุด polygon แบบ normalized 0–1 |
| 2.2 | ใช้ Digest Auth (digest-fetch) ดึงภาพนิ่งจากกล้องที่ `CCTV_BASE_URL/ISAPI/Streaming/channels/101/picture` |
| 2.3 | **ถ้าดึงภาพจากกล้องไม่ได้** (timeout, 401, 404, 503, connection error) → **return 502** พร้อม message/reason/hint |
| 2.4 | ได้ buffer ภาพแล้ว เรียก **Image Processing Service**: `countPeople(buffer, roi)` |
| 2.5 | **ถ้า image processing throw error** → **return 500** พร้อม message |
| 2.6 | ส่งกลับ **200** ด้วย JSON: `{ "cameraId": "...", "count": 5, "timestamp": "ISO8601" }` (และ success: true ตามที่ frontend ใช้) |

### 3. Image Processing (Node.js)

| ขั้นตอน | รายละเอียด |
|--------|-------------|
| 3.1 | **ดึงภาพจากกล้อง**: ทำที่ controller (ไม่ใช่ใน service) — service รับแค่ buffer + roi |
| 3.2 | **Detect คน**: ใช้ `@vladmandic/human` (เทียบเท่า YOLO/object detection, class = person) ได้ bounding box ของแต่ละคน |
| 3.3 | **Centroid**: คำนวณจุดกึ่งกลางของแต่ละ bounding box (normalized 0–1 ตามขนาดภาพ) |
| 3.4 | **Point-in-polygon**: ใช้ ray-casting ตรวจว่า centroid อยู่ใน ROI หรือไม่ |
| 3.5 | **นับ**: นับเฉพาะคนที่ centroid อยู่ใน ROI แล้ว return จำนวน (integer) |
| 3.6 | ถ้าไม่มี ROI หรือ ROI ไม่ถูกต้อง (น้อยกว่า 3 จุด) → นับทั้งภาพ |

---

## โค้ดที่เกี่ยวข้อง

### Backend (Express)

- **Route**: `backend/routes/cctvRoutes.js`  
  - `POST /count-people` → `cctvController.countPeopleInArea`
  - `GET /areas`, `PUT /areas` → โหลด/บันทึกพื้นที่วาด
- **Controller**: `backend/controllers/cctvController.js`  
  - `countPeopleInArea(req, res)` — รับ cameraId, roi; ดึง snapshot ด้วย digest-fetch; เรียก `imageProcessingService.countPeople(buffer, roi)`; return 502/500/200 ตามสเปก
- **Database**: ตาราง `cctv_area_config` (สร้างด้วย `scripts/create_cctv_area_config_mssql.sql` หรือ `scripts/create_smart_room_booking_mssql.sql`)

### Image Processing

- **Service**: `backend/services/imageProcessingService.js`  
  - `pointInPolygon(nx, ny, polygon)` — ray-casting สำหรับ normalized coordinates  
  - `countPeople(imageBuffer, roi)` — ใช้ @vladmandic/human detect persons, หา centroid, กรองด้วย pointInPolygon, return count  
  - ถ้า require @vladmandic/human / @tensorflow/tfjs-node ไม่ได้ จะ log warning และ return 0 (ไม่ throw)

### Frontend (Vue/Nuxt) — วาดพื้นที่บน canvas

- **Page**: `frontend/src/pages/cctv.vue`
  - **State**: `drawMode`, `areas[]`, `currentPoints`, `snapshotUrl`, `peopleCountByAreaId`, `countPeopleRefreshIntervalMinutes`, `countPeopleIntervalId`
  - **ฟังก์ชันหลัก**:  
    - `getSnapshotUrl()`, `loadAreas()`, `saveAreas()`  
    - `startDrawMode()`, `cancelDrawMode()`, `onDrawCanvasClick(e)` — คลิกเพิ่มจุด (normalized 0–1)  
    - `finishDrawing()`, `confirmNewArea()` — ปิด polygon + ตั้งชื่อ + บันทึก  
    - `redrawCanvas()` — วาด polygon ทั้งหมด + จุดปัจจุบันบน canvas  
    - `fetchCountForArea(area)`, `refreshAllPeopleCounts()`, `startCountPeopleInterval()`, `stopCountPeopleInterval()`
  - **Template**:  
    - ปุ่ม วาดพื้นที่ / เสร็จสิ้น / ยกเลิก  
    - ช่วงรีเฟรช 1–5 นาที, ปุ่ม เริ่มนับคน / หยุดนับ  
    - เมื่อ `drawMode`: `<img>` snapshot + `<canvas>` ซ้อนทับ รับ click  
    - รายการพื้นที่ + จำนวนคนต่อพื้นที่ + ปุ่มลบ  
    - Dialog ตั้งชื่อพื้นที่, Snackbar แจ้งเตือน  

---

## Error Handling (ตามสเปก)

| สถานการณ์ | HTTP | การตอบกลับ |
|-----------|------|-------------|
| ดึงภาพจากกล้องไม่ได้ (timeout, 401, 404, 503, ECONNREFUSED, ...) | **502** | JSON มี message, reason, (hint) |
| Image processing error (library throw) | **500** | JSON มี message, reason: image_processing_error |
| สำเร็จ | **200** | `{ success: true, cameraId, count, timestamp }` |

---

## Output (สำเร็จ)

```json
{
  "success": true,
  "cameraId": "0",
  "count": 5,
  "timestamp": "2025-01-29T12:00:00.000Z"
}
```

---

## การตั้งเวลา (1–5 นาที)

- **Frontend**: ใช้ `setInterval` เรียก `refreshAllPeopleCounts()` ทุก N นาที (N เลือกได้ 1–5)  
- **Backend**: ไม่ใช้ node-cron สำหรับ count-people — แต่ละครั้งนับเกิดจาก frontend เรียก POST /api/cctv/count-people  
- **Image Processing Service** (งานอื่น เช่น processSnapshot loop) ใช้ setInterval 1–5 นาที ได้ใน `imageProcessingService.start(intervalMinutes)`
