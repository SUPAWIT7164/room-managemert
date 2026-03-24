-- Migration: Add area_id to device_states table
-- This allows device states to be stored for area-level devices (devices with area_id but no room_id)

-- Add area_id column (nullable, since existing records use room_id)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('device_states') AND name = 'area_id')
BEGIN
    ALTER TABLE device_states ADD area_id INT NULL;
END
GO

-- Make room_id nullable (for area devices that don't have room_id)
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('device_states') AND name = 'room_id' AND is_nullable = 0)
BEGIN
    ALTER TABLE device_states ALTER COLUMN room_id INT NULL;
END
GO

-- Create index for area_id queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_device_states_area_id' AND object_id = OBJECT_ID('device_states'))
BEGIN
    CREATE INDEX idx_device_states_area_id ON device_states(area_id, device_type, device_index);
END
GO

-- Add unique constraint for area devices (area_id + device_type + device_index)
-- Note: This is a filtered unique index to allow multiple NULLs
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'uq_device_states_area' AND object_id = OBJECT_ID('device_states'))
BEGIN
    CREATE UNIQUE INDEX uq_device_states_area 
    ON device_states(area_id, device_type, device_index) 
    WHERE area_id IS NOT NULL;
END
GO

-- Add check constraint: must have either room_id OR area_id (not both, not neither)
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'chk_room_or_area' AND parent_object_id = OBJECT_ID('device_states'))
BEGIN
    ALTER TABLE device_states 
    ADD CONSTRAINT chk_room_or_area 
    CHECK ((room_id IS NOT NULL AND area_id IS NULL) OR (room_id IS NULL AND area_id IS NOT NULL));
END
GO

PRINT 'Migration completed: area_id added to device_states table';
