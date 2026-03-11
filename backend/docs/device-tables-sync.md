# ความสัมพันธ์และการซิงค์ของตาราง devices, device_types, device_states และ rooms

## ภาพรวม

| ตาราง / แหล่งข้อมูล | หน้าที่หลัก | ลิงก์กับ rooms |
|----------------------|-------------|----------------|
| **rooms** | เก็บข้อมูลห้อง + **ตำแหน่งอุปกรณ์บน floor plan** (x1, y1, x2, y2, device_positions JSON) | - |
| **devices** | เก็บรายการอุปกรณ์จริง (sensor, ตัวควบคุม ฯลฯ) อาจมี device_type = light/ac/erv สำหรับตำแหน่ง (fallback) | `devices.room_id` → rooms.id |
| **device_states** | เก็บ **สถานะการเปิด/ปิด** ของอุปกรณ์ควบคุม (light, ac, erv) แยกตาม room + type + index | `device_states.room_id` → rooms.id |
| **device_types** | **ไม่มีตารางใน DB** — ใช้จาก config ในโค้ดเท่านั้น (`config/deviceTypes.js`) | - |

---

## 1. device_types (ไม่ใช่ตาราง DB)

- **ที่อยู่:** `backend/config/deviceTypes.js`
- **ใช้สำหรับ:** รายการประเภทที่สั่งงานได้ (light, ac, erv) พร้อม label, icon, apiPath
- **API:** `GET /api/devices/types` คืนค่าจาก config นี้
- **ไม่มีการซิงค์กับ DB** — เป็นค่าคงที่ในโค้ด

---

## 2. rooms

- เก็บข้อมูลห้อง (name, area_id, room_type_id, ฯลฯ)
- **ตำแหน่งอุปกรณ์บนหน้า /rooms/control:**
  - **device_positions** (nvarchar max) = JSON `{ light: [{x,y},...], ac: [...], erv: [...] }`
  - **x1, y1, x2, y2** = bounding box ของจุดทั้งหมด (คำนวณตอนบันทึก)
- การโหลด/บันทึกตำแหน่ง: ใช้ `Room.getDevicePositions(roomId)` และ `Room.setDevicePositions(roomId, positions)` เป็นหลัก

---

## 3. devices

- เก็บอุปกรณ์ที่ผูกกับห้องผ่าน **room_id**
- คอลัมน์ที่เกี่ยวข้อง: room_id, name, type / device_type, device_category, ip, code, x1, y1, x2, y2 (ถ้ามี)
- **ใช้ในระบบควบคุม:**
  - **ตำแหน่ง:** ใช้เป็น **fallback** เมื่อตาราง rooms ยังไม่มีคอลัมน์ device_positions / x1,y1,x2,y2 จะอ่าน/เขียนจาก `devices` (device_type ใน 'light','ac','erv' เรียงตาม id)
  - **รายการอุปกรณ์ในห้อง:** `Device.getByRoom(roomId)` ใช้แสดงรายการอุปกรณ์ของห้อง (เช่น sensor, ประตู)
- **ไม่มีการซิงค์อัตโนมัติกับ device_states** — device_states อ้าง (room_id, device_type, device_index) ไม่ได้อ้าง devices.id

---

## 4. device_states

- เก็บ **สถานะเปิด/ปิด (และ settings)** ของอุปกรณ์ควบคุมในแต่ละห้อง
- คอลัมน์: **room_id**, **device_type** (light | ac | erv), **device_index** (0, 1, 2, ...), status, settings (JSON), created_at, updated_at
- **ความสัมพันธ์:** อ้าง **rooms** ผ่าน room_id เท่านั้น (ไม่มี FK ไปที่ devices)
- **การซิงค์:**
  - หน้า /rooms/control โหลดสถานะจาก `DeviceState.getByRoom(roomId)` หรือจาก **Control API** (ถ้าเปิดใช้) แล้วแสดงบน UI
  - เมื่อผู้ใช้กดเปิด/ปิด: เรียก `DeviceState.setDeviceState(roomId, deviceType, deviceIndex, status, settings)` (และอาจส่งคำสั่งไป Control API ก่อน แล้วค่อยอัปเดต DB)

---

