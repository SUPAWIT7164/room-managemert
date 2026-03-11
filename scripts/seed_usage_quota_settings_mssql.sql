-- =============================================================================
-- Seed: ตั้งค่าโควต้าการใช้งาน (module_id = 1)
-- ข้อมูลตรงกับโปรเจกต์เดิม old/room-management-portal/database/seeders/SettingSeeder.php
-- รันสคริปต์นี้เมื่อต้องการสร้างหรืออัปเดตข้อมูลตั้งค่าโควต้าให้เหมือนหน้า
-- ตั้งค่าโควต้าการใช้งานของโปรเจกต์เดิม
-- =============================================================================

-- ตรวจสอบว่าตาราง settings มีอยู่และมี slug, module_id
IF OBJECT_ID(N'dbo.settings', N'U') IS NULL
BEGIN
    RAISERROR(N'ตาราง [dbo].[settings] ยังไม่มี กรุณารัน create_smart_room_booking_mssql.sql ก่อน', 16, 1);
    RETURN;
END
GO

DECLARE @now datetime2 = GETDATE();

-- ลบรายการตั้งค่าโควต้าเดิม (module_id = 1) แล้วใส่ใหม่ตามโปรเจกต์เดิม
-- หรือใช้ MERGE เพื่ออัปเดต/เพิ่มเฉพาะรายการที่ตรง slug
MERGE INTO [dbo].[settings] AS t
USING (
    SELECT N'booking-per-week' AS slug, N'จำนวนครั้งการจองใน 1 อาทิตย์' AS name, N'Number of bookings per week' AS name_en, N'3' AS value, N'ครั้ง/อาทิตย์' AS unit, N'count' AS unit_en
    UNION ALL SELECT N'booking-per-day', N'จำนวนครั้งการจองใน 1 วัน', N'Number of bookings per day', N'2', N'ครั้ง/วัน', N'count'
    UNION ALL SELECT N'booking-ahead-day', N'จำนวนวันในการจองล่วงหน้า', N'Number of days to book ahead', N'3', N'วัน', N'day'
    UNION ALL SELECT N'booking-hour-max', N'ชั่วโมงการจองสูงสุด', N'Maximum booking hours', N'3', N'ชั่วโมง', N'hour'
    UNION ALL SELECT N'booking-hour-min', N'ชั่วโมงการจองขั้นต่ำ', N'Minimum booking hours', N'0.5', N'ชั่วโมง', N'hour'
    UNION ALL SELECT N'before-start', N'สามารถเข้าห้องได้ก่อนเวลา', N'Can enter room before time', N'30', N'นาที', N'minute'
    UNION ALL SELECT N'after-end', N'สามารถเข้าห้องได้หลังจบการจอง', N'Can enter room after booking ends', N'30', N'นาที', N'minute'
    UNION ALL SELECT N'after-start', N'ยกเลิกตารางหากผู้จองไม่มาใช้งานภายใน', N'Cancel booking if user does not use within', N'10', N'นาที', N'minute'
    UNION ALL SELECT N'booking-start', N'เวลาเริ่มต้นการแสดงตาราง', N'Booking Start Time', N'08:00', N'เวลา', N'time'
    UNION ALL SELECT N'booking-end', N'เวลาสิ้นสุดการแสดงตาราง', N'Booking End Time', N'20:00', N'เวลา', N'time'
) AS s (slug, name, name_en, value, unit, unit_en)
ON t.[slug] = s.slug AND t.[module_id] = 1
WHEN MATCHED THEN
    UPDATE SET
        t.[name] = s.name,
        t.[name_en] = s.name_en,
        t.[value] = s.value,
        t.[unit] = s.unit,
        t.[unit_en] = s.unit_en,
        t.[updated_at] = @now
WHEN NOT MATCHED BY TARGET THEN
    INSERT ([name], [name_en], [slug], [value], [unit], [unit_en], [is_default], [disable], [type_id], [module_id], [created_at], [updated_at])
    VALUES (s.name, s.name_en, s.slug, s.value, s.unit, s.unit_en, 1, 0, NULL, 1, @now, @now);
GO

PRINT N'Seed ตั้งค่าโควต้าการใช้งาน (module_id = 1) เสร็จแล้ว - 10 รายการ';
GO
