require('dotenv').config();
const mysql = require('mysql2/promise');

async function cleanupRooms() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 8011,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '1234',
        database: process.env.DB_NAME || 'smart_room_booking'
    });

    try {
        // List of rooms to keep
        const roomsToKeep = [
            'อาคาร A - ห้อง 101',
            'อาคาร A - ห้อง 102',
            'อาคาร A - ห้อง 103',
            'อาคาร A - ห้อง 201',
            'อาคาร A - ห้อง 202',
            'อาคาร A - ห้อง 203',
            'ห้องประชุม Earth',
            'ห้องประชุม Jupiter',
            'ห้องประชุม Mars',
            'ห้องประชุม Mercury',
            'ห้องประชุม Venus'
        ];

        // Get current rooms
        const [currentRooms] = await conn.query('SELECT id, name FROM rooms');
        console.log('Current rooms:', currentRooms.length);

        // Delete rooms not in the list
        const placeholders = roomsToKeep.map(() => '?').join(',');
        const [result] = await conn.query(
            `DELETE FROM rooms WHERE name NOT IN (${placeholders})`,
            roomsToKeep
        );
        console.log('Deleted rooms:', result.affectedRows);

        // Show remaining rooms
        const [remainingRooms] = await conn.query('SELECT id, name FROM rooms ORDER BY name');
        console.log('\nRemaining rooms:', remainingRooms.length);
        remainingRooms.forEach(r => console.log('-', r.name));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await conn.end();
    }
}

cleanupRooms();
















