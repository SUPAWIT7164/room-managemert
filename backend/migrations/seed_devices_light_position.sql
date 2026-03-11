-- ตำแหน่งไฟ (light): ใส่ค่า x = x1,x2 และ y = y1,y2 ให้อุปกรณ์ประเภท light
-- รันหลัง devices_xy_store_x1_x2_y1_y2.sql (คอลัมน์ x, y เป็น nvarchar)
-- SQL Server: smart_room_booking

USE [smart_room_booking];
GO

-- อัปเดตเฉพาะแถวที่ device_type = 'light' (ตำแหน่งไฟ)
IF COL_LENGTH(N'dbo.devices', N'device_type') IS NOT NULL
BEGIN
    UPDATE [dbo].[devices]
    SET [x] = N'15.0000,85.2632',
        [y] = N'19.6897,80.0000'
    WHERE [device_type] = N'light'
      AND ([x] IS NULL OR [y] IS NULL);
    PRINT N'Updated light device(s) with position x1,x2 and y1,y2';
END
ELSE
BEGIN
    -- ถ้ายังไม่มีคอลัมน์ device_type ให้อัปเดตทุกแถวที่ x,y เป็น NULL (ใช้เมื่อมีแค่ไฟในตาราง)
    UPDATE [dbo].[devices]
    SET [x] = N'15.0000,85.2632',
        [y] = N'19.6897,80.0000'
    WHERE [x] IS NULL AND [y] IS NULL;
    PRINT N'Updated device(s) with light position (no device_type column)';
END
GO