## Flow การทำงานร่วมกัน (ซิงค์)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  หน้า /rooms/control?building=1&floor=3&area=Mercury                     │
└─────────────────────────────────────────────────────────────────────────┘
         │
         │ 1) โหลดตำแหน่งปุ่ม (light, ac, erv บน floor plan)
         ▼
   Room.getDevicePositions(roomId)
         │  อ่านจาก rooms.device_positions หรือ rooms.x1,y1,x2,y2
         │  (fallback: Device.getPositionsByRoom → DevicePosition.getByRoom)
         │
         │ 2) โหลดสถานะเปิด/ปิด
         ▼
   DeviceState.getByRoom(roomId)  หรือ  Control API
         │  อ่านจาก device_states (room_id, device_type, device_index)
         │
         │ 3) ผู้ใช้ลากตำแหน่งแล้วบันทึก
         ▼
   Room.setDevicePositions(roomId, positions)
         │  บันทึกลง rooms.device_positions + rooms.x1,y1,x2,y2
         │
         │ 4) ผู้ใช้กดเปิด/ปิด
         ▼
   DeviceState.setDeviceState(roomId, deviceType, deviceIndex, status)
         │  อัปเดต device_states (และอาจส่งไป Control API)
```

- **ตำแหน่ง** = ของห้อง → เก็บใน **rooms** (และ fallback ไป devices / device_positions)
- **สถานะ** = เปิด/ปิด ต่อ (room, type, index) → เก็บใน **device_states**
- **devices** = รายการอุปกรณ์ในห้อง + ทางเลือกเก็บตำแหน่งแบบเก่า ไม่ได้ซิงค์กับ device_states แบบ 1:1

---

## 5. การซิงค์จาก Home Assistant → device_states

- **ที่อยู่:** `homeAssistantSyncService.js` + mapping ใน `deviceMappings`
- **Flow:** เรียก `POST /api/devices/sync/all` หรือ sync ต่อตัว (light/air/erv)
  - ดึงสถานะจาก Home Assistant (getState entity)
  - เขียนลง **device_states** ด้วย `DeviceState.setDeviceState(roomId, deviceType, deviceIndex, status, settings)`
- **ไม่เขียนไปที่ตาราง devices หรือ rooms** — เขียนเฉพาะ device_states
- หลัง sync แล้ว หน้า /rooms/control และ GET /rooms/:id/devices จะได้สถานะล่าสุดจาก device_states

## 6. หน้ารายการอุปกรณ์ (GET /api/devices) กับ device_states

- **enrichDevicesWithHAStatus:** หลังดึงรายการจากตาราง **devices** แล้ว จะเติมค่า `is_active`, `status` จาก **device_states** (ตาม room_id + device_type + device_index ที่อนุมานจากลำดับแถว)
- ดังนั้น **สถานะที่แสดงในหน้ารายการอุปกรณ์ = จาก device_states เป็นหลัก** (ที่ sync จาก HA) ไม่ได้มาจากคอลัมน์ status ในตาราง devices โดยตรง

---

## สรุปสั้นๆ

| สิ่งที่เก็บ | ตารางหลัก | หมายเหตุ |
|------------|------------|----------|
| ตำแหน่งปุ่มบน floor plan | **rooms** (device_positions, x1,y1,x2,y2) | เป็นของห้องนั้นๆ |
| สถานะเปิด/ปิด light/ac/erv | **device_states** (room_id, device_type, device_index) | ไม่ลิงก์กับแถวใน devices; sync จาก HA เข้ามาที่นี่ |
| รายการประเภทสั่งงาน (icon, label) | **config/deviceTypes.js** (ไม่ใช่ตาราง device_types) | ค่าคงที่ในโค้ด |
| รายการอุปกรณ์ในห้อง (sensor ฯลฯ) | **devices** (room_id) | ใช้แสดงรายการ/จัดการอุปกรณ์; สถานะแสดงจาก device_states (enrich) |

### ความสัมพันธ์ระหว่างตาราง (ไม่ซิงค์อัตโนมัติแบบ 1:1)

- **rooms** ↔ **device_states**: ผูกด้วย `room_id` เท่านั้น (ตำแหน่งอยู่ rooms, สถานะอยู่ device_states)
- **rooms** ↔ **devices**: ผูกด้วย `devices.room_id` (ตำแหน่ง fallback อ่าน/เขียนจาก devices ได้)
- **devices** ↔ **device_states**: **ไม่มีการลิงก์ FK** — device_states ใช้ (room_id, device_type, device_index); รายการ devices ใช้ room_id + device_type เรียง id เพื่ออนุมาน index ตอน enrich
