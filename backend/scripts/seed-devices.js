require('dotenv').config();
const { pool } = require('../config/database');

/**
 * Script to seed real devices into the database
 * - 192.168.22.53: Face Scanner (เครื่องสแกนหน้า)
 * - 192.168.24.1: CCTV Camera (กล้อง cctv)
 */

async function seedDevices() {
    try {
        console.log('Starting device seeding...');

        // Get the first room if available (for room_id)
        let roomId = null;
        try {
            const [rooms] = await pool.query('SELECT id FROM rooms LIMIT 1');
            if (rooms.length > 0) {
                roomId = rooms[0].id;
                console.log(`Using room_id: ${roomId}`);
            } else {
                console.log('No rooms found, devices will be created without room assignment');
            }
        } catch (error) {
            console.log('Could not fetch rooms, devices will be created without room assignment');
        }

        const devices = [
            {
                ip: '192.168.22.53',
                name: 'เครื่องสแกนหน้า',
                code: 'FACE_SCANNER_01',
                description: 'Face Scanner Device - IP: 192.168.22.53',
                status: 'active',
                disable: 0,
                room_id: roomId,
                device_category: 'sensor'
            },
            {
                ip: '192.168.24.1',
                name: 'กล้อง CCTV',
                code: 'CCTV_01',
                description: 'CCTV Camera - IP: 192.168.24.1',
                status: 'active',
                disable: 0,
                room_id: roomId,
                device_category: 'sensor'
            }
        ];

        for (const device of devices) {
            // Check if device already exists by IP
            const [existing] = await pool.query(
                'SELECT id FROM devices WHERE ip = ?',
                [device.ip]
            );

            if (existing.length > 0) {
                // Update existing device
                await pool.query(
                    `UPDATE devices SET 
                        name = ?, 
                        code = ?,
                        description = ?, 
                        status = ?,
                        disable = ?,
                        room_id = ?,
                        device_category = ?,
                        updated_at = GETDATE()
                    WHERE ip = ?`,
                    [
                        device.name,
                        device.code,
                        device.description,
                        device.status,
                        device.disable,
                        device.room_id,
                        device.device_category,
                        device.ip
                    ]
                );
                console.log(`✓ Updated device: ${device.name} (${device.ip})`);
            } else {
                // Insert new device
                await pool.query(
                    `INSERT INTO devices (
                        room_id, ip, name, code, description, status, disable, device_category, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE())`,
                    [
                        device.room_id,
                        device.ip,
                        device.name,
                        device.code,
                        device.description,
                        device.status,
                        device.disable,
                        device.device_category
                    ]
                );
                console.log(`✓ Created device: ${device.name} (${device.ip})`);
            }
        }

        console.log('\nDevice seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding devices:', error);
        process.exit(1);
    }
}

// Run the seeding
seedDevices();

