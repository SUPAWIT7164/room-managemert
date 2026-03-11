/**
 * ตรวจสอบว่าอาคารแต่ละแห่งมี areas และ rooms หรือไม่ (ใช้ตรวจอาคาร B ไม่มีข้อมูล)
 * Usage: node scripts/check-buildings-data.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const config = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || 1433),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_room_booking',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
    },
};

async function check() {
    let pool;
    try {
        pool = await sql.connect(config);
        const buildResult = await pool.request().query(`
            SELECT id, name, disable FROM buildings ORDER BY id
        `);
        const buildings = buildResult.recordset || [];
        console.log('\n=== อาคาร (buildings) และจำนวน areas / rooms ===\n');
        for (const b of buildings) {
            const req1 = pool.request().input('building_id', sql.BigInt, b.id);
            const areaResult = await req1.query(
                'SELECT COUNT(*) as cnt FROM areas WHERE building_id = @building_id AND (disable = 0 OR disable IS NULL)'
            );
            const areaCount = areaResult.recordset || [];
            const req2 = pool.request().input('building_id', sql.BigInt, b.id);
            const areasResult = await req2.query(
                'SELECT id, name, floor, disable FROM areas WHERE building_id = @building_id ORDER BY floor'
            );
            const areas = areasResult.recordset || [];
            let roomCount = 0;
            for (const a of areas) {
                const req3 = pool.request().input('area_id', sql.BigInt, a.id);
                const rResult = await req3.query(
                    'SELECT COUNT(*) as cnt FROM rooms WHERE area_id = @area_id AND (disable = 0 OR disable IS NULL)'
                );
                const r = rResult.recordset || [];
                roomCount += Number(r[0]?.cnt || 0);
            }
            const nameDisplay = (b.name || '(ไม่มีชื่อ)').toString().trim();
            const hasData = (areaCount[0]?.cnt || 0) > 0;
            console.log(`Building id=${b.id}: "${nameDisplay}" (disable=${b.disable})`);
            console.log(`  - areas: ${areaCount[0]?.cnt || 0}, rooms: ${roomCount}`);
            if (!hasData) {
                console.log('  >>> ไม่มี areas ที่ disable=0 จึงไม่มีข้อมูลแสดงในหน้าจอ');
            }
            const areasDisabled = areas.filter(a => a.disable === 1).length;
            if (areas.length > 0 && areasDisabled === areas.length) {
                console.log('  >>> ทุก area ในอาคารนี้เป็น disable=1 จึงถูกกรองออก');
            }
            console.log('');
        }
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

check().then(() => process.exit(0)).catch(() => process.exit(1));
