# คู่มือ AM319 Sensor API

## ภาพรวม

API นี้ใช้สำหรับดึงข้อมูลจาก AM319 Sensor ผ่าน Home Assistant โดยรองรับการดึงข้อมูล sensor ต่างๆ:
- CO2 (Carbon Dioxide)
- HCHO (Formaldehyde)
- Humidity (ความชื้น)
- Motion (การเคลื่อนไหว)
- PM2.5 (ฝุ่นละอองขนาดเล็ก)
- PM10 (ฝุ่นละอองขนาดใหญ่)
- Pressure (ความดันอากาศ)
- Temperature (อุณหภูมิ)
- TVOC (Total Volatile Organic Compounds)

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

### 1. ดึงข้อมูล AM319 Sensor ทั้งหมด

**Method:** `GET`  
**URL:** `http://localhost:5000/api/devices/sensor/am319`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "ดึงข้อมูล AM319 Sensor สำเร็จ",
  "data": {
    "formatted": {
      "co2": "450",
      "hcho": "0.02",
      "humidity": "57",
      "motion": "on",
      "pm2_5": "46",
      "pm10": "55",
      "pressure": "978.3",
      "temperature": "25.8",
      "tvoc": "1.45"
    },
    "raw": {
      "sensor.am319_am319_co2": {
        "state": "450",
        "attributes": {
          "unit_of_measurement": "ppm",
          "friendly_name": "AM319 CO2",
          "device_class": "carbon_dioxide"
        },
        "last_changed": "2026-02-11T15:30:00.000Z",
        "last_updated": "2026-02-11T15:30:00.000Z"
      },
      "sensor.am319_am319_temperature": {
        "state": "25.8",
        "attributes": {
          "unit_of_measurement": "°C",
          "friendly_name": "AM319 Temperature",
          "device_class": "temperature"
        },
        "last_changed": "2026-02-11T15:30:00.000Z",
        "last_updated": "2026-02-11T15:30:00.000Z"
      }
      // ... sensors อื่นๆ
    },
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

### 2. ดึงข้อมูล Sensor ตัวเดียว

**Method:** `GET`  
**URL:** `http://localhost:5000/api/devices/sensor/{entityId}`

**Headers:**
```
Authorization: Bearer YOUR_AUTH_TOKEN
```

**ตัวอย่าง:**
```bash
GET /api/devices/sensor/sensor.am319_am319_co2
GET /api/devices/sensor/sensor.am319_am319_temperature
```

**ตัวอย่าง Response (Success):**
```json
{
  "success": true,
  "message": "ดึงข้อมูล sensor สำเร็จ",
  "data": {
    "entityId": "sensor.am319_am319_co2",
    "state": "450",
    "attributes": {
      "unit_of_measurement": "ppm",
      "friendly_name": "AM319 CO2",
      "device_class": "carbon_dioxide"
    },
    "last_changed": "2026-02-11T15:30:00.000Z",
    "last_updated": "2026-02-11T15:30:00.000Z",
    "timestamp": "2026-02-11T15:30:00.000Z"
  }
}
```

---

## Entity IDs ที่รองรับ

| Sensor | Entity ID | ประเภท | หน่วย |
|--------|-----------|--------|-------|
| CO2 | `sensor.am319_am319_co2` | Sensor | ppm |
| HCHO | `sensor.am319_am319_hcho` | Sensor | mg/m³ |
| Humidity | `sensor.am319_am319_humidity` | Sensor | % |
| Motion | `binary_sensor.am319_am319_motion` | Binary Sensor | on/off |
| PM2.5 | `sensor.am319_am319_pm2_5` | Sensor | µg/m³ |
| PM10 | `sensor.am319_am319_pm10` | Sensor | µg/m³ |
| Pressure | `sensor.am319_am319_pressure` | Sensor | hPa |
| Temperature | `sensor.am319_am319_temperature` | Sensor | °C |
| TVOC | `sensor.am319_am319_tvoc` | Sensor | mg/m³ |

---

## ตัวอย่าง cURL Commands

### ดึงข้อมูล AM319 Sensor ทั้งหมด
```bash
curl -X GET http://localhost:5000/api/devices/sensor/am319 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### ดึงข้อมูล CO2
```bash
curl -X GET http://localhost:5000/api/devices/sensor/sensor.am319_am319_co2 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### ดึงข้อมูลอุณหภูมิ
```bash
curl -X GET http://localhost:5000/api/devices/sensor/sensor.am319_am319_temperature \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### ดึงข้อมูล Motion
```bash
curl -X GET http://localhost:5000/api/devices/sensor/binary_sensor.am319_am319_motion \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Response Format

### Formatted Data
ข้อมูลที่ format แล้วสำหรับใช้งานง่าย:
```json
{
  "co2": "450",
  "hcho": "0.02",
  "humidity": "57",
  "motion": "on",
  "pm2_5": "46",
  "pm10": "55",
  "pressure": "978.3",
  "temperature": "25.8",
  "tvoc": "1.45"
}
```

### Raw Data
ข้อมูลดิบจาก Home Assistant พร้อม attributes:
```json
{
  "sensor.am319_am319_co2": {
    "state": "450",
    "attributes": {
      "unit_of_measurement": "ppm",
      "friendly_name": "AM319 CO2",
      "device_class": "carbon_dioxide"
    },
    "last_changed": "2026-02-11T15:30:00.000Z",
    "last_updated": "2026-02-11T15:30:00.000Z"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "กรุณาระบุ entityId"
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
  "message": "ไม่สามารถดึงข้อมูล sensor ได้: [error message]",
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

### Error: Cannot connect to Home Assistant
- ตรวจสอบว่า Home Assistant server ทำงานอยู่
- ตรวจสอบว่า URL ใน `.env` ถูกต้อง
- ตรวจสอบ network/firewall

### Error: Entity not found
- ตรวจสอบว่า entity มีอยู่ใน Home Assistant:
  - `sensor.am319_am319_co2`
  - `sensor.am319_am319_temperature`
  - `binary_sensor.am319_am319_motion`
  - และอื่นๆ
- ตรวจสอบว่า token มีสิทธิ์เข้าถึง entity เหล่านี้

### Error: Sensor data is null
- ตรวจสอบว่า sensor ทำงานอยู่และส่งข้อมูล
- ตรวจสอบว่า entity ID ถูกต้อง
- ตรวจสอบ logs ใน Home Assistant

---

## หมายเหตุ

- **Data Types**: ค่าที่ได้จาก sensor เป็น string ต้องแปลงเป็น number ถ้าต้องการคำนวณ
- **Motion Sensor**: เป็น binary sensor ที่คืนค่า "on" หรือ "off"
- **Units**: หน่วยวัดจะอยู่ใน `attributes.unit_of_measurement`
- **Timestamps**: `last_changed` และ `last_updated` เป็น ISO 8601 format

---

## ตัวอย่างการใช้งานใน Frontend

```javascript
// ดึงข้อมูล AM319 Sensor ทั้งหมด
const response = await api.get('/devices/sensor/am319')
const sensorData = response.data.data.formatted

console.log('CO2:', sensorData.co2, 'ppm')
console.log('Temperature:', sensorData.temperature, '°C')
console.log('Humidity:', sensorData.humidity, '%')
console.log('Motion:', sensorData.motion === 'on' ? 'Active' : 'Inactive')

// ดึงข้อมูล sensor ตัวเดียว
const tempResponse = await api.get('/devices/sensor/sensor.am319_am319_temperature')
const temperature = parseFloat(tempResponse.data.data.state)
```









