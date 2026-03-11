const { pool } = require('../config/database');

class CctvCamera {
    static async findAll() {
        const [rows] = await pool.query(
            `SELECT id, name, base_url, username, password, snapshot_endpoint, created_at, updated_at
             FROM cctv_cameras ORDER BY id`
        );
        return rows || [];
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, base_url, username, password, snapshot_endpoint, created_at, updated_at
             FROM cctv_cameras WHERE id = ?`,
            [id]
        );
        return rows && rows[0] ? rows[0] : null;
    }

    static async create(data) {
        const { name, base_url, username, password, snapshot_endpoint } = data;
        const result = await pool.execute(
            `INSERT INTO cctv_cameras (name, base_url, username, password, snapshot_endpoint, updated_at)
             VALUES (?, ?, ?, ?, ?, GETDATE())`,
            [
                name || null,
                base_url || '',
                username || '',
                password || '',
                snapshot_endpoint || '/ISAPI/Streaming/channels/101/picture'
            ]
        );
        return result.insertId;
    }

    static async update(id, data) {
        const { name, base_url, username, password, snapshot_endpoint } = data;
        await pool.execute(
            `UPDATE cctv_cameras SET name = ?, base_url = ?, username = ?, password = ?, snapshot_endpoint = ?, updated_at = GETDATE() WHERE id = ?`,
            [
                name !== undefined ? name : null,
                base_url !== undefined ? base_url : null,
                username !== undefined ? username : null,
                password !== undefined ? password : null,
                snapshot_endpoint !== undefined ? snapshot_endpoint : null,
                id
            ]
        );
        return id;
    }

    static async delete(id) {
        const result = await pool.execute('DELETE FROM cctv_cameras WHERE id = ?', [id]);
        return result && result.affectedRows > 0;
    }
}

module.exports = CctvCamera;
