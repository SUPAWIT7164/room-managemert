/**
 * สร้างตารางที่ขาดใน smart_room_booking (17 ตาราง) โดยดูโครงสร้างจาก DB room-management-portal
 * Usage: node scripts/create-missing-tables-from-portal.js
 * .env: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME=smart_room_booking, REF_DB_NAME=room-management-portal
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');

const mssqlConfig = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_room_booking',
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

const REF_DB = process.env.REF_DB_NAME || 'room-management-portal';

const MISSING_TABLES = [
    'access_booking_request', 'Access_History', 'access_permissions', 'Alert_History',
    'attribute_types', 'attributes', 'data_types', 'datas', 'entities', 'faces_pid',
    'home_assistants', 'modules', 'peoplecount', 'peoplecount_realtime', 'presence',
    'PublicHoliday', 'SensorLists'
];

function quoteName(name) {
    return '[' + String(name).replace(/]/g, ']]') + ']';
}

function sqlType(col) {
    const dt = (col.DATA_TYPE || '').toLowerCase();
    const len = col.CHARACTER_MAXIMUM_LENGTH;
    const prec = col.NUMERIC_PRECISION;
    const scale = col.NUMERIC_SCALE;
    const dtPrec = col.DATETIME_PRECISION;

    if (col.is_identity) {
        if (dt === 'int') return 'int IDENTITY(1,1)';
        if (dt === 'bigint') return 'bigint IDENTITY(1,1)';
        if (dt === 'smallint') return 'smallint IDENTITY(1,1)';
        return dt + ' IDENTITY(1,1)';
    }
    if (len !== undefined && len !== null) {
        if (len === -1) return dt + '(MAX)';
        if (dt === 'varchar' || dt === 'nvarchar' || dt === 'char' || dt === 'nchar')
            return dt + '(' + (len > 8000 ? 'MAX' : len) + ')';
    }
    if ((dt === 'decimal' || dt === 'numeric') && prec != null)
        return dt + '(' + prec + ',' + (scale != null ? scale : 0) + ')';
    if (dt === 'datetime2' && dtPrec != null) return 'datetime2(' + dtPrec + ')';
    if (dt === 'time' && dtPrec != null) return 'time(' + dtPrec + ')';
    return dt;
}

function defaultClause(col) {
    const def = col.COLUMN_DEFAULT;
    if (def == null || def === '') return '';
    let s = String(def).trim();
    if (s === '(getdate())') return ' DEFAULT GETDATE()';
    if (s === '(getutcdate())') return ' DEFAULT GETUTCDATE()';
    if (/^\(\(0\)\)$/i.test(s)) return ' DEFAULT 0';
    if (/^\(\(1\)\)$/i.test(s)) return ' DEFAULT 1';
    if (/^\(N?'([^']*)'\)$/i.test(s)) return " DEFAULT N'" + s.replace(/^\(N?'([^']*)'\)$/i, '$1').replace(/'/g, "''") + "'";
    if (/^\(\((\d+)\)\)$/.test(s)) return ' DEFAULT ' + s.replace(/^\(\((\d+)\)\)$/, '$1');
    if (s.length > 0 && s.startsWith('(') && s.endsWith(')')) return ' DEFAULT ' + s;
    return '';
}

async function getTableDef(pool, tableName) {
    const schema = 'dbo';
    const req = pool.request();
    req.input('tableName', sql.NVarChar(128), tableName);
    req.input('schemaName', sql.NVarChar(128), schema);

    const colsQuery = `
        SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE,
            c.DATETIME_PRECISION,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT,
            CAST(CASE WHEN ic.column_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS is_identity
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN sys.columns sc ON sc.object_id = OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME))
            AND sc.name = c.COLUMN_NAME
        LEFT JOIN sys.identity_columns ic ON ic.object_id = sc.object_id AND ic.column_id = sc.column_id
        WHERE c.TABLE_NAME = @tableName AND c.TABLE_SCHEMA = @schemaName
        ORDER BY c.ORDINAL_POSITION
    `;
    const colsResult = await req.query(colsQuery);
    const columns = colsResult.recordset || [];

    const pkReq = pool.request();
    pkReq.input('tableName', sql.NVarChar(128), tableName);
    pkReq.input('schemaName', sql.NVarChar(128), schema);
    const pkResult = await pkReq.query(`
        SELECT kcu.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_NAME = kcu.TABLE_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        WHERE tc.TABLE_NAME = @tableName AND tc.TABLE_SCHEMA = @schemaName AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ORDER BY kcu.ORDINAL_POSITION
    `);
    const pkCols = (pkResult.recordset || []).map((r) => r.COLUMN_NAME);

    const parts = [];
    for (const col of columns) {
        let line = '    ' + quoteName(col.COLUMN_NAME) + ' ' + sqlType(col);
        if (col.IS_NULLABLE === 'NO' && !col.is_identity) line += ' NOT NULL';
        else if (col.IS_NULLABLE === 'YES') line += ' NULL';
        line += defaultClause(col);
        parts.push(line);
    }
    if (pkCols.length > 0) {
        parts.push('    CONSTRAINT [PK_' + tableName + '] PRIMARY KEY (' + pkCols.map(quoteName).join(', ') + ')');
    }
    return 'CREATE TABLE [dbo].' + quoteName(tableName) + ' (\n' + parts.join(',\n') + '\n);';
}

async function run() {
    const refConfig = { ...mssqlConfig, database: REF_DB };
    const refPool = new sql.ConnectionPool(refConfig);
    const targetPool = new sql.ConnectionPool(mssqlConfig);
    await refPool.connect();
    await targetPool.connect();

    console.log('\nสร้างตารางที่ขาดใน smart_room_booking (ดูโครงสร้างจาก ' + REF_DB + ')');
    console.log('Target DB:', mssqlConfig.database, '\n');

    let created = 0;
    let skipped = 0;
    for (const tableName of MISSING_TABLES) {
        try {
            const existsResult = await targetPool.request().query(
                "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = N'" + tableName.replace(/'/g, "''") + "' AND TABLE_SCHEMA = 'dbo'"
            );
            if ((existsResult.recordset || []).length > 0) {
                console.log('  ข้าม (มีแล้ว): ' + tableName);
                skipped++;
                continue;
            }
            const createSql = await getTableDef(refPool, tableName);
            await targetPool.request().query(createSql);
            console.log('  สร้างแล้ว: ' + tableName);
            created++;
        } catch (err) {
            console.error('  ผิดพลาด ' + tableName + ':', err.message);
        }
    }

    await refPool.close();
    await targetPool.close();
    console.log('\nสรุป: สร้าง ' + created + ' ตาราง, ข้าม ' + skipped + ' ตาราง\n');
}

run().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
