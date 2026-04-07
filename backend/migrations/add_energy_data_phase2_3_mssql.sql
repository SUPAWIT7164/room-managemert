-- =============================================================================
-- Add optional phase 2 & 3 meter columns to dbo.energy_data (SQL Server)
-- power2/voltage2/current2/power_factor2 — second phase
-- power3/voltage3/current3/power_factor3 — third phase
-- Run once against the target database.
-- =============================================================================

IF OBJECT_ID(N'dbo.energy_data', N'U') IS NULL
BEGIN
    RAISERROR(N'Table dbo.energy_data does not exist.', 16, 1);
    RETURN;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'energy2')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power2')
    EXEC sp_rename N'dbo.energy_data.energy2', N'power2', N'COLUMN';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power2')
    ALTER TABLE [dbo].[energy_data] ADD [power2] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'voltage2')
    ALTER TABLE [dbo].[energy_data] ADD [voltage2] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'current2')
    ALTER TABLE [dbo].[energy_data] ADD [current2] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power_factor2')
    ALTER TABLE [dbo].[energy_data] ADD [power_factor2] decimal(5,2) NULL;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'energy3')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power3')
    EXEC sp_rename N'dbo.energy_data.energy3', N'power3', N'COLUMN';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power3')
    ALTER TABLE [dbo].[energy_data] ADD [power3] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'voltage3')
    ALTER TABLE [dbo].[energy_data] ADD [voltage3] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'current3')
    ALTER TABLE [dbo].[energy_data] ADD [current3] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power_factor3')
    ALTER TABLE [dbo].[energy_data] ADD [power_factor3] decimal(5,2) NULL;
GO

-- Cleanup legacy columns if they still exist alongside new names.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'energy2')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power2')
        UPDATE [dbo].[energy_data]
        SET [power2] = COALESCE([power2], [energy2])
        WHERE [energy2] IS NOT NULL;

    ALTER TABLE [dbo].[energy_data] DROP COLUMN [energy2];
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'energy3')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'power3')
        UPDATE [dbo].[energy_data]
        SET [power3] = COALESCE([power3], [energy3])
        WHERE [energy3] IS NOT NULL;

    ALTER TABLE [dbo].[energy_data] DROP COLUMN [energy3];
END
GO
