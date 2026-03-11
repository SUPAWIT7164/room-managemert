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
            // Support both old schema (is_active) and new schema (status + disable)
            if (options.is_active) {
                // Active: either is_active = 1 OR (status = 'active' AND disable = 0)
                query += ' AND ((d.is_active = 1) OR (d.status = \'active\' AND d.disable = 0))';
            } else {
                // Inactive: either is_active = 0 OR (status != 'active' OR disable = 1)
                query += ' AND ((d.is_active = 0) OR (d.status != \'active\' OR d.disable = 1))';
            }
        }

        if (options.search) {
            query += ' AND (d.name LIKE ? OR d.ip LIKE ? OR d.code LIKE ? OR d.device_id LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
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
            WHERE d.device_id = ? OR d.ip = ? OR d.code = ?
        `;
        const [rows] = await pool.query(query, [deviceId, deviceId, deviceId]);
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
            // Support both old schema (is_active) and new schema (status + disable)
            if (options.is_active) {
                // Active: either is_active = 1 OR (status = 'active' AND disable = 0)
                query += ' AND ((is_active = 1) OR (status = \'active\' AND disable = 0))';
            } else {
                // Inactive: either is_active = 0 OR (status != 'active' OR disable = 1)
                query += ' AND ((is_active = 0) OR (status != \'active\' OR disable = 1))';
            }
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    }

    static async getByRoom(roomId) {
        const query = `
            SELECT * FROM devices 
            WHERE room_id = ? AND (is_active = 1 OR (status = 'active' AND disable = 0))
            ORDER BY device_category, name
        `;
        const [rows] = await pool.query(query, [roomId]);
        return rows;
    }

    /**
     * โหลดตำแหน่งอุปกรณ์จากตาราง devices (x, y) สำหรับ room
     */
    static async getPositionsByRoom(roomId) {
        const [rows] = await pool.query(
            `SELECT device_type, x, y FROM devices
             WHERE room_id = ? AND device_type IN ('light','ac','erv') AND device_type IS NOT NULL
             ORDER BY device_type, id`,
            [roomId]
        );
        const positions = { light: [], ac: [], erv: [] };
        (rows || []).forEach((row) => {
            const type = row.device_type || row.type;
            if (!positions[type]) return;
            const x = row.x != null ? Number(row.x) : null;
            const y = row.y != null ? Number(row.y) : null;
            if (x != null && y != null) positions[type].push({ x, y });
        });
        return positions;
    }

    /**
     * บันทึกตำแหน่งอุปกรณ์ลงตาราง devices (x, y)
     */
    static async setPositionsByRoom(roomId, positions) {
        const types = ['light', 'ac', 'erv'];
        const defaultName = (type, idx) => `pos-${type}-${idx}`;
        const defaultCode = (type, idx) => `POS-${type.toUpperCase()}-${idx}`;
        for (const deviceType of types) {
            const arr = positions[deviceType];
            if (!Array.isArray(arr)) continue;
            const [existingRows] = await pool.query(
                'SELECT id FROM devices WHERE room_id = ? AND device_type = ? ORDER BY id',
                [roomId, deviceType]
            );
            const ids = (existingRows || []).map((r) => r.id);
            for (let i = 0; i < arr.length; i++) {
                const p = arr[i];
                const x = p != null && (p.x != null || p.x1 != null) ? Number(p.x ?? p.x1) : null;
                const y = p != null && (p.y != null || p.y1 != null) ? Number(p.y ?? p.y1) : null;
                if (ids[i] != null) {
                    await pool.query(
                        'UPDATE devices SET x = ?, y = ? WHERE id = ?',
                        [x, y, ids[i]]
                    );
                } else {
                    const name = defaultName(deviceType, i);
                    const code = defaultCode(deviceType, i);
                    try {
                        await pool.query(
                            `INSERT INTO devices (room_id, device_type, x, y, name, code) VALUES (?, ?, ?, ?, ?, ?)`,
                            [roomId, deviceType, x, y, name, code]
                        );
                    } catch (insertErr) {
                        if (insertErr.message && /code|Invalid column name/i.test(insertErr.message)) {
                            await pool.query(
                                `INSERT INTO devices (room_id, device_type, x, y, name) VALUES (?, ?, ?, ?, ?)`,
                                [roomId, deviceType, x, y, name]
                            );
                        } else {
                            throw insertErr;
                        }
                    }
                }
            }
        }
        return true;
    }
}

module.exports = Device;
