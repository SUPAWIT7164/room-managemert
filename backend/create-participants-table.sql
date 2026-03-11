-- =============================================
-- สร้างตาราง participants สำหรับ smart_room_booking
-- โครงสร้างเหมือนกับ room-management-portal
-- =============================================

USE [smart_room_booking];
GO

-- สร้างตาราง participants
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[participants]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[participants] (
        [id] BIGINT IDENTITY(1, 1) NOT NULL,
        [booking_id] BIGINT NOT NULL,
        [email] NVARCHAR(255) NOT NULL,
        [created_at] DATETIME NULL,
        [updated_at] DATETIME NULL,
        CONSTRAINT [PK_participants] PRIMARY KEY CLUSTERED ([id])
    );
    
    PRINT 'ตาราง participants ถูกสร้างเรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT 'ตาราง participants มีอยู่แล้ว';
END
GO

-- สร้าง Foreign Key constraint
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'participants_booking_id_foreign' 
    AND parent_object_id = OBJECT_ID('participants')
)
BEGIN
    -- ตรวจสอบว่าตาราง booking_requests มีอยู่
    IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[booking_requests]') AND type in (N'U'))
    BEGIN
        ALTER TABLE [dbo].[participants] 
        ADD CONSTRAINT [participants_booking_id_foreign] 
        FOREIGN KEY ([booking_id]) 
        REFERENCES [dbo].[booking_requests] ([id]);
        
        PRINT 'Foreign Key participants_booking_id_foreign ถูกสร้างเรียบร้อยแล้ว';
    END
    ELSE
    BEGIN
        PRINT '⚠️  ไม่พบตาราง booking_requests ไม่สามารถสร้าง Foreign Key ได้';
    END
END
ELSE
BEGIN
    PRINT 'Foreign Key participants_booking_id_foreign มีอยู่แล้ว';
END
GO

-- สร้าง Index สำหรับ booking_id (เพื่อเพิ่มประสิทธิภาพการค้นหา)
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_participants_booking_id' 
    AND object_id = OBJECT_ID('participants')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_participants_booking_id] 
    ON [dbo].[participants] ([booking_id]);
    
    PRINT 'Index IX_participants_booking_id ถูกสร้างเรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT 'Index IX_participants_booking_id มีอยู่แล้ว';
END
GO

-- สร้าง Index สำหรับ email (เพื่อเพิ่มประสิทธิภาพการค้นหา)
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_participants_email' 
    AND object_id = OBJECT_ID('participants')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_participants_email] 
    ON [dbo].[participants] ([email]);
    
    PRINT 'Index IX_participants_email ถูกสร้างเรียบร้อยแล้ว';
END
ELSE
BEGIN
    PRINT 'Index IX_participants_email มีอยู่แล้ว';
END
GO

PRINT '';
PRINT '=============================================';
PRINT '✅ สร้างตาราง participants เสร็จสิ้น';
PRINT '=============================================';
GO


