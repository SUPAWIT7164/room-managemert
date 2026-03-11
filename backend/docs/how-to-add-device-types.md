# คู่มือเพิ่มประเภทอุปกรณ์ (ไฟ, แอร์, ERV หรือประเภทใหม่)

เมื่อต้องการ **เพิ่มอุปกรณ์ใหม่** (เช่น ประเภทเดิมแต่ตัวใหม่ในห้องอื่น) หรือ **เพิ่มประเภทอุปกรณ์ใหม่** (เช่น พัดลม, ม่าน) ต้องแก้หลายจุดดังนี้

---

## สรุปภาพรวม

| ลำดับ | ส่วนที่ต้องแก้ | ไฟล์/ตำแหน่ง | รายละเอียด |
|------|----------------|-------------|-------------|
| 1 | Config ประเภทอุปกรณ์ | Backend + Frontend | กำหนด key, label, icon, API path |
| 2 | Home Assistant Mapping | Backend | เชื่อม device ID กับ room + entity |
| 3 | Sync จาก HA | Backend | method ดึงสถานะจาก HA + บันทึก device_states |
| 4 | Device State Model | Backend | รองรับประเภทใหม่ใน grouped object |
| 5 | Device Model (ตำแหน่ง) | Backend | รองรับประเภทใน positions |
| 6 | Enrich สถานะจาก HA | Backend | เพิ่มประเภทใน HA_DEVICE_TYPES |
| 7 | Room Control API | Backend | รองรับ type ใหม่ใน roomController |
| 8 | Device API (สั่งงาน/สถานะ) | Backend | routes + controller สำหรับ control/sync |
| 9 | Frontend config | Frontend | DEFAULT_DEVICE_TYPES + icon/label |
| 10 | หน้า Room Control | Frontend | deviceStates, devicePositions, UI, API เรียก |

---

## 1. Backend: Config ประเภทอุปกรณ์

**ไฟล์:** `backend/config/deviceTypes.js`

- เพิ่ม object ในอาร์เรย์ `CONTROLLABLE_DEVICE_TYPES`
- กำหนดอย่างน้อย: `key`, `apiPath`, `label`, `labelEn`, `icon`, `order`
- ถ้ามีอุณหภูมิ/โหมด/ระดับ: ใส่ `hasTemperature`, `hasMode`, `hasLevel`, `hasStatus`, `syncPath`

```javascript
// ตัวอย่างเพิ่มประเภท "fan" (พัดลม)
{
  key: 'fan',
  apiPath: 'fan',           // URL: /api/devices/fan/...
  label: 'พัดลม',
  labelEn: 'Fan',
  icon: 'tabler-windmill',
  description: 'ควบคุมพัดลม',
  actions: ['on', 'off'],
  hasStatus: true,
  syncPath: 'fan',
  order: 4,
},
```

- **key** ใช้ในโค้ดและใน `device_states.device_type`
- **apiPath** ใช้ใน URL (เช่น แอร์ใช้ `air` แต่ key เป็น `ac`)

---

## 2. Home Assistant: Mapping อุปกรณ์

**ไฟล์:** `backend/services/homeAssistantSyncService.js`

### 2.1 เพิ่มใน `deviceMappings`

แต่ละอุปกรณ์ที่ต้องการ sync จาก HA ต้องมี 1 entry:

```javascript
this.deviceMappings = {
  // ตัวอย่าง: ไฟตัวที่ 2 ในห้อง Mercury
  'LIGHTS_18': {
    roomId: 28,
    deviceType: 'light',
    deviceIndex: 1,   // ตัวที่ 2 ในห้องนี้ (0-based)
    entityId: 'light.lights_18'
  },
  // แอร์ตัวใหม่ในห้องอื่น
  'CC3F1D03XXXX': {
    roomId: 28,
    deviceType: 'ac',
    deviceIndex: 2,
    entityId: 'climate.air_03'
  },
  // ...
};
```

