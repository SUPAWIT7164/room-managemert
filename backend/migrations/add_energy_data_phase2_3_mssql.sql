-- =============================================================================
-- Add optional phase 2 & 3 meter columns to dbo.energy_data (SQL Server)
-- energy2/voltage2/current2 — second phase; energy3/voltage3/current3 — third
-- Run once against the target database.
-- =============================================================================

IF OBJECT_ID(N'dbo.energy_data', N'U') IS NULL
BEGIN
    RAISERROR(N'Table dbo.energy_data does not exist.', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'energy2')
    ALTER TABLE [dbo].[energy_data] ADD [energy2] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'voltage2')
    ALTER TABLE [dbo].[energy_data] ADD [voltage2] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'current2')
    ALTER TABLE [dbo].[energy_data] ADD [current2] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'energy3')
    ALTER TABLE [dbo].[energy_data] ADD [energy3] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'voltage3')
    ALTER TABLE [dbo].[energy_data] ADD [voltage3] decimal(10,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.energy_data') AND name = N'current3')
    ALTER TABLE [dbo].[energy_data] ADD [current3] decimal(10,2) NULL;
GO
