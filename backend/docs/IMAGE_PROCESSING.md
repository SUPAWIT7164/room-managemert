# Image Processing Service - คู่มือการใช้งาน

## 📋 ภาพรวม

**Image Processing Service** เป็น service ที่ทำหน้าที่:
1. **ดึงภาพนิ่ง** (snapshot) จากกล้อง CCTV ทุกๆ 1-5 นาที
2. **ทำ Image Processing** เช่น:
   - Motion Detection (ตรวจจับการเคลื่อนไหว)
   - Object Detection (ตรวจจับวัตถุ เช่น คน, รถ)
   - Face Recognition (จดจำใบหน้า)
   - People Counting (นับจำนวนคน)
   - Anomaly Detection (ตรวจจับสิ่งผิดปกติ)
3. **บันทึกผลลัพธ์** หรือ **แจ้งเตือน** เมื่อพบเหตุการณ์สำคัญ

---

## 🔄 วิธีทำงาน (Flow)

```
┌─────────────────────────────────────────────────┐
│  Image Processing Service                        │
│  (รันทุกๆ 1-5 นาที)                              │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  1. ดึงภาพนิ่ง (Snapshot)                        │
│     - ใช้ snapshot endpoint                      │
│     - ไม่ใช่ stream (เพื่อประหยัด bandwidth)      │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  2. Image Processing                            │
│     - Motion Detection                          │
│     - Object Detection                         │
│     - Face Recognition                         │
│     - People Counting                          │
│     - Anomaly Detection                        │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  3. บันทึกผลลัพธ์                                │
│     - บันทึกภาพที่ process แล้ว                 │
│     - บันทึก metadata (JSON)                    │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  4. ส่ง Notification (ถ้าจำเป็น)                 │
│     - Email                                     │
│     - LINE Notify                               │
│     - Webhook                                   │
└─────────────────────────────────────────────────┘
```

---

## 🚀 วิธีใช้งาน

### 1. ผ่าน API Endpoints (แนะนำ)

#### เริ่มต้น Image Processing
```bash
POST /api/cctv/image-processing/start
Content-Type: application/json
Authorization: Bearer <token>

{
  "intervalMinutes": 5  // 1-5 นาที
}
```

#### หยุด Image Processing
```bash
POST /api/cctv/image-processing/stop
Authorization: Bearer <token>
```

#### ตรวจสอบสถานะ
```bash
GET /api/cctv/image-processing/status
Authorization: Bearer <token>
```

#### เปลี่ยน Interval
```bash
PUT /api/cctv/image-processing/interval
Content-Type: application/json
Authorization: Bearer <token>

{
  "intervalMinutes": 3  // 1-5 นาที
}
```

### 2. ใช้ Service โดยตรง (สำหรับ Development)

#### Import Service

```javascript
const ImageProcessingService = require('./services/imageProcessingService');
const cctvController = require('./controllers/cctvController');
```

#### สร้าง Instance

```javascript
// ใช้ camera config จาก CCTVController
const imageProcessingService = new ImageProcessingService(
    cctvController.cameraConfig
);
```

#### เริ่มต้น Service

```javascript
// Process ทุก 5 นาที
imageProcessingService.start(5);

// หรือทุก 1 นาที
imageProcessingService.start(1);

// หรือทุก 3 นาที
imageProcessingService.start(3);
```

#### หยุด Service

```javascript
imageProcessingService.stop();
```

#### ตรวจสอบสถานะ

```javascript
const status = imageProcessingService.getStatus();
console.log(status);
// {
//   isRunning: true,
//   isProcessing: false,
//   intervalMinutes: 5,
//   lastProcessedTime: "2024-01-15T10:30:00.000Z",
//   processingCount: 10,
//   errorCount: 0,
//   lastResults: {...},
//   config: {...}
// }
```

#### เปลี่ยน Interval

```javascript
// เปลี่ยนเป็นทุก 2 นาที
imageProcessingService.setInterval(2);
```

---

## 📝 ตัวอย่างการใช้งานใน server.js

```javascript
const express = require('express');
const ImageProcessingService = require('./services/imageProcessingService');
const cctvController = require('./controllers/cctvController');

const app = express();

// ... other middleware ...

// Initialize Image Processing Service
const imageProcessingService = new ImageProcessingService(
    cctvController.cameraConfig
);

// เริ่มต้น Image Processing (ทุก 5 นาที)
imageProcessingService.start(5);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Stopping image processing service...');
    imageProcessingService.stop();
    process.exit(0);
});

app.listen(5000, () => {
    console.log('Server running on port 5000');
    console.log('Image Processing Service: Running (every 5 minutes)');
});
```

---

## 🎯 Image Processing Tasks ที่สามารถทำได้

### 1. Motion Detection
```javascript
// เปรียบเทียบภาพปัจจุบันกับภาพก่อนหน้า
// ใช้ library เช่น opencv หรือ sharp
async detectMotion(currentImage) {
    // TODO: เปรียบเทียบกับภาพก่อนหน้า
    return {
        detected: true,
        confidence: 0.85
    };
}
```

### 2. Object Detection
```javascript
// ตรวจจับวัตถุ เช่น คน, รถ, กระเป๋า
// ใช้ TensorFlow.js, YOLO, หรือ COCO-SSD
async detectObjects(imageBuffer) {
    // TODO: ใช้ AI model
    return [
        { class: 'person', confidence: 0.9, bbox: [x, y, w, h] },
        { class: 'car', confidence: 0.7, bbox: [x, y, w, h] }
    ];
}
```

