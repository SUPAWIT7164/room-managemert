const sql = require('mssql');

// Database configuration
const config = {
    server: '10.3.2.10',
    port: 1433,
    user: 'devadmin',
    password: 'Lannacom@Dev@2025',
    database: 'room-management-portal',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 10000,
        requestTimeout: 30000,
    }
};

async function getTableStructure(tableName) {
    let pool;
    
    try {
        console.log(`🔍 กำลังดึงโครงสร้างตาราง: ${tableName}`);
        console.log('='.repeat(70));
        
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        
        // Get column information
        const columnQuery = `
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION,
                NUMERIC_SCALE,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                ORDINAL_POSITION
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @tableName
            ORDER BY ORDINAL_POSITION
        `;
        
        const columnRequest = pool.request();
        columnRequest.input('tableName', sql.NVarChar(255), tableName);
        const columnResult = await columnRequest.query(columnQuery);
        
        // Get primary key information
        const pkQuery = `
            SELECT 
                COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = @tableName
            AND CONSTRAINT_NAME IN (
                SELECT CONSTRAINT_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_NAME = @tableName
                AND CONSTRAINT_TYPE = 'PRIMARY KEY'
            )
            ORDER BY ORDINAL_POSITION
        `;
        
        const pkRequest = pool.request();
        pkRequest.input('tableName', sql.NVarChar(255), tableName);
        const pkResult = await pkRequest.query(pkQuery);
        const primaryKeys = pkResult.recordset.map(row => row.COLUMN_NAME);
        
        // Get foreign key information
        const fkQuery = `
            SELECT 
                fk.name AS CONSTRAINT_NAME,
                COL_NAME(fk.parent_object_id, fkc.parent_column_id) AS COLUMN_NAME,
                OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS REFERENCED_SCHEMA,
                OBJECT_NAME(fk.referenced_object_id) AS REFERENCED_TABLE,
                COL_NAME(fk.referenced_object_id, fkc.referenced_column_id) AS REFERENCED_COLUMN
            FROM sys.foreign_keys AS fk
            INNER JOIN sys.foreign_key_columns AS fkc
                ON fk.object_id = fkc.constraint_object_id
            WHERE OBJECT_NAME(fk.parent_object_id) = @tableName
        `;
        
        const fkRequest = pool.request();
        fkRequest.input('tableName', sql.NVarChar(255), tableName);
        const fkResult = await fkRequest.query(fkQuery);
        
        // Get index information
        const indexQuery = `
            SELECT 
                i.name AS INDEX_NAME,
                i.is_unique,
                i.is_primary_key,
                STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS COLUMNS
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE OBJECT_NAME(i.object_id) = @tableName
            AND i.type_desc <> 'HEAP'
            GROUP BY i.name, i.is_unique, i.is_primary_key
            ORDER BY i.is_primary_key DESC, i.name
        `;
        
        const indexRequest = pool.request();
        indexRequest.input('tableName', sql.NVarChar(255), tableName);
        const indexResult = await indexRequest.query(indexQuery);
        
        // Get identity column information
        const identityQuery = `
            SELECT 
                c.name AS COLUMN_NAME,
                IDENT_SEED(OBJECT_SCHEMA_NAME(c.object_id) + '.' + OBJECT_NAME(c.object_id)) AS SEED,
                IDENT_INCR(OBJECT_SCHEMA_NAME(c.object_id) + '.' + OBJECT_NAME(c.object_id)) AS INCREMENT
            FROM sys.columns c
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            WHERE t.name = @tableName
            AND COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') = 1
        `;
        
        const identityRequest = pool.request();
        identityRequest.input('tableName', sql.NVarChar(255), tableName);
        const identityResult = await identityRequest.query(identityQuery);
        const identityColumns = identityResult.recordset.map(row => row.COLUMN_NAME);
        
        // Generate CREATE TABLE SQL
        let createTableSQL = `CREATE TABLE [dbo].[${tableName}] (\n`;
        
        const columns = [];
        columnResult.recordset.forEach((col, index) => {
            let colDef = `    [${col.COLUMN_NAME}] `;
            
            // Data type
            let dataType = col.DATA_TYPE.toUpperCase();
            if (dataType === 'VARCHAR' || dataType === 'NVARCHAR' || dataType === 'CHAR' || dataType === 'NCHAR') {
                const maxLength = col.CHARACTER_MAXIMUM_LENGTH;
                if (maxLength === -1) {
                    colDef += `${dataType}(MAX)`;
                } else {
                    colDef += `${dataType}(${maxLength})`;
                }
            } else if (dataType === 'DECIMAL' || dataType === 'NUMERIC') {
                colDef += `${dataType}(${col.NUMERIC_PRECISION}, ${col.NUMERIC_SCALE})`;
            } else if (dataType === 'FLOAT') {
                if (col.NUMERIC_PRECISION) {
                    colDef += `${dataType}(${col.NUMERIC_PRECISION})`;
                } else {
                    colDef += dataType;
                }
            } else {
                colDef += dataType;
            }
            
            // Identity
            if (identityColumns.includes(col.COLUMN_NAME)) {
                const identityCol = identityResult.recordset.find(r => r.COLUMN_NAME === col.COLUMN_NAME);
                colDef += ` IDENTITY(${identityCol.SEED}, ${identityCol.INCREMENT})`;
            }
            
            // Nullable
            if (col.IS_NULLABLE === 'NO') {
                colDef += ' NOT NULL';
            } else {
                colDef += ' NULL';
            }
            
            // Default value
            if (col.COLUMN_DEFAULT) {
                let defaultValue = col.COLUMN_DEFAULT;
                // Remove parentheses from default values like (getdate())
                defaultValue = defaultValue.replace(/^\(|\)$/g, '');
                colDef += ` DEFAULT ${defaultValue}`;
            }
            
            columns.push(colDef);
        });
        
        createTableSQL += columns.join(',\n');
        
        // Add primary key constraint
        if (primaryKeys.length > 0) {
            createTableSQL += `,\n    CONSTRAINT [PK_${tableName}] PRIMARY KEY CLUSTERED ([${primaryKeys.join('], [')}])`;
        }
        
        createTableSQL += '\n);\n';
        
        // Add foreign key constraints
        if (fkResult.recordset.length > 0) {
            createTableSQL += '\n';
            fkResult.recordset.forEach(fk => {
                createTableSQL += `ALTER TABLE [dbo].[${tableName}] ADD CONSTRAINT [${fk.CONSTRAINT_NAME}] FOREIGN KEY ([${fk.COLUMN_NAME}]) REFERENCES [${fk.REFERENCED_SCHEMA}].[${fk.REFERENCED_TABLE}] ([${fk.REFERENCED_COLUMN}]);\n`;
            });
        }
        
        // Add non-clustered indexes
        const nonClusteredIndexes = indexResult.recordset.filter(idx => !idx.is_primary_key);
        if (nonClusteredIndexes.length > 0) {
            createTableSQL += '\n';
            nonClusteredIndexes.forEach(idx => {
                const unique = idx.is_unique ? 'UNIQUE ' : '';
                createTableSQL += `CREATE ${unique}NONCLUSTERED INDEX [${idx.INDEX_NAME}] ON [dbo].[${tableName}] ([${idx.COLUMNS}]);\n`;
            });
        }
        
        console.log('\n📋 โครงสร้างตาราง:');
        console.log('='.repeat(70));
        columnResult.recordset.forEach(col => {
            let type = col.DATA_TYPE.toUpperCase();
            if (col.CHARACTER_MAXIMUM_LENGTH) {
                if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                    type += '(MAX)';
                } else {
                    type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                }
            }
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const identity = identityColumns.includes(col.COLUMN_NAME) ? ' IDENTITY' : '';
            const pk = primaryKeys.includes(col.COLUMN_NAME) ? ' [PK]' : '';
            console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}${identity}${pk}`);
        });
        
        if (primaryKeys.length > 0) {
            console.log(`\n🔑 Primary Key: ${primaryKeys.join(', ')}`);
        }
        
        if (fkResult.recordset.length > 0) {
            console.log('\n🔗 Foreign Keys:');
            fkResult.recordset.forEach(fk => {
                console.log(`   ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE}.${fk.REFERENCED_COLUMN}`);
            });
        }
        
        if (nonClusteredIndexes.length > 0) {
            console.log('\n📇 Indexes:');
            nonClusteredIndexes.forEach(idx => {
                const unique = idx.is_unique ? 'UNIQUE ' : '';
                console.log(`   ${unique}${idx.INDEX_NAME}: ${idx.COLUMNS}`);
            });
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('📝 SQL Script:');
        console.log('='.repeat(70));
        console.log(createTableSQL);
        
        // Get sample data
        const sampleQuery = `SELECT TOP 5 * FROM [dbo].[${tableName}]`;
        try {
            const sampleResult = await pool.request().query(sampleQuery);
            if (sampleResult.recordset.length > 0) {
                console.log('\n' + '='.repeat(70));
                console.log('📊 ตัวอย่างข้อมูล (5 แถวแรก):');
                console.log('='.repeat(70));
                console.log(JSON.stringify(sampleResult.recordset, null, 2));
            }
        } catch (err) {
            console.log('\n⚠️  ไม่สามารถดึงข้อมูลตัวอย่างได้');
        }
        
        await pool.close();
        
        return {
            createTableSQL,
            columns: columnResult.recordset,
            primaryKeys,
            foreignKeys: fkResult.recordset,
            indexes: indexResult.recordset
        };
        
    } catch (error) {
        console.error('\n❌ เกิดข้อผิดพลาด:');
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        
        if (pool && pool.connected) {
            await pool.close();
        }
        
        throw error;
    }
}

// Get table name from command line argument
const tableName = process.argv[2] || 'participants';

getTableStructure(tableName)
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        process.exit(1);
    });

