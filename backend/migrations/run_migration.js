const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_room_booking',
    multipleStatements: true
};

async function runMigration() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(config);
        console.log('Connected successfully');

        // Read the migration file
        const migrationFile = path.join(__dirname, 'create_device_states_table.sql');
        const sql = await fs.readFile(migrationFile, 'utf8');

        console.log('Running migration...');
        await connection.query(sql);
        console.log('Migration completed successfully!');

        // Show created tables
        const [tables] = await connection.query(`
            SHOW TABLES WHERE Tables_in_${config.database} LIKE 'device%' 
            OR Tables_in_${config.database} LIKE 'user_preferences'
        `);
        console.log('\nCreated tables:');
        tables.forEach(row => {
            const tableName = Object.values(row)[0];
            console.log(`  ✓ ${tableName}`);
        });

    } catch (error) {
        console.error('Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\nDatabase connection closed');
        }
    }
}

runMigration();

