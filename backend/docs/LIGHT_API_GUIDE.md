# Light Control API Guide

API สำหรับควบคุมไฟผ่าน Home Assistant

## Setup

ตรวจสอบว่า Home Assistant ตั้งค่าใน `.env`:
```env
HOME_ASSISTANT_URL=http://your-home-assistant-url:8123
HOME_ASSISTANT_TOKEN=your-token
```

## Endpoints

### 1. เปิด/ปิดไฟ

**POST** `/api/devices/light/:entityId/control`

**Parameters:**
- `entityId` (path): Entity ID ของไฟ เช่น `light.lights_17`

**Body:**
```json
{
  "action": "on"  // หรือ "off"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/devices/light/light.lights_17/control \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "on"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "เปิดสำเร็จ",
  "data": {
    "entityId": "light.lights_17",
    "action": "on",
    "timestamp": "2026-02-12T08:30:00.000Z"
  }
}
```

### 2. ดึงสถานะไฟ

**GET** `/api/devices/light/:entityId/status`

**Parameters:**
- `entityId` (path): Entity ID ของไฟ เช่น `light.lights_17`

**Example Request:**
```bash
curl -X GET http://localhost:5000/api/devices/light/light.lights_17/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response:**
```json
{
  "success": true,
  "message": "ดึงสถานะไฟสำเร็จ",
  "data": {
    "entityId": "light.lights_17",
    "state": {
      "entity_id": "light.lights_17",
      "state": "on",
      "attributes": {
        "friendly_name": "Lights 1",
        "brightness": 255,
        "color_temp": 500,
        ...
      }
    },
    "timestamp": "2026-02-12T08:30:00.000Z"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "กรุณาระบุ action เป็น \"on\" หรือ \"off\""
}
```

### 503 Service Unavailable
```json
{
  "success": false,
  "message": "Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "ไม่สามารถเปิดไฟได้: Entity not found",
  "error": "ไม่สามารถเปิดไฟได้: Entity not found"
}
```

## Notes

- API นี้ใช้ `homeAssistantService.controlSwitch()` ซึ่งรองรับทั้ง `switch` และ `light` entities
- Light entity ใช้ `turn_on` และ `turn_off` services เหมือน switch
- ต้องมี authentication token ใน header ทุก request









