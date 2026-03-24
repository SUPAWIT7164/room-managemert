-- OPTIONAL: ลบคอลัมน์ device_index ออกจากตาราง (SQL Server)
-- ถ้าต้องการแค่ "เก็บคอลัมน์ไว้แต่ไม่ใช้" — ไม่ต้องรันไฟล์นี้ ให้รันแค่ device_index_nullable_mssql.sql แล้วให้แอปเซ็ต device_index = NULL
-- เมื่อรันไฟล์นี้: ต้องมี device_id ครบทุกแถวที่จะเก็บ — แถว device_id IS NULL จะถูกลบ

-- Run after add_device_id_to_device_states_mssql.sql

SET QUOTED_IDENTIFIER ON;
GO

-- Allow NULL temporarily if column was NOT NULL (needed before we drop orphans / column)
IF COL_LENGTH('device_states', 'device_index') IS NOT NULL
BEGIN
    ALTER TABLE dbo.device_states ALTER COLUMN device_index INT NULL;
END
GO

DELETE FROM dbo.device_states WHERE device_id IS NULL;
GO

-- Drop indexes/constraints that use column device_index (keeps PK and indexes without that column)
DECLARE @indexName sysname;
DECLARE @sql nvarchar(520);

DECLARE idx_cur CURSOR LOCAL FAST_FORWARD FOR
SELECT DISTINCT i.name
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID(N'dbo.device_states')
  AND c.name = N'device_index'
  AND i.is_hypothetical = 0
  AND i.index_id > 0
  AND i.name IS NOT NULL;

OPEN idx_cur;
FETCH NEXT FROM idx_cur INTO @indexName;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'DROP INDEX ' + QUOTENAME(@indexName) + N' ON dbo.device_states';
    BEGIN TRY
        EXEC sp_executesql @sql;
    END TRY
    BEGIN CATCH
        PRINT N'Could not drop index ' + @indexName + N': ' + ERROR_MESSAGE();
    END CATCH
    FETCH NEXT FROM idx_cur INTO @indexName;
END
CLOSE idx_cur;
DEALLOCATE idx_cur;
GO

-- Default constraints on device_index
DECLARE @dc sysname;
SELECT @dc = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.device_states') AND c.name = N'device_index';

IF @dc IS NOT NULL
BEGIN
    SET @sql = N'ALTER TABLE dbo.device_states DROP CONSTRAINT ' + QUOTENAME(@dc);
    EXEC sp_executesql @sql;
END
GO

IF COL_LENGTH('device_states', 'device_index') IS NOT NULL
    ALTER TABLE dbo.device_states DROP COLUMN device_index;
GO

-- Area queries: index without device_index
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.device_states') AND name = 'idx_device_states_area_id'
)
BEGIN
    CREATE NONCLUSTERED INDEX idx_device_states_area_id
    ON dbo.device_states (area_id, device_type)
    WHERE area_id IS NOT NULL;
END
GO

PRINT N'drop_device_index_device_states_mssql: completed';
GO
