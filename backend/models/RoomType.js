const { pool } = require('../config/database');

class RoomType {
    static async findAll() {
        const [rows] = await pool.query('SELECT * FROM room_types ORDER BY name');
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM room_types WHERE id = ?', [id]);
        return rows[0];
    }

    static async create(data) {
        const [result] = await pool.query(
            'INSERT INTO room_types (name, name_en, is_default) VALUES (?, ?, ?)',
            [data.name, data.name_en || null, data.is_default || 1]
        );
        return { id: result.insertId, ...data };
    }

    static async update(id, data) {
        const updates = [];
        const params = [];

        const allowedFields = ['name', 'name_en', 'is_default'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(data[field]);
            }
        }

        if (updates.length === 0) return null;

        params.push(id);
        await pool.query(`UPDATE room_types SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.findById(id);
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM room_types WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = RoomType;
