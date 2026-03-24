/**
 * ตรวจว่า migration add_device_id (และสถานะคอลัมน์ device_index) บน SQL Server สอดคล้องกับโค้ด
 * รัน: cd backend && node scripts/verify_device_states_migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { pool } = require('../config/database');
const DeviceState = require('../models/DeviceState');

async function columnExists(table, column) {
    const [rows] = await pool.query(
        `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows && rows.length > 0;
}

async function main() {
    console.log('=== verify_device_states_migration ===');
    console.log('DB:', process.env.DB_HOST, '/', process.env.DB_NAME || 'smart_room_booking');
    console.log('');

    const hasDeviceId = await columnExists('device_states', 'device_id');
    const hasDeviceIndex = await columnExists('device_states', 'device_index');

    console.log('คอลัมน์ device_states.device_id:', hasDeviceId ? 'มี ✓' : 'ไม่มี ✗');
    console.log('คอลัมน์ device_states.device_index:', hasDeviceIndex ? 'มี (ยังไม่รัน drop migration)' : 'ไม่มี (รัน drop แล้วหรือสร้างตารางใหม่)');

    if (!hasDeviceId) {
        console.error('\n❌ ยังไม่มี device_id — รัน add_device_id_to_device_states_mssql.sql');
        process.exit(1);
    }

    const [counts] = await pool.query(`
        SELECT
            COUNT(*) AS total_rows,
            SUM(CASE WHEN device_id IS NULL THEN 1 ELSE 0 END) AS null_device_id
        FROM device_states
    `);
    const c = counts[0] || {};
    console.log('\nสรุปแถว device_states:');
    console.log('  total_rows     :', c.total_rows);
    console.log('  null device_id :', c.null_device_id ?? 0, c.null_device_id > 0 ? '← ควร backfill หรือลบก่อนรัน drop_device_index' : '');

    const [sample] = await pool.query(
        `SELECT TOP 8 id, room_id, area_id, device_type, device_id, status, updated_at
         FROM device_states ORDER BY updated_at DESC`
    );
    console.log('\nตัวอย่างล่าสุด (8 แถว):');
    console.table(sample || []);

    const [rooms] = await pool.query(`SELECT TOP 1 id FROM rooms WHERE disable = 0 OR disable IS NULL ORDER BY id`);
    const rid = rooms && rooms[0] ? rooms[0].id : null;
    if (rid != null) {
        console.log(`\nทดสอบ DeviceState.getByRoom(${rid}):`);
        const grouped = await DeviceState.getByRoom(rid);
        console.log('  light count:', grouped.light.length, '| ac:', grouped.ac.length, '| erv:', grouped.erv.length);
        const first = [...grouped.light, ...grouped.ac, ...grouped.erv].find((x) => x && x.device_id);
        if (first) {
            console.log('  ตัวอย่าง entry:', { device_id: first.device_id, status: first.status });
        }
        console.log('  DeviceState.getByRoom: OK ✓');
    } else {
        console.log('\n(ไม่มี rooms สำหรับทดสอบ getByRoom)');
    }

    if (hasDeviceIndex) {
        const [nullability] = await pool.query(
            `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_NAME = 'device_states' AND COLUMN_NAME = 'device_index'`
        );
        const nullable = nullability?.[0]?.IS_NULLABLE === 'YES';
        console.log('\ndevice_index IS_NULLABLE:', nullable ? 'YES ✓' : 'NO — รัน device_index_nullable_mssql.sql ถ้า INSERT/UPDATE ใส่ NULL');
    }

    // --- ทดสอบ upsert จริงผ่าน DeviceState (device_id) ---
    console.log('\n--- ทดสอบ upsertRoomStateByDeviceId (อ่านค่าเดิมแล้วเขียนคืนค่าเดิม) ---');
    const [devPick] = await pool.query(
        `SELECT TOP 1 d.id AS device_pk, d.room_id,
                CASE WHEN LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) = 'air'
                     THEN 'ac' ELSE LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) END AS norm_type
         FROM devices d
         WHERE d.room_id IS NOT NULL AND (d.disable = 0 OR d.disable IS NULL)
           AND LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''))) IN ('light','ac','erv','air')
         ORDER BY d.id`
    );
    const pick = devPick && devPick[0];
    if (pick && pick.device_pk && pick.room_id && ['light', 'ac', 'erv'].includes(pick.norm_type)) {
        const devicePk = Number(pick.device_pk);
        const roomPk = Number(pick.room_id);
        const dtype = pick.norm_type;
        let before = await DeviceState.getStateByDeviceId(devicePk);
        const status = before ? !!before.status : false;
        const settings = before && before.settings ? before.settings : null;
        try {
            await DeviceState.upsertRoomStateByDeviceId(roomPk, devicePk, dtype, status, settings);
            const after = await DeviceState.getStateByDeviceId(devicePk);
            console.log('  device_id:', devicePk, 'room_id:', roomPk, 'type:', dtype);
            console.log('  upsert + getStateByDeviceId: OK ✓');
            console.log('  status หลังทดสอบ:', after?.status, '(เท่าเดิม)');
        } catch (err) {
            console.error('  ❌ upsert ล้มเหลว:', err.message);
            console.error('     (ถ้าเป็นเรื่อง device_index / NOT NULL / UNIQUE ให้รัน device_index_nullable_mssql.sql หรือแก้ constraint)');
            process.exit(1);
        }
    } else {
        console.log('  (ข้าม — ไม่มีแถว devices ในห้องสำหรับ light/ac/erv)');
    }

    console.log('\n=== เสร็จสิ้น — device_id path ใช้งานได้ ===');
    process.exit(0);
}

main().catch((e) => {
    console.error('❌ Error:', e.message);
    if (e.code === 'ESOCKET' || e.message.includes('Failed to connect')) {
        console.error('   ตรวจสอบ .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) และว่า SQL Server เปิดรับ connection');
    }
    process.exit(1);
});
