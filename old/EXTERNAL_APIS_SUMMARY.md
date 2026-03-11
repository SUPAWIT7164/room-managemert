# สรุป External APIs ที่ใช้ในโปรเจค old

## 📋 รายการ External APIs ทั้งหมด

### 1. **Booking Backend API** (`http://10.1.244.42`)
**Base URL:** `http://10.1.244.42`

#### 1.1 `/booking/daily_sync`
- **Method:** POST
- **Description:** Sync การจองรายวัน
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการสร้าง/อัปเดต/ลบการจอง
  - เรียกจาก `BookingController::triggerDailySyncAsync()`
  - เรียกจาก `RoomController::update()` (เมื่ออัปเดต room)
  - เรียกจาก `SettingController` (เมื่อมีการตั้งค่า)
- **Request Body:** Empty
- **Timeout:** 15 seconds
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingController.php` (line 601)
  - `app/Http/Controllers/RoomController.php` (line 738)
  - `app/Http/Controllers/SettingController.php` (line 72)

#### 1.2 `/booking/admin_sync`
- **Method:** POST
- **Description:** Sync ข้อมูล admin
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการอัปเดต role ของ user
  - เรียกจาก `UserController::triggerAdminSyncAsync()`
- **Request Body:** Empty
- **Timeout:** 15 seconds
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/UserController.php` (line 187)

#### 1.3 `/booking/admin_remove/{id}`
- **Method:** GET
- **Description:** ลบ admin ออกจากระบบ
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการลบ role admin ของ user
  - เรียกจาก `UserController::triggerAdminRemoveAsync($id)`
- **Timeout:** 15 seconds
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/UserController.php` (line 228)

#### 1.4 `/booking/request`
- **Method:** POST
- **Description:** ส่งข้อมูลการจองไปยัง backend
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการอนุมัติการจอง (approve)
  - เมื่อมีการสร้างการจองใหม่
  - เรียกจาก `BookingRequestController::sendBookingRequest()`
- **Request Body:**
  ```json
  {
    "booking_id": "123"
  }
  ```
- **Timeout:** 0 (no timeout)
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 1172, 1488)

#### 1.5 `/booking/cancel`
- **Method:** POST
- **Description:** ยกเลิกการจอง
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการยกเลิกหรือปฏิเสธการจอง (cancel/reject)
  - เรียกจาก `BookingRequestController::updateStatus()`
- **Request Body:**
  ```json
  {
    "booking_id": "123"
  }
  ```
- **Timeout:** 0 (no timeout)
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 1148)

#### 1.6 `/booking/edit`
- **Method:** POST
- **Description:** แก้ไขการจอง
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการแก้ไขการจอง
  - เรียกจาก `BookingRequestController::editBookingRequest()`
- **Request Body:**
  ```json
  {
    "booking_id": "123"
  }
  ```
- **Timeout:** 0 (no timeout)
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 1515)

---

### 2. **User/Face Recognition API** (`http://10.1.244.42`)
**Base URL:** `http://10.1.244.42`

#### 2.1 `/user/AddFace`
- **Method:** POST
- **Description:** เพิ่มรูปภาพใบหน้า
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการอัปโหลดรูปภาพ visitor
  - เมื่อมีการอัปโหลดรูปภาพ profile
  - เรียกจาก `VisitorController::store()`
  - เรียกจาก `ProfileController::updateProfile()`
- **Request Body:**
  ```json
  {
    "Username": "username",
    "Image": "base64_image_string"
  }
  ```
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/VisitorController.php` (line 323)
  - `app/Http/Controllers/ProfileController.php` (line 145)

#### 2.2 `/user/GetFace`
- **Method:** POST
- **Description:** ดึงรูปภาพใบหน้า
- **เมื่อไหร่เรียกใช้:**
  - เมื่อ login (เพื่อดึงรูปภาพผู้ใช้)
  - เมื่อดู profile
  - เรียกจาก `LoginController::getFaceImage()`
  - เรียกจาก `DashboardController::getFaceImage()`
  - เรียกจาก `ProfileController::getFaceImage()`
- **Request Body:**
  ```json
  {
    "Username": "username"
  }
  ```
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/Auth/LoginController.php` (line 300)
  - `app/Http/Controllers/DashboardController.php` (line 988)
  - `app/Http/Controllers/ProfileController.php` (line 89)

