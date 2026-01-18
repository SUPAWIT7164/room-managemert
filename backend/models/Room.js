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
            `INSERT INTO rooms (name, description, area_id, room_type_id, capacity, facilities, auto_approve, automation_enabled, disable) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                data.name,
                data.description || null,
                data.area_id,
                data.room_type_id || null,
                data.capacity || 1,
                data.facilities || null,
                data.auto_approve ? 1 : 0,
                data.automation_enabled ? 1 : 0
            ]
        );
        return this.findById(result.insertId);
    }

    static async update(id, data) {
        try {
        const updates = [];
        const params = [];

            const allowedFields = ['name', 'description', 'area_id', 'room_type_id', 'capacity', 'facilities', 'auto_approve', 'automation_enabled', 'disable', 'is_active', 'image'];
        
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
                        } else {
                            continue; // Skip null values for numeric fields
                        }
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
            SELECT id, title, start_datetime as start_time, end_datetime as end_time, status
            FROM booking_requests
            WHERE room_id = ? 
              AND DATE(start_datetime) = ?
              AND status NOT IN ('rejected', 'cancelled')
            ORDER BY start_datetime
        `, [roomId, date]);
        return bookings;
    }
}

module.exports = Room;
