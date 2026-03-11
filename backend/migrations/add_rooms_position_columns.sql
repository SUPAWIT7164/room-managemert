-- Add x1, y1, x2, y2 and device_positions (JSON) to rooms for /rooms/control
-- Run on SQL Server: smart_room_booking

USE [smart_room_booking];
GO

IF COL_LENGTH(N'dbo.rooms', N'x1') IS NULL
BEGIN
    ALTER TABLE [dbo].[rooms] ADD [x1] decimal(10,4) NULL;
    PRINT N'Added column rooms.x1';
END
GO
IF COL_LENGTH(N'dbo.rooms', N'y1') IS NULL
BEGIN
    ALTER TABLE [dbo].[rooms] ADD [y1] decimal(10,4) NULL;
    PRINT N'Added column rooms.y1';
END
GO
IF COL_LENGTH(N'dbo.rooms', N'x2') IS NULL
BEGIN
    ALTER TABLE [dbo].[rooms] ADD [x2] decimal(10,4) NULL;
    PRINT N'Added column rooms.x2';
END
GO
IF COL_LENGTH(N'dbo.rooms', N'y2') IS NULL
BEGIN
    ALTER TABLE [dbo].[rooms] ADD [y2] decimal(10,4) NULL;
    PRINT N'Added column rooms.y2';
END
GO
IF COL_LENGTH(N'dbo.rooms', N'device_positions') IS NULL
BEGIN
    ALTER TABLE [dbo].[rooms] ADD [device_positions] nvarchar(max) NULL;
    PRINT N'Added column rooms.device_positions (JSON)';
END
GO