---

### 3. **Encryption/Decryption API** (`http://10.1.244.42`)
**Base URL:** `http://10.1.244.42`

#### 3.1 `/encrypt`
- **Method:** POST
- **Description:** เข้ารหัส password
- **เมื่อไหร่เรียกใช้:**
  - เมื่อสร้าง/แก้ไข device (เพื่อเข้ารหัส password)
  - เรียกจาก `DeviceController::store()` และ `update()`
- **Request Body:**
  ```json
  {
    "Password": "plain_password",
    "Code": "Agri@cmu@2024"
  }
  ```
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/DeviceController.php` (line 137, 219)

#### 3.2 `/decrypt`
- **Method:** POST
- **Description:** ถอดรหัส password
- **เมื่อไหร่เรียกใช้:**
  - เมื่อต้องการใช้ password ของ device (เช่น เปิดประตู)
  - เรียกจาก `RoomController::controlDoor()`
  - เรียกจาก `DashboardController::decryptPassword()`
- **Request Body:**
  ```json
  {
    "Password": "encrypted_password",
    "Code": "CW@MJU@2025"  // หรือ "Agri@cmu@2024"
  }
  ```
- **Timeout:** 30 seconds
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/RoomController.php` (line 514)
  - `app/Http/Controllers/DashboardController.php` (line 805)

---

### 4. **Hikvision Camera API** (`http://{device_ip}`)
**Base URL:** `http://{device_ip}` (IP ของ device)

#### 4.1 `/ISAPI/AccessControl/RemoteControl/door/1`
- **Method:** PUT
- **Description:** ควบคุมประตู (เปิด/ปิด)
- **เมื่อไหร่เรียกใช้:**
  - เมื่อผู้ใช้กดปุ่มเปิด/ปิดประตู
  - เรียกจาก `RoomController::controlDoor()`
- **Authentication:** Digest Auth (username:password)
- **Request Body (XML):**
  ```xml
  <RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
    <cmd>open</cmd>  <!-- หรือ close, alwaysOpen, alwaysClose -->
    <password></password>
  </RemoteControlDoor>
  ```
- **Timeout:** 0 (no timeout)
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/RoomController.php` (line 574)

#### 4.2 `/hikapi/eventImage?eventId={eventId}`
- **Method:** GET
- **Description:** ดึงรูปภาพจาก event
- **เมื่อไหร่เรียกใช้:**
  - เมื่อต้องการดูรูปภาพจาก access event
  - เรียกจาก `DashboardController::getEventImage()`
- **Base URL:** `http://10.1.244.42:8100`
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/DashboardController.php` (line 1022)

---

### 5. **Microsoft Graph API** (`https://graph.microsoft.com`)
**Base URL:** `https://graph.microsoft.com/v1.0`

#### 5.1 `/users/{email}/sendMail`
- **Method:** POST
- **Description:** ส่งอีเมลผ่าน Microsoft Graph
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการส่งอีเมลแจ้งสถานะการจอง
  - เรียกจาก `BookingRequestController::sendBookingStatusEmail()`
  - เรียกจาก `BookingRequestController::sendBookingConfirmationEmail()`
- **Authentication:** OAuth 2.0 (Client Credentials)
- **Request Body:**
  ```json
  {
    "message": {
      "subject": "...",
      "body": {
        "contentType": "HTML",
        "content": "..."
      },
      "toRecipients": [...]
    }
  }
  ```
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 456, 998, 1324)
  - `app/Http/Controllers/ReportController.php` (line 191)

#### 5.2 `/users/{email}/calendar/events`
- **Method:** POST
- **Description:** สร้าง calendar event
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการอนุมัติการจอง (เพื่อสร้าง calendar event)
  - เรียกจาก `BookingRequestController::createCalendarEvent()`
- **Authentication:** OAuth 2.0 (Client Credentials)
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 834)

#### 5.3 OAuth Token Endpoint
- **URL:** `https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token`
- **Method:** POST
- **Description:** ขอ access token สำหรับ Microsoft Graph
- **เมื่อไหร่เรียกใช้:**
  - ก่อนเรียกใช้ Microsoft Graph API
  - เรียกจาก `BookingRequestController::getMicrosoftGraphToken()`
  - เรียกจาก `ReportController::getMicrosoftGraphToken()`
