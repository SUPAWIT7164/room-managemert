-- =============================================================================
-- Create table dbo.watermeter_data (SQL Server)
-- Stores flow and totalizer values from water meter devices
-- =============================================================================

IF OBJECT_ID(N'dbo.watermeter_data', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[watermeter_data] (
        [id] bigint IDENTITY(1,1) NOT NULL,
        [device_id] bigint NULL,
        [device_type_id] bigint NULL,
        [flowrate] decimal(10,2) NULL,
        [totalizer] decimal(18,2) NULL,
        [waterpump] bit NULL,
        [building_id] bigint NULL,
        [room_id] bigint NULL,
        [area_id] bigint NULL,
        [recorded_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
        [created_at] datetime2 NULL,
        [updated_at] datetime2 NULL,
        CONSTRAINT [PK_watermeter_data] PRIMARY KEY ([id])
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_watermeter_data_device_id'
      AND object_id = OBJECT_ID(N'dbo.watermeter_data')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_watermeter_data_device_id]
    ON [dbo].[watermeter_data] ([device_id]);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_watermeter_data_recorded_at'
      AND object_id = OBJECT_ID(N'dbo.watermeter_data')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_watermeter_data_recorded_at]
    ON [dbo].[watermeter_data] ([recorded_at]);
END
GO
