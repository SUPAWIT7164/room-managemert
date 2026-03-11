/**
 * เปรียบเทียบตารางระหว่าง DB smart_room_booking (SQL Server) กับ room-management-portal (MySQL)
 * - แสดงจำนวนตารางในแต่ละ DB
 * - แสดงตารางที่อยู่ใน room-management-portal แต่ไม่มีใน smart_room_booking (ขาดไป)
 *
 * Usage:
 *   node scripts/compare-db-tables.js
 *
 * .env (SQL Server - smart_room_booking):
 *   DB_HOST, DB_PORT=1433, DB_USER, DB_PASSWORD, DB_NAME=smart_room_booking
 *
 * .env (MySQL - room-management-portal, ถ้าต้องการเปรียบเทียบ):
 *   MYSQL_HOST, MYSQL_PORT=3306, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE=room-management-portal
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');
const mysql = require('mysql2/promise');

const mssqlConfig = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_room_booking',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function getTablesSmartRoomBooking() {
    let pool;
    try {
        pool = await sql.connect(mssqlConfig);
        const result = await pool.request().query(`
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `);
        const rows = result.recordset || [];
        return rows.map((r) => (r.TABLE_SCHEMA && r.TABLE_SCHEMA !== 'dbo' ? r.TABLE_SCHEMA + '.' : '') + r.TABLE_NAME);
    } finally {
        if (pool) await pool.close();
    }
}

async function getTablesRoomManagementPortal() {
    // ตัวเลือก 1: MySQL (ตั้ง MYSQL_HOST หรือ MYSQL_DATABASE)
    const mysqlHost = process.env.MYSQL_HOST || process.env.RM_MYSQL_HOST;
    const mysqlDb = process.env.MYSQL_DATABASE || process.env.RM_MYSQL_DATABASE;
    if (mysqlHost || mysqlDb) {
        const config = {
            host: mysqlHost || 'localhost',
            port: parseInt(process.env.MYSQL_PORT || process.env.RM_MYSQL_PORT || '3306', 10),
            user: process.env.MYSQL_USER || process.env.RM_MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || process.env.RM_MYSQL_PASSWORD || '',
            database: mysqlDb || 'room-management-portal',
        };
        let conn;
        try {
            conn = await mysql.createConnection(config);
            const [rows] = await conn.query('SHOW TABLES');
            const key = 'Tables_in_' + config.database;
            return { tables: rows.map((r) => r[key]), engine: 'mysql' };
        } catch (e) {
            console.error('MySQL (room-management-portal):', e.message);
            return null;
        } finally {
            if (conn) await conn.end();
        }
    }
    // ตัวเลือก 2: SQL Server อีกฐานหนึ่ง (REF_DB_NAME=room-management-portal บน server เดียวกัน)
    const refDb = process.env.REF_DB_NAME || 'room-management-portal';
    let pool;
    try {
        pool = await sql.connect({ ...mssqlConfig, database: refDb });
        const result = await pool.request().query(`
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `);
        const rows = result.recordset || [];
        const tables = rows.map((r) => (r.TABLE_SCHEMA && r.TABLE_SCHEMA !== 'dbo' ? r.TABLE_SCHEMA + '.' : '') + r.TABLE_NAME);
        return { tables, engine: 'mssql', database: refDb };
    } catch (e) {
        console.error('SQL Server (' + refDb + '):', e.message);
        return null;
    } finally {
        if (pool) await pool.close();
    }
}

function normalizeTableName(name) {
    return (name || '').toLowerCase().replace(/^dbo\./i, '').trim();
}

async function run() {
    console.log('\n========== smart_room_booking (SQL Server) ==========');
    console.log('Host:', mssqlConfig.server + ':' + mssqlConfig.port, '| Database:', mssqlConfig.database);
    const tablesSRB = await getTablesSmartRoomBooking();
    console.log('จำนวนตาราง:', tablesSRB.length);
    tablesSRB.forEach((t, i) => console.log('  ', (i + 1) + '.', t));
    const setSRB = new Set(tablesSRB.map(normalizeTableName));

    console.log('\n========== room-management-portal ==========');
    const rmpResult = await getTablesRoomManagementPortal();
    if (rmpResult === null) {
        console.log('ไม่พบ DB room-management-portal (ลองตั้ง REF_DB_NAME=room-management-portal บน SQL Server เดียวกัน');
        console.log('หรือตั้ง MySQL: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE=room-management-portal');
    } else {
        const tablesRMP = rmpResult.tables;
        console.log('Engine:', rmpResult.engine, rmpResult.database ? '| Database: ' + rmpResult.database : '');
        console.log('จำนวนตาราง:', tablesRMP.length);
        tablesRMP.forEach((t, i) => console.log('  ', (i + 1) + '.', t));

        const missing = tablesRMP.filter((t) => !setSRB.has(normalizeTableName(t)));
        console.log('\n========== ตารางที่ smart_room_booking ขาดไป ==========');
        console.log('(มีใน room-management-portal แต่ไม่มีใน smart_room_booking)');
        console.log('จำนวนตารางที่ขาด:', missing.length);
        if (missing.length > 0) {
            missing.forEach((t, i) => console.log('  ', (i + 1) + '.', t));
        }
    }
    console.log('');
}

run().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
