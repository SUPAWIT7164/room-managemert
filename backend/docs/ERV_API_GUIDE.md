# คู่มือ ERV Control API ผ่าน Home Assistant

## ภาพรวม

API นี้ใช้สำหรับควบคุม ERV (Energy Recovery Ventilation) ผ่าน Home Assistant โดยรองรับ:
- เปิด/ปิด ERV (`switch.erv_u1_power`)
- ตั้งค่าโหมด ERV (`script.erv_u1_mode_heat`, `script.erv_u1_mode_normal`)
- ตั้งค่าระดับ ERV (`script.erv_u1_air_low`, `script.erv_u1_air_high`)

---

## ข้อกำหนดเบื้องต้น

1. **Backend server ต้องทำงานอยู่** (`http://localhost:5000`)
2. **ต้องมี Authentication token** (ได้จาก login API)
3. **ต้องตั้งค่า Home Assistant ใน `.env`:**
   ```env
   HA_URL=http://your-home-assistant-url:8123
   HA_LONG_LIVED_TOKEN=your-token-here
   ```

---

## API Endpoints

### 1. เปิด/ปิด ERV

**Method:** `POST`  
**URL:** `http://localhost:5000/api/devices/erv/{deviceId}/control`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (raw JSON):**
```json
{
  "action": "on"
}
```

หรือ

```json
{
  "action": "off"
}
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "เปิดสำเร็จ",
  "data": {
    "deviceId": "ERV_U1",
    "entityId": "switch.erv_u1_power",
    "action": "on",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

### 2. ตั้งค่าโหมด ERV

**Method:** `POST`  
**URL:** `http://localhost:5000/api/devices/erv/{deviceId}/mode`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (raw JSON):**

**โหมด Heat:**
```json
{
  "mode": "heat"
}
```

**โหมด Normal:**
```json
{
  "mode": "normal"
}
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "เรียก script สำเร็จ",
  "data": {
    "deviceId": "ERV_U1",
    "entityId": "script.erv_u1_mode_heat",
    "mode": "heat",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

### 3. ตั้งค่าระดับ ERV

**Method:** `POST`  
**URL:** `http://localhost:5000/api/devices/erv/{deviceId}/level`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Body (raw JSON):**

**ระดับต่ำ (Low):**
```json
{
  "level": "low"
}
```

**ระดับสูง (High):**
```json
{
  "level": "high"
}
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "เรียก script สำเร็จ",
  "data": {
    "deviceId": "ERV_U1",
    "entityId": "script.erv_u1_air_low",
    "level": "low",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

### 4. ดึงสถานะ ERV

**Method:** `GET`  
**URL:** `http://localhost:5000/api/devices/erv/{deviceId}/status`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**ตัวอย่าง Response:**
```json
{
  "success": true,
  "message": "ดึงสถานะ ERV สำเร็จ",
  "data": {
    "deviceId": "ERV_U1",
    "entityId": "switch.erv_u1_power",
    "state": {
      "entity_id": "switch.erv_u1_power",
      "state": "on",
      "attributes": {
        "friendly_name": "ERV U1 Power",
        ...
      },
      "last_changed": "2026-02-11T15:30:00.000Z",
      "last_updated": "2026-02-11T15:30:00.000Z"
    },
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

## ตัวอย่าง cURL Commands

### เปิด ERV
```bash
curl -X POST http://localhost:5000/api/devices/erv/ERV_U1/control \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "action": "on"
  }'
```

### ปิด ERV
```bash
curl -X POST http://localhost:5000/api/devices/erv/ERV_U1/control \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "action": "off"
  }'
```

### ตั้งค่าโหมด Heat
```bash
curl -X POST http://localhost:5000/api/devices/erv/ERV_U1/mode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "mode": "heat"
  }'
```

### ตั้งค่าโหมด Normal
```bash
curl -X POST http://localhost:5000/api/devices/erv/ERV_U1/mode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "mode": "normal"
  }'
```

### ตั้งค่าระดับต่ำ
```bash
curl -X POST http://localhost:5000/api/devices/erv/ERV_U1/level \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "level": "low"
  }'
```

### ตั้งค่าระดับสูง
```bash
curl -X POST http://localhost:5000/api/devices/erv/ERV_U1/level \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "level": "high"
  }'
```

### ดึงสถานะ
```bash
curl -X GET http://localhost:5000/api/devices/erv/ERV_U1/status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Entity IDs ที่ใช้

| ฟังก์ชัน | Entity ID | ประเภท |
|---------|-----------|--------|
| เปิด/ปิด ERV | `switch.erv_u1_power` | Switch |
| โหมด Heat | `script.erv_u1_mode_heat` | Script |
| โหมด Normal | `script.erv_u1_mode_normal` | Script |
| ระดับต่ำ | `script.erv_u1_air_low` | Script |
| ระดับสูง | `script.erv_u1_air_high` | Script |

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "กรุณาระบุ action เป็น \"on\" หรือ \"off\""
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "กรุณาเข้าสู่ระบบ"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "ไม่สามารถเปิดได้: [error message]",
  "error": "[error message]"
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "message": "Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)"
}
```

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
- ตรวจสอบว่า entity มีอยู่ใน Home Assistant:
  - `switch.erv_u1_power`
  - `script.erv_u1_mode_heat`
  - `script.erv_u1_mode_normal`
  - `script.erv_u1_air_low`
  - `script.erv_u1_air_high`
- ตรวจสอบว่า token มีสิทธิ์เข้าถึง entity เหล่านี้

---

## หมายเหตุ

- **Device ID**: สามารถใช้ device ID ใดก็ได้ (เช่น `ERV_U1`, `ERV1`, `1`) เพราะระบบจะใช้ entity ID ที่ hardcode ไว้
- **Script Execution**: การเรียก script จะทำงานแบบ asynchronous ใน Home Assistant
- **State Updates**: สถานะอาจจะไม่ update ทันทีหลังเรียก script ควรใช้ polling หรือ webhook เพื่อตรวจสอบสถานะ









