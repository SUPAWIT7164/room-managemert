-- =============================================================================
-- Create table dbo.people_count (SQL Server)
-- Stores people counting results by device
-- =============================================================================

IF OBJECT_ID(N'dbo.people_count', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[people_count] (
        [id] bigint IDENTITY(1,1) NOT NULL,
        [device_id] bigint NULL,
        [people_count] int NOT NULL DEFAULT 0,
        [faces_count] int NOT NULL DEFAULT 0,
        [confidence] decimal(5,2) NULL,
        [created_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
        [updated_at] datetime2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT [PK_people_count] PRIMARY KEY ([id])
    );
END
GO

IF COL_LENGTH(N'dbo.people_count', N'device_id') IS NOT NULL
   AND OBJECT_ID(N'dbo.devices', N'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = N'FK_people_count_device'
         AND parent_object_id = OBJECT_ID(N'dbo.people_count')
   )
BEGIN
    ALTER TABLE [dbo].[people_count]
    ADD CONSTRAINT [FK_people_count_device]
    FOREIGN KEY ([device_id]) REFERENCES [dbo].[devices]([id]);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_people_count_device_id'
      AND object_id = OBJECT_ID(N'dbo.people_count')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_people_count_device_id]
    ON [dbo].[people_count] ([device_id]);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_people_count_created_at'
      AND object_id = OBJECT_ID(N'dbo.people_count')
)
BEGIN
    CREATE NONCLUSTERED INDEX [idx_people_count_created_at]
    ON [dbo].[people_count] ([created_at] DESC);
END
GO

-- source_log_id: tracks which image_processing_logs.id this row was synced from
IF COL_LENGTH(N'dbo.people_count', N'source_log_id') IS NULL
BEGIN
    ALTER TABLE [dbo].[people_count] ADD [source_log_id] bigint NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'idx_people_count_source_log_id'
      AND object_id = OBJECT_ID(N'dbo.people_count')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [idx_people_count_source_log_id]
    ON [dbo].[people_count] ([source_log_id]) WHERE [source_log_id] IS NOT NULL;
END
GO
