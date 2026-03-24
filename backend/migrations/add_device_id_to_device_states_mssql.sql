-- Add device_id to device_states and backfill (SQL Server)
-- Target DB: smart_room_booking
-- Purpose: Link device_states to devices.id directly (stable identity)

SET QUOTED_IDENTIFIER ON;
GO

-- 1) Add column device_id if missing
IF COL_LENGTH('device_states', 'device_id') IS NULL
BEGIN
    ALTER TABLE device_states ADD device_id BIGINT NULL;
END
GO

-- 2) Backfill device_id for room-based states (room_id + device_type + device_index -> devices.id by order)
;WITH ranked_devices AS (
    SELECT
        d.id AS device_id,
        d.room_id,
        CASE
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('air') THEN 'ac'
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('ac') THEN 'ac'
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('erv') THEN 'erv'
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('light') THEN 'light'
            ELSE NULL
        END AS norm_type,
        ROW_NUMBER() OVER (
            PARTITION BY d.room_id,
                         CASE
                             WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('air','ac') THEN 'ac'
                             WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('erv') THEN 'erv'
                             WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('light') THEN 'light'
                             ELSE NULL
                         END
            ORDER BY d.id
        ) AS rn
    FROM devices d
    WHERE d.room_id IS NOT NULL
      AND (d.disable = 0 OR d.disable IS NULL)
)
UPDATE ds
SET ds.device_id = rd.device_id
FROM device_states ds
JOIN ranked_devices rd
  ON rd.room_id = ds.room_id
 AND rd.norm_type = ds.device_type
 AND rd.rn = (ds.device_index + 1)
WHERE ds.device_id IS NULL
  AND ds.room_id IS NOT NULL;
GO

-- 3) Backfill device_id for area-based states (area_id + device_type + device_index -> devices.id by order)
;WITH ranked_area_devices AS (
    SELECT
        d.id AS device_id,
        d.area_id,
        CASE
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('air') THEN 'ac'
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('ac') THEN 'ac'
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('erv') THEN 'erv'
            WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('light') THEN 'light'
            ELSE NULL
        END AS norm_type,
        ROW_NUMBER() OVER (
            PARTITION BY d.area_id,
                         CASE
                             WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('air','ac') THEN 'ac'
                             WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('erv') THEN 'erv'
                             WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('light') THEN 'light'
                             ELSE NULL
                         END
            ORDER BY d.id
        ) AS rn
    FROM devices d
    WHERE d.area_id IS NOT NULL
      AND (d.disable = 0 OR d.disable IS NULL)
)
UPDATE ds
SET ds.device_id = rd.device_id
FROM device_states ds
JOIN ranked_area_devices rd
  ON rd.area_id = ds.area_id
 AND rd.norm_type = ds.device_type
 AND rd.rn = (ds.device_index + 1)
WHERE ds.device_id IS NULL
  AND ds.area_id IS NOT NULL;
GO

-- 4) Indexes / constraints
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_device_states_device_id' AND object_id = OBJECT_ID('device_states'))
BEGIN
    CREATE INDEX idx_device_states_device_id ON device_states(device_id);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'uq_device_states_device_id' AND object_id = OBJECT_ID('device_states'))
BEGIN
    CREATE UNIQUE INDEX uq_device_states_device_id
    ON device_states(device_id)
    WHERE device_id IS NOT NULL;
END
GO

-- FK (optional but recommended). Keep it NOCHECK so existing rows with NULL don't block.
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'fk_device_states_device_id')
BEGIN
    ALTER TABLE device_states WITH NOCHECK
    ADD CONSTRAINT fk_device_states_device_id FOREIGN KEY (device_id) REFERENCES devices(id);
END
GO

