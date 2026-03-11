/**
 * ตรวจสอบจำนวนการจองทั้งหมดในฐานข้อมูล
 * รัน: node scripts/check-total-bookings.js (จากโฟลเดอร์ backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

async function main() {
    try {
        // จำนวนการจองทั้งหมด (ไม่กรองอะไรเลย)
        const [totalRows] = await pool.query('SELECT COUNT(*) as total FROM booking_requests');
        console.log('📊 จำนวนการจองทั้งหมดในฐานข้อมูล:', totalRows[0].total);
        
        // จำนวนการจองแยกตาม user_id
        const [byUserRows] = await pool.query(`
            SELECT user_id, COUNT(*) as count 
            FROM booking_requests 
            GROUP BY user_id 
            ORDER BY count DESC
        `);
        console.log('\n📋 จำนวนการจองแยกตาม user_id:');
        byUserRows.forEach(row => {
            console.log(`  User ID ${row.user_id}: ${row.count} รายการ`);
        });
        
        // จำนวนการจองแยกตาม status
        const [byStatusRows] = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM booking_requests 
            GROUP BY status 
            ORDER BY count DESC
        `);
        console.log('\n📋 จำนวนการจองแยกตาม status:');
        byStatusRows.forEach(row => {
            console.log(`  ${row.status}: ${row.count} รายการ`);
        });
        
        // จำนวนการจองแยกตามเดือน
        const [byMonthRows] = await pool.query(`
            SELECT 
                FORMAT(start_datetime, 'yyyy-MM') as month,
                COUNT(*) as count 
            FROM booking_requests 
            GROUP BY FORMAT(start_datetime, 'yyyy-MM')
            ORDER BY month DESC
        `);
        console.log('\n📋 จำนวนการจองแยกตามเดือน:');
        byMonthRows.forEach(row => {
            console.log(`  ${row.month}: ${row.count} รายการ`);
        });
        
        // จำนวนการจองของ user_id = 6
        const [user6Rows] = await pool.query('SELECT COUNT(*) as total FROM booking_requests WHERE user_id = ?', [6]);
        console.log('\n👤 จำนวนการจองของ user_id = 6:', user6Rows[0].total);
        
        // จำนวนการจองของ user_id = 6 ในช่วงวันที่ 2025-11-01 ถึง 2026-01-22
        const [user6DateRows] = await pool.query(`
            SELECT COUNT(*) as total 
            FROM booking_requests 
            WHERE user_id = ? 
              AND CAST(start_datetime AS DATE) >= ? 
              AND CAST(end_datetime AS DATE) <= ?
        `, [6, '2025-11-01', '2026-01-22']);
        console.log('👤 จำนวนการจองของ user_id = 6 (2025-11-01 ถึง 2026-01-22):', user6DateRows[0].total);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
