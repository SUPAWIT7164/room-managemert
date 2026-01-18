const Booking = require('../models/Booking');
const { pool } = require('../config/database');

class ReportController {
    // Service Usage Report
    async getServiceUsageReport(req, res) {
        try {
            const { start, end, user_id } = req.query;
            
            let query = `
                SELECT br.*, 
                       r.name as room_name,
                       u.name as booker_name, u.email as booker_email,
                       a.name as area_name,
                       b.name as building_name
                FROM booking_requests br
                LEFT JOIN rooms r ON br.room_id = r.id
                LEFT JOIN users u ON br.user_id = u.id
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                WHERE 1=1
            `;
            const params = [];

            if (start) {
                query += ' AND DATE(br.start_datetime) >= ?';
                params.push(start);
            }

            if (end) {
                query += ' AND DATE(br.start_datetime) <= ?';
                params.push(end);
            }

            if (user_id) {
                query += ' AND br.user_id = ?';
                params.push(user_id);
            }

            query += ' ORDER BY br.start_datetime DESC';

            const [rows] = await pool.query(query, params);

            const data = rows.map(row => ({
                ...row,
                start_time: row.start_datetime,
                end_time: row.end_datetime,
                title: row.title || row.name,
                name: row.title || row.name
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
            
            // Build base query
            let query = `
                SELECT 
                    r.id as room_id,
                    r.name as room_name,
                    b.name as building_name,
                    COUNT(br.id) as booking_count,
                    COALESCE(SUM(
                        TIMESTAMPDIFF(HOUR, br.start_datetime, br.end_datetime)
                    ), 0) as total_hours
                FROM rooms r
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                LEFT JOIN booking_requests br ON br.room_id = r.id 
                    AND br.status = 'approved'
            `;
            const params = [];

            // Add date filters to JOIN condition
            if (start) {
                query += ' AND DATE(br.start_datetime) >= ?';
                params.push(start);
            }
            if (end) {
                query += ' AND DATE(br.start_datetime) <= ?';
                params.push(end);
            }

            query += ' WHERE 1=1';

            if (room_id) {
                query += ' AND r.id = ?';
                params.push(room_id);
            }

            query += ' GROUP BY r.id, r.name, b.name ORDER BY booking_count DESC';

            const [rows] = await pool.query(query, params);

            // Calculate total bookings for usage rate
            const totalBookings = rows.reduce((sum, row) => sum + row.booking_count, 0);
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
                    br.title,
                    br.description,
                    br.start_datetime,
                    br.end_datetime,
                    br.status,
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
                LEFT JOIN rooms r ON br.room_id = r.id
                LEFT JOIN users u ON br.user_id = u.id
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                LEFT JOIN users approver ON br.approved_by = approver.id
                WHERE DATE(br.start_datetime) >= ? AND DATE(br.end_datetime) <= ?
            `;
            const params = [start_date, end_date];

            if (room_id) {
                query += ' AND br.room_id = ?';
                params.push(room_id);
            }

            if (status) {
                query += ' AND br.status = ?';
                params.push(status);
            }

            if (building_id) {
                query += ' AND b.id = ?';
                params.push(building_id);
            }

            query += ' ORDER BY br.start_datetime DESC';

            const [rows] = await pool.query(query, params);

            // Calculate statistics
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

            // Note: This assumes you have an access_logs or similar table
            // If not, you might need to create it or use booking data as access data
            let query = `
                SELECT 
                    DATE(br.start_datetime) as access_date,
                    COUNT(DISTINCT br.user_id) as unique_users,
                    COUNT(br.id) as total_access,
                    b.id as building_id,
                    b.name as building_name
                FROM booking_requests br
                LEFT JOIN rooms r ON br.room_id = r.id
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                WHERE br.status = 'approved'
                    AND DATE(br.start_datetime) >= ?
                    AND DATE(br.start_datetime) <= ?
            `;
            const params = [start_date, end_date];

            if (building_ids && Array.isArray(building_ids) && building_ids.length > 0) {
                query += ' AND b.id IN (' + building_ids.map(() => '?').join(',') + ')';
                params.push(...building_ids);
            }

            query += ' GROUP BY DATE(br.start_datetime), b.id, b.name ORDER BY access_date DESC';

            const [rows] = await pool.query(query, params);

            res.json({
                success: true,
                data: rows
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

            let dateFormat;
            switch (report_type) {
                case 'daily':
                    dateFormat = '%Y-%m-%d';
                    break;
                case 'weekly':
                    dateFormat = '%Y-%u'; // Year-Week
                    break;
                case 'monthly':
                    dateFormat = '%Y-%m';
                    break;
                default:
                    dateFormat = '%Y-%m-%d';
            }

            let query = `
                SELECT 
                    DATE_FORMAT(br.start_datetime, ?) as period,
                    r.id as room_id,
                    r.name as room_name,
                    COUNT(br.id) as booking_count,
                    COALESCE(SUM(
                        TIMESTAMPDIFF(HOUR, br.start_datetime, br.end_datetime)
                    ), 0) as total_hours,
                    COUNT(DISTINCT br.user_id) as unique_users
                FROM booking_requests br
                LEFT JOIN rooms r ON br.room_id = r.id
                WHERE br.status = 'approved'
                    AND DATE(br.start_datetime) >= ?
                    AND DATE(br.end_datetime) <= ?
                GROUP BY period, r.id, r.name
                ORDER BY period DESC, booking_count DESC
            `;
            const params = [dateFormat, start_date, end_date];

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

