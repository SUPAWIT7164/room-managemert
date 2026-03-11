const sql = require('mssql');

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

async function addColumns() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔧 กำลังเพิ่ม columns ใหม่ใน booking_requests');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        // List of columns to add
        const columnsToAdd = [
            { name: 'name', type: 'NVARCHAR(255)', nullable: 'NULL' },
            { name: 'booker', type: 'BIGINT', nullable: 'NULL' },
            { name: 'room', type: 'BIGINT', nullable: 'NULL' },
            { name: 'start', type: 'DATETIME', nullable: 'NOT NULL', defaultValue: 'GETDATE()' },
            { name: 'end', type: 'DATETIME', nullable: 'NOT NULL', defaultValue: 'GETDATE()' },
            { name: 'hour', type: 'DECIMAL(18,2)', nullable: 'NULL' },
            { name: 'instructor', type: 'NVARCHAR(MAX)', nullable: 'NULL' },
            { name: 'calendar_id', type: 'NVARCHAR(MAX)', nullable: 'NULL' },
            { name: 'icaluid', type: 'NVARCHAR(MAX)', nullable: 'NULL' },
            { name: 'qrcode', type: 'NVARCHAR(255)', nullable: 'NOT NULL', defaultValue: "''" },
            { name: 'online_meeting', type: 'BIT', nullable: 'NOT NULL', defaultValue: '0' },
            { name: 'email_notify', type: 'BIT', nullable: 'NOT NULL', defaultValue: '0' },
            { name: 'cancel', type: 'BIT', nullable: 'NULL' },
            { name: 'reject', type: 'BIT', nullable: 'NULL' },
            { name: 'reject_reason', type: 'NVARCHAR(255)', nullable: 'NULL' },
            { name: 'transaction_id', type: 'NVARCHAR(255)', nullable: 'NULL' },
            { name: 'approve_by', type: 'BIGINT', nullable: 'NULL' }
        ];
        
        console.log(`📝 กำลังเพิ่ม ${columnsToAdd.length} columns...\n`);
        
        for (const col of columnsToAdd) {
            // Check if column exists
            const checkQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'booking_requests' 
                AND COLUMN_NAME = @columnName
            `;
            
            const checkRequest = pool.request();
            checkRequest.input('columnName', sql.NVarChar(255), col.name);
            const checkResult = await checkRequest.query(checkQuery);
            
            if (checkResult.recordset.length > 0) {
                console.log(`⚠️  column ${col.name} มีอยู่แล้ว`);
                continue;
            }
            
            // Add column
            let alterQuery = `ALTER TABLE [dbo].[booking_requests] ADD [${col.name}] ${col.type} ${col.nullable}`;
            if (col.defaultValue) {
                alterQuery += ` DEFAULT ${col.defaultValue}`;
            }
            
            try {
                await pool.request().query(alterQuery);
                console.log(`✅ เพิ่ม column ${col.name} เรียบร้อยแล้ว`);
            } catch (error) {
                console.error(`❌ ไม่สามารถเพิ่ม column ${col.name}: ${error.message}`);
            }
        }
        
        // Migrate data from old columns to new columns
        console.log('\n📊 กำลัง migrate ข้อมูลจาก columns เก่าไปยัง columns ใหม่...\n');
        
        const migrations = [
            { from: 'user_id', to: 'booker' },
            { from: 'room_id', to: 'room' },
            { from: 'start_datetime', to: 'start', transform: 'CAST([start_datetime] AS DATETIME)' },
            { from: 'end_datetime', to: 'end', transform: 'CAST([end_datetime] AS DATETIME)' },
            { from: 'title', to: 'name' },
            { from: 'rejection_reason', to: 'reject_reason' },
            { from: 'approved_by', to: 'approve_by' }
        ];
        
        for (const migration of migrations) {
            // Check if both columns exist
            const checkFromQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'booking_requests' 
                AND COLUMN_NAME = @columnName
            `;
            
            const checkFromRequest = pool.request();
            checkFromRequest.input('columnName', sql.NVarChar(255), migration.from);
            const fromExists = await checkFromRequest.query(checkFromQuery);
            
            const checkToQuery = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'booking_requests' 
                AND COLUMN_NAME = @columnName
            `;
            
            const checkToRequest = pool.request();
            checkToRequest.input('columnName', sql.NVarChar(255), migration.to);
            const toExists = await checkToRequest.query(checkToQuery);
            
            if (fromExists.recordset.length > 0 && toExists.recordset.length > 0) {
                const source = migration.transform || `[${migration.from}]`;
                const updateQuery = `UPDATE [dbo].[booking_requests] SET [${migration.to}] = ${source} WHERE [${migration.to}] IS NULL`;
                
                try {
                    const result = await pool.request().query(updateQuery);
                    console.log(`✅ Migrate ${migration.from} -> ${migration.to} (${result.rowsAffected[0]} แถว)`);
                } catch (error) {
                    console.error(`❌ ไม่สามารถ migrate ${migration.from} -> ${migration.to}: ${error.message}`);
                }
            }
        }
        
        // Verify final structure
        console.log('\n🔍 กำลังตรวจสอบโครงสร้างตาราง...');
        const verifyQuery = `
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'booking_requests'
            ORDER BY ORDINAL_POSITION
        `;
        
        const verifyResult = await pool.request().query(verifyQuery);
        console.log(`\n📋 โครงสร้างตาราง booking_requests (${verifyResult.recordset.length} columns):`);
        verifyResult.recordset.forEach(col => {
            let type = col.DATA_TYPE.toUpperCase();
            if (col.CHARACTER_MAXIMUM_LENGTH) {
                if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                    type += '(MAX)';
                } else {
                    type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                }
            }
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}`);
        });
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ เสร็จสิ้น');
        console.log('='.repeat(70));
        
        await pool.close();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ เกิดข้อผิดพลาด:');
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        
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
addColumns();

