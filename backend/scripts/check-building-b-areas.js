/**
 * ตรวจสอบ areas ที่เชื่อมกับอาคาร B (building_id=4) และ areas ที่ไม่มี building ในระบบ
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

async function check() {
    let pool;
    try {
        pool = await sql.connect(config);
        const buildings = (await pool.request().query('SELECT id, name FROM buildings ORDER BY id')).recordset || [];
        console.log('\nBuildings:', buildings.map(b => `id=${b.id} "${b.name}"`).join(', '));
        const areaResult = await pool.request().query(`
            SELECT a.id, a.name, a.building_id, a.floor, a.disable, b.name AS building_name
            FROM areas a
            LEFT JOIN buildings b ON a.building_id = b.id
            ORDER BY a.building_id, a.floor
        `);
        const areas = areaResult.recordset || [];
        console.log('\nAreas ที่ building_id=4 (อาคาร B):');
        const forB = areas.filter(a => a.building_id == 4);
        if (forB.length) forB.forEach(a => console.log(`  id=${a.id} name=${a.name} floor=${a.floor} disable=${a.disable}`));
        else console.log('  (ไม่มี)');
        console.log('\nAreas ทั้งหมด (building_id):');
        const byBuilding = {};
        areas.forEach(a => {
            const bid = a.building_id;
            if (!byBuilding[bid]) byBuilding[bid] = [];
            byBuilding[bid].push(a);
        });
        Object.keys(byBuilding).sort((x,y)=>Number(x)-Number(y)).forEach(bid => {
            const b = buildings.find(x => x.id == bid);
            console.log(`  building_id=${bid} (${b ? b.name : 'ไม่มี building นี้'}) => ${byBuilding[bid].length} areas`);
        });
        console.log('');
    } catch (err) {
        console.error(err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

check().then(() => process.exit(0)).catch(() => process.exit(1));