- **Key:** ตัวระบุอุปกรณ์ (เช่น device_id, IP, หรือชื่อที่ใช้ในระบบ)
- **roomId:** id ห้องในตาราง `rooms`
- **deviceType:** ต้องตรงกับ `key` ใน `deviceTypes.js` (เช่น `light`, `ac`, `erv`)
- **deviceIndex:** ลำดับในห้องสำหรับประเภทนั้น (0, 1, 2, ...)
- **entityId:** entity ใน Home Assistant (เช่น `light.xxx`, `climate.xxx`, `switch.xxx`)

### 2.2 เพิ่ม method sync สำหรับประเภทใหม่ (ถ้าเป็นประเภทใหม่)

ถ้าเพิ่ม **ประเภทใหม่** (ไม่ใช่แค่ตัวใหม่ของ light/ac/erv) ต้องเพิ่ม method ใน class เดียวกัน เช่น:

```javascript
async syncFan(deviceId) {
  if (!homeAssistantService.isEnabled()) {
    throw new Error('Home Assistant ไม่ได้ตั้งค่า');
  }
  const mapping = this.deviceMappings[deviceId];
  if (!mapping || mapping.deviceType !== 'fan') {
    throw new Error(`ไม่พบ mapping สำหรับ device ID: ${deviceId}`);
  }
  const stateResult = await homeAssistantService.getState(mapping.entityId);
  const haState = stateResult.state;
  const isOn = haState.state === 'on';
  await DeviceState.setDeviceState(
    mapping.roomId,
    mapping.deviceType,
    mapping.deviceIndex,
    isOn,
    null
  );
  return { success: true, deviceId, status: isOn, ... };
}
```

### 2.3 ใส่ใน `syncAll()`

ใน loop ของ `syncAll()` เพิ่ม branch สำหรับประเภทใหม่:

```javascript
} else if (mapping.deviceType === 'fan') {
  const result = await this.syncFan(deviceId);
  results.success.push(result);
}
```

---

## 3. Backend: DeviceState Model

**ไฟล์:** `backend/models/DeviceState.js`

- ใน `getByRoom()` มี object `grouped` และ `maxIndices` กำหนดประเภทที่รองรับ
- **ถ้าเพิ่มประเภทใหม่** (เช่น `fan`) ต้องเพิ่มในทั้งสองที่:

```javascript
const grouped = {
  light: [],
  ac: [],
  erv: [],
  fan: []   // เพิ่ม
};
const maxIndices = { light: -1, ac: -1, erv: -1, fan: -1 };  // เพิ่ม
```

- ตาราง `device_states` ใช้คอลัมน์ `device_type` เป็น string อยู่แล้ว ไม่ต้องเปลี่ยน schema

---

## 4. Backend: Device Model (ตำแหน่งบน floor plan)

**ไฟล์:** `backend/models/Device.js`

### 4.1 getPositionsByRoom()

- ใน query เปลี่ยน `IN ('light','ac','erv')` เป็นรวมประเภทใหม่ เช่น `IN ('light','ac','erv','fan')`
- ใน object `positions` เพิ่ม key ประเภทใหม่: `positions.fan = []`

### 4.2 setPositionsByRoom()

- ในอาร์เรย์ `types` เพิ่มประเภทใหม่: `const types = ['light', 'ac', 'erv', 'fan'];`

---

## 5. Backend: Enrich สถานะจาก HA (รายการอุปกรณ์)

**ไฟล์:** `backend/controllers/deviceController.js`

- อาร์เรย์ `HA_DEVICE_TYPES` ใช้ตัดว่าอุปกรณ์ประเภทไหนจะดึงสถานะจาก `device_states` (ที่ sync จาก HA)
- **เพิ่มประเภทใหม่:** `const HA_DEVICE_TYPES = ['light', 'ac', 'erv', 'fan'];`

---

## 6. Backend: Room Controller (สั่งงานตามห้อง)

**ไฟล์:** `backend/controllers/roomController.js`

