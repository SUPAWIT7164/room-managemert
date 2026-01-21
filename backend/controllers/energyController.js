const { pool } = require('../config/database');

class EnergyController {
    /**
     * Get notification settings list
     * POST /api/energy/notification/list
     * Body: { module_id: 3 }
     */
    async getNotificationList(req, res) {
        try {
            const { module_id } = req.body;

            if (!module_id) {
                return res.status(400).json({
                    success: false,
                    message: 'module_id is required'
                });
            }

            // Query settings table
            const query = `
                SELECT name, slug, value, unit
                FROM settings
                WHERE module_id = ? AND disable = 0
                ORDER BY name ASC
            `;

            const [rows] = await pool.query(query, [module_id]);

            res.json(rows);
        } catch (error) {
            console.error('[EnergyController] Error getting notification list:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการตั้งค่า',
                error: error.message
            });
        }
    }

    /**
     * Update notification setting
     * POST /api/energy/notification/update
     * Body: { [slug]: value }
     */
    async notificationUpdate(req, res) {
        try {
            const data = req.body;

            if (!data || Object.keys(data).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid data provided'
                });
            }

            // Get the first key-value pair (slug and value)
            const slug = Object.keys(data)[0];
            const value = data[slug];

            if (!slug || value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Slug and value are required'
                });
            }

            // Find and update the setting
            const updateQuery = `
                UPDATE settings
                SET value = ?
                WHERE slug = ?
            `;

            const [result] = await pool.query(updateQuery, [value, slug]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Setting not found'
                });
            }

            res.json({
                success: true,
                message: 'บันทึกการตั้งค่าสำเร็จ'
            });
        } catch (error) {
            console.error('[EnergyController] Error updating notification:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการบันทึก',
                error: error.message
            });
        }
    }
}

module.exports = new EnergyController();




