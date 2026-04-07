-- =============================================================================
-- Disable unique constraints for device_states (history mode)
-- - Keep multiple rows per device_id (each control event as new record)
-- - Drop legacy unique indexes if they exist
-- =============================================================================

IF OBJECT_ID(N'dbo.device_states', N'U') IS NULL
BEGIN
    RAISERROR(N'Table dbo.device_states does not exist.', 16, 1);
    RETURN;
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'ux_device_states_device_id'
      AND object_id = OBJECT_ID(N'dbo.device_states')
)
BEGIN
    DROP INDEX ux_device_states_device_id ON dbo.device_states;
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'uq_device_states_device_id'
      AND object_id = OBJECT_ID(N'dbo.device_states')
)
BEGIN
    DROP INDEX uq_device_states_device_id ON dbo.device_states;
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'uq_device_states_area'
      AND object_id = OBJECT_ID(N'dbo.device_states')
)
BEGIN
    DROP INDEX uq_device_states_area ON dbo.device_states;
END
GO