- **Grant Type:** `client_credentials`
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 1043)
  - `app/Http/Controllers/ReportController.php` (line 153)

---

### 6. **Microsoft Graph Login API** (`https://login.microsoftonline.com`)
**Base URL:** `https://login.microsoftonline.com`

#### 6.1 `/{TENANT_ID}/oauth2/v2.0/token` (Login)
- **Method:** POST
- **Description:** ขอ access token สำหรับ login
- **เมื่อไหร่เรียกใช้:**
  - เมื่อผู้ใช้ login ด้วย Microsoft Account
  - เรียกจาก `LoginController::handleMicrosoftCallback()`
- **Grant Type:** `authorization_code`
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/Auth/LoginController.php` (line 368)

#### 6.2 `/v1.0/me`
- **Method:** GET
- **Description:** ดึงข้อมูลผู้ใช้ที่ login
- **เมื่อไหร่เรียกใช้:**
  - หลังจาก login สำเร็จ
  - เรียกจาก `LoginController::handleMicrosoftCallback()`
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/Auth/LoginController.php` (line 391)

---

### 7. **CMU OAuth API** (`https://oauth.cmu.ac.th`)
**Base URL:** `https://oauth.cmu.ac.th`

#### 7.1 `/v1/GetToken.aspx`
- **Method:** POST
- **Description:** ขอ access token จาก CMU OAuth
- **เมื่อไหร่เรียกใช้:**
  - เมื่อผู้ใช้ login ด้วย CMU Account
  - เรียกจาก `LoginController::handleCmuCallback()`
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/Auth/LoginController.php` (line 520)

#### 7.2 CMU API (`https://misapi.cmu.ac.th`)
- **URL:** `https://misapi.cmu.ac.th/cmuitaccount/v1/api/cmuitaccount/basicinfo`
- **Method:** GET
- **Description:** ดึงข้อมูลผู้ใช้จาก CMU API
- **เมื่อไหร่เรียกใช้:**
  - หลังจาก login ด้วย CMU Account สำเร็จ
  - เรียกจาก `LoginController::getCmuUserInfo()`
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/Auth/LoginController.php` (line 495)

---

### 8. **LINE API** (`https://library.agri.cmu.ac.th`)
**Base URL:** `https://library.agri.cmu.ac.th/line-api-booking`

#### 8.1 `/linemessageapi.php`
- **Method:** POST
- **Description:** ส่งข้อความ LINE
- **เมื่อไหร่เรียกใช้:**
  - เมื่อมีการส่งการแจ้งเตือนผ่าน LINE
  - เรียกจาก `BookingRequestController::sendLineMessage()`
- **Request Body:**
  ```json
  {
    "message": "ข้อความที่ต้องการส่ง"
  }
  ```
- **SSL Verification:** Disabled
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 31)

---

### 9. **Home Assistant API** (`http://10.1.244.43:8123`)
**Base URL:** `http://10.1.244.43:8123/api`

#### 9.1 `/states`
- **Method:** GET
- **Description:** ดึงข้อมูล sensors จาก Home Assistant
- **เมื่อไหร่เรียกใช้:**
  - เมื่อต้องการดึงข้อมูล Air Detector
  - เรียกจาก `DashboardController::getAirDetectorData()`
  - เรียกจาก `DeviceController::getHomeAssistantStates()`
- **Authentication:** Bearer Token (Long-lived token)
- **Headers:**
  ```
  Authorization: Bearer {HA_LONG_LIVED_TOKEN}
  Content-Type: application/json
  ```
- **Timeout:** 10 seconds
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/DashboardController.php` (line 611)
  - `app/Http/Controllers/DeviceController.php` (line 526)

---

### 10. **QR Code API** (`https://api.qrserver.com`)
**Base URL:** `https://api.qrserver.com/v1`

#### 10.1 `/create-qr-code/`
- **Method:** GET
- **Description:** สร้าง QR Code
- **เมื่อไหร่เรียกใช้:**
  - เมื่อต้องการแสดง QR Code ในอีเมล
  - เรียกจาก `BookingRequestController::sendBookingConfirmationEmail()`
- **Parameters:**
  - `size`: `200x200`
  - `data`: QR code data (URL encoded)
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 972)

