-- Add image column to buildings table (path/URL for building photo)
-- Run on SQL Server: smart_room_booking

USE [smart_room_booking];
GO

IF COL_LENGTH(N'dbo.buildings', N'image') IS NULL
BEGIN
    ALTER TABLE [dbo].[buildings] ADD [image] nvarchar(500) NULL;
    PRINT N'Added column buildings.image';
END
ELSE
    PRINT N'Column buildings.image already exists';
GO
