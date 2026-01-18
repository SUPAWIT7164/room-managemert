const { pool } = require('../config/database');

async function checkBookingTable() {
    try {
        console.log('🔍 กำลังตรวจสอบโครงสร้างตาราง booking_requests...\n');
        
        // Check if table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'booking_requests'");
        if (tables.length === 0) {
            console.error('❌ ไม่พบตาราง booking_requests ในฐานข้อมูล');
            return;
        }
        console.log('✅ พบตาราง booking_requests\n');
        
        // Get table structure
        const [columns] = await pool.query('DESCRIBE booking_requests');
        
        console.log('📋 โครงสร้างตาราง booking_requests:');
        console.log('='.repeat(80));
        console.log('Column Name'.padEnd(25) + 'Type'.padEnd(20) + 'Null'.padEnd(8) + 'Key'.padEnd(8) + 'Default'.padEnd(15) + 'Extra');
        console.log('-'.repeat(80));
        
        columns.forEach(col => {
            const field = (col.Field || '').padEnd(25);
            const type = (col.Type || '').padEnd(20);
            const nullVal = (col.Null || '').padEnd(8);
            const key = (col.Key || '').padEnd(8);
            const defaultVal = (col.Default !== null ? col.Default : 'NULL').toString().padEnd(15);
            const extra = col.Extra || '';
            console.log(field + type + nullVal + key + defaultVal + extra);
        });
        
        console.log('\n');
        console.log('📊 สรุปคอลัมน์:');
        const columnNames = columns.map(c => c.Field);
        console.log('คอลัมน์ทั้งหมด:', columnNames.join(', '));
        console.log('จำนวนคอลัมน์:', columnNames.length);
        
        // Check required columns
        console.log('\n🔎 ตรวจสอบคอลัมน์ที่จำเป็น:');
        const requiredColumns = [
            'id', 'room_id', 'user_id', 'title', 
            'start_datetime', 'end_datetime', 'status'
        ];
        
        const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
        const existingColumns = requiredColumns.filter(col => columnNames.includes(col));
        
        if (existingColumns.length > 0) {
            console.log('✅ คอลัมน์ที่พบ:', existingColumns.join(', '));
        }
        
        if (missingColumns.length > 0) {
            console.log('❌ คอลัมน์ที่ขาดหาย:', missingColumns.join(', '));
        } else {
            console.log('✅ พบคอลัมน์ที่จำเป็นครบถ้วน');
        }
        
        // Check optional columns used in code
        console.log('\n🔎 ตรวจสอบคอลัมน์เสริม:');
        const optionalColumns = [
            'booking_number', 'description', 'attendees', 'participants',
            'send_notification', 'auto_cancel', 'created_at', 'updated_at',
            'approved_by', 'approved_at', 'rejected_by', 'rejected_at',
            'rejection_reason', 'cancelled_at'
        ];
        
        const foundOptional = optionalColumns.filter(col => columnNames.includes(col));
        const missingOptional = optionalColumns.filter(col => !columnNames.includes(col));
        
        if (foundOptional.length > 0) {
            console.log('✅ คอลัมน์เสริมที่พบ:', foundOptional.join(', '));
        }
        
        if (missingOptional.length > 0) {
            console.log('⚠️  คอลัมน์เสริมที่ไม่มี (ไม่จำเป็น):', missingOptional.join(', '));
        }
        
        // Show sample data structure
        console.log('\n📝 ตัวอย่างข้อมูลในตาราง:');
        const [sampleData] = await pool.query('SELECT * FROM booking_requests LIMIT 1');
        if (sampleData.length > 0) {
            console.log(JSON.stringify(sampleData[0], null, 2));
        } else {
            console.log('⚠️  ยังไม่มีข้อมูลในตาราง');
        }
        
        console.log('\n✅ การตรวจสอบเสร็จสมบูรณ์');
        
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาด:', error.message);
        console.error('Error details:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

checkBookingTable();



