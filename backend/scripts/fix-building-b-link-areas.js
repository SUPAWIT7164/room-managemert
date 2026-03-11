/**
 * แก้ไขอาคาร B (0 ชั้น / ไม่มีห้อง)
 * ย้าย areas ที่มี building_id=2 หรือ 3 (ที่ไม่มี building ในระบบ) มาเป็นของอาคาร B (building_id=4)
 * Usage: node scripts/fix-building-b-link-areas.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const config = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || 1433),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_room_booking',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

const BUILDING_B_ID = 4; // อาคาร B
const ORPHAN_BUILDING_IDS = [2, 3]; // building_id ที่ไม่มีในตาราง buildings แล้ว

async function run() {
    let pool;
    try {
        pool = await sql.connect(config);
        const req = pool.request();
        const areasResult = await req.query(`
            SELECT id, name, building_id, floor FROM areas
            WHERE building_id IN (${ORPHAN_BUILDING_IDS.join(',')})
            ORDER BY building_id, floor
        `);
        const areas = areasResult.recordset || [];
        if (areas.length === 0) {
            console.log('\nไม่มี areas ที่ building_id IN (2,3) ให้ย้าย ถ้าอาคาร B ยังไม่มีข้อมูลให้สร้าง areas ใหม่ในระบบ\n');
            return;
        }
        console.log(`\nจะย้าย ${areas.length} areas มาเป็นของอาคาร B (building_id=${BUILDING_B_ID}):`);
        areas.slice(0, 15).forEach(a => console.log(`  id=${a.id} ${a.name} floor=${a.floor} (เดิม building_id=${a.building_id})`));
        if (areas.length > 15) console.log(`  ... และอีก ${areas.length - 15} รายการ`);

        const updateResult = await pool.request().query(`
            UPDATE areas SET building_id = ${BUILDING_B_ID}
            WHERE building_id IN (${ORPHAN_BUILDING_IDS.join(',')})
        `);
        const affected = updateResult.rowsAffected ? updateResult.rowsAffected[0] : 0;
        console.log(`\nอัปเดตแล้ว: ${affected} areas ผูกกับอาคาร B แล้ว`);
        console.log('รีเฟรชหน้า rooms/control จะเห็นอาคาร B มีชั้นและจำนวนห้อง\n');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