- `getDevices()`: คืนค่า `deviceStates` เป็น object มี key ตามประเภท (light, ac, erv)
  - ถ้าเพิ่มประเภทใหม่ ต้องให้ response มี key นั้น (จาก DeviceState.getByRoom ซึ่งแก้ในข้อ 3 แล้ว ถ้า DeviceState รองรับ type นั้นแล้ว ตรงนี้จะได้ตามนั้น)
- `controlDevice()`: รับ `req.params.type` (light, ac, erv)
  - Logic ส่วนใหญ่ใช้ `deviceType` จาก request ไปเรียก `roomControlProxyService.controlDeviceByRoomId` และจัดการกับ `device_states` ทั่วไป
  - ถ้าไม่มีเงื่อนไขเฉพาะประเภท (เช่น แอร์มีโหมด/อุณหภูมิ) การเพิ่มประเภทใหม่อาจไม่ต้องแก้ตรงนี้ เพียงให้ type ใหม่ส่งมาที่ route ได้

- **Route มีอยู่แล้ว:** `POST /rooms/:id/devices/:type/:index?` จึงรองรับ type ใหม่โดยไม่ต้องเพิ่ม route

---

## 7. Backend: Device API (สั่งงานโดยตรง + Sync)

**ไฟล์:**  
- `backend/routes/deviceRoutes.js`  
- `backend/controllers/deviceController.js`

### 7.1 ประเภทเดิม (light, ac, erv) แต่เพิ่ม **ตัวใหม่**

- **ไม่ต้อง**เพิ่ม route ใหม่
- เพิ่มแค่ mapping ใน `homeAssistantSyncService.deviceMappings` (ข้อ 2) และให้ device_id/entity_id ตรงกับอุปกรณ์ตัวใหม่

### 7.2 ประเภทใหม่ (เช่น fan)

- **Routes:** ใน `deviceRoutes.js` เพิ่มกลุ่ม route ในรูปแบบเดียวกับ light/erv:

```javascript
// ==================== พัดลม (Fan) ====================
router.post('/fan/:deviceId/control', deviceController.controlFan);
router.get('/fan/:deviceId/status', deviceController.getFanStatus);
router.post('/sync/fan/:deviceId', deviceController.syncFan);
```

- **Controller:** ใน `deviceController.js` เพิ่ม method เช่น `controlFan`, `getFanStatus`, `syncFan` (เรียก homeAssistantService / homeAssistantSyncService ตามรูปแบบของ light หรือ erv)

---

## 8. Frontend: Config ประเภทอุปกรณ์

**ไฟล์:** `frontend/src/config/deviceTypes.js`

- ใน `DEFAULT_DEVICE_TYPES` เพิ่ม object ตรงกับ backend (key, apiPath, label, icon, order)
- หน้าเว็บที่ใช้ `getDeviceTypeIcon`, `getDeviceTypeLabel` และดึงจาก `GET /api/devices/types` จะได้ประเภทใหม่อัตโนมัติ ถ้า backend ส่งมา

---

## 9. Frontend: หน้า Room Control

**ไฟล์:** `frontend/src/pages/rooms/control.vue`

จุดที่ต้องตรวจ/แก้เมื่อเพิ่มประเภทใหม่ (เช่น `fan`):

### 9.1 State / ตำแหน่ง

- `floorDeviceStates` / โครงสร้างที่เก็บสถานะต่อห้อง: มีรูปแบบ `{ light: [], ac: [], erv: [] }`  
  → เพิ่ม key ประเภทใหม่ เช่น `fan: []`
- `devicePositions`: มี `light`, `ac`, `erv`  
  → เพิ่ม `fan: []`
- ค่าเริ่มต้นหรือ fallback ที่สร้างอาร์เรย์ตามประเภท (เช่น ตำแหน่งเริ่มต้น 3 จุด)  
  → เพิ่มประเภทใหม่ในที่ที่ใช้ loop ตาม type

### 9.2 การโหลดข้อมูล

