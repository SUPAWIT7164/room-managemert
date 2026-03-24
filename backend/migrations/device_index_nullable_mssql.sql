-- ทำให้ device_index รับ NULL ได้ (ใช้เมื่อต้องการเก็บคอลัมน์ไว้แต่ไม่ใช้ใน logic — โค้ดจะเซ็ต device_index = NULL)
-- รันครั้งเดียวหลัง add_device_id ถ้าคอลัมน์ device_index ยังเป็น NOT NULL

SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('device_states', 'device_index') IS NOT NULL
BEGIN
    ALTER TABLE dbo.device_states ALTER COLUMN device_index INT NULL;
END
GO

PRINT N'device_index_nullable_mssql: device_index is now nullable (if column exists)';
GO

-- หมายเหตุ: ถ้ามี UNIQUE บน (room_id, device_type, device_index) และ SQL Server ไม่อนุญาตหลายแถวที่ device_index เป็น NULL
-- ให้ลบ constraint/index นั้น (แหล่งความจริงของแถวคือ device_id + uq_device_states_device_id แล้ว)
GO
 