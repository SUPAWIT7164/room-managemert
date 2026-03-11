const { pool } = require('../config/database');

class Area {
    static async findAll(options = {}) {
        try {
            // Try with JOIN first
            let query = `
                SELECT a.*, b.name as building_name, b.name_en as building_name_en
                FROM areas a
                LEFT JOIN buildings b ON a.building_id = b.id
            `;
            const params = [];
            const conditions = [];

            if (options.building_id) {
                conditions.push('a.building_id = ?');
                params.push(options.building_id);
            }

            if (options.disable !== undefined) {
                conditions.push('a.disable = ?');
                params.push(options.disable);
            }

            if (options.search) {
                conditions.push('(a.name LIKE ? OR a.name_en LIKE ?)');
                const searchTerm = `%${options.search}%`;
                params.push(searchTerm, searchTerm);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY COALESCE(b.name, ""), a.name';

            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) {
            console.error('Area.findAll error:', error.message);
            console.error('Error code:', error.code);
            
            // Fallback: try simple query without JOIN
            try {
                console.log('Trying fallback query without JOIN...');
                const [rows] = await pool.query('SELECT * FROM areas ORDER BY name');
                return rows;
            } catch (fallbackError) {
                console.error('Fallback query also failed:', fallbackError.message);
                throw error; // Throw original error
            }
        }
    }

    static async findById(id) {
        const [rows] = await pool.query(`
            SELECT a.*, b.name as building_name, b.name_en as building_name_en
            FROM areas a
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE a.id = ?
        `, [id]);
        return rows[0];
    }

    static async findWithRooms(id) {
        const area = await this.findById(id);
        if (!area) return null;

        const [rooms] = await pool.query(`
            SELECT r.*, rt.name as room_type_name
            FROM rooms r
            LEFT JOIN room_types rt ON r.room_type_id = rt.id
            WHERE r.area_id = ? AND r.disable = 0
            ORDER BY r.name
        `, [id]);
        
        area.rooms = rooms;
        return area;
    }

    static async create(data) {
        const [result] = await pool.query(
            'INSERT INTO areas (name, name_en, description, building_id, floor, email, disable, image) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
            [data.name, data.name_en || null, data.description || null, data.building_id, data.floor != null ? Number(data.floor) : null, data.email || null, data.image || null]
        );
        return { id: result.insertId, ...data };
    }

    static async update(id, data) {
        const updates = [];
        const params = [];

        const allowedFields = ['name', 'name_en', 'description', 'building_id', 'floor', 'email', 'disable', 'image'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(data[field]);
            }
        }

        if (updates.length === 0) return null;

        params.push(id);
        await pool.query(`UPDATE areas SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.findById(id);
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM areas WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async count(options = {}) {
        let query = 'SELECT COUNT(*) as total FROM areas WHERE disable = 0';
        const params = [];

        if (options.building_id) {
            query += ' AND building_id = ?';
            params.push(options.building_id);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    }
}

module.exports = Area;
