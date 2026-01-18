const { pool } = require('../config/database');

class Device {
    static async findAll(options = {}) {
        let query = `
            SELECT d.*, 
                   r.name as room_name,
                   a.name as area_name,
                   b.name as building_name
            FROM devices d
            LEFT JOIN rooms r ON d.room_id = r.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (options.room_id) {
            query += ' AND d.room_id = ?';
            params.push(options.room_id);
        }

        if (options.type) {
            query += ' AND d.type = ?';
            params.push(options.type);
        }

        if (options.is_active !== undefined) {
            query += ' AND d.is_active = ?';
            params.push(options.is_active);
        }

        if (options.search) {
            query += ' AND (d.name LIKE ? OR d.device_id LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ' ORDER BY d.created_at DESC';

        if (options.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(options.limit, options.offset || 0);
        }

        const [rows] = await pool.query(query, params);
        return rows;
    }

    static async findById(id) {
        const query = `
            SELECT d.*, 
                   r.name as room_name,
                   a.name as area_name,
                   b.name as building_name
            FROM devices d
            LEFT JOIN rooms r ON d.room_id = r.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE d.id = ?
        `;
        const [rows] = await pool.query(query, [id]);
        return rows[0];
    }

    static async findByDeviceId(deviceId) {
        const query = `
            SELECT d.*, 
                   r.name as room_name
            FROM devices d
            LEFT JOIN rooms r ON d.room_id = r.id
            WHERE d.device_id = ?
        `;
        const [rows] = await pool.query(query, [deviceId]);
        return rows[0];
    }

    static async create(data) {
        const query = `
            INSERT INTO devices (
                room_id, device_id, name, type, 
                description, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await pool.query(query, [
            data.room_id,
            data.device_id,
            data.name,
            data.type,
            data.description || null,
            data.is_active !== undefined ? data.is_active : 1
        ]);

        return this.findById(result.insertId);
    }

    static async update(id, data) {
        const query = `
            UPDATE devices SET
                room_id = ?,
                device_id = ?,
                name = ?,
                type = ?,
                description = ?,
                is_active = ?,
                updated_at = NOW()
            WHERE id = ?
        `;
        await pool.query(query, [
            data.room_id,
            data.device_id,
            data.name,
            data.type,
            data.description,
            data.is_active,
            id
        ]);

        return this.findById(id);
    }

    static async delete(id) {
        const query = 'DELETE FROM devices WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    }

    static async count(options = {}) {
        let query = 'SELECT COUNT(*) as total FROM devices WHERE 1=1';
        const params = [];

        if (options.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(options.is_active);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    }

    static async getByRoom(roomId) {
        const query = `
            SELECT * FROM devices 
            WHERE room_id = ? AND is_active = 1
            ORDER BY type, name
        `;
        const [rows] = await pool.query(query, [roomId]);
        return rows;
    }
}

module.exports = Device;
