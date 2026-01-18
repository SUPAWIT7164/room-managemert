# วิธีเริ่ม Image Processing Service ให้ดึงภาพทุกๆ 5 นาที

## 🚀 วิธีที่ 1: ใช้ Script (แนะนำ)

รันคำสั่ง:
```bash
node backend/scripts/start-image-processing.js
```

Service จะ:
- ✅ เริ่มดึงภาพทุกๆ **5 นาที** อัตโนมัติ
- ✅ บันทึกภาพไว้ที่ `backend/storage/processed_images/`
- ✅ แสดงสถานะทุก 30 วินาที
- ✅ กด `Ctrl+C` เพื่อหยุด service

---

## 🚀 วิธีที่ 2: ผ่าน API Endpoint

### เริ่ม Service:
```bash
POST http://localhost:3000/api/cctv/image-processing/start
Content-Type: application/json
Authorization: Bearer <your_token>

{
  "intervalMinutes": 5
}
```

### ตรวจสอบสถานะ:
```bash
GET http://localhost:3000/api/cctv/image-processing/status
Authorization: Bearer <your_token>
```

### หยุด Service:
```bash
POST http://localhost:3000/api/cctv/image-processing/stop
Authorization: Bearer <your_token>
```

---

## 📋 สรุป

**Default Interval:** 5 นาที (ตั้งค่าไว้แล้ว)

**Path ที่เก็บภาพ:**
- `backend/storage/processed_images/processed_*.jpg` - ภาพ JPEG
- `backend/storage/processed_images/metadata_*.json` - ข้อมูลการประมวลผล

**การทำงาน:**
1. Service จะดึงภาพทันทีเมื่อเริ่มต้น
2. แล้วจะดึงภาพทุกๆ 5 นาทีต่อจากนั้น
3. ภาพจะถูกประมวลผลและบันทึกอัตโนมัติ

---

## ⚙️ เปลี่ยน Interval (ถ้าต้องการ)

ถ้าต้องการเปลี่ยนเป็น 1-4 นาที สามารถทำได้:

**ผ่าน API:**
```bash
PUT http://localhost:3000/api/cctv/image-processing/interval
Content-Type: application/json
Authorization: Bearer <your_token>

{
  "intervalMinutes": 3  // 1-5 นาที
}
```

**หรือแก้ไขใน script:**
```javascript
const intervalMinutes = 3; // เปลี่ยนเป็น 3 นาที
```

---

## ✅ การตรวจสอบ

Service กำลังทำงานอยู่หรือไม่:
- ดูที่ console log: `[ImageProcessing] Starting image processing service (every 5 minutes)`
- ตรวจสอบโฟลเดอร์: `backend/storage/processed_images/` จะมีไฟล์ใหม่เพิ่มขึ้นทุก 5 นาที


