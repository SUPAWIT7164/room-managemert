const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Database configuration for smart_room_booking
const config = {
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

async function createParticipantsTable() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔧 กำลังสร้างตาราง participants ใน smart_room_booking');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        // Read SQL script
        const sqlFilePath = path.join(__dirname, 'create-participants-table.sql');
        const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
        
        // Split script by GO statements
        const batches = sqlScript.split(/\bGO\b/gi).filter(batch => batch.trim().length > 0);
        
        console.log(`📝 กำลังรัน SQL script (${batches.length} batches)...\n`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch.length === 0) continue;
            
            try {
                const result = await pool.request().query(batch);
                
                // Print messages if any
                if (result.recordset && result.recordset.length > 0) {
                    result.recordset.forEach(row => {
                        const message = Object.values(row)[0];
                        if (message) {
                            console.log(`   ${message}`);
                        }
                    });
                }
            } catch (error) {
                // Some errors are expected (like table already exists)
                if (error.message.includes('already exists') || 
                    error.message.includes('มีอยู่แล้ว') ||
                    error.message.includes('already an object')) {
                    // Ignore these errors
                } else {
                    throw error;
                }
            }
        }
        
        // Verify table was created
        console.log('\n🔍 กำลังตรวจสอบตาราง...');
        const checkQuery = `
            SELECT 
                TABLE_NAME,
                (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'participants') AS COLUMN_COUNT
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'participants'
        `;
        
        const checkResult = await pool.request().query(checkQuery);
        
        if (checkResult.recordset.length > 0) {
            console.log('✅ ตาราง participants ถูกสร้างเรียบร้อยแล้ว');
            
            // Get column information
            const columnQuery = `
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    CHARACTER_MAXIMUM_LENGTH,
                    IS_NULLABLE,
                    COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'participants'
                ORDER BY ORDINAL_POSITION
            `;
            
            const columnResult = await pool.request().query(columnQuery);
            console.log('\n📋 โครงสร้างตาราง:');
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
                console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${type.padEnd(20)} ${nullable}`);
            });
            
            // Check foreign key
            const fkQuery = `
                SELECT 
                    fk.name AS CONSTRAINT_NAME,
                    OBJECT_NAME(fk.referenced_object_id) AS REFERENCED_TABLE
                FROM sys.foreign_keys AS fk
                WHERE OBJECT_NAME(fk.parent_object_id) = 'participants'
            `;
            
            const fkResult = await pool.request().query(fkQuery);
            if (fkResult.recordset.length > 0) {
                console.log('\n🔗 Foreign Keys:');
                fkResult.recordset.forEach(fk => {
                    console.log(`   ${fk.CONSTRAINT_NAME} -> ${fk.REFERENCED_TABLE}`);
                });
            }
        } else {
            console.log('❌ ไม่พบตาราง participants');
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ เสร็จสิ้น');
        console.log('='.repeat(70));
        
        await pool.close();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ เกิดข้อผิดพลาด:');
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Number:', error.number);
        
        if (error.stack) {
            console.error('\nStack Trace:');
            console.error(error.stack);
        }
        
        if (pool && pool.connected) {
            await pool.close();
        }
        
        process.exit(1);
    }
}

// Run the function
createParticipantsTable();