### 3. Face Recognition
```javascript
// จดจำใบหน้า
// ใช้ face-api.js หรือ face-recognition
async recognizeFaces(imageBuffer) {
    // TODO: ใช้ face recognition library
    return [
        { name: 'John Doe', confidence: 0.95 },
        { name: 'Jane Smith', confidence: 0.88 }
    ];
}
```

### 4. People Counting
```javascript
// นับจำนวนคนในภาพ
// ใช้ object detection แล้ว filter เฉพาะ 'person' class
async countPeople(imageBuffer) {
    const objects = await this.detectObjects(imageBuffer);
    return objects.filter(obj => obj.class === 'person').length;
}
```

### 5. Anomaly Detection
```javascript
// ตรวจจับสิ่งผิดปกติ
// ใช้ AI model สำหรับ anomaly detection
async detectAnomalies(imageBuffer) {
    // TODO: ใช้ anomaly detection model
    return [
        { type: 'unusual_object', confidence: 0.8 },
        { type: 'crowd', confidence: 0.6 }
    ];
}
```

---

## 📦 Libraries ที่แนะนำ

### Image Processing
- **sharp** - Fast image processing
- **jimp** - Pure JavaScript image processing
- **opencv4nodejs** - OpenCV bindings for Node.js

### AI/ML
- **@tensorflow/tfjs-node** - TensorFlow.js for Node.js
- **@tensorflow-models/coco-ssd** - Object detection
- **face-api.js** - Face recognition
- **@vladmandic/face-api** - Face detection and recognition

### Motion Detection
- **pixelmatch** - Compare images pixel by pixel
- **jimp** - Image comparison

---

## ⚙️ Configuration

```javascript
const config = {
    intervalMinutes: 5,        // Process ทุก 5 นาที (ปรับได้ 1-5)
    snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture',
    saveProcessedImages: true,  // บันทึกภาพที่ process แล้ว
    savePath: './storage/processed_images',
    enableProcessing: true,     // เปิด/ปิด image processing
    lastProcessedTime: null,    // เวลาที่ process ล่าสุด
    lastResults: null,          // ผลลัพธ์ล่าสุด
    processingCount: 0,         // จำนวนครั้งที่ process แล้ว
    errorCount: 0               // จำนวนครั้งที่เกิด error
};
```

---

## 🔔 Notification

เมื่อพบเหตุการณ์สำคัญ (เช่น motion detected, anomaly) สามารถส่ง notification ผ่าน:

1. **Email** - ใช้ nodemailer
2. **LINE Notify** - ใช้ axios
3. **Webhook** - ใช้ axios
4. **Database** - บันทึกใน database

---

## 📊 ตัวอย่างผลลัพธ์

```json
{
    "timestamp": "2024-01-15T10:30:00.000Z",
    "imageSize": 125430,
    "processing": {
        "motionDetected": true,
        "objects": [
            { "class": "person", "confidence": 0.9 }
        ],
        "peopleCount": 1,
        "faces": [],
        "anomalies": [],
        "brightness": {
            "level": "bright",
            "fileSize": 125430
        }
    }
}
```

---

## ⚠️ ถ้านับคนได้ 0 เสมอ (People count = 0)

ฟีเจอร์นับคนในหน้า CCTV (`/api/cctv/count-people`) ใช้ `@vladmandic/human` และ `@tensorflow/tfjs-node` ในโค้ดถ้า `require` ไม่ได้จะ **return 0** (ไม่ crash)

**สาเหตุที่เป็นไปได้:**

1. **เซิร์ฟเวอร์ต่อกล้องไม่ได้**  
   - เช่น 502 Bad Gateway จาก proxy/กล้อง  
   - API จะตอบ `502` พร้อม `count: 0` และข้อความ "ไม่สามารถดึงภาพจากกล้องได้"

2. **บน backend ยังไม่ได้ติดตั้ง AI packages**  
   - โค้ดใช้ `optionalDependencies`: `@vladmandic/human`, `@tensorflow/tfjs-node`  
   - ถ้าไม่ติดตั้งหรือติดตั้งไม่สำเร็จ (เช่น build native ล้มบนเซิร์ฟเวอร์) ฟังก์ชันนับคนจะ return 0  
   - ใน log จะเห็นคำเตือนครั้งเดียว:  
     `[ImageProcessing] countPeople: ไม่พบ @vladmandic/human หรือ @tensorflow/tfjs-node — ติดตั้งเพื่อนับคนจริง. ตอนนี้ return 0.`

**ถ้าแก้ไขแล้ว (ติดตั้ง packages / แก้ต่อกล้อง) ให้ build ใหม่:**

- Backend: ในโฟลเดอร์ `backend` รัน `npm install` (หรือ `npm install @vladmandic/human @tensorflow/tfjs-node` ถ้าต้องการบังคับติดตั้ง) แล้ว restart service  
- หมายเหตุ: ตอนนี้ backend นับคนทั้งภาพ (จาก snapshot) ยังไม่ได้ crop ตาม polygon ที่วาด ดังนั้นทุกพื้นที่วาดจะได้เลขนับคนเท่ากัน (นับทั้งภาพ)

---

## 🎓 สรุป

**Image Processing Service** ทำงานแบบ:
- ✅ **ดึงภาพนิ่ง** จากกล้อง (ไม่ใช่ stream)
- ✅ **Process ทุกๆ 1-5 นาที** (ปรับได้)
- ✅ **ทำงานใน background** (ไม่กระทบ video stream)
- ✅ **บันทึกผลลัพธ์** และ **แจ้งเตือน** เมื่อจำเป็น

**ข้อดี:**
- ประหยัด bandwidth (ไม่ต้อง stream ตลอดเวลา)
- สามารถทำ processing ที่ซับซ้อนได้
- ไม่กระทบ video stream ที่แสดง real-time

