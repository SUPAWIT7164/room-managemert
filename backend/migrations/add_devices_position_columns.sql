-- Add device_type, x1, y1, x2, y2 to devices for storing control device position (device_index ไม่ใช้)
-- Run on SQL Server: smart_room_booking

USE [smart_room_booking];
GO

IF COL_LENGTH(N'dbo.devices', N'device_type') IS NULL
BEGIN
    ALTER TABLE [dbo].[devices] ADD [device_type] nvarchar(20) NULL;
    PRINT N'Added column devices.device_type';
END
GO
IF COL_LENGTH(N'dbo.devices', N'x1') IS NULL
BEGIN
    ALTER TABLE [dbo].[devices] ADD [x1] decimal(10,4) NULL;
    PRINT N'Added column devices.x1';
END
GO
IF COL_LENGTH(N'dbo.devices', N'y1') IS NULL
BEGIN
    ALTER TABLE [dbo].[devices] ADD [y1] decimal(10,4) NULL;
    PRINT N'Added column devices.y1';
END
GO
IF COL_LENGTH(N'dbo.devices', N'x2') IS NULL
BEGIN
    ALTER TABLE [dbo].[devices] ADD [x2] decimal(10,4) NULL;
    PRINT N'Added column devices.x2';
END
GO
IF COL_LENGTH(N'dbo.devices', N'y2') IS NULL
BEGIN
    ALTER TABLE [dbo].[devices] ADD [y2] decimal(10,4) NULL;
    PRINT N'Added column devices.y2';
END
GO
