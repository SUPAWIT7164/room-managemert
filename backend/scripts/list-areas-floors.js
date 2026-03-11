/**
 * ตรวจสอบข้อมูลในตาราง areas โดยเฉพาะคอลัมน์ floor (Floor 1-5 อยู่ส่วนไหน)
 * Usage: node scripts/list-areas-floors.js
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

async function listAreasFloors() {
    let pool;
    try {
        pool = await sql.connect(config);
        const result = await pool.request().query(`
            SELECT a.id, a.name, a.building_id, a.floor, a.disable,
                   b.name AS building_name
            FROM areas a
            LEFT JOIN buildings b ON a.building_id = b.id
            ORDER BY a.building_id, a.floor, a.name
        `);
        const rows = result.recordset || [];
        console.log('\n=== ตาราง areas: คอลัมน์ floor (Floor 1-5) ===\n');
        if (rows.length === 0) {
            console.log('ไม่มีข้อมูลในตาราง areas');
            return;
        }
        console.log('id\tbuilding_id\tfloor\tbuilding_name\tname');
        console.log('--\t----------\t-----\t-------------\t----');
        rows.forEach(r => {
            const floorStr = r.floor != null ? String(r.floor) : 'NULL';
            console.log(`${r.id}\t${r.building_id}\t${floorStr}\t${(r.building_name || '').substring(0, 20)}\t${(r.name || '').substring(0, 30)}`);
        });
        console.log('\n--- สรุปตาม floor ---');
        const byFloor = {};
        rows.forEach(r => {
            const f = r.floor != null ? r.floor : 'NULL';
            if (!byFloor[f]) byFloor[f] = [];
            byFloor[f].push({ id: r.id, name: r.name, building_name: r.building_name });
        });
        [1, 2, 3, 4, 5, 'NULL'].forEach(f => {
            const list = byFloor[f] || [];
            console.log(`Floor ${f}: ${list.length} area(s) - ${list.map(x => x.name).join(', ') || '-'}`);
        });
        console.log('');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

listAreasFloors().then(() => process.exit(0)).catch(() => process.exit(1));
