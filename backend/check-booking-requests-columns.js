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

async function checkColumns() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔍 กำลังตรวจสอบ columns ในตาราง booking_requests');
        console.log('='.repeat(70));
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        // Get all columns
        const query = `
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
            WHERE TABLE_NAME = 'booking_requests'
            ORDER BY ORDINAL_POSITION
        `;
        
        const result = await pool.request().query(query);
        const columns = result.recordset;
        
        console.log(`📊 พบทั้งหมด: ${columns.length} columns\n`);
        
        // Columns from room-management-portal (from user's query)
        const requiredColumns = [
            'id', 'name', 'booker', 'room', 'start', 'end', 'hour', 'instructor',
            'attendees', 'description', 'calendar_id', 'icaluid', 'qrcode',
            'online_meeting', 'email_notify', 'status', 'cancel', 'reject',
            'reject_reason', 'objective', 'transaction_id', 'approve_by',
            'created_at', 'updated_at'
        ];
        
        console.log('='.repeat(70));
        console.log('📋 รายการ columns ทั้งหมด:');
        console.log('='.repeat(70));
        console.log('');
        
        const columnNames = columns.map(col => col.COLUMN_NAME.toLowerCase());
        const missingColumns = [];
        const extraColumns = [];
        
        columns.forEach((col, index) => {
            let type = col.DATA_TYPE.toUpperCase();
            if (col.CHARACTER_MAXIMUM_LENGTH) {
                if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                    type += '(MAX)';
                } else {
                    type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                }
            } else if (col.NUMERIC_PRECISION) {
                type += `(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE || 0})`;
            }
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const isRequired = requiredColumns.includes(col.COLUMN_NAME.toLowerCase());
            const marker = isRequired ? '✅' : '⚠️ ';
            
            console.log(`${marker} ${(index + 1).toString().padStart(3, ' ')}. ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}`);
            
            if (!isRequired) {
                extraColumns.push(col.COLUMN_NAME);
            }
        });
        
        // Check missing columns
        requiredColumns.forEach(reqCol => {
            if (!columnNames.includes(reqCol.toLowerCase())) {
                missingColumns.push(reqCol);
            }
        });
        
        console.log('');
        console.log('='.repeat(70));
        console.log('📊 สรุป:');
        console.log('='.repeat(70));
        console.log(`   - จำนวน columns ทั้งหมด: ${columns.length} columns`);
        console.log(`   - Columns ที่ต้องการ (จาก room-management-portal): ${requiredColumns.length} columns`);
        console.log(`   - Columns ที่มีครบ: ${requiredColumns.length - missingColumns.length} columns`);
        console.log(`   - Columns ที่ขาด: ${missingColumns.length} columns`);
        console.log(`   - Columns เพิ่มเติม: ${extraColumns.length} columns`);
        console.log('');
        
        if (missingColumns.length > 0) {
            console.log('❌ Columns ที่ขาดหายไป:');
            missingColumns.forEach(col => {
                console.log(`   - ${col}`);
            });
            console.log('');
        }
        
        if (extraColumns.length > 0) {
            console.log('⚠️  Columns เพิ่มเติม (ไม่มีใน room-management-portal):');
            extraColumns.forEach(col => {
                console.log(`   - ${col}`);
            });
            console.log('');
        }
        
        if (missingColumns.length === 0 && extraColumns.length === 0) {
            console.log('✅ ตารางมี columns ครบถ้วนเหมือนกับ room-management-portal!');
        } else if (missingColumns.length === 0) {
            console.log('✅ มี columns ที่ต้องการครบแล้ว แต่มี columns เพิ่มเติม');
        } else {
            console.log('⚠️  ยังขาด columns บางตัว');
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
checkColumns();


