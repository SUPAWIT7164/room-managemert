/**
 * คัดลอกตารางทั้งหมด (schema dbo + ข้อมูล) จาก smart_room_booking -> smart_room_booking_PSRU
 * - ลบ FK ในฐานปลายทาง แล้ว DROP ตารางเดิมในปลายทาง (ถ้ามี)
 * - สร้างตารางใหม่ด้วย SELECT * INTO (ไม่คัดลอก index / FK / trigger จากต้นทาง — ต้องสร้างทีหลังถ้าต้องการ)
 *
 * รัน: node scripts/copy_smart_room_booking_to_psru.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const SOURCE_DB = 'smart_room_booking';
const TARGET_DB = 'smart_room_booking_PSRU';

const baseConfig = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
        enableArithAbort: true,
        connectionTimeout: 30000,
    },
    pool: { max: 1, min: 0 },
    requestTimeout: 600000,
};

function qIdent(part) {
    return `[${String(part).replace(/]/g, ']]')}]`;
}

async function main() {
    const pool = await sql.connect({ ...baseConfig, database: 'master' });

    console.log(`Source: ${SOURCE_DB} -> Target: ${TARGET_DB}`);

    const tablesRes = await pool.request().query(`
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM ${qIdent(SOURCE_DB)}.INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    const tables = tablesRes.recordset;
    console.log(`Tables in source: ${tables.length}`);

    // 1) Drop all foreign keys on target
    const dropFkSql = `
        USE ${qIdent(TARGET_DB)};
        DECLARE @s NVARCHAR(MAX) = N'';
        SELECT @s = @s + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.'
            + QUOTENAME(OBJECT_NAME(parent_object_id)) + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(10)
        FROM sys.foreign_keys;
        IF LEN(@s) > 0 EXEC sp_executesql @s;
    `;
    await pool.request().batch(dropFkSql);
    console.log('Dropped foreign keys on target (if any).');

    // 2) Drop all base tables on target
    const dropTablesRes = await pool.request().query(`
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM ${qIdent(TARGET_DB)}.INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    for (const row of dropTablesRes.recordset) {
        const fq = `${qIdent(row.TABLE_SCHEMA)}.${qIdent(row.TABLE_NAME)}`;
        await pool.request().query(`USE ${qIdent(TARGET_DB)}; DROP TABLE ${fq};`);
    }
    console.log(`Dropped ${dropTablesRes.recordset.length} existing table(s) on target.`);

    // 3) Copy each table
    let ok = 0;
    for (const row of tables) {
        const sch = row.TABLE_SCHEMA;
        const name = row.TABLE_NAME;
        const src = `${qIdent(SOURCE_DB)}.${qIdent(sch)}.${qIdent(name)}`;
        const dst = `${qIdent(TARGET_DB)}.${qIdent(sch)}.${qIdent(name)}`;
        const copySql = `SELECT * INTO ${dst} FROM ${src};`;
        process.stdout.write(`Copying ${sch}.${name} ... `);
        try {
            await pool.request().query(copySql);
            console.log('ok');
            ok += 1;
        } catch (e) {
            console.log('FAIL');
            console.error(e.message);
            throw e;
        }
    }

    console.log(`Done. Copied ${ok}/${tables.length} tables.`);
    await pool.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
