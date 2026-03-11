# API นับคน: POST /api/cctv/count-people — รูปแบบการตอบกลับ

## Request

```
POST /api/cctv/count-people
Content-Type: application/json

{
  "cameraId": "0",        // optional, default "0"
  "areaId": "area-xxx",   // optional, ใช้ระบุพื้นที่
  "roi": [                // polygon normalized 0–1 (จำเป็นถ้าต้องการนับใน ROI)
    { "x": 0.2, "y": 0.2 },
    { "x": 0.8, "y": 0.2 },
    { "x": 0.8, "y": 0.8 },
    { "x": 0.2, "y": 0.8 }
  ]
}
```

---

## Response ที่ API คืน (แต่ละกรณี)

### 1. สำเร็จ — HTTP 200

เมื่อดึง snapshot จากกล้องได้ และประมวลผลภาพเสร็จ

```json
{
  "count": 3,
  "people": [
    { "x": 0.25, "y": 0.4, "width": 0.1, "height": 0.25 },
    { "x": 0.5, "y": 0.35, "width": 0.08, "height": 0.22 },
    { "x": 0.7, "y": 0.45, "width": 0.09, "height": 0.2 }
  ],
  "timestamp": "2025-01-29T10:30:00.000Z"
}
```

| ชื่อฟิลด์   | ประเภท | ความหมาย |
|------------|--------|-----------|
| `count`    | number | จำนวนคนที่อยู่ใน ROI (หรือทั้งภาพถ้าไม่มี roi) |
| `people`   | array  | Bounding box แต่ละคน normalized 0–1: `{ x, y, width, height }` |
| `timestamp`| string | ISO 8601 เวลาที่นับ |

---

### 2. ระบบกำลังประมวลผลรอบก่อน — HTTP 429

มีการยิง request ซ้อน (รอบก่อนยังไม่จบ)

```json
{
  "success": false,
  "count": 0,
  "message": "ระบบกำลังประมวลผลรอบก่อน — รอสักครู่แล้วลองใหม่",
  "reason": "busy"
}
```

---

### 3. Error จากกล้อง (รวม 503) — HTTP 503

กล้องไม่ให้บริการชั่วคราว / timeout / ไม่ถึงกล้อง

```json
{
  "success": false,
  "count": 0,
  "people": [],
  "message": "กล้องตอบ 503",
  "reason": "camera_error",
  "hint": "ตรวจสอบ CCTV_BASE_URL ใน .env และให้กล้องเปิดอยู่"
}
```

กรณีอื่นจากกล้อง (เช่น Auth ไม่พร้อม):

- `message`: ข้อความเช่น "ระบบ Digest Auth ไม่พร้อม...", "กล้องตอบสนองช้าเกินไป (เกิน 5 วินาที)"
- `reason`: `"camera_error"` หรือ `"timeout"` หรือ `"digest_auth_unavailable"`
- `hint`: ข้อความแนะนำ (มีเมื่อมี)

---

### 4. Error จาก Image Processing — HTTP 500

ประมวลผลภาพล้มเหลว (เช่น AI module ผิดพลาด)

```json
{
  "success": false,
  "count": 0,
  "people": [],
  "message": "เกิดข้อผิดพลาดในการประมวลผลภาพ (image processing)",
  "reason": "image_processing_error",
  "error": "รายละเอียด error จาก backend"
}
```

---

### 5. Error อื่น (Service init / ไม่คาดคิด) — HTTP 500

```json
{
  "success": false,
  "count": 0,
  "people": [],
  "message": "ไม่สามารถเริ่ม Image Processing Service ได้",
  "reason": "service_init_error",
  "error": "..."
}
```

หรือ
 
```json
{
  "success": false,
  "count": 0,
  "people": [],
  "message": "เกิดข้อผิดพลาดไม่คาดคิด",
  "error": "..."
}
```

---

## สรุป: API นับคน “คืนอันไหน”

| HTTP | สถานการณ์ | ฟิลด์สำคัญที่คืน |
|------|-----------|-------------------|  
| **200** | นับสำเร็จ | `count`, `people`, `timestamp` |
| **429** | กำลังประมวลผลรอบก่อน | `message`, `reason: "busy"` |
| **503** | กล้องไม่ให้บริการ / 503 / timeout / auth กล้อง | `message`, `reason`, `hint` (และ `people: []`) |
| **500** | ประมวลผลภาพล้มเหลว / service init / error อื่น | `message`, `reason`, `error` (และ `people: []`) |

หมายเหตุ: กรณี **503 “กล้องตอบ 503”** หมายถึง **กล้อง Hikvision ตอบ HTTP 503** ตอน backend ไปดึง snapshot — ต้องตรวจที่กล้อง/เครือข่าย/CCTV_BASE_URL ไม่ใช่แค่ backend.
