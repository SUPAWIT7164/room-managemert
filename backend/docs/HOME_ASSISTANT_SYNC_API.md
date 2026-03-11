# คู่มือ Home Assistant Sync API

## ภาพรวม

API นี้ใช้สำหรับดึงสถานะอุปกรณ์ (แอร์และ ERV) จาก Home Assistant และบันทึกลงในฐานข้อมูลอัตโนมัติ

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

### 1. Sync สถานะแอร์

**Method:** `POST`  
**URL:** `http://localhost:5000/api/devices/sync/air/{deviceId}`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**ตัวอย่าง:**
```bash
POST /api/devices/sync/air/CC3F1D03BAE3
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "Sync สถานะแอร์สำเร็จ",
  "data": {
    "success": true,
    "deviceId": "CC3F1D03BAE3",
    "roomId": 28,
    "deviceType": "ac",
    "deviceIndex": 1,
    "status": true,
    "settings": {
      "mode": "cool",
      "temperature": 25,
      "current_temperature": 26,
      "fan_mode": "auto"
    },
    "haState": "cool",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

### 2. Sync สถานะ ERV

**Method:** `POST`  
**URL:** `http://localhost:5000/api/devices/sync/erv/{deviceId}`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**ตัวอย่าง:**
```bash
POST /api/devices/sync/erv/ERV_U1
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "Sync สถานะ ERV สำเร็จ",
  "data": {
    "success": true,
    "deviceId": "ERV_U1",
    "roomId": 28,
    "deviceType": "erv",
    "deviceIndex": 0,
    "status": true,
    "settings": {
      "mode": "normal",
      "speed": "low"
    },
    "haState": "on",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

### 3. Sync ทุกอุปกรณ์

**Method:** `POST`  
**URL:** `http://localhost:5000/api/devices/sync/all`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "Sync สำเร็จ: 2 อุปกรณ์, ล้มเหลว: 0 อุปกรณ์",
  "data": {
    "success": [
      {
        "success": true,
        "deviceId": "CC3F1D03BAE3",
        "roomId": 28,
        "deviceType": "ac",
        "deviceIndex": 1,
        "status": true,
        "settings": {
          "mode": "cool",
          "temperature": 25
        },
        "haState": "cool",
        "timestamp": "2026-02-11T15:30:00.000Z"
      },
      {
        "success": true,
        "deviceId": "ERV_U1",
        "roomId": 28,
        "deviceType": "erv",
        "deviceIndex": 0,
        "status": true,
        "settings": {
          "mode": "normal",
          "speed": "low"
        },
        "haState": "on",
        "timestamp": "2026-02-11T15:30:00.000Z"
      }
    ],
    "failed": []
  }
}
```

---

## ตัวอย่าง cURL Commands

### Sync สถานะแอร์
```bash
curl -X POST http://localhost:5000/api/devices/sync/air/CC3F1D03BAE3 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Sync สถานะ ERV
```bash
curl -X POST http://localhost:5000/api/devices/sync/erv/ERV_U1 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Sync ทุกอุปกรณ์
```bash
curl -X POST http://localhost:5000/api/devices/sync/all \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Device Mappings

ระบบจะ sync อุปกรณ์ตาม mapping ที่กำหนดไว้:

| Device ID | Room ID | Device Type | Device Index | Entity ID |
|-----------|---------|-------------|--------------|-----------|
| CC3F1D03BAE3 | 28 | ac | 1 | climate.air_02 |
| ERV_U1 | 28 | erv | 0 | switch.erv_u1_power |

---

## Auto-Sync

ระบบจะทำการ sync อัตโนมัติเมื่อมีการควบคุมอุปกรณ์ผ่าน API:
- เมื่อเปิด/ปิดแอร์ → sync สถานะแอร์อัตโนมัติ
- เมื่อเปิด/ปิด ERV → sync สถานะ ERV อัตโนมัติ
- เมื่อตั้งค่าอุณหภูมิ/โหมด → sync สถานะแอร์อัตโนมัติ

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "ไม่พบ mapping สำหรับ device ID: INVALID_ID"
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
  "message": "ไม่สามารถ sync สถานะได้: [error message]",
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

### Error: Home Assistant ไม่ได้ตั้งค่า
- ตรวจสอบว่า `.env` มี `HA_URL` และ `HA_LONG_LIVED_TOKEN`
- Restart backend server หลังแก้ `.env`

### Error: ไม่พบ mapping สำหรับ device ID
- ตรวจสอบว่า device ID ถูกต้อง
- เพิ่ม mapping ใหม่ใน `homeAssistantSyncService.js` ถ้าจำเป็น

### Error: Entity not found
- ตรวจสอบว่า entity มีอยู่ใน Home Assistant:
  - `climate.air_02`
  - `switch.erv_u1_power`
- ตรวจสอบว่า token มีสิทธิ์เข้าถึง entity เหล่านี้

---

## การขยาย Device Mappings

หากต้องการเพิ่มอุปกรณ์ใหม่ ให้แก้ไขไฟล์ `backend/services/homeAssistantSyncService.js`:

```javascript
this.deviceMappings = {
    'NEW_DEVICE_ID': {
        roomId: 28,
        deviceType: 'ac', // หรือ 'erv'
        deviceIndex: 2,
        entityId: 'climate.new_device'
    }
};
```

---

## Scheduled Sync (Optional)

สามารถตั้งค่า scheduled job เพื่อ sync สถานะอัตโนมัติทุก X นาที โดยใช้ `node-cron`:

```javascript
const cron = require('node-cron');
const homeAssistantSyncService = require('./services/homeAssistantSyncService');

// Sync ทุก 5 นาที
cron.schedule('*/5 * * * *', async () => {
    try {
        await homeAssistantSyncService.syncAll();
        console.log('[Scheduled] Device states synced');
    } catch (error) {
        console.error('[Scheduled] Sync failed:', error.message);
    }
});
```









