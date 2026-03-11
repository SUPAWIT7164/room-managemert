-- ตารางกล้อง CCTV (IP, user, password)
-- รันสคริปต์นี้บน SQL Server หลังจากมี DB smart_room_booking แล้ว

USE [smart_room_booking];
GO

IF OBJECT_ID(N'dbo.cctv_cameras', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[cctv_cameras] (
        [id] int IDENTITY(1,1) NOT NULL,
        [name] nvarchar(255) NULL,
        [base_url] nvarchar(500) NOT NULL,
        [username] nvarchar(255) NOT NULL,
        [password] nvarchar(255) NOT NULL,
        [snapshot_endpoint] nvarchar(255) NULL DEFAULT N'/ISAPI/Streaming/channels/101/picture',
        [created_at] datetime2 NULL DEFAULT GETDATE(),
        [updated_at] datetime2 NULL DEFAULT GETDATE(),
        CONSTRAINT [PK_cctv_cameras] PRIMARY KEY ([id])
    );
    PRINT N'สร้างตาราง cctv_cameras เรียบร้อยแล้ว';
END
ELSE
    PRINT N'ตาราง cctv_cameras มีอยู่แล้ว';
GO

-- ตารางบันทึกผลการนับคน (จาก image processing)
IF OBJECT_ID(N'dbo.people_count_logs', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[people_count_logs] (
        [id] bigint IDENTITY(1,1) NOT NULL,
        [camera_id] int NOT NULL,
        [zone_name] nvarchar(255) NULL,
        [count] int NOT NULL DEFAULT 0,
        [snapshot_path] nvarchar(500) NULL,
        [recorded_at] datetime2 NOT NULL DEFAULT GETDATE(),
        [created_at] datetime2 NULL DEFAULT GETDATE(),
        CONSTRAINT [PK_people_count_logs] PRIMARY KEY ([id]),
        CONSTRAINT [FK_people_count_logs_camera] FOREIGN KEY ([camera_id]) REFERENCES [dbo].[cctv_cameras]([id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_people_count_logs_camera_recorded] ON [dbo].[people_count_logs]([camera_id], [recorded_at] DESC);
    PRINT N'สร้างตาราง people_count_logs เรียบร้อยแล้ว';
END
ELSE
    PRINT N'ตาราง people_count_logs มีอยู่แล้ว';
GO
