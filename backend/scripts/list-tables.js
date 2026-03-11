/**
 * List all tables in the database (SQL Server)
 * Usage: node scripts/list-tables.js
 * Uses .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
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

async function listTables() {
    let pool;
    try {
        pool = await sql.connect(config);
        const dbName = config.database;
        const result = await pool.request().query(`
            SELECT TABLE_SCHEMA, TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `);
        const tables = result.recordset || [];
        console.log('\n=== Database:', dbName, 'Host:', config.server, '===');
        console.log('Total tables:', tables.length);
        console.log('\nTables:');
        console.log('--------');
        tables.forEach((row, i) => {
            const name = (row.TABLE_SCHEMA && row.TABLE_SCHEMA !== 'dbo' ? row.TABLE_SCHEMA + '.' : '') + row.TABLE_NAME;
            console.log((i + 1) + '. ' + name);
        });
        console.log('');
        return tables;
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

listTables().then(() => process.exit(0)).catch(() => process.exit(1));
