const { pool } = require('../config/database');

class Approver {
    static async findByRoom(roomId) {
        const [rows] = await pool.query(`
            SELECT ap.id, ap.room_id, ap.user_id, u.name, u.email, u.phone
            FROM approvers ap
            JOIN users u ON ap.user_id = u.id
            WHERE ap.room_id = ?
        `, [roomId]);
        return rows;
    }

    static async findByUser(userId) {
        const [rows] = await pool.query(`
            SELECT ap.id, ap.room_id, ap.user_id, r.name as room_name
            FROM approvers ap
            JOIN rooms r ON ap.room_id = r.id
            WHERE ap.user_id = ?
        `, [userId]);
        return rows;
    }

    static async create(data) {
        const [result] = await pool.query(
            'INSERT INTO approvers (room_id, user_id) VALUES (?, ?)',
            [data.room_id, data.user_id]
        );
        return { id: result.insertId, ...data };
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM approvers WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async deleteByRoomAndUser(roomId, userId) {
        const [result] = await pool.query(
            'DELETE FROM approvers WHERE room_id = ? AND user_id = ?',
            [roomId, userId]
        );
        return result.affectedRows > 0;
    }

    static async isApprover(userId, roomId) {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM approvers WHERE room_id = ? AND user_id = ?',
            [roomId, userId]
        );
        return rows[0].count > 0;
    }

    static async getPendingBookingsForApprover(userId) {
        const [rows] = await pool.query(`
            SELECT br.*, 
                   r.name as room_name,
                   u.name as booker_name, u.email as booker_email,
                   a.name as area_name,
                   b.name as building_name
            FROM booking_requests br
            JOIN rooms r ON br.room_id = r.id
            JOIN approvers ap ON ap.room_id = r.id
            JOIN users u ON br.user_id = u.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE ap.user_id = ? AND br.status = 'pending'
            ORDER BY br.created_at DESC
        `, [userId]);
        return rows.map(row => ({
            ...row,
            start_time: row.start_datetime,
            end_time: row.end_datetime,
            start: row.start_datetime,
            end: row.end_datetime,
            title: row.title || row.name,
            name: row.title || row.name,
            room_id: row.room_id,
            booker_id: row.user_id,
            booker: row.user_id,
            room: row.room_id,
            status: row.status || 'pending'
        }));
    }
}

module.exports = Approver;
