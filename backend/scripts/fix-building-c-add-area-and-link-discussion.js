/**
 * แก้ไขให้ห้อง DISSCUSION แสดงในอาคาร C
 * 1. สร้าง area ใหม่ในอาคาร C (building_id=21) ถ้ายังไม่มี
 * 2. อัปเดต room id=35 (ห้อง DISSCUSION) ให้ area_id ชี้ไปที่ area ของอาคาร C
 * Usage: node scripts/fix-building-c-add-area-and-link-discussion.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const BUILDING_C_ID = 21;
const ROOM_DISCUSSION_ID = 35;
const NEW_AREA_NAME = 'ชั้น 1 อาคาร C';
const NEW_AREA_FLOOR = 1;

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

        const areaRes = await pool.request().input('bid', sql.Int, BUILDING_C_ID).query(`
            SELECT id, name, floor FROM areas WHERE building_id = @bid AND (disable = 0 OR disable IS NULL)
        `);
        const areasInC = areaRes.recordset || [];

        let areaIdForRoom;
        if (areasInC && areasInC.length > 0) {
            areaIdForRoom = areasInC[0].id;
            console.log(`\nอาคาร C มี area อยู่แล้ว: id=${areaIdForRoom} name="${areasInC[0].name}" floor=${areasInC[0].floor}`);
        } else {
            const insertResult = await pool.request()
                .input('name', sql.NVarChar(200), NEW_AREA_NAME)
                .input('building_id', sql.Int, BUILDING_C_ID)
                .input('floor', sql.Int, NEW_AREA_FLOOR)
                .query(`
                    INSERT INTO areas (name, building_id, floor, disable)
                    OUTPUT INSERTED.id
                    VALUES (@name, @building_id, @floor, 0)
                `);
            const inserted = insertResult.recordset || [];
            areaIdForRoom = inserted[0]?.id ?? inserted[0];
            if (areaIdForRoom == null) throw new Error('Insert area failed: no id returned');
            console.log(`\nสร้าง area ใหม่ในอาคาร C: id=${areaIdForRoom} name="${NEW_AREA_NAME}" floor=${NEW_AREA_FLOOR}`);
        }

        const updateResult = await pool.request()
            .input('area_id', sql.Int, areaIdForRoom)
            .input('room_id', sql.Int, ROOM_DISCUSSION_ID)
            .query(`
                UPDATE rooms SET area_id = @area_id WHERE id = @room_id
            `);
        const affected = Array.isArray(updateResult.rowsAffected) ? updateResult.rowsAffected[0] : (updateResult.rowsAffected || 0);
        if (affected > 0) {
            console.log(`อัปเดต room id=${ROOM_DISCUSSION_ID} (ห้อง DISSCUSION) ให้ area_id = ${areaIdForRoom} เรียบร้อย`);
        } else {
            console.log(`ไม่พบ room id=${ROOM_DISCUSSION_ID} หรืออัปเดตไม่เปลี่ยนค่า`);
        }

        console.log('\nเสร็จแล้ว — เปิดหน้า /rooms/control?building=21&floor=1 แล้วเลือกชั้น 1 ควรเห็นห้อง DISSCUSION');
        console.log('');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
