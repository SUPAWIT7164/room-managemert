const { pool } = require('../config/database');

class Building {
    static async findAll(options = {}) {
        let query = 'SELECT * FROM buildings';
        const params = [];
        const conditions = [];

        if (options.search) {
            conditions.push('(name LIKE ? OR name_en LIKE ?)');
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY name ASC';

        const [rows] = await pool.query(query, params);
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM buildings WHERE id = ?', [id]);
        return rows[0];
    }

    static async findWithAreas(id) {
        const building = await this.findById(id);
        if (!building) return null;

        const [areas] = await pool.query('SELECT * FROM areas WHERE building_id = ? AND disable = 0 ORDER BY name', [id]);
        building.areas = areas;
        return building;
    }

    static async create(data) {
        const [result] = await pool.query(
            'INSERT INTO buildings (name, name_en) VALUES (?, ?)',
            [data.name, data.name_en || null]
        );
        return { id: result.insertId, ...data };
    }

    static async update(id, data) {
        const updates = [];
        const params = [];

        const allowedFields = ['name', 'name_en'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(data[field]);
            }
        }

        if (updates.length === 0) return null;

        params.push(id);
        await pool.query(`UPDATE buildings SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.findById(id);
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM buildings WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async count() {
        const [rows] = await pool.query('SELECT COUNT(*) as total FROM buildings');
        return rows[0].total;
    }
}

module.exports = Building;
