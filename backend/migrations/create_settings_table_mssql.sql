/*
  ตาราง settings — โควต้า/การตั้งค่าโมดูล (เทียบเท่า Laravel + โปรเจกต์เก่า)
  รันครั้งเดียวบน SQL Server หลังจากนั้น API /reports/usage-quota และ /quotas/update จะอ่าน/เขียนได้

  หมายเหตุ: ไม่มี FK ไป modules (โปรเจกต์นี้ใช้ module_id เป็นตัวเลขอ้างอิงเชิงตรรกะเท่านั้น)
  module_id = 1  = โควต้าการจองห้อง
  module_id = 3  = การแจ้งเตือนพลังงาน (seed แยกใน seed-energy-notification-settings.js)
*/

IF OBJECT_ID(N'dbo.settings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.settings (
        id           BIGINT IDENTITY(1, 1) NOT NULL,
        name         NVARCHAR(255) NULL,
        name_en      NVARCHAR(255) NULL,
        slug         NVARCHAR(255) NULL,
        value        NVARCHAR(MAX) NULL,
        unit         NVARCHAR(255) NULL,
        unit_en      NVARCHAR(255) NULL,
        is_default   BIT NOT NULL CONSTRAINT DF_settings_is_default DEFAULT (0),
        disable      BIT NOT NULL CONSTRAINT DF_settings_disable DEFAULT (0),
        type_id      BIGINT NULL,
        module_id    BIGINT NULL,
        created_at   DATETIME2(0) NOT NULL CONSTRAINT DF_settings_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at   DATETIME2(0) NOT NULL CONSTRAINT DF_settings_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_settings PRIMARY KEY CLUSTERED (id)
    );

    CREATE NONCLUSTERED INDEX IX_settings_module_id ON dbo.settings (module_id);
    CREATE NONCLUSTERED INDEX IX_settings_slug ON dbo.settings (slug);
    CREATE NONCLUSTERED INDEX IX_settings_disable ON dbo.settings (disable);
END
GO

/* --- Seed โควต้าการจอง (module_id = 1) ถ้ายังไม่มี slug นั้น --- */

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'booking-per-week')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'จำนวนครั้งการจองใน 1 อาทิตย์', N'Number of bookings per week', N'booking-per-week', N'3', N'ครั้ง/อาทิตย์', N'count/week', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'booking-per-day')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'จำนวนครั้งการจองใน 1 วัน', N'Number of bookings per day', N'booking-per-day', N'2', N'ครั้ง/วัน', N'count/day', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'booking-ahead-day')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'จำนวนวันในการจองล่วงหน้า', N'Number of days to book ahead', N'booking-ahead-day', N'3', N'วัน', N'day', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'booking-hour-max')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'ชั่วโมงการจองสูงสุด', N'Maximum booking hours', N'booking-hour-max', N'3', N'ชั่วโมง', N'hour', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'booking-hour-min')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'ชั่วโมงการจองขั้นต่ำ', N'Minimum booking hours', N'booking-hour-min', N'0.5', N'ชั่วโมง', N'hour', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'before-start')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'สามารถเข้าห้องได้ก่อนเวลา', N'Can enter room before time', N'before-start', N'30', N'นาที', N'minute', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'after-end')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'สามารถเข้าห้องได้หลังจบการจอง', N'Can enter room after booking ends', N'after-end', N'30', N'นาที', N'minute', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'after-start')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'ยกเลิกตารางหากผู้จองไม่มาใช้งานภายใน', N'Cancel booking if user does not use within', N'after-start', N'10', N'นาที', N'minute', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'booking-start')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'เวลาเริ่มต้นการแสดงตาราง', N'Booking start time', N'booking-start', N'08:00', N'เวลา', N'time', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.settings WHERE module_id = 1 AND slug = N'booking-end')
    INSERT INTO dbo.settings (name, name_en, slug, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
    VALUES (N'เวลาสิ้นสุดการแสดงตาราง', N'Booking end time', N'booking-end', N'20:00', N'เวลา', N'time', 1, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

GO