- จุดที่โหลดจาก `GET /rooms/:id/devices` แล้ว map เข้า `deviceStates.light`, `deviceStates.ac`, `deviceStates.erv`  
  → เพิ่ม map สำหรับ `deviceStates.fan` (หรือ key ตามประเภทใหม่)
- จุดที่โหลดตำแหน่งจาก API (device-positions)  
  → ให้รองรับ key ประเภทใหม่ใน response

### 9.3 การแสดงผลและปุ่มควบคุม

- ฟังก์ชันที่เช็ค “เปิดอยู่หรือไม่” (เช่น `hasLightOn`, `hasAcOn`, `hasErvOn`)  
  → เพิ่ม `hasFanOn` และใช้ในปุ่มเปิด/ปิดรวม (ถ้ามี)
- UI ที่วนแสดงปุ่ม/สวิตช์ตามประเภท (light, ac, erv)  
  → วนรวมประเภทใหม่ หรือเพิ่มบล็อกสำหรับ fan
- การเรียก API สั่งงาน: ปัจจุบันน่าจะเป็น `POST /rooms/:roomId/devices/:type/:index`  
  → ถ้า type ใหม่ใช้ endpoint เดียวกัน แค่ส่ง `type: 'fan'` และ index ที่ตรงกับ device_states

### 9.4 RoomControlProxyService (ถ้าใช้ Control API ภายนอก)

**ไฟล์:** `backend/services/roomControlProxyService.js`

- `fetchDeviceStatesByRoomId`: คืนค่า `deviceStates` ในรูปแบบ `{ light: [], ac: [], erv: [] }`
  - ถ้า API ภายนอกรองรับประเภทใหม่ ให้เพิ่ม key นั้นใน response (หรือ map จาก response มาใส่ใน object นี้)

---

## 10. สรุปเช็คลิสต์เมื่อเพิ่ม “ประเภท” ใหม่ (เช่น fan)

| # | งาน | ไฟล์ |
|---|-----|------|
| 1 | เพิ่มใน CONTROLLABLE_DEVICE_TYPES | `backend/config/deviceTypes.js` |
| 2 | เพิ่ม deviceMappings + sync method + syncAll | `backend/services/homeAssistantSyncService.js` |
| 3 | เพิ่ม type ใน grouped และ maxIndices | `backend/models/DeviceState.js` |
| 4 | เพิ่ม type ใน positions + types | `backend/models/Device.js` |
| 5 | เพิ่มใน HA_DEVICE_TYPES | `backend/controllers/deviceController.js` |
| 6 | เพิ่ม route + controller (control, status, sync) | `deviceRoutes.js`, `deviceController.js` |
| 7 | เพิ่มใน DEFAULT_DEVICE_TYPES | `frontend/src/config/deviceTypes.js` |
| 8 | เพิ่ม state/positions/UI/API เรียกใน control | `frontend/src/pages/rooms/control.vue` |
| 9 | (ถ้าใช้) รองรับ type ใหม่ใน roomControlProxyService | `backend/services/roomControlProxyService.js` |

---

## 11. กรณีเพิ่มแค่ “ตัวใหม่” (ห้องใหม่ / ตัวที่ 2, 3 ของ light/ac/erv)

- **Backend:** เพิ่มแค่ 1 entry ใน `homeAssistantSyncService.deviceMappings` (roomId, deviceType, deviceIndex, entityId)
- **DB:** อาจต้องมีแถวใน `devices` (room_id, device_type, x, y) และเมื่อมี device_states จาก sync สถานะจะแสดงในรายการอุปกรณ์และหน้า control ตาม room/index ที่ map ไว้
- **Frontend:** โดยทั่วไปไม่ต้องแก้ ถ้า UI วนจากจำนวนสถานะ/ตำแหน่งที่ได้จาก API อยู่แล้ว

ถ้าต้องการให้ประเภทใหม่ทำงานครบเหมือน light/ac/erv (แสดงในรายการ, sync จาก HA, ควบคุมจาก room control) ให้ทำครบทุกขั้นที่เกี่ยวข้องกับ “ประเภท” ตามตารางด้านบน
