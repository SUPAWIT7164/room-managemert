# สรุปผลการทดสอบการเชื่อมต่อเครื่องสแกนหน้า

## 📋 ข้อมูลเครื่องสแกนหน้า
- **IP Address:** `192.168.22.53`
- **Username:** `admin`
- **Password:** `lannacom@1`

## ✅ ผลการทดสอบ

### 1. การเชื่อมต่อพื้นฐาน
- ✅ **HTTP Connection:** สำเร็จ (Status 200)
- ✅ **Web Interface:** พบ (HTML response)
- ❌ **API Endpoints:** ไม่พบ endpoints ตาม format room-management-portal

### 2. API Endpoints ที่ทดสอบ

#### ❌ `/user/GetFace` (POST)
- **Status:** 404 Not Found
- **Response:** `Can't locate document: /user/GetFace`
- **หมายเหตุ:** Endpoint นี้ใช้ใน room-management-portal (IP: 10.1.244.42) แต่ไม่พบในเครื่องนี้

#### ❌ `/user/AddFace` (POST)
- **Status:** 404 Not Found
- **Response:** `Can't locate document: /user/AddFace`
- **หมายเหตุ:** Endpoint นี้ใช้ใน room-management-portal (IP: 10.1.244.42) แต่ไม่พบในเครื่องนี้

### 3. Web Interface
- ✅ **GET /** → Status 200 (HTML response)
- ⚠️ **GET /system** → Status 405 (Method Not Allowed)

## 🔍 ข้อสรุป

### ❌ **ไม่สามารถเชื่อมต่อได้เหมือน room-management-portal**

**สาเหตุ:**
เครื่องสแกนหน้า IP `192.168.22.53` ใช้ **API format ที่แตกต่าง** จากเครื่อง `10.1.244.42` ที่ใช้ใน room-management-portal

### 📊 เปรียบเทียบ

| Feature | room-management-portal (10.1.244.42) | เครื่องใหม่ (192.168.22.53) |
|---------|-------------------------------------|---------------------------|
| GetFace API | ✅ `/user/GetFace` | ❌ ไม่พบ (404) |
| AddFace API | ✅ `/user/AddFace` | ❌ ไม่พบ (404) |
| Web Interface | ✅ มี | ✅ มี |
| HTTP Connection | ✅ ทำงาน | ✅ ทำงาน |

## 🛠️ ขั้นตอนต่อไป

### 1. ตรวจสอบ Web Interface
เปิด browser และไปที่: `http://192.168.22.53`
- Login ด้วย `admin` / `lannacom@1`
- ตรวจสอบ:
  - หน้า Settings/Configuration
  - API Documentation
  - Developer Tools → Network tab (ดู API calls)

### 2. ค้นหา API Endpoints ที่ถูกต้อง
- ตรวจสอบ documentation ของเครื่องสแกนหน้า
- ดู Network requests ใน Developer Tools
- ลองค้นหา endpoints ที่เกี่ยวข้องกับ:
  - User management
  - Face management
  - API/WebService

### 3. ปรับ FaceScannerService
เมื่อทราบ API endpoints ที่ถูกต้องแล้ว:
- อัปเดต `backend/services/faceScannerService.js`
- ปรับ endpoints และ request format ให้ตรงกับเครื่องนี้

## 📝 API Format ที่ room-management-portal ใช้

```javascript
// GetFace
POST http://10.1.244.42/user/GetFace
Headers: { "Content-Type": "application/json" }
Body: { "Username": "username" }
Response: { "Image": "base64_string" }

// AddFace
POST http://10.1.244.42/user/AddFace
Headers: { "Content-Type": "application/json" }
Body: { 
  "Username": "username", 
  "Image": "base64_string" 
}
Response: success message
```

## 🔧 Test Scripts ที่มี

1. **test-face-scanner.js** - ทดสอบการเชื่อมต่อพื้นฐาน
2. **test-face-scanner-direct.js** - ทดสอบ API format โดยตรง
3. **discover-face-scanner-endpoints.js** - ค้นหา endpoints ที่มี
4. **test-face-scanner-web-interface.js** - ตรวจสอบ web interface

## 📌 สรุป

**สถานะปัจจุบัน:** ❌ ไม่สามารถเชื่อมต่อได้เหมือน room-management-portal

**ต้องทำ:** ตรวจสอบ API documentation ของเครื่องสแกนหน้า IP 192.168.22.53 เพื่อหา endpoints ที่ถูกต้อง


