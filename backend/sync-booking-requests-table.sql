-- =============================================
-- Sync ตาราง booking_requests ใน smart_room_booking
-- ให้เหมือนกับ room-management-portal
-- และลบ column participants
-- =============================================

USE [smart_room_booking];
GO

PRINT '=============================================';
PRINT 'เริ่ม sync ตาราง booking_requests';
PRINT '=============================================';
GO

-- 1. ลบ column participants (ถ้ามี)
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'participants'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] DROP COLUMN [participants];
    PRINT '✅ ลบ column participants เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  ไม่พบ column participants';
END
GO

-- 2. เพิ่ม columns ที่ขาดหายไป (ถ้ายังไม่มี)

-- name
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'name'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [name] NVARCHAR(255) NULL;
    PRINT '✅ เพิ่ม column name เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column name มีอยู่แล้ว';
END
GO

-- booker
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'booker'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [booker] BIGINT NULL;
    PRINT '✅ เพิ่ม column booker เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column booker มีอยู่แล้ว';
END
GO

-- room
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'room'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [room] BIGINT NULL;
    PRINT '✅ เพิ่ม column room เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column room มีอยู่แล้ว';
END
GO

-- start
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'start'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [start] DATETIME NOT NULL DEFAULT GETDATE();
    PRINT '✅ เพิ่ม column start เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column start มีอยู่แล้ว';
END
GO

-- end
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'end'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [end] DATETIME NOT NULL DEFAULT GETDATE();
    PRINT '✅ เพิ่ม column end เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column end มีอยู่แล้ว';
END
GO

-- hour
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'hour'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [hour] DECIMAL(18,2) NULL;
    PRINT '✅ เพิ่ม column hour เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column hour มีอยู่แล้ว';
END
GO

-- instructor
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'instructor'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [instructor] NVARCHAR(MAX) NULL;
    PRINT '✅ เพิ่ม column instructor เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column instructor มีอยู่แล้ว';
END
GO

-- calendar_id
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'calendar_id'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [calendar_id] NVARCHAR(MAX) NULL;
    PRINT '✅ เพิ่ม column calendar_id เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column calendar_id มีอยู่แล้ว';
END
GO

-- icaluid
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'icaluid'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [icaluid] NVARCHAR(MAX) NULL;
    PRINT '✅ เพิ่ม column icaluid เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column icaluid มีอยู่แล้ว';
END
GO

-- qrcode
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'qrcode'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [qrcode] NVARCHAR(255) NOT NULL DEFAULT '';
    PRINT '✅ เพิ่ม column qrcode เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column qrcode มีอยู่แล้ว';
END
GO

-- online_meeting
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'online_meeting'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [online_meeting] BIT NOT NULL DEFAULT 0;
    PRINT '✅ เพิ่ม column online_meeting เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column online_meeting มีอยู่แล้ว';
END
GO

-- email_notify
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'email_notify'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [email_notify] BIT NOT NULL DEFAULT 0;
    PRINT '✅ เพิ่ม column email_notify เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column email_notify มีอยู่แล้ว';
END
GO

-- cancel
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'cancel'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [cancel] BIT NULL;
    PRINT '✅ เพิ่ม column cancel เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column cancel มีอยู่แล้ว';
END
GO

-- reject
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'reject'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [reject] BIT NULL;
    PRINT '✅ เพิ่ม column reject เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column reject มีอยู่แล้ว';
END
GO

-- reject_reason
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'reject_reason'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [reject_reason] NVARCHAR(255) NULL;
    PRINT '✅ เพิ่ม column reject_reason เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column reject_reason มีอยู่แล้ว';
END
GO

-- transaction_id
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'transaction_id'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [transaction_id] NVARCHAR(255) NULL;
    PRINT '✅ เพิ่ม column transaction_id เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column transaction_id มีอยู่แล้ว';
END
GO

-- approve_by
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'approve_by'
)
BEGIN
    ALTER TABLE [dbo].[booking_requests] ADD [approve_by] BIGINT NULL;
    PRINT '✅ เพิ่ม column approve_by เรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT '⚠️  column approve_by มีอยู่แล้ว';
END
GO

-- 3. แก้ไข columns ที่มีอยู่ให้ตรงกับ room-management-portal

-- แก้ไข status จาก NVARCHAR(50) เป็น BIT (ถ้ายังไม่ใช่ BIT)
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'booking_requests' 
    AND COLUMN_NAME = 'status'
    AND DATA_TYPE != 'bit'
)
BEGIN
    -- ต้องสร้าง column ใหม่ก่อน แล้วค่อยลบ column เก่า
    -- แต่เพื่อความปลอดภัย เราจะไม่เปลี่ยน type ของ status
    PRINT '⚠️  column status มี type เป็น ' + (
        SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'status'
    ) + ' (ไม่เปลี่ยน type เพื่อความปลอดภัย)';
END
GO

PRINT '';
PRINT '=============================================';
PRINT '✅ Sync ตาราง booking_requests เสร็จสิ้น';
PRINT '=============================================';
GO


