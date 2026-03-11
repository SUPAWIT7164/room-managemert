/**
 * Add x1, y1, x2, y2 and device_positions to rooms table (ตำแหน่งอุปกรณ์ในหน้า /rooms/control)
 * Usage: node scripts/add-rooms-position-columns.js
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
    { name: 'x1', type: 'decimal(10,4)' },
    { name: 'y1', type: 'decimal(10,4)' },
    { name: 'x2', type: 'decimal(10,4)' },
    { name: 'y2', type: 'decimal(10,4)' },
    { name: 'device_positions', type: 'nvarchar(max)' },
];

async function run() {
    let pool;
    try {
        pool = await sql.connect(config);
        for (const col of columns) {
            await pool.request().query(`
                IF COL_LENGTH(N'dbo.rooms', N'${col.name}') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[rooms] ADD [${col.name}] ${col.type} NULL;
                    PRINT N'Added rooms.${col.name}';
                END
            `);
        }
        console.log('\nColumns x1, y1, x2, y2, device_positions on rooms table are ready.\n');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
