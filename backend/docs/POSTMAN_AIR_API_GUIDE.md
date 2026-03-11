# คู่มือทดสอบ Air Control API ผ่าน Postman

## ข้อกำหนดเบื้องต้น

1. **Backend server ต้องทำงานอยู่** (`http://localhost:5000`)
2. **ต้องมี Authentication token** (ได้จาก login API)
3. **ต้องตั้งค่า Home Assistant ใน `.env`:**
   ```env
   HA_URL=http://your-home-assistant-url:8123
   HA_LONG_LIVED_TOKEN=your-token-here
   ```

---

## ขั้นตอนการทดสอบใน Postman

### 1. เปิดแอร์ (Turn On)

**Method:** `POST`  
**URL:** `http://localhost:5000/api/device/air/CC3F1D03BAE3/control`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (raw JSON):**
```json
{
  "action": "on",
  "temperature": 25,
  "hvac_mode": "cool"
}
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "เปิดแอร์สำเร็จ",
  "data": {
    "deviceId": "CC3F1D03BAE3",
    "entityId": "climate.air_02",
    "action": "on",
    "temperature": 25,
    "hvac_mode": "cool",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

### 2. ปิดแอร์ (Turn Off)

**Method:** `POST`  
**URL:** `http://localhost:5000/api/device/air/CC3F1D03BAE3/control`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (raw JSON):**
```json
{
  "action": "off"
}
```

---

### 3. ตั้งค่าอุณหภูมิ

**Method:** `POST`  
**URL:** `http://localhost:5000/api/device/air/CC3F1D03BAE3/temperature`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (raw JSON):**
```json
{
  "temperature": 26
}
```

---

### 4. ตั้งค่าโหมด (HVAC Mode)

**Method:** `POST`  
**URL:** `http://localhost:5000/api/device/air/CC3F1D03BAE3/mode`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (raw JSON):**
```json
{
  "hvac_mode": "cool"
}
```

**ค่า `hvac_mode` ที่ใช้ได้:**
- `"cool"` - โหมดเย็น
- `"heat"` - โหมดร้อน
- `"auto"` - อัตโนมัติ
- `"off"` - ปิด

---

### 5. ดึงสถานะแอร์

**Method:** `GET`  
**URL:** `http://localhost:5000/api/device/air/CC3F1D03BAE3/status`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**ตัวอย่าง Response:**
```json
{
  "success": true,
  "message": "ดึงสถานะแอร์สำเร็จ",
  "data": {
    "deviceId": "CC3F1D03BAE3",
    "entityId": "climate.air_02",
    "state": {
      "entity_id": "climate.air_02",
      "state": "cool",
      "attributes": {
        "temperature": 25,
        "current_temperature": 26,
        "hvac_modes": ["cool", "heat", "auto", "off"],
        ...
      }
    },
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

## วิธีใช้ Postman

### ขั้นตอนที่ 1: สร้าง Collection

1. เปิด Postman
2. คลิก **New** → **Collection**
3. ตั้งชื่อว่า "Air Control API"

### ขั้นตอนที่ 2: ตั้งค่า Environment Variables

1. คลิก **Environments** (ซ้ายล่าง)
2. สร้าง Environment ใหม่ชื่อ "Local Dev"
3. เพิ่ม variables:
   - `base_url` = `http://localhost:5000`
   - `auth_token` = `YOUR_AUTH_TOKEN` (ใส่ token จาก login)
   - `device_id` = `CC3F1D03BAE3`

### ขั้นตอนที่ 3: สร้าง Request

1. ใน Collection "Air Control API" → คลิก **Add Request**
2. ตั้งชื่อ: "เปิดแอร์"
3. เลือก Method: **POST**
4. URL: `{{base_url}}/api/device/air/{{device_id}}/control`
5. **Headers:**
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer {{auth_token}}`
6. **Body:**
   - เลือก **raw** → **JSON**
   - ใส่:
   ```json
   {
     "action": "on",
     "temperature": 25,
     "hvac_mode": "cool"
   }
   ```
7. คลิก **Send**

---

## ตัวอย่าง cURL Commands

### เปิดแอร์
```bash
curl -X POST http://localhost:5000/api/device/air/CC3F1D03BAE3/control \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "action": "on",
    "temperature": 25,
    "hvac_mode": "cool"
  }'
```

### ปิดแอร์
```bash
curl -X POST http://localhost:5000/api/device/air/CC3F1D03BAE3/control \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "action": "off"
  }'
```

### ตั้งอุณหภูมิ
```bash
curl -X POST http://localhost:5000/api/device/air/CC3F1D03BAE3/temperature \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "temperature": 26
  }'
```

### ดึงสถานะ
```bash
curl -X GET http://localhost:5000/api/device/air/CC3F1D03BAE3/status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## วิธีดึง Authentication Token

### ผ่าน Login API

**POST** `http://localhost:5000/api/auth/login`

**Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    ...
  }
}
```

คัดลอก `token` มาใช้ใน Authorization header

---

## Troubleshooting

### Error: 401 Unauthorized
- ตรวจสอบว่าใส่ Authorization header ถูกต้อง
- ตรวจสอบว่า token ยังไม่หมดอายุ
- ลอง login ใหม่เพื่อได้ token ใหม่

### Error: Home Assistant ไม่ได้ตั้งค่า
- ตรวจสอบว่า `.env` มี `HA_URL` และ `HA_LONG_LIVED_TOKEN`
- Restart backend server หลังแก้ `.env`

### Error: Cannot connect to Home Assistant
- ตรวจสอบว่า Home Assistant server ทำงานอยู่
- ตรวจสอบว่า URL ใน `.env` ถูกต้อง
- ตรวจสอบ network/firewall

### Error: Entity not found
- ตรวจสอบว่า entity `climate.air_02` มีอยู่ใน Home Assistant
- ตรวจสอบว่า token มีสิทธิ์เข้าถึง entity นี้










