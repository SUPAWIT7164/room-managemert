# Home Assistant Air Control API

API สำหรับควบคุมแอร์ผ่าน Home Assistant

## การตั้งค่า Environment Variables

เพิ่มในไฟล์ `.env`:

```env
# Home Assistant Configuration (บรรทัด 39-40)
HOME_ASSISTANT_URL=http://your-home-assistant-url:8123
HOME_ASSISTANT_TOKEN=your-long-lived-access-token
HOME_ASSISTANT_TIMEOUT=10000
```

หรือใช้ชื่อตัวแปรแบบย่อ:
```env
HA_URL=http://your-home-assistant-url:8123
HA_TOKEN=your-long-lived-access-token
```

### วิธีสร้าง Long-lived Access Token

1. เปิด Home Assistant
2. ไปที่ Profile → Long-lived access tokens
3. สร้าง token ใหม่
4. คัดลอก token มาใส่ใน `.env`

## API Endpoints

### 1. เปิด/ปิดแอร์

**POST** `/api/device/air/:deviceId/control`

**Parameters:**
- `deviceId` (URL parameter): Device ID เช่น `CC3F1D03BAE3`

**Request Body:**
```json
{
  "action": "on",  // หรือ "off"
  "temperature": 25,  // (optional) อุณหภูมิที่ต้องการ
  "hvac_mode": "cool"  // (optional) "cool", "heat", "auto", "off"
}
```

**Response:**
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

**ตัวอย่างการใช้งาน:**

```bash
# เปิดแอร์
curl -X POST http://localhost:5000/api/device/air/CC3F1D03BAE3/control \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "on",
    "temperature": 25,
    "hvac_mode": "cool"
  }'

# ปิดแอร์
curl -X POST http://localhost:5000/api/device/air/CC3F1D03BAE3/control \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "off"
  }'
```

---

### 2. ตั้งค่าอุณหภูมิ

**POST** `/api/device/air/:deviceId/temperature`

**Request Body:**
```json
{
  "temperature": 26
}
```

**Response:**
```json
{
  "success": true,
  "message": "ตั้งอุณหภูมิเป็น 26°C สำเร็จ",
  "data": {
    "deviceId": "CC3F1D03BAE3",
    "entityId": "climate.air_02",
    "temperature": 26,
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

**ตัวอย่าง:**
```bash
curl -X POST http://localhost:5000/api/device/air/CC3F1D03BAE3/temperature \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"temperature": 26}'
```

---

### 3. ตั้งค่าโหมด (HVAC Mode)

**POST** `/api/device/air/:deviceId/mode`

**Request Body:**
```json
{
  "hvac_mode": "cool"  // "cool", "heat", "auto", "off"
}
```

**Response:**
```json
{
  "success": true,
  "message": "ตั้งค่าโหมดเป็น cool สำเร็จ",
  "data": {
    "deviceId": "CC3F1D03BAE3",
    "entityId": "climate.air_02",
    "hvac_mode": "cool",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

**ตัวอย่าง:**
```bash
curl -X POST http://localhost:5000/api/device/air/CC3F1D03BAE3/mode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"hvac_mode": "cool"}'
```

---

### 4. ดึงสถานะแอร์

**GET** `/api/device/air/:deviceId/status`

**Response:**
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

**ตัวอย่าง:**
```bash
curl -X GET http://localhost:5000/api/device/air/CC3F1D03BAE3/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## หมายเหตุ

- ทุก API endpoint ต้องมี Authentication token
- Device ID (`CC3F1D03BAE3`) ใช้สำหรับ logging/reference เท่านั้น
- Entity ID ที่ใช้จริงคือ `climate.air_02` (hardcoded ตามที่ระบุ)
- อุณหภูมิต้องอยู่ระหว่าง 16-30 องศาเซลเซียส










