-- Add image column to areas table (URL/path for floor plan image per floor)
-- Run on SQL Server: smart_room_booking

USE [smart_room_booking];
GO

IF COL_LENGTH(N'dbo.areas', N'image') IS NULL
BEGIN
    ALTER TABLE [dbo].[areas] ADD [image] nvarchar(500) NULL;
    PRINT N'Added column areas.image';
END
ELSE
    PRINT N'Column areas.image already exists';
GO
