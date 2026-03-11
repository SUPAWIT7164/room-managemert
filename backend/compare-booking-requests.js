const sql = require('mssql');

// Database configurations
const config1 = {
    server: '10.3.2.10',
    port: 1433,
    user: 'devadmin',
    password: 'Lannacom@Dev@2025',
    database: 'smart_room_booking',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 10000,
        requestTimeout: 30000,
    }
};

const config2 = {
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

async function getTableStructure(pool, tableName) {
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
    
    return {
        columns: columnResult.recordset,
        primaryKeys,
        foreignKeys: fkResult.recordset,
        identityColumns: identityResult.recordset
    };
}

async function compareBookingRequests() {
    let pool1, pool2;
    
    try {
        console.log('='.repeat(70));
        console.log('🔍 กำลังเปรียบเทียบตาราง booking_requests');
        console.log('='.repeat(70));
        console.log('');
        
        // Connect to smart_room_booking
        console.log('📊 กำลังเชื่อมต่อ smart_room_booking...');
        pool1 = new sql.ConnectionPool(config1);
        await pool1.connect();
        console.log('✅ เชื่อมต่อ smart_room_booking สำเร็จ\n');
        
        const structure1 = await getTableStructure(pool1, 'booking_requests');
        console.log(`📋 smart_room_booking.booking_requests (${structure1.columns.length} columns):`);
        structure1.columns.forEach(col => {
            let type = col.DATA_TYPE.toUpperCase();
            if (col.CHARACTER_MAXIMUM_LENGTH) {
                if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                    type += '(MAX)';
                } else {
                    type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                }
            }
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const identity = structure1.identityColumns.find(ic => ic.COLUMN_NAME === col.COLUMN_NAME) ? ' IDENTITY' : '';
            const pk = structure1.primaryKeys.includes(col.COLUMN_NAME) ? ' [PK]' : '';
            console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}${identity}${pk}`);
        });
        console.log('');
        
        // Connect to room-management-portal
        console.log('📊 กำลังเชื่อมต่อ room-management-portal...');
        pool2 = new sql.ConnectionPool(config2);
        await pool2.connect();
        console.log('✅ เชื่อมต่อ room-management-portal สำเร็จ\n');
        
        const structure2 = await getTableStructure(pool2, 'booking_requests');
        console.log(`📋 room-management-portal.booking_requests (${structure2.columns.length} columns):`);
        structure2.columns.forEach(col => {
            let type = col.DATA_TYPE.toUpperCase();
            if (col.CHARACTER_MAXIMUM_LENGTH) {
                if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                    type += '(MAX)';
                } else {
                    type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                }
            }
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const identity = structure2.identityColumns.find(ic => ic.COLUMN_NAME === col.COLUMN_NAME) ? ' IDENTITY' : '';
            const pk = structure2.primaryKeys.includes(col.COLUMN_NAME) ? ' [PK]' : '';
            console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}${identity}${pk}`);
        });
        console.log('');
        
        // Compare columns
        const cols1 = structure1.columns.map(c => c.COLUMN_NAME.toLowerCase());
        const cols2 = structure2.columns.map(c => c.COLUMN_NAME.toLowerCase());
        
        const missingIn1 = cols2.filter(c => !cols1.includes(c));
        const missingIn2 = cols1.filter(c => !cols2.includes(c));
        const common = cols1.filter(c => cols2.includes(c));
        
        console.log('='.repeat(70));
        console.log('📊 ผลการเปรียบเทียบ:');
        console.log('='.repeat(70));
        console.log(`   - ตารางที่เหมือนกัน: ${common.length} columns`);
        console.log(`   - columns ที่ smart_room_booking ขาด: ${missingIn1.length} columns`);
        console.log(`   - columns ที่ room-management-portal ขาด: ${missingIn2.length} columns`);
        console.log('');
        
        if (missingIn1.length > 0) {
            console.log('❌ Columns ที่ smart_room_booking ขาด:');
            missingIn1.forEach(col => {
                const colInfo = structure2.columns.find(c => c.COLUMN_NAME.toLowerCase() === col);
                let type = colInfo.DATA_TYPE.toUpperCase();
                if (colInfo.CHARACTER_MAXIMUM_LENGTH) {
                    if (colInfo.CHARACTER_MAXIMUM_LENGTH === -1) {
                        type += '(MAX)';
                    } else {
                        type += `(${colInfo.CHARACTER_MAXIMUM_LENGTH})`;
                    }
                }
                const nullable = colInfo.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
                console.log(`   - ${colInfo.COLUMN_NAME} (${type}, ${nullable})`);
            });
            console.log('');
        }
        
        if (missingIn2.length > 0) {
            console.log('❌ Columns ที่ room-management-portal ขาด (ควรลบออกจาก smart_room_booking):');
            missingIn2.forEach(col => {
                const colInfo = structure1.columns.find(c => c.COLUMN_NAME.toLowerCase() === col);
                let type = colInfo.DATA_TYPE.toUpperCase();
                if (colInfo.CHARACTER_MAXIMUM_LENGTH) {
                    if (colInfo.CHARACTER_MAXIMUM_LENGTH === -1) {
                        type += '(MAX)';
                    } else {
                        type += `(${colInfo.CHARACTER_MAXIMUM_LENGTH})`;
                    }
                }
                const nullable = colInfo.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
                console.log(`   - ${colInfo.COLUMN_NAME} (${type}, ${nullable})`);
            });
            console.log('');
        }
        
        // Check for participants column
        const hasParticipants1 = cols1.includes('participants');
        const hasParticipants2 = cols2.includes('participants');
        
        console.log('='.repeat(70));
        console.log('🔍 ตรวจสอบ column participants:');
        console.log('='.repeat(70));
        console.log(`   - smart_room_booking มี participants: ${hasParticipants1 ? '✅ ใช่' : '❌ ไม่มี'}`);
        console.log(`   - room-management-portal มี participants: ${hasParticipants2 ? '✅ ใช่' : '❌ ไม่มี'}`);
        if (hasParticipants1 && !hasParticipants2) {
            console.log('   ⚠️  ต้องลบ column participants ออกจาก smart_room_booking');
        }
        console.log('');
        
        await pool1.close();
        await pool2.close();
        
        return {
            structure1,
            structure2,
            missingIn1,
            missingIn2,
            hasParticipants1,
            hasParticipants2
        };
        
    } catch (error) {
        console.error('\n❌ เกิดข้อผิดพลาด:');
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        
        if (pool1 && pool1.connected) {
            await pool1.close();
        }
        if (pool2 && pool2.connected) {
            await pool2.close();
        }
        
        throw error;
    }
}

// Run the function
compareBookingRequests()
    .then(() => {
        process.exit(0);
    })
    .catch(error => {
        process.exit(1);
    });


