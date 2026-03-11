/**
 * ตรวจสอบ areas ว่าตัวไหนไม่มีห้องอ้างอิง (ไม่ได้ใช้จริงในระบบ)
 * Usage: node scripts/check-unused-areas.js
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

async function run() {
    let pool;
    try {
        pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT
                a.id,
                a.name,
                a.code,
                a.building_id,
                a.floor,
                a.disable,
                b.name AS building_name,
                (SELECT COUNT(*) FROM rooms r WHERE r.area_id = a.id) AS room_count
            FROM areas a
            LEFT JOIN buildings b ON b.id = a.building_id
            ORDER BY a.building_id, a.floor, a.id
        `);
        const rows = result.recordset || [];
        const unused = rows.filter((r) => Number(r.room_count) === 0);
        const used = rows.filter((r) => Number(r.room_count) > 0);

        console.log('\n========== areas ที่ไม่มีห้องอ้างอิง (ไม่ได้ใช้จริง) ==========');
        console.log('จำนวน:', unused.length, 'รายการ\n');
        if (unused.length > 0) {
            console.log('id\tname\tcode\tbuilding_id\tfloor\tbuilding_name');
            console.log('--\t----\t----\t-----------\t-----\t-------------');
            unused.forEach((r) => {
                console.log(
                    [r.id, r.name || '', r.code || '', r.building_id, r.floor, r.building_name || ''].join('\t')
                );
            });
        }

        console.log('\n========== areas ที่มีห้องอ้างอิง (ใช้อยู่) ==========');
        console.log('จำนวน:', used.length, 'รายการ\n');
        if (used.length > 0) {
            console.log('id\tname\tcode\tbuilding_id\tfloor\troom_count\tbuilding_name');
            console.log('--\t----\t----\t-----------\t-----\t----------\t-------------');
            used.forEach((r) => {
                console.log(
                    [r.id, r.name || '', r.code || '', r.building_id, r.floor, r.room_count, r.building_name || ''].join(
                        '\t'
                    )
                );
            });
        }

        console.log('\nสรุป: areas ที่ไม่ได้ใช้จริง = ' + unused.length + ' รายการ (ไม่มี rooms.area_id ชี้มา)\n');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
