/**
 * ลบ areas ที่ไม่มีห้องอ้างอิง (ไม่ได้ใช้จริง) ออกจากตาราง areas
 * Usage: node scripts/delete-unused-areas.js
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

        const listResult = await pool.request().query(`
            SELECT a.id, a.name, a.code, a.building_id, a.floor
            FROM areas a
            WHERE NOT EXISTS (SELECT 1 FROM rooms r WHERE r.area_id = a.id)
            ORDER BY a.id
        `);
        const toDelete = listResult.recordset || [];
        if (toDelete.length === 0) {
            console.log('\nไม่มี areas ที่ไม่ได้ใช้ให้ลบ\n');
            return;
        }

        console.log('\nจะลบ areas ที่ไม่มีห้องอ้างอิง จำนวน', toDelete.length, 'รายการ:');
        toDelete.forEach((r) => console.log('  id=' + r.id + ' ' + (r.name || '') + ' ' + (r.code || '') + ' (building_id=' + r.building_id + ', floor=' + r.floor + ')'));

        const ids = toDelete.map((r) => r.id);
        const deleteResult = await pool.request().query(
            `DELETE FROM areas WHERE id IN (${ids.join(',')})`
        );
        const deleted = deleteResult.rowsAffected ? deleteResult.rowsAffected[0] : 0;
        console.log('\nลบแล้ว: ' + deleted + ' แถว\n');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
