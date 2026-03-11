-- Replace x1, y1, x2, y2 with single X, Y on devices (ตำแหน่งอุปกรณ์ในห้อง)
-- Run after add_devices_position_columns.sql if those columns exist.
-- SQL Server: smart_room_booking

USE [smart_room_booking];
GO

-- Add new columns x, y if not exist
IF COL_LENGTH(N'dbo.devices', N'x') IS NULL
BEGIN
    ALTER TABLE [dbo].[devices] ADD [x] decimal(10,4) NULL;
    PRINT N'Added column devices.x';
END
GO
IF COL_LENGTH(N'dbo.devices', N'y') IS NULL
BEGIN
    ALTER TABLE [dbo].[devices] ADD [y] decimal(10,4) NULL;
    PRINT N'Added column devices.y';
END
GO

-- Migrate data: copy x1,y1 into x,y (if old columns exist)
IF COL_LENGTH(N'dbo.devices', N'x1') IS NOT NULL
BEGIN
    UPDATE [dbo].[devices] SET [x] = [x1] WHERE [x1] IS NOT NULL AND [x] IS NULL;
    PRINT N'Migrated x1 -> x';
END
GO
IF COL_LENGTH(N'dbo.devices', N'y1') IS NOT NULL
BEGIN
    UPDATE [dbo].[devices] SET [y] = [y1] WHERE [y1] IS NOT NULL AND [y] IS NULL;
    PRINT N'Migrated y1 -> y';
END
GO

-- Drop old columns (SQL Server)
IF COL_LENGTH(N'dbo.devices', N'x1') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[devices] DROP COLUMN [x1];
    PRINT N'Dropped column devices.x1';
END
GO
IF COL_LENGTH(N'dbo.devices', N'y1') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[devices] DROP COLUMN [y1];
    PRINT N'Dropped column devices.y1';
END
GO
IF COL_LENGTH(N'dbo.devices', N'x2') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[devices] DROP COLUMN [x2];
    PRINT N'Dropped column devices.x2';
END
GO
IF COL_LENGTH(N'dbo.devices', N'y2') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[devices] DROP COLUMN [y2];
    PRINT N'Dropped column devices.y2';
END
GO
