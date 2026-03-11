-- สร้างตาราง cctv_area_config สำหรับบันทึกพื้นที่วาดนับคนบนหน้า /cctv
-- รันสคริปต์นี้ถ้า DB มีอยู่แล้วและยังไม่มีตาราง (หรือใช้ create_smart_room_booking_mssql.sql ที่รวมตารางนี้แล้ว)

IF OBJECT_ID(N'dbo.cctv_area_config', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[cctv_area_config] (
        [id] int IDENTITY(1,1) NOT NULL,
        [config_key] nvarchar(50) NOT NULL DEFAULT N'default',
        [areas] nvarchar(max) NULL,
        [updated_at] datetime2 NULL,
        CONSTRAINT [PK_cctv_area_config] PRIMARY KEY ([id]),
        CONSTRAINT [UQ_cctv_area_config_key] UNIQUE ([config_key])
    );
    PRINT N'สร้างตาราง cctv_area_config เรียบร้อยแล้ว';
END
ELSE
    PRINT N'ตาราง cctv_area_config มีอยู่แล้ว';
GO
