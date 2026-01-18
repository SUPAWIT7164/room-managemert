# Image Processing API Documentation

## 📋 API Endpoints

### 1. เริ่มต้น Image Processing Service

**POST** `/api/cctv/image-processing/start`

เริ่มต้น Image Processing Service ที่จะดึงภาพนิ่งและ process วนลูปทุกๆ 1-5 นาที

#### Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "intervalMinutes": 5  // 1-5 นาที (optional, default: 5)
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Image Processing Service started (every 5 minutes)",
  "intervalMinutes": 5
}
```

#### Example (cURL)
```bash
curl -X POST http://localhost:3000/api/cctv/image-processing/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 3}'
```

---

### 2. หยุด Image Processing Service

**POST** `/api/cctv/image-processing/stop`

หยุด Image Processing Service ที่กำลังทำงาน

#### Request Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Image Processing Service stopped"
}
```

#### Example (cURL)
```bash
curl -X POST http://localhost:3000/api/cctv/image-processing/stop \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. ตรวจสอบสถานะ Image Processing Service

**GET** `/api/cctv/image-processing/status`

ตรวจสอบสถานะ Image Processing Service

#### Request Headers
```
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Running (every 5 minutes)",
  "data": {
    "isRunning": true,
    "isProcessing": false,
    "intervalMinutes": 5,
    "lastProcessedTime": "2024-01-15T10:30:00.000Z",
    "processingCount": 10,
    "errorCount": 0,
    "lastResults": {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "imageSize": 125430,
      "processing": {
        "brightness": {
          "level": "bright",
          "fileSize": 125430,
          "timestamp": "2024-01-15T10:30:00.000Z"
        }
      }
    },
    "config": {
      "saveProcessedImages": true,
      "snapshotEndpoint": "/ISAPI/Streaming/channels/101/picture"
    }
  }
}
```

#### Example (cURL)
```bash
curl -X GET http://localhost:3000/api/cctv/image-processing/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. เปลี่ยน Interval

**PUT** `/api/cctv/image-processing/interval`

เปลี่ยนระยะเวลาระหว่างการ process (1-5 นาที)

#### Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "intervalMinutes": 3  // 1-5 นาที
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Image Processing interval updated to 3 minutes",
  "intervalMinutes": 3
}
```

#### Response (400 Bad Request)
```json
{
  "success": false,
  "message": "Interval must be between 1 and 5 minutes"
}
```

#### Example (cURL)
```bash
curl -X PUT http://localhost:3000/api/cctv/image-processing/interval \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"intervalMinutes": 2}'
```

---

## 📝 Response Status Codes

- **200 OK** - Request สำเร็จ
- **400 Bad Request** - Request ข้อมูลไม่ถูกต้อง (เช่น interval นอกช่วง 1-5)
- **401 Unauthorized** - ไม่มี token หรือ token ไม่ถูกต้อง
- **500 Internal Server Error** - เกิดข้อผิดพลาดภายใน

---

## 🔄 Workflow

```
1. เริ่มต้น Service
   POST /api/cctv/image-processing/start
   Body: { "intervalMinutes": 5 }

2. ตรวจสอบสถานะ
   GET /api/cctv/image-processing/status

3. (Optional) เปลี่ยน Interval
   PUT /api/cctv/image-processing/interval
   Body: { "intervalMinutes": 3 }

4. หยุด Service
   POST /api/cctv/image-processing/stop
```

---

## 📊 ข้อมูลที่ Service จะบันทึก

- **ภาพที่ process แล้ว** - เก็บไว้ใน `backend/storage/processed_images/`
- **Metadata** - บันทึกเป็น JSON ในไฟล์ `metadata_*.json`
- **สถานะ** - เก็บไว้ใน memory และแสดงผ่าน `/status` endpoint

---

## ⚠️ ข้อควรระวัง

1. **Interval** ต้องอยู่ระหว่าง 1-5 นาที
2. Service จะดึงภาพและ process ทันทีหลังจาก `start()` ถูกเรียก
3. หาก Service กำลัง process อยู่ จะข้ามรอบถัดไปจนกว่าจะเสร็จ
4. ภาพที่ process แล้วจะถูกบันทึกใน `storage/processed_images/` (ถ้าเปิด `saveProcessedImages`)


