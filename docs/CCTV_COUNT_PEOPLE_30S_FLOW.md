# Flow การนับคนทุก 30 วินาที และการแก้ 502/503

## แก้ปัญหา 502/503 อย่างไร

1. **Snapshot แยก service + timeout 5 วินาที**
   - ใช้ `cctvSnapshotService.fetchSnapshot()` ดึงภาพ **เพียง 1 frame ต่อการนับ 1 รอบ**
   - Timeout ไม่เกิน **5 วินาที** — ลดโอกาส backend ค้างหรือ IIS 502 จาก request นาน
   - Error จากกล้อง (timeout, 503, 401, 404) → backend ส่ง **503** (ไม่ใช่ 502) พร้อมข้อความชัดเจน

2. **ป้องกัน request ซ้อน (ไม่ timeout / crash)**
   - ตัวแปร `countPeopleProcessing`: ถ้ายังประมวลผลไม่เสร็จ → **return 429** ทันที
   - Frontend ห้ามยิงซ้อน: ถ้า `countPeopleLoading` อยู่ → ข้าม tick ของ setInterval (ไม่เรียก refreshAllPeopleCounts)
   - ทุกจุดมี try/catch; error จากกล้อง → 503, image processing error → 500, log ชัดเจน

3. **แยก service ชัดเจน**
   - **Snapshot**: `cctvSnapshotService.js` — ดึง 1 frame, timeout 5s, ใช้ env (ไม่ hardcode auth)
   - **Detect**: `imageProcessingService.detectPeople(buffer)` → `{ people: [{x,y,width,height}], count }` (normalized 0-1)
   - **Count in ROI**: `imageProcessingService.countInROI(people, roi)` → นับเฉพาะคนที่ center อยู่ใน polygon

---

## Flow การนับทุก 30 วินาที

1. **Frontend**
   - `setInterval(..., 30000)` เรียก `refreshAllPeopleCounts()` ทุก 30 วินาที
   - ก่อนเรียก: ถ้า `countPeopleBackendUnavailable` หรือ `areas.length === 0` → return
   - ถ้า `countPeopleLoading` อยู่ (รอบก่อนยังไม่เสร็จ) → **ข้าม tick นี้** (ไม่ยิงซ้อน)
   - ตั้ง `countPeopleLoading = true` → วนเรียก `fetchCountForArea(area)` ต่อ area → ส่ง `{ cameraId, areaId, roi }`
   - แสดง "กำลังนับ..." (loading state)
   - ได้ response `{ count, people, timestamp }` → เก็บ count ต่อ area, เก็บ `people` สำหรับ overlay bbox
   - ถ้าได้ 429 → แสดง snackbar "ระบบกำลังประมวลผล — รอสักครู่" (ไม่หยุด interval)
   - ถ้าได้ 503/502/500 → ตั้ง `countPeopleBackendUnavailable` หยุด interval แสดง Alert
   - สุดท้าย `countPeopleLoading = false`

2. **Backend (POST /api/cctv/count-people)**
   - ถ้า `countPeopleProcessing` อยู่ → **429** ทันที
   - ตั้ง `countPeopleProcessing = true`
   - ดึง snapshot ผ่าน `fetchSnapshot(config, client, 5000)` (timeout 5s)
     - ล้มเหลว → 503, แล้ว `countPeopleProcessing = false` (ใน finally)
   - เรียก `imageProcessingService.countPeople(buffer, roi)` → ได้ `{ count, people }`
     - ล้มเหลว → 500
   - ส่ง `{ count, people, timestamp }`
   - ใน `finally`: ตั้ง `countPeopleProcessing = false`

3. **Overlay บนภาพ**
   - Frontend เก็บ `peopleByAreaId[areaId] = people` (bbox normalized 0-1)
   - ใน `redrawCanvas()` วาด ROI polygon + วาด bounding box ของคน (สีเขียว) บน canvas ที่ซ้อนภาพกล้อง

---

## API

**POST /api/cctv/count-people**

- Request: `{ cameraId: number|string, areaId: string, roi: [{x,y}, ...] }` (roi = polygon normalized 0-1)
- Response 200: `{ count: number, people: [{x,y,width,height}], timestamp: ISOString }`
- 429: ระบบกำลังประมวลผลรอบก่อน
- 503: ไม่สามารถดึงภาพจากกล้องได้ (timeout / กล้องตอบ 503 หรือ error)
- 500: เกิดข้อผิดพลาดในการประมวลผลภาพ (image processing)
