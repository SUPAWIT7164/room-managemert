const Booking = require('../models/Booking');
const { pool } = require('../config/database');

class ReportController {
    // Service Usage Report
    async getServiceUsageReport(req, res) {
        try {
            const { start, end, user_id } = req.query;
            
            let query = `
                SELECT br.id, br.name,
                       FORMAT(br.[start], 'yyyy-MM-dd HH:mm:ss') as start_datetime,
                       FORMAT(br.[end], 'yyyy-MM-dd HH:mm:ss') as end_datetime,
                       br.hour, br.objective, br.attendees,
                       CASE 
                           WHEN br.[cancel] = 1 THEN 'cancelled'
                           WHEN br.[reject] = 1 THEN 'rejected'
                           WHEN CAST(br.status AS NVARCHAR(50)) IN ('1', 'approved') THEN 'approved'
                           ELSE 'pending'
                       END as status,
                       br.created_at, br.updated_at,
                       r.name as room_name,
                       u.name as booker_name, u.email as booker_email,
                       a.name as area_name,
                       b.name as building_name
                FROM booking_requests br
                LEFT JOIN rooms r ON br.[room] = r.id
                LEFT JOIN users u ON br.booker = u.id
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                WHERE 1=1
            `;
            const params = [];

            if (start) {
                query += ' AND CAST(br.[start] AS DATE) >= ?';
                params.push(start);
            }

            if (end) {
                query += ' AND CAST(br.[start] AS DATE) <= ?';
                params.push(end);
            }

            if (user_id) {
                query += ' AND br.booker = ?';
                params.push(user_id);
            }

            query += ' ORDER BY br.[start] DESC';

            const [rows] = await pool.query(query, params);

            const data = rows.map(row => ({
                ...row,
                start_time: row.start_datetime,
                end_time: row.end_datetime,
                title: row.name,
            }));

            res.json({
                success: true,
                data: data
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Room Usage Report
    async getRoomUsageReport(req, res) {
        try {
            const { start, end, room_id } = req.query;
            
            let query = `
                SELECT 
                    r.id as room_id,
                    r.name as room_name,
                    b.name as building_name,
                    COUNT(br.id) as booking_count,
                    COALESCE(SUM(br.hour), 0) as total_hours
                FROM rooms r
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                LEFT JOIN booking_requests br ON br.[room] = r.id 
                    AND CAST(br.status AS NVARCHAR(50)) IN ('1', 'approved')
                    AND (br.[cancel] IS NULL OR br.[cancel] = 0)
                    AND (br.[reject] IS NULL OR br.[reject] = 0)
            `;
            const params = [];

            if (start) {
                query += ' AND CAST(br.[start] AS DATE) >= ?';
                params.push(start);
            }
            if (end) {
                query += ' AND CAST(br.[start] AS DATE) <= ?';
                params.push(end);
            }

            query += ' WHERE 1=1';

            if (room_id) {
                query += ' AND r.id = ?';
                params.push(room_id);
            }

            query += ' GROUP BY r.id, r.name, b.name ORDER BY booking_count DESC';

            const [rows] = await pool.query(query, params);

            const maxBookings = Math.max(...rows.map(r => r.booking_count), 1);

            const data = rows.map(row => ({
                ...row,
                usage_rate: maxBookings > 0 ? (row.booking_count / maxBookings * 100) : 0
            }));

            res.json({
                success: true,
                data: data
            });
        } catch (error) {
            console.error('Room usage report error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Booking Report (แบบละเอียด)
    async getBookingReport(req, res) {
        try {
            const { start_date, end_date, room_id, status, building_id } = req.body || req.query;
            
            if (!start_date || !end_date) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด'
                });
            }

            let query = `
                SELECT 
                    br.id,
                    br.name as title,
                    br.objective as description,
                    FORMAT(br.[start], 'yyyy-MM-dd HH:mm:ss') as start_datetime,
                    FORMAT(br.[end], 'yyyy-MM-dd HH:mm:ss') as end_datetime,
                    CASE 
                        WHEN br.[cancel] = 1 THEN 'cancelled'
                        WHEN br.[reject] = 1 THEN 'rejected'
                        WHEN CAST(br.status AS NVARCHAR(50)) IN ('1', 'approved') THEN 'approved'
                        ELSE 'pending'
                    END as status,
                    br.created_at,
                    br.updated_at,
                    r.id as room_id,
                    r.name as room_name,
                    u.id as user_id,
                    u.name as booker_name,
                    u.email as booker_email,
                    a.name as area_name,
                    b.id as building_id,
                    b.name as building_name,
                    approver.name as approved_by_name
                FROM booking_requests br
                LEFT JOIN rooms r ON br.[room] = r.id
                LEFT JOIN users u ON br.booker = u.id
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                LEFT JOIN users approver ON br.approve_by = approver.id
                WHERE CAST(br.[start] AS DATE) >= ? AND CAST(br.[end] AS DATE) <= ?
            `;
            const params = [start_date, end_date];

            if (room_id) {
                query += ' AND br.[room] = ?';
                params.push(room_id);
            }

            if (status) {
                if (status === 'approved') {
                    query += ' AND CAST(br.status AS NVARCHAR(50)) IN (\'1\', \'approved\') AND (br.[cancel] IS NULL OR br.[cancel] = 0) AND (br.[reject] IS NULL OR br.[reject] = 0)';
                } else if (status === 'cancelled') {
                    query += ' AND br.[cancel] = 1';
                } else if (status === 'rejected') {
                    query += ' AND br.[reject] = 1';
                } else if (status === 'pending') {
                    query += ' AND (br.status IS NULL OR CAST(br.status AS NVARCHAR(50)) NOT IN (\'1\', \'approved\')) AND (br.[cancel] IS NULL OR br.[cancel] = 0) AND (br.[reject] IS NULL OR br.[reject] = 0)';
                }
            }

            if (building_id) {
                query += ' AND b.id = ?';
                params.push(building_id);
            }

            query += ' ORDER BY br.[start] DESC';

            const [rows] = await pool.query(query, params);

            const stats = {
                total: rows.length,
                approved: rows.filter(r => r.status === 'approved').length,
                pending: rows.filter(r => r.status === 'pending').length,
                rejected: rows.filter(r => r.status === 'rejected').length,
                cancelled: rows.filter(r => r.status === 'cancelled').length
            };

            res.json({
                success: true,
                data: rows,
                statistics: stats
            });
        } catch (error) {
            console.error('Booking report error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Access Report (รายงานการเข้าถึง)
    async getAccessReport(req, res) {
        try {
            const { start_date, end_date, building_ids } = req.body || req.query;
            
            if (!start_date || !end_date) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด'
                });
            }

            // Use booking_requests: columns [start], [room], status (BIT). Approved = status=1, not cancelled/rejected.
            let query = `
                SELECT 
                    CAST(br.[start] AS DATE) as access_date,
                    COUNT(DISTINCT br.booker) as unique_users,
                    COUNT(br.id) as total_access,
                    b.id as building_id,
                    b.name as building_name
                FROM booking_requests br
                LEFT JOIN rooms r ON br.[room] = r.id
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                WHERE CAST(br.status AS NVARCHAR(50)) IN ('1', 'approved')
                    AND (br.[cancel] IS NULL OR br.[cancel] = 0)
                    AND (br.[reject] IS NULL OR br.[reject] = 0)
                    AND CAST(br.[start] AS DATE) >= ?
                    AND CAST(br.[start] AS DATE) <= ?
            `;
            const params = [start_date, end_date];

            if (building_ids && Array.isArray(building_ids) && building_ids.length > 0) {
                query += ' AND b.id IN (' + building_ids.map(() => '?').join(',') + ')';
                params.push(...building_ids);
            }

            query += ' GROUP BY CAST(br.[start] AS DATE), b.id, b.name ORDER BY CAST(br.[start] AS DATE) DESC';

            const [rows] = await pool.query(query, params);
            const data = Array.isArray(rows) ? rows : (rows ? [rows] : []);

            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Access report error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Room Usage Summary (สรุปการใช้งานห้อง)
    async getRoomUsageSummary(req, res) {
        try {
            const { start_date, end_date, report_type = 'daily' } = req.body || req.query;
            
            if (!start_date || !end_date) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด'
                });
            }

            let dateExpr;
            switch (report_type) {
                case 'weekly':
                    dateExpr = "FORMAT(br.[start], 'yyyy') + '-W' + RIGHT('0' + CAST(DATEPART(WEEK, br.[start]) AS VARCHAR), 2)";
                    break;
                case 'monthly':
                    dateExpr = "FORMAT(br.[start], 'yyyy-MM')";
                    break;
                default:
                    dateExpr = "FORMAT(br.[start], 'yyyy-MM-dd')";
            }

            let query = `
                SELECT 
                    ${dateExpr} as period,
                    r.id as room_id,
                    r.name as room_name,
                    COUNT(br.id) as booking_count,
                    COALESCE(SUM(br.hour), 0) as total_hours,
                    COUNT(DISTINCT br.booker) as unique_users
                FROM booking_requests br
                LEFT JOIN rooms r ON br.[room] = r.id
                WHERE CAST(br.status AS NVARCHAR(50)) IN ('1', 'approved')
                    AND (br.[cancel] IS NULL OR br.[cancel] = 0)
                    AND (br.[reject] IS NULL OR br.[reject] = 0)
                    AND CAST(br.[start] AS DATE) >= ?
                    AND CAST(br.[end] AS DATE) <= ?
                GROUP BY ${dateExpr}, r.id, r.name
                ORDER BY ${dateExpr} DESC, booking_count DESC
            `;
            const params = [start_date, end_date];

            const [rows] = await pool.query(query, params);

            res.json({
                success: true,
                data: rows,
                report_type: report_type
            });
        } catch (error) {
            console.error('Room usage summary error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }
}

module.exports = new ReportController();

