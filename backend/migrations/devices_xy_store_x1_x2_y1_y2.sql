-- Store x1,x2 in column x and y1,y2 in column y (no new columns).
-- Format: x = 'x1,x2' (e.g. '15.0000,85.2632'), y = 'y1,y2' (e.g. '19.6897,80.0000').
-- SQL Server: smart_room_booking

USE [smart_room_booking];
GO

-- Alter x from decimal to nvarchar to store "x1,x2"
IF COL_LENGTH(N'dbo.devices', N'x') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[devices] ALTER COLUMN [x] nvarchar(50) NULL;
    PRINT N'Altered column devices.x to nvarchar(50) for x1,x2 format';
END
GO

-- Alter y from decimal to nvarchar to store "y1,y2"
IF COL_LENGTH(N'dbo.devices', N'y') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[devices] ALTER COLUMN [y] nvarchar(50) NULL;
    PRINT N'Altered column devices.y to nvarchar(50) for y1,y2 format';
END
GO
