# สรุปตารางในฐานข้อมูล smart_room_booking

ไฟล์ต้นทาง: `C:\inetpub\wwwroot\Final-Booking\Final-Booking\smart_room_booking (1).sql`  
รูปแบบ: **MySQL/MariaDB** (phpMyAdmin)

---

## รายการตารางทั้งหมด (47 ตาราง)

| # | ตาราง | คำอธิบายสั้นๆ |
|---|-------|----------------|
| 1 | `access_logs` | บันทึกการเข้า-ออกห้อง (entry/exit/denied) |
| 2 | `approvers` | ผู้อนุมัติการจองต่อห้อง |
| 3 | `areas` | พื้นที่/ชั้น ภายใต้ building |
| 4 | `area_types` | ประเภทพื้นที่ (ประชุม, ทำงาน ฯลฯ) |
| 5 | `booking_quotas` | โควต้าการจองต่อ user/room |
| 6 | `booking_requests` | คำขอจองห้อง |
| 7 | `borrow_records` | บันทึกการยืม-คืนอุปกรณ์ |
| 8 | `buildings` | อาคาร |
| 9 | `building_types` | ประเภทอาคาร |
| 10 | `cache` | Laravel cache |
| 11 | `cache_locks` | คิว cache lock |
| 12 | `devices` | อุปกรณ์ (ประตู, เครื่องยืม ฯลฯ) |
| 13 | `device_positions` | ตำแหน่ง light/ac/erv บนแผนภูมิห้อง |
| 14 | `device_states` | สถานะ light/ac/erv (on/off, อุณหภูมิ ฯลฯ) |
| 15 | `device_types` | ประเภทอุปกรณ์ |
| 16 | `energy_data` | ข้อมูลพลังงาน (power, energy, voltage ฯลฯ) |
| 17 | `environmental_data` | ข้อมูลสิ่งแวดล้อม (อุณหภูมิ, ความชื้น, CO2, PM2.5, noise ฯลฯ) |
| 18 | `environment_data` | ข้อมูลสิ่งแวดล้อมอีกชุด (device/building/room) |
| 19 | `faces` | ข้อมูลใบหน้าสำหรับ Face Recognition |
| 20 | `failed_jobs` | คิวงานที่ล้มเหลว |
| 21 | `holidays` | วันหยุด |
| 22 | `home_assistant_entities` | Entity จาก Home Assistant |
| 23 | `jobs` | คิวงาน |
| 24 | `job_batches` | แบตช์คิวงาน |
| 25 | `logs` | บันทึกการทำงานระบบ |
| 26 | `log_types` | ประเภท log |
| 27 | `migrations` | Laravel migrations |
| 28 | `model_has_permissions` | สร้างความสัมพันธ์ Permission–Model (Spatie) |
| 29 | `model_has_roles` | สร้างความสัมพันธ์ Role–Model (Spatie) |
| 30 | `notifications` | การแจ้งเตือนผู้ใช้ |
| 31 | `password_reset_tokens` | โทเค็นรีเซ็ตรหัสผ่าน |
| 32 | `permissions` | สิทธิ์ (manage-users, manage-rooms ฯลฯ) |
| 33 | `roles` | บทบาท (super-admin, admin, user) |
| 34 | `role_has_permissions` | สิทธิ์ของแต่ละ role |
| 35 | `rooms` | ห้องประชุม |
| 36 | `room_permissions` | สิทธิ์การเข้าห้อง (view/book/manage) |
| 37 | `room_types` | ประเภทห้อง |
| 38 | `schedules` | ตารางเปิด-ปิดห้อง (วัน + เวลา) |
| 39 | `service_access_logs` | บันทึกการเข้า-ออก (camera, device ฯลฯ) |
| 40 | `sessions` | เซสชันผู้ใช้ |
| 41 | `settings` | ตั้งค่าระบบ |
| 42 | `settings_old` | ตั้งค่าเดิม (legacy) |
| 43 | `setting_types` | ประเภท setting |
| 44 | `usage_quotas` | โคว้าการใช้งานต่อ user/room |
| 45 | `users` | ผู้ใช้งาน |
| 46 | `user_preferences` | ค่ากำหนดของผู้ใช้ |
| 47 | `visitors` | ผู้เยี่ยมชม |

---

## การสร้างฐานข้อมูลใน SSMS (SQL Server)

1. เปิด **SQL Server Management Studio** แล้วเชื่อมต่อ:
   - **Server name:** `AZ-BMS-DEV`
   - **Authentication:** SQL Server Authentication
   - **Login:** `devadmin`
   - **Password:** `Lannacom@Dev@2025`

2. **สร้างโครงสร้างตาราง**  
   เปิด `scripts/create_smart_room_booking_mssql.sql` แล้วกด **Execute (F5)**  
   - สร้างฐานข้อมูล `smart_room_booking` (ถ้ายังไม่มี)
   - สร้างตารางทั้ง 47 ตาราง

3. **นำเข้าข้อมูล** จากไฟล์ MySQL ต้นทาง  
   - สร้างไฟล์ T-SQL สำหรับ INSERT:
     ```powershell
     node scripts/import-mysql-to-mssql.js "C:\inetpub\wwwroot\Final-Booking\Final-Booking\smart_room_booking (1).sql"
     ```
   - ใน SSMS เปิด `scripts/insert_smart_room_booking_data_mssql.sql` แล้วกด **Execute (F5)**  
   - ข้อมูลจะถูก INSERT ลงตาราง areas, area_types, booking_requests, buildings, building_types, cache, devices, device_positions, device_states, device_types, energy_data, environmental_data, faces, migrations, model_has_roles, permissions, roles, role_has_permissions, rooms, room_types, sessions, settings, usage_quotas, users, user_preferences, visitors

---

## การเชื่อมต่อจาก Backend (SQL Server)

ในโฟลเดอร์ `backend` กำหนดใน `.env`:

```env
DB_TYPE=mssql
DB_HOST=AZ-BMS-DEV
DB_PORT=1433
DB_NAME=smart_room_booking
DB_USER=devadmin
DB_PASSWORD=Lannacom@Dev@2025
DB_TRUST_CERT=true
```

และต้องมีแพ็คเกจ `mssql` ติดตั้งใน backend (`npm install mssql`).

---

## หมายเหตุ

- ไฟล์ต้นทางเป็น **MySQL/MariaDB**  
  หากใช้ **SQL Server (SSMS)** ต้องใช้สคริปต์ T-SQL ที่แปลงแล้ว (เช่น `scripts/create_smart_room_booking_mssql.sql`)
- ตารางมี PK, Index และ Foreign Key ครบในไฟล์ต้นทาง
- Backend รองรับทั้ง MySQL และ SQL Server ผ่าน `DB_TYPE` ใน `.env`
