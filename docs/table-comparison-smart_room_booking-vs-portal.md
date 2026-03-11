# สรุปเปรียบเทียบตาราง: smart_room_booking vs room-management-portal

**อัปเดต:** ถือว่า smart_room_booking มี **participants** แล้ว (ตารางหรือคอลัมน์ใน booking_requests)

---

## จำนวนตารางที่ smart_room_booking ยังขาด (เทียบกับ room-management-portal)

**ขาดอีก 4 ตาราง** (ไม่นับ participants เพราะมีแล้ว):

| # | ชื่อตาราง | ใช้ใน room-management-portal | สคริปต์ใน smart_room_booking |
|---|-----------|------------------------------|------------------------------|
| 1 | **cctv_cameras** | `CctvCamera.js`, `cctvController.js` | มีสคริปต์แยก: `backend/migrations/create_cctv_cameras_and_people_count.sql` |
| 2 | **people_count_logs** | `PeopleCountLog.js`, `peopleCountingService.js`, `cctvController.js` | อยู่ในสคริปต์เดียวกับ cctv_cameras ข้างบน |
| 3 | **room_schedules** | `roomController.js` (SELECT/INSERT/DELETE) | **ไม่มีสคริปต์** — ต้องสร้างเพิ่ม |
| 4 | **access_permissions** | `roomController.js` (SELECT/INSERT/DELETE) | **ไม่มีสคริปต์** — ต้องสร้างเพิ่ม |

---

## รายละเอียด

- **participants** — ถือว่ามีแล้ว (ตาราง participants หรือคอลัมน์ participants ใน booking_requests) จึงไม่นับเป็นตารางที่ขาด
- **cctv_cameras** และ **people_count_logs** — สร้างได้โดยรัน `backend/migrations/create_cctv_cameras_and_people_count.sql` บน DB smart_room_booking
- **room_schedules** และ **access_permissions** — ไม่มีในสคริปต์ smart_room_booking ต้องเขียนสคริปต์สร้างตาราง (MSSQL) เองถ้าต้องการให้ portal ทำงานครบ

---

## จำนวนตาราง

| แหล่งที่มา | จำนวนตาราง |
|------------|------------|
| **smart_room_booking** (สคริปต์หลัก `scripts/create_smart_room_booking_mssql.sql`) | 48 ตาราง |
| **room-management-portal** (จาก migrations + models ใน repo นี้) | ใช้ตารางจาก smart_room_booking + ตารางเพิ่มจาก migrations |

---

## ตารางที่ smart_room_booking ขาดไป (รายการเต็ม ก่อนตัด participants)

มี **ทั้งหมด 5 ตาราง** ที่ room-management-portal อ้างอิง/ใช้ แต่ smart_room_booking ไม่ได้รวมไว้ในสคริปต์หลัก หรือไม่มีเลย:

| # | ชื่อตาราง | สถานะใน smart_room_booking | หมายเหตุ |
|---|-----------|-----------------------------|----------|
| 1 | **participants** | ไม่มีในสคริปต์หลัก | **ถือว่ามีแล้ว** (ตามที่ตรวจสอบ) — มีสคริปต์แยก: `backend/create-participants-table.sql` |
| 2 | **cctv_cameras** | ไม่มีในสคริปต์หลัก | มีสคริปต์แยก: `backend/migrations/create_cctv_cameras_and_people_count.sql` — ต้องรันเพิ่ม |
| 3 | **people_count_logs** | ไม่มีในสคริปต์หลัก | อยู่ในสคริปต์เดียวกับ cctv_cameras ข้างบน — ต้องรันเพิ่ม |
| 4 | **room_schedules** | **ไม่มีเลย** | room-management-portal มี migration `create_room_schedules_table.sql` (room_id, start_datetime, end_datetime, disable) — ตาราง **schedules** ใน smart_room_booking เป็นคนละแบบ (day_of_week, start_time, end_time) |
| 5 | **access_permissions** | **ไม่มีเลย** | room-management-portal มี migration `create_access_permissions_table.sql` — smart_room_booking มีแค่ **room_permissions** (โครงสร้างต่างกัน) |

---

## สรุปจำนวนตารางที่ขาด

- **เมื่อ participants มีแล้ว**  
  → ขาดอีก **4 ตาราง**: `cctv_cameras`, `people_count_logs`, `room_schedules`, `access_permissions`

- **ถ้ารันสคริปต์แยก** `create_cctv_cameras_and_people_count.sql`  
  → จะยังขาดอยู่ **2 ตาราง**: `room_schedules`, `access_permissions`  
  (ยังไม่มีสคริปต์สร้างสองตารางนี้ใน smart_room_booking)

---

## รายชื่อตารางในสคริปต์หลัก smart_room_booking (48 ตาราง)

1. area_types  
2. building_types  
3. room_types  
4. device_types  
5. log_types  
6. setting_types  
7. permissions  
8. roles  
9. users  
10. cache  
11. cache_locks  
12. password_reset_tokens  
13. migrations  
14. job_batches  
15. buildings  
16. areas  
17. rooms  
18. devices  
19. visitors  
20. booking_requests  
21. approvers  
22. room_permissions  
23. schedules  
24. borrow_records  
25. faces  
26. logs  
27. settings  
28. settings_old  
29. energy_data  
30. environment_data  
31. access_logs  
32. notifications  
33. holidays  
34. cctv_area_config  
35. booking_quotas  
36. home_assistant_entities  
37. jobs  
38. failed_jobs  
39. device_positions  
40. device_states  
41. environmental_data  
42. service_access_logs  
43. sessions  
44. role_has_permissions  
45. model_has_permissions  
46. model_has_roles  
47. usage_quotas  
48. user_preferences  

---

## แนะนำ

- รัน `backend/create-participants-table.sql` และ `backend/migrations/create_cctv_cameras_and_people_count.sql` บน DB smart_room_booking เพื่อให้มี `participants`, `cctv_cameras`, `people_count_logs`
- ถ้า portal ใช้ `room_schedules` และ `access_permissions` จริง ควรเพิ่มสคริปต์สร้างสองตารางนี้ใน smart_room_booking (MSSQL) ให้สอดคล้องกับ room-management-portal
