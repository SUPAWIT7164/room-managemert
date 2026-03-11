/**
 * ตรวจสอบอาคาร C (ตึก c) ว่ามี areas และ rooms หรือไม่ และหาห้อง DISCUSSION/DISSCUSION
 * ใช้วิเคราะห์ว่าทำไมห้องไม่แสดงในหน้า
 * Usage: node scripts/check-building-c-and-discussion-room.js
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

        // 1) หาอาคารที่ชื่อหรือ code เป็น C (ไม่สนใจตัวพิมพ์)
        const buildResult = await pool.request().query(`
            SELECT id, name, code FROM buildings ORDER BY id
        `);
        const buildings = buildResult.recordset || [];
        const buildingC = buildings.find(b => {
            const n = (b.name || '').toString().trim().toLowerCase();
            const c = (b.code || '').toString().trim().toLowerCase();
            return n === 'c' || c === 'c' || n.includes('ตึก c') || n === 'อาคาร c';
        });
        const buildingCById = buildingC ? buildingC.id : null;

        console.log('\n=== อาคารทั้งหมด (buildings) ===');
        buildings.forEach(b => console.log(`  id=${b.id} name="${b.name}" code="${b.code || ''}"`));

        if (!buildingC) {
            console.log('\n⚠ ไม่พบอาคารที่ชื่อ/code เป็น "C" หรือ "ตึก c"');
            console.log('  หน้าเว็บใช้ building id จาก URL (?building=เลข) ถ้าอาคาร C ใช้ id อื่น ให้เลือกอาคารนั้นใน dropdown');
        } else {
            console.log(`\n✓ พบอาคาร C: id=${buildingC.id} name="${buildingC.name}"`);
        }

        const bidToCheck = buildingCById != null ? buildingCById : buildings[buildings.length - 1]?.id;
        if (bidToCheck == null) {
            console.log('\nไม่มี buildings ในระบบ');
            return;
        }

        const buildingName = buildings.find(b => b.id === bidToCheck)?.name || '';

        // 2) Areas ในอาคาร C (หรืออาคารสุดท้ายถ้าไม่มี C)
        const areaResult = await pool.request()
            .input('building_id', sql.Int, bidToCheck)
            .query(`
                SELECT id, name, floor, disable, building_id
                FROM areas
                WHERE building_id = @building_id
                ORDER BY COALESCE(floor, 0), name
            `);
        const areas = areaResult.recordset || [];

        console.log(`\n=== Areas ในอาคาร id=${bidToCheck} ("${buildingName}") ===`);
        if (areas.length === 0) {
            console.log('  (ไม่มี area เลย)');
            console.log('\nสาเหตุที่ห้องไม่แสดง: อาคารนี้ไม่มี area ดังนั้นไม่มี area_id ให้ room ผูก → ต้องสร้าง area ในอาคาร C ก่อน แล้วตั้ง room.area_id ให้ชี้ไปที่ area นั้น');
        } else {
            areas.forEach(a => console.log(`  id=${a.id} name="${a.name}" floor=${a.floor} disable=${a.disable}`));
        }

        const areaIds = areas.map(a => a.id);

        // 3) ห้องทั้งหมดที่ area_id อยู่ในอาคารนี้
        let roomsInBuilding = [];
        if (areaIds.length > 0) {
            const placeholders = areaIds.map((_, i) => `@a${i}`).join(',');
            const req = pool.request();
            areaIds.forEach((id, i) => req.input(`a${i}`, sql.Int, id));
            const roomResult = await req.query(`
                SELECT r.id, r.name, r.area_id, r.disable, a.name AS area_name, a.floor
                FROM rooms r
                LEFT JOIN areas a ON r.area_id = a.id
                WHERE r.area_id IN (${placeholders})
                ORDER BY a.floor, r.name
            `);
            roomsInBuilding = roomResult.recordset || [];
        }

        console.log(`\n=== ห้อง (rooms) ในอาคาร id=${bidToCheck} (area_id ในอาคารนี้) ===`);
        if (roomsInBuilding.length === 0) {
            console.log('  (ไม่มีห้องที่ผูกกับ area ของอาคารนี้)');
        } else {
            roomsInBuilding.forEach(r => console.log(`  room id=${r.id} name="${r.name}" area_id=${r.area_id} area="${r.area_name}" floor=${r.floor} disable=${r.disable}`));
        }

        // 4) ห้องที่ area_id เป็น NULL (จะไม่แสดงในหน้าจอเพราะไม่มี building/floor)
        const nullAreaResult = await pool.request().query(`
            SELECT id, name, area_id, disable FROM rooms WHERE area_id IS NULL AND (disable = 0 OR disable IS NULL) ORDER BY name
        `);
        const roomsWithNullArea = nullAreaResult.recordset || [];
        if (roomsWithNullArea.length > 0) {
            console.log('\n=== ห้องที่ area_id เป็น NULL (จะไม่แสดงในหน้าจอ) ===');
            roomsWithNullArea.forEach(r => console.log(`  id=${r.id} name="${r.name}" disable=${r.disable}`));
        }

        // 5) หาห้องชื่อ DISCUSSION หรือ DISSCUSION ทั้งระบบ
        const discResult = await pool.request().query(`
            SELECT r.id, r.name, r.area_id, r.disable,
                   a.id AS area_id_join, a.name AS area_name, a.building_id, a.floor
            FROM rooms r
            LEFT JOIN areas a ON r.area_id = a.id
            WHERE UPPER(LTRIM(RTRIM(ISNULL(r.name,'')))) LIKE '%DISCUS%'
            ORDER BY r.id
        `);
        const discussionRooms = discResult.recordset || [];

        console.log('\n=== ห้องที่ชื่อมี "DISCUS" (DISCUSSION / DISSCUSION) ===');
        if (discussionRooms.length === 0) {
            console.log('  (ไม่พบห้องชื่อ DISCUSSION/DISSCUSION ในตาราง rooms)');
        } else {
            discussionRooms.forEach(r => {
                const inBuildingC = buildingCById != null && Number(r.building_id) === Number(buildingCById);
                console.log(`  room id=${r.id} name="${r.name}" area_id=${r.area_id} disable=${r.disable}`);
                console.log(`    → area: id=${r.area_id_join} name="${r.area_name}" building_id=${r.building_id} floor=${r.floor}`);
                if (r.area_id == null) {
                    console.log('    ⚠ area_id เป็น NULL → ห้องจะไม่แสดงในหน้าจอ (ต้องตั้ง area_id ให้ชี้ไปที่ area ของอาคาร C)');
                } else if (!inBuildingC && buildingCById != null) {
                    console.log(`    ⚠ area นี้อยู่คนละอาคารกับอาคาร C (building_id=${r.building_id}) → จะแสดงในอาคารอื่น ไม่ใช่ตึก C`);
                } else if (inBuildingC) {
                    console.log('    ✓ อยู่ภายใต้อาคาร C แล้ว — ถ้าไม่แสดง ให้เช็ค floor ว่าตรงกับที่เลือกใน dropdown ชั้นหรือไม่');
                }
            });
        }

        // 6) ตรวจสอบ area_id ที่ห้อง DISCUSSION ใช้ (เช่น 25)
        const discussionRoom = (await pool.request().query(`
            SELECT id, name, area_id, disable FROM rooms WHERE id = 35 OR name LIKE '%DISSCUSION%' OR name LIKE '%DISCUSSION%'
        `)).recordset || [];
        if (discussionRoom.length > 0) {
            for (const r of discussionRoom) {
                if (r.area_id != null) {
                    const ar = (await pool.request().input('aid', sql.Int, r.area_id).query(`
                        SELECT id, name, building_id, floor, disable FROM areas WHERE id = @aid
                    `)).recordset || [];
                    console.log(`\nห้อง id=${r.id} "${r.name}" ใช้ area_id=${r.area_id}:`);
                    if (ar.length === 0) console.log('  ⚠ ไม่มี area id นี้ในตาราง areas (ถูกลบหรือผิด)');
                    else console.log(`  area: id=${ar[0].id} name="${ar[0].name}" building_id=${ar[0].building_id} floor=${ar[0].floor} disable=${ar[0].disable}`);
                }
            }
        }

        // 7) ห้องล่าสุด 10 ห้อง (ถ้าสร้าง DISCUSSION มาใหม่จะอยู่ด้านบน)
        const recentResult = await pool.request().query(`
            SELECT TOP 10 r.id, r.name, r.area_id, r.disable, a.name AS area_name, a.building_id
            FROM rooms r
            LEFT JOIN areas a ON r.area_id = a.id
            ORDER BY r.id DESC
        `);
        const recentRooms = recentResult.recordset || [];
        console.log('\n=== ห้องล่าสุด 10 ห้อง (เรียง id ลด) ===');
        recentRooms.forEach(r => console.log(`  id=${r.id} name="${r.name}" area_id=${r.area_id} area="${r.area_name || ''}" building_id=${r.building_id || ''}`));

        console.log('\n--- สรุปสาเหตุที่ห้องไม่แสดงในหน้า ---');
        console.log('1. room.area_id ต้องชี้ไปที่ area ที่มี area.building_id = อาคาร C');
        console.log('2. อาคาร C ต้องมีอย่างน้อย 1 area (และ area.disable = 0)');
        console.log('3. หน้า rooms/control แสดงห้องตาม " building + ชั้น " — ต้องเลือกชั้น (floor) ที่ตรงกับ area.floor ของห้องนั้น');
        console.log('4. room.disable ต้องเป็น 0 (เปิดใช้งาน)');
        console.log('');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
