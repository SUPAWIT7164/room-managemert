/**
 * Add device_type, x, y columns to devices table (ตำแหน่งอุปกรณ์ในห้อง)
 * Usage: node scripts/add-devices-position-columns.js
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

const columns = [
    { name: 'device_type', type: 'nvarchar(20)' },
    { name: 'x', type: 'decimal(10,4)' },
    { name: 'y', type: 'decimal(10,4)' },
];

async function run() {
    let pool;
    try {
        pool = await sql.connect(config);
        for (const col of columns) {
            await pool.request().query(`
                IF COL_LENGTH(N'dbo.devices', N'${col.name}') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[devices] ADD [${col.name}] ${col.type} NULL;
                    PRINT N'Added devices.${col.name}';
                END
            `);
        }
        console.log('\nColumns device_type, x, y on devices table are ready.\n');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
