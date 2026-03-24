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
     * รองรับทั้ง device_type และ code (air -> ac)
     */
    static async getPositionsByRoom(roomId) {
        const [rows] = await pool.query(
            `SELECT d.id, d.device_type, d.code, d.x, d.y, dt.name AS device_type_name
             FROM devices d
             LEFT JOIN device_types dt ON d.device_type_id = dt.id
             WHERE d.room_id = ? 
             AND (
                 d.device_type IN ('light','ac','erv','vent_fan','am319') 
                  OR LOWER(LTRIM(RTRIM(ISNULL(d.code,'')))) IN ('light','ac','erv','air','vent_fan','fan','exhaust_fan','ventilation_fan','am319')
                  OR LOWER(LTRIM(RTRIM(ISNULL(d.code,'')))) LIKE 'am319%'
                  OR LOWER(LTRIM(RTRIM(ISNULL(dt.name,'')))) = 'am319'
                  OR LOWER(LTRIM(RTRIM(ISNULL(dt.name,'')))) LIKE 'am319%'
             )
             AND (d.disable = 0 OR d.disable IS NULL)
             ORDER BY COALESCE(d.device_type, d.code), d.id`,
            [roomId]
        );
        const positions = { light: [], ac: [], erv: [], vent_fan: [], am319: [] };
        (rows || []).forEach((row) => {
            let type = row.device_type || row.code || row.device_type_name;
            if (type) type = String(type).toLowerCase().trim();
            if (type === 'air') type = 'ac';
            if (type === 'fan' || type === 'exhaust_fan' || type === 'ventilation_fan') type = 'vent_fan';
            // code เช่น am319-1 หรือชื่อใน device_types ที่ขึ้นต้น am319
            if (type && type.startsWith('am319')) type = 'am319';
            if (!positions[type]) return;
            const x = row.x != null ? parseFloat(String(row.x).replace(/[^0-9.-]/g, '')) : null;
            const y = row.y != null ? parseFloat(String(row.y).replace(/[^0-9.-]/g, '')) : null;
            if (x != null && !isNaN(x) && y != null && !isNaN(y)) {
                positions[type].push({ x, y });
            }
        });
        return positions;
    }

    /**
     * บันทึกตำแหน่งอุปกรณ์ลงตาราง devices (x, y)
     * รองรับทั้ง device_type และ code (air -> ac)
     */
    static async setPositionsByRoom(roomId, positions) {
        console.log(`[Device] setPositionsByRoom roomId=${roomId} positions=`, JSON.stringify(positions));
        const types = ['light', 'ac', 'erv', 'vent_fan', 'am319'];
        let updatedCount = 0;
        
        for (const deviceType of types) {
            const arr = positions[deviceType];
            if (!Array.isArray(arr) || arr.length === 0) {
                console.log(`[Device] No positions for ${deviceType}, skipping`);
                continue;
            }
            
            console.log(`[Device] Processing ${deviceType}: ${arr.length} positions`);
            
            let query;
            let params;
            if (deviceType === 'am319') {
                query = `SELECT d.id, d.device_type, d.code, d.x, d.y FROM devices d
                 LEFT JOIN device_types dt ON d.device_type_id = dt.id
                 WHERE d.room_id = ? 
                 AND (
                    d.device_type = 'am319'
                    OR LOWER(LTRIM(RTRIM(ISNULL(d.code,'')))) LIKE 'am319%'
                    OR LOWER(LTRIM(RTRIM(ISNULL(dt.name,'')))) = 'am319'
                    OR LOWER(LTRIM(RTRIM(ISNULL(dt.name,'')))) LIKE 'am319%'
                 )
                 AND (d.disable = 0 OR d.disable IS NULL)
                 ORDER BY d.id`;
                params = [roomId];
            } else {
                let codeVariants = [deviceType];
                if (deviceType === 'ac') codeVariants = ['ac', 'air'];
                if (deviceType === 'vent_fan') codeVariants = ['vent_fan', 'fan', 'exhaust_fan', 'ventilation_fan'];
                const codePlaceholders = codeVariants.map(() => '?').join(',');
                query = `SELECT id, device_type, code, x, y FROM devices 
                 WHERE room_id = ? 
                 AND (device_type = ? OR LOWER(LTRIM(RTRIM(ISNULL(code,'')))) IN (${codePlaceholders}))
                 AND (disable = 0 OR disable IS NULL)
                 ORDER BY id`;
                params = [roomId, deviceType, ...codeVariants];
            }
            
            console.log(`[Device] Query: ${query}`);
            console.log(`[Device] Params:`, params);
            
            const result = await pool.query(query, params);
            const existingRows = Array.isArray(result) ? result[0] : (result.recordset || []);
            const ids = (existingRows || []).map((r) => r.id);
            
            console.log(`[Device] Found ${ids.length} existing devices: ${JSON.stringify(existingRows)}`);
            
            // อัปเดตตำแหน่งเฉพาะอุปกรณ์ที่มีอยู่แล้ว (ไม่สร้างใหม่)
            for (let i = 0; i < Math.min(arr.length, ids.length); i++) {
                const p = arr[i];
                const x = p != null && (p.x != null || p.x1 != null) ? Number(p.x ?? p.x1) : null;
                const y = p != null && (p.y != null || p.y1 != null) ? Number(p.y ?? p.y1) : null;
                
                if (ids[i] != null && x != null && y != null && !isNaN(x) && !isNaN(y)) {
                    await pool.query(
                        'UPDATE devices SET x = ?, y = ? WHERE id = ?',
                        [x, y, ids[i]]
                    );
                    console.log(`[Device] Updated device ${ids[i]}: x=${x}, y=${y}`);
                    updatedCount++;
                } else {
                    console.log(`[Device] Skipping index ${i}: id=${ids[i]}, x=${x}, y=${y}`);
                }
            }
        }
        
        console.log(`[Device] setPositionsByRoom completed. Updated ${updatedCount} devices.`);
        return true;
    }
}

module.exports = Device;
