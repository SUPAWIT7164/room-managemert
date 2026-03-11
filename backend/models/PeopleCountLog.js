const { pool } = require('../config/database');

class PeopleCountLog {
    static async create(data) {
        const { camera_id, zone_name, count, snapshot_path } = data;
        const result = await pool.execute(
            `INSERT INTO people_count_logs (camera_id, zone_name, count, snapshot_path, recorded_at, created_at)
             VALUES (?, ?, ?, ?, GETDATE(), GETDATE())`,
            [
                camera_id,
                zone_name || null,
                count != null ? count : 0,
                snapshot_path || null
            ]
        );
        return result.insertId;
    }

    static async findAll(options = {}) {
        const { camera_id, start_date, end_date, limit = 100 } = options;
        let query = `
            SELECT pcl.id, pcl.camera_id, pcl.zone_name, pcl.count, pcl.snapshot_path,
                   FORMAT(pcl.recorded_at, 'yyyy-MM-dd HH:mm:ss') as recorded_at,
                   FORMAT(pcl.created_at, 'yyyy-MM-dd HH:mm:ss') as created_at,
                   c.name as camera_name
            FROM people_count_logs pcl
            LEFT JOIN cctv_cameras c ON pcl.camera_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (camera_id != null && camera_id !== '') {
            query += ' AND pcl.camera_id = ?';
            params.push(camera_id);
        }
        if (start_date) {
            query += ' AND CAST(pcl.recorded_at AS DATE) >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND CAST(pcl.recorded_at AS DATE) <= ?';
            params.push(end_date);
        }

        query += ' ORDER BY pcl.recorded_at DESC';
        if (limit) {
            query += ` OFFSET 0 ROWS FETCH NEXT ${Math.min(parseInt(limit) || 100, 500)} ROWS ONLY`;
        }

        const [rows] = await pool.query(query, params);
        return rows || [];
    }
}

module.exports = PeopleCountLog;
