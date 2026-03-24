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
    /**
     * Get energy usage data for a room
     * GET /api/energy/room/:roomId
     * Query: period=1d|7d|1m  OR  start=YYYY-MM-DD&end=YYYY-MM-DD
     */
    async getRoomEnergy(req, res) {
        try {
            const roomId = parseInt(req.params.roomId);
            if (!roomId) {
                return res.status(400).json({ success: false, message: 'roomId is required' });
            }

            const { period, start, end } = req.query;
            let startDate, endDate;
            const now = new Date();

            if (start && end) {
                startDate = new Date(start);
                endDate = new Date(end);
                endDate.setHours(23, 59, 59, 999);
            } else {
                endDate = now;
                switch (period) {
                    case '7d':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case '1m':
                        startDate = new Date(now);
                        startDate.setMonth(startDate.getMonth() - 1);
                        break;
                    default: // 1d
                        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        break;
                }
            }

            const query = `
                SELECT id, device_id, room_id, power, energy, voltage, [current],
                       energy2, voltage2, [current2],
                       energy3, voltage3, [current3],
                       power_factor, recorded_at
                FROM energy_data
                WHERE room_id = ?
                  AND recorded_at >= ?
                  AND recorded_at <= ?
                ORDER BY recorded_at ASC
            `;

            let [rows] = await pool.query(query, [
                roomId,
                startDate.toISOString(),
                endDate.toISOString(),
            ]);

            let records = rows || [];
            let usedFallback = false;

            if (records.length === 0) {
                const fallbackQuery = `
                    SELECT TOP 100 id, device_id, room_id, power, energy, voltage, [current],
                           energy2, voltage2, [current2],
                           energy3, voltage3, [current3],
                           power_factor, recorded_at
                    FROM energy_data
                    WHERE room_id = ?
                    ORDER BY recorded_at DESC
                `;
                const [fallbackRows] = await pool.query(fallbackQuery, [roomId]);
                records = (fallbackRows || []).reverse();
                usedFallback = records.length > 0;
            }

            const totalEnergy = records.reduce((sum, r) => sum + parseFloat(r.energy || 0), 0);
            const avgPower = records.length > 0
                ? records.reduce((sum, r) => sum + parseFloat(r.power || 0), 0) / records.length
                : 0;
            const maxPower = records.length > 0
                ? Math.max(...records.map(r => parseFloat(r.power || 0)))
                : 0;

            const periodStart = records.length > 0 && usedFallback
                ? records[0].recorded_at
                : startDate;
            const periodEnd = records.length > 0 && usedFallback
                ? records[records.length - 1].recorded_at
                : endDate;

            res.json({
                success: true,
                data: {
                    records,
                    summary: {
                        totalEnergy: parseFloat(totalEnergy.toFixed(2)),
                        avgPower: parseFloat(avgPower.toFixed(2)),
                        maxPower: parseFloat(maxPower.toFixed(2)),
                        recordCount: records.length,
                    },
                    period: {
                        start: (periodStart && new Date(periodStart).toISOString) ? new Date(periodStart).toISOString() : startDate.toISOString(),
                        end: (periodEnd && new Date(periodEnd).toISOString) ? new Date(periodEnd).toISOString() : endDate.toISOString(),
                    },
                    usedFallback,
                },
            });
        } catch (error) {
            console.error('[EnergyController] Error getting room energy:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพลังงาน',
                error: error.message,
            });
        }
    }
}

module.exports = new EnergyController();




