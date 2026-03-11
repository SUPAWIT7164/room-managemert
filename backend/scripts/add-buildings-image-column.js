/**
 * Add image column to buildings table (run once)
 * Usage: node scripts/add-buildings-image-column.js
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
        const result = await pool.request().query(`
            IF COL_LENGTH(N'dbo.buildings', N'image') IS NULL
            BEGIN
                ALTER TABLE [dbo].[buildings] ADD [image] nvarchar(500) NULL;
                PRINT N'Added column buildings.image';
            END
        `);
        console.log('\nColumn buildings.image ready.\n');
    } catch (err) {
        console.error('Error:', err.message);
        throw err;
    } finally {
        if (pool) await pool.close();
    }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
