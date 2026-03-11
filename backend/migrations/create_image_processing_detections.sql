-- ตาราง image_processing_detections เก็บผลการ detect คนจาก image processing
-- แต่ละแถว = 1 คน (person_index) ใน zone ที่ recorded_at เดียวกัน
-- จำนวนคนใน zone = COUNT(*) กลุ่มล่าสุดของ zone นั้น

USE [smart_room_booking];
GO

IF OBJECT_ID(N'dbo.image_processing_detections', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[image_processing_detections] (
        [id] bigint IDENTITY(1,1) NOT NULL,
        [zone_name] nvarchar(255) NULL,
        [person_index] int NOT NULL DEFAULT 0,
        [camera_id] int NULL,
        [recorded_at] datetime2 NOT NULL DEFAULT GETDATE(),
        [created_at] datetime2 NULL DEFAULT GETDATE(),
        CONSTRAINT [PK_image_processing_detections] PRIMARY KEY ([id]),
        CONSTRAINT [FK_image_processing_detections_camera] FOREIGN KEY ([camera_id]) REFERENCES [dbo].[cctv_cameras]([id]) ON DELETE SET NULL
    );
    CREATE INDEX [IX_image_processing_detections_zone_recorded] ON [dbo].[image_processing_detections]([zone_name], [recorded_at] DESC);
    PRINT N'สร้างตาราง image_processing_detections เรียบร้อยแล้ว';
END
ELSE
    PRINT N'ตาราง image_processing_detections มีอยู่แล้ว';
GO
