const { pool } = require('../config/database');

class Room {
    static async findAll(options = {}) {
        let query = `
            SELECT r.*, 
                   rt.name as room_type_name,
                   a.name as area_name,
                   b.id as building_id, b.name as building_name
            FROM rooms r
            LEFT JOIN room_types rt ON r.room_type_id = rt.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (options.area_id) {
            query += ' AND r.area_id = ?';
            params.push(options.area_id);
        }

        if (options.building_id) {
            query += ' AND b.id = ?';
            params.push(options.building_id);
        }

        if (options.room_type_id) {
            query += ' AND r.room_type_id = ?';
            params.push(options.room_type_id);
        }

        if (options.disable !== undefined) {
            query += ' AND r.disable = ?';
            params.push(options.disable);
        } else {
            query += ' AND r.disable = 0';
        }

        if (options.search) {
            query += ' AND r.name LIKE ?';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm);
        }

        query += ' ORDER BY b.name, a.name, r.name';

        const [rows] = await pool.query(query, params);
        // Convert disable to is_active for frontend compatibility
        // disable: 0 = active (true), disable: 1 = inactive (false)
        return rows.map(room => ({
            ...room,
            is_active: room.disable === 0 || room.disable === false || room.disable === null
        }));
    }

    static async findById(id) {
        const [rows] = await pool.query(`
            SELECT r.*, 
                   rt.name as room_type_name,
                   a.name as area_name,
                   b.id as building_id, b.name as building_name
            FROM rooms r
            LEFT JOIN room_types rt ON r.room_type_id = rt.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE r.id = ?
        `, [id]);
        if (!rows[0]) return null;
        // Convert disable to is_active for frontend compatibility
        // disable: 0 = active (true), disable: 1 = inactive (false)
        return {
            ...rows[0],
            is_active: rows[0].disable === 0 || rows[0].disable === false || rows[0].disable === null
        };
    }

    static async findWithApprovers(id) {
        const room = await this.findById(id);
        if (!room) return null;

        const [approvers] = await pool.query(`
            SELECT ap.id, ap.user_id, u.name, u.email
            FROM approvers ap
            JOIN users u ON ap.user_id = u.id
            WHERE ap.room_id = ?
        `, [id]);
        
        room.approvers = approvers;
        // is_active already set in findById
        return room;
    }

    static async create(data) {
        const [result] = await pool.query(
            `INSERT INTO rooms (name, description, area_id, room_type_id, capacity, facilities, auto_approve, automation_enabled, disable, image) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [
                data.name,
                data.description || null,
                data.area_id,
                data.room_type_id || null,
                data.capacity || 1,
                data.facilities || null,
                data.auto_approve ? 1 : 0,
                data.automation_enabled ? 1 : 0,
                data.image || null
            ]
        );
        return this.findById(result.insertId);
    }

    static async update(id, data) {
        try {
        const updates = [];
        const params = [];

            const allowedFields = ['name', 'description', 'area_id', 'room_type_id', 'capacity', 'facilities', 'auto_approve', 'automation_enabled', 'disable', 'is_active', 'image', 'x1', 'y1', 'x2', 'y2'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                    let value = data[field];
                    
                    // Handle is_active conversion to disable
                    if (field === 'is_active') {
                        // Convert is_active (true/false) to disable (0/1)
                        // is_active: true = disable: 0, is_active: false = disable: 1
                        updates.push('disable = ?');
                        params.push(value === true || value === 1 || value === '1' ? 0 : 1);
                        continue;
                    }
                    
                    // Convert boolean fields to proper format (0/1 for TINYINT)
                    if (field === 'auto_approve' || field === 'automation_enabled' || field === 'disable') {
                        value = value === true || value === 1 || value === '1' ? 1 : 0;
                    }
                    
                    // Handle null values
                    if (value === null || value === '') {
                        if (field === 'description' || field === 'facilities') {
                            value = null;
                        } else if (field === 'room_type_id' || field === 'area_id') {
                            value = null;
                        } else if (field === 'x1' || field === 'y1' || field === 'x2' || field === 'y2') {
                            value = null;
                        } else {
                            continue; // Skip null values for numeric fields
                        }
                    }

                    // Convert x1,y1,x2,y2 to number
                    if ((field === 'x1' || field === 'y1' || field === 'x2' || field === 'y2') && value != null) {
                        value = Number(value);
                        if (Number.isNaN(value)) continue;
                    }
                    
                    updates.push(`${field} = ?`);
                    params.push(value);
            }
        }

        if (updates.length === 0) return null;

        params.push(id);
            const query = `UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`;
            console.log('Room update query:', query);
            console.log('Room update params:', params);
            
            await pool.query(query, params);
        return this.findById(id);
        } catch (error) {
            console.error('Room.update error:', error);
            throw error;
        }
    }

    static async delete(id) {
        // Use disable flag instead of soft delete
        await pool.query('UPDATE rooms SET disable = 1 WHERE id = ?', [id]);
        return true;
    }

    static async count(options = {}) {
        let query = 'SELECT COUNT(*) as total FROM rooms r WHERE r.disable = 0';
        const params = [];

        if (options.area_id) {
            query += ' AND r.area_id = ?';
            params.push(options.area_id);
        }

        if (options.building_id) {
            query += ' AND EXISTS (SELECT 1 FROM areas a WHERE a.id = r.area_id AND a.building_id = ?)';
            params.push(options.building_id);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    }

    static async getAvailability(roomId, date) {
        const [bookings] = await pool.query(`
            SELECT br.id, br.name as title, 
                   FORMAT(br.[start], 'yyyy-MM-dd HH:mm:ss') as start_datetime,
                   FORMAT(br.[end], 'yyyy-MM-dd HH:mm:ss') as end_datetime,
                   br.status, br.cancel, br.reject
            FROM booking_requests br
            WHERE br.[room] = ? 
              AND CAST(br.[start] AS DATE) = CAST(? AS DATE)
              AND (br.[cancel] IS NULL OR br.[cancel] = 0)
              AND (br.[reject] IS NULL OR br.[reject] = 0)
            ORDER BY br.[start]
        `, [roomId, date]);
        return bookings.map(b => ({
            ...b,
            start: b.start_datetime, // Use string format for Date parsing
            end: b.end_datetime, // Use string format for Date parsing
            start_time: b.start_datetime,
            end_time: b.end_datetime
        }));
    }

    /**
     * โหลดตำแหน่งอุปกรณ์จากตาราง devices (x, y) โดยตรง
     * ไม่ใช้ rooms.device_positions JSON แล้ว
     * คืนค่า { light: [{x,y}], ac: [...], erv: [...] } สำหรับหน้า /rooms/control
     */
    static async getDevicePositions(roomId) {
        const Device = require('./Device');
        return await Device.getPositionsByRoom(roomId);
    }

    /**
     * บันทึกตำแหน่งอุปกรณ์ลงตาราง devices (x, y) โดยตรง
     * ไม่ใช้ rooms.device_positions JSON แล้ว
     */
    static async setDevicePositions(roomId, positions) {
        const Device = require('./Device');
        return await Device.setPositionsByRoom(roomId, positions);
    }
}

module.exports = Room;
