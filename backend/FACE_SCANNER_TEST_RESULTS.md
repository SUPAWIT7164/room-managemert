# ผลการทดสอบการเชื่อมต่อเครื่องสแกนหน้า

## สรุปผลการทดสอบ

### เครื่องสแกนหน้า IP: 192.168.22.53
- Username: admin
- Password: lannacom@1

### ผลการทดสอบ

#### ❌ **ไม่สามารถเชื่อมต่อได้เหมือน room-management-portal**

**สาเหตุ:**
1. **Endpoint `/user/GetFace` ไม่พบ (404)**
   - room-management-portal ใช้: `POST http://10.1.244.42/user/GetFace`
   - เครื่อง 192.168.22.53: ไม่มี endpoint นี้

2. **Endpoint `/user/AddFace` ไม่พบ (404)**
   - room-management-portal ใช้: `POST http://10.1.244.42/user/AddFace`
   - เครื่อง 192.168.22.53: ไม่มี endpoint นี้

3. **Web Interface พบ**
   - GET `/` → Status 200 (HTML response)
   - GET `/system` → Status 405 (Method Not Allowed)
   - แสดงว่าเครื่องมี web interface แต่ API endpoints แตกต่าง

### ข้อสรุป

**เครื่องสแกนหน้า IP 192.168.22.53 ใช้ API format ที่แตกต่างจากเครื่อง 10.1.244.42**

**สิ่งที่ต้องทำ:**
1. ตรวจสอบ documentation ของเครื่องสแกนหน้า IP 192.168.22.53
2. ตรวจสอบ web interface ที่ `http://192.168.22.53` เพื่อหา API endpoints ที่ถูกต้อง
3. อาจต้องใช้ API format ที่แตกต่างจาก room-management-portal

### วิธีแก้ไข

1. **เปิด web interface** ใน browser: `http://192.168.22.53`
   - Login ด้วย admin / lannacom@1
   - ตรวจสอบ API documentation หรือ Developer Tools

2. **ตรวจสอบ API endpoints** ที่เครื่องรองรับ:
   - อาจอยู่ในหน้า Settings/API/Configuration
   - หรือดูจาก Network tab ใน Developer Tools

3. **ปรับ FaceScannerService** ให้ใช้ API format ที่ถูกต้องตามเครื่องนี้

### API Format ที่ room-management-portal ใช้

```javascript
// GetFace
POST http://10.1.244.42/user/GetFace
Body: {"Username": "username"}
Response: {"Image": "base64_string"}

// AddFace
POST http://10.1.244.42/user/AddFace
Body: {"Username": "username", "Image": "base64_string"}
```

### ขั้นตอนต่อไป

1. เปิด `http://192.168.22.53` ใน browser
2. Login ด้วย admin / lannacom@1
3. ตรวจสอบ API documentation
4. แจ้ง API endpoints ที่ถูกต้องเพื่อปรับ FaceScannerService


