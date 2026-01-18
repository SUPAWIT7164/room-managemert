const { pool } = require('../config/database');

class Visitor {
    static async findAll(options = {}) {
        let query = `SELECT * FROM visitors WHERE 1=1`;
        const params = [];

        if (options.approve !== undefined) {
            if (options.approve === 'pending') {
                query += ' AND approve IS NULL';
            } else if (options.approve === 'approved') {
                query += ' AND approve = 1';
            } else if (options.approve === 'rejected') {
                query += ' AND approve = 0';
            }
        }

        if (options.date) {
            query += ' AND DATE(created_at) = ?';
            params.push(options.date);
        }

        if (options.search) {
            query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY created_at DESC';

        if (options.limit) {
            query += ' LIMIT ?';
            params.push(parseInt(options.limit));
        }

        const [rows] = await pool.query(query, params);
        
        // Map to unified format
        return rows.map(row => ({
            ...row,
            status: row.approve === null ? 'pending' : row.approve ? 'approved' : 'rejected',
            organization: row.faculty
        }));
    }

    static async findById(id) {
        const [rows] = await pool.query(`SELECT * FROM visitors WHERE id = ?`, [id]);
        if (!rows[0]) return null;
        
        return {
            ...rows[0],
            status: rows[0].approve === null ? 'pending' : rows[0].approve ? 'approved' : 'rejected',
            organization: rows[0].faculty
        };
    }

    static async create(data) {
        const [result] = await pool.query(
            `INSERT INTO visitors (prefix_name, prefix_name_en, name, name_en, email, phone, citizen_id, faculty, address, image) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.prefix_name || null,
                data.prefix_name_en || null,
                data.name,
                data.name_en || data.name,
                data.email || null,
                data.phone || null,
                data.citizen_id || '',
                data.organization || data.faculty || null,
                data.address || null,
                data.image || null
            ]
        );
        return { id: result.insertId, ...data };
    }

    static async update(id, data) {
        const updates = [];
        const params = [];

        const allowedFields = ['prefix_name', 'prefix_name_en', 'name', 'name_en', 'email', 'phone', 'citizen_id', 'faculty', 'address', 'image', 'approve'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(data[field]);
            }
        }

        if (updates.length === 0) return null;

        params.push(id);
        await pool.query(`UPDATE visitors SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.findById(id);
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM visitors WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async approve(id) {
        await pool.query('UPDATE visitors SET approve = 1 WHERE id = ?', [id]);
        return this.findById(id);
    }

    static async reject(id) {
        await pool.query('UPDATE visitors SET approve = 0 WHERE id = ?', [id]);
        return this.findById(id);
    }

    static async count(options = {}) {
        let query = 'SELECT COUNT(*) as total FROM visitors WHERE 1=1';
        const params = [];

        if (options.approve !== undefined) {
            if (options.approve === 'pending') {
                query += ' AND approve IS NULL';
            } else if (options.approve === 'approved') {
                query += ' AND approve = 1';
            }
        }

        if (options.date) {
            query += ' AND DATE(created_at) = ?';
            params.push(options.date);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    }

    static async getTodayVisitors() {
        const [rows] = await pool.query(`
            SELECT * FROM visitors 
            WHERE DATE(created_at) = CURDATE()
            ORDER BY created_at DESC
        `);
        return rows.map(row => ({
            ...row,
            status: row.approve === null ? 'pending' : row.approve ? 'approved' : 'rejected'
        }));
    }
}

module.exports = Visitor;