---

### 11. **External Image URLs**
#### 11.1 MJU Logo
- **URL:** `https://www.mju.ac.th/th/images/mju_logo_main-resize.png`
- **Description:** Logo มหาวิทยาลัยแม่โจ้
- **เมื่อไหร่เรียกใช้:**
  - เมื่อส่งอีเมล (เพื่อแสดง logo)
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/BookingRequestController.php` (line 419, 977, 1275)

#### 11.2 Booking Image
- **URL:** `https://booking.mju.ac.th/storage/...`
- **Description:** รูปภาพห้องที่อัปโหลด
- **เมื่อไหร่เรียกใช้:**
  - เมื่อแสดงรายละเอียดห้อง
- **ไฟล์ที่ใช้:**
  - `app/Http/Controllers/RoomController.php` (line 234)

---

## 📅 สรุปการเรียกใช้ API ตามช่วงเวลา

### **Real-time (เมื่อผู้ใช้ทำ action)**
1. `/booking/request` - เมื่ออนุมัติการจอง
2. `/booking/cancel` - เมื่อยกเลิก/ปฏิเสธการจอง
3. `/booking/edit` - เมื่อแก้ไขการจอง
4. `/user/AddFace` - เมื่ออัปโหลดรูปภาพ
5. `/user/GetFace` - เมื่อ login หรือดู profile
6. `/encrypt` - เมื่อสร้าง/แก้ไข device
7. `/decrypt` - เมื่อต้องการใช้ password (เช่น เปิดประตู)
8. `/ISAPI/AccessControl/RemoteControl/door/1` - เมื่อควบคุมประตู
9. Microsoft Graph APIs - เมื่อส่งอีเมลหรือสร้าง calendar event
10. LINE API - เมื่อส่งการแจ้งเตือน
11. Home Assistant API - เมื่อดึงข้อมูล sensors

### **Async/Background (ไม่รอ response)**
1. `/booking/daily_sync` - เรียกหลังจากสร้าง/อัปเดต/ลบการจอง
2. `/booking/admin_sync` - เรียกหลังจากอัปเดต role
3. `/booking/admin_remove/{id}` - เรียกหลังจากลบ role admin

---

## 🔐 Authentication & Security

### **No Authentication:**
- `http://10.1.244.42/*` (Booking Backend API)
- `http://10.1.244.42:8100/*` (Hikvision API)
- `https://api.qrserver.com/*` (QR Code API)
- `https://www.mju.ac.th/*` (Image URLs)

### **Bearer Token:**
- Home Assistant API (`Authorization: Bearer {token}`)

### **Digest Auth:**
- Hikvision Camera API (`CURLAUTH_DIGEST`)

### **OAuth 2.0:**
- Microsoft Graph API (Client Credentials)
- Microsoft Graph Login (Authorization Code)
- CMU OAuth (Authorization Code)

### **SSL Verification:**
- ส่วนใหญ่ **disabled** (`CURLOPT_SSL_VERIFYPEER => false`)

---

## ⚠️ หมายเหตุสำคัญ

1. **IP Address:** `10.1.244.42` และ `10.1.244.43` เป็น internal IP ต้องอยู่ใน network เดียวกัน
2. **Timeout:** บาง API ใช้ timeout 0 (ไม่จำกัดเวลา) ซึ่งอาจทำให้ request ค้างได้
3. **Error Handling:** ส่วนใหญ่มี try-catch และ log error แต่ไม่มีการ retry
4. **SSL Verification:** ส่วนใหญ่ disabled เพื่อความสะดวก แต่ไม่ปลอดภัย

---

## 📝 ไฟล์ที่เกี่ยวข้อง

- `app/Http/Controllers/BookingRequestController.php`
- `app/Http/Controllers/BookingController.php`
- `app/Http/Controllers/UserController.php`
- `app/Http/Controllers/RoomController.php`
- `app/Http/Controllers/VisitorController.php`
- `app/Http/Controllers/DeviceController.php`
- `app/Http/Controllers/DashboardController.php`
- `app/Http/Controllers/Auth/LoginController.php`
- `app/Http/Controllers/ProfileController.php`
- `app/Http/Controllers/ReportController.php`
- `app/Http/Controllers/SettingController.php`
