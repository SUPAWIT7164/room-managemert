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

async function syncBookingRequests() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔧 กำลัง sync ตาราง booking_requests');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        // Read SQL script
        const sqlFilePath = path.join(__dirname, 'sync-booking-requests-table.sql');
        const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
        
        // Split script by GO statements
        const batches = sqlScript.split(/\bGO\b/gi).filter(batch => batch.trim().length > 0);
        
        console.log(`📝 กำลังรัน SQL script (${batches.length} batches)...\n`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch.length === 0 || batch.startsWith('--')) continue;
            
            try {
                await pool.request().query(batch);
            } catch (error) {
                // Some errors are expected (like column already exists)
                if (error.message.includes('already exists') || 
                    error.message.includes('มีอยู่แล้ว') ||
                    error.message.includes('already an object') ||
                    error.message.includes('does not exist') ||
                    error.message.includes('ไม่พบ')) {
                    // These are handled in the SQL script itself
                } else {
                    console.error(`❌ Error in batch ${i + 1}:`, error.message);
                    throw error;
                }
            }
        }
        
        // Migrate data from old columns to new columns
        console.log('\n📊 กำลัง migrate ข้อมูลจาก columns เก่าไปยัง columns ใหม่...\n');
        
        // Check if old columns exist and migrate data
        const checkOldColumns = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'booking_requests'
            AND COLUMN_NAME IN ('user_id', 'room_id', 'start_datetime', 'end_datetime', 'title', 'rejection_reason', 'approved_by')
        `;
        
        const oldColsResult = await pool.request().query(checkOldColumns);
        const oldColumns = oldColsResult.recordset.map(row => row.COLUMN_NAME);
        
        if (oldColumns.length > 0) {
            console.log(`พบ columns เก่า: ${oldColumns.join(', ')}`);
            
            // Build migration query
            let updateQuery = 'UPDATE [dbo].[booking_requests] SET ';
            const updates = [];
            
            // user_id -> booker
            if (oldColumns.includes('user_id')) {
                const checkBooker = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'booker'
                `);
                if (checkBooker.recordset.length > 0) {
                    updates.push('[booker] = [user_id]');
                }
            }
            
            // room_id -> room
            if (oldColumns.includes('room_id')) {
                const checkRoom = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'room'
                `);
                if (checkRoom.recordset.length > 0) {
                    updates.push('[room] = [room_id]');
                }
            }
            
            // start_datetime -> start
            if (oldColumns.includes('start_datetime')) {
                const checkStart = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'start'
                `);
                if (checkStart.recordset.length > 0) {
                    updates.push('[start] = CAST([start_datetime] AS DATETIME)');
                }
            }
            
            // end_datetime -> end
            if (oldColumns.includes('end_datetime')) {
                const checkEnd = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'end'
                `);
                if (checkEnd.recordset.length > 0) {
                    updates.push('[end] = CAST([end_datetime] AS DATETIME)');
                }
            }
            
            // title -> name
            if (oldColumns.includes('title')) {
                const checkName = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'name'
                `);
                if (checkName.recordset.length > 0) {
                    updates.push('[name] = [title]');
                }
            }
            
            // rejection_reason -> reject_reason
            if (oldColumns.includes('rejection_reason')) {
                const checkRejectReason = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'reject_reason'
                `);
                if (checkRejectReason.recordset.length > 0) {
                    updates.push('[reject_reason] = [rejection_reason]');
                }
            }
            
            // approved_by -> approve_by
            if (oldColumns.includes('approved_by')) {
                const checkApproveBy = await pool.request().query(`
                    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'approve_by'
                `);
                if (checkApproveBy.recordset.length > 0) {
                    updates.push('[approve_by] = [approved_by]');
                }
            }
            
            if (updates.length > 0) {
                updateQuery += updates.join(', ');
                const result = await pool.request().query(updateQuery);
                console.log(`✅ Migrate ข้อมูลเรียบร้อยแล้ว (${result.rowsAffected[0]} แถว)`);
            }
        } else {
            console.log('⚠️  ไม่พบ columns เก่า');
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
        
        // Check if participants column was removed
        const checkParticipants = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'participants'
        `);
        
        if (checkParticipants.recordset.length === 0) {
            console.log('\n✅ column participants ถูกลบออกแล้ว');
        } else {
            console.log('\n⚠️  column participants ยังมีอยู่');
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
syncBookingRequests();


