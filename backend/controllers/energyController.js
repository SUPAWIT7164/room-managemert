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
                       power2, voltage2, [current2], power_factor2,
                       power3, voltage3, [current3], power_factor3,
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
                           power2, voltage2, [current2], power_factor2,
                           power3, voltage3, [current3], power_factor3,
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

    /**
     * GET /api/energy/devices
     * อุปกรณ์ที่มีข้อมูลใน energy_data
     */
    async getEnergyDevices(req, res) {
        try {
            const query = `
                SELECT DISTINCT
                    ed.device_id AS id,
                    COALESCE(d.name, CONCAT(N'Power Meter #', CAST(ed.device_id AS nvarchar(30)))) AS name
                FROM energy_data ed
                LEFT JOIN devices d ON d.id = ed.device_id
                WHERE ed.device_id IS NOT NULL
                ORDER BY name ASC
            `;
            const [rows] = await pool.query(query);
            res.json({
                success: true,
                data: rows || [],
            });
        } catch (error) {
            console.error('[EnergyController] Error getting energy devices:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงรายการมิเตอร์ไฟฟ้า',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/energy/report
     * Query: period=24h|7d|1m OR start=YYYY-MM-DD&end=YYYY-MM-DD
     * Optional: device_id
     * รวมช่วงเวลาเป็น bucket (ชั่วโมง / วัน / สัปดาห์) จาก dbo.energy_data
     */
    async getEnergyReport(req, res) {
        try {
            const { period, start, end, device_id } = req.query;

            const now = new Date();
            let startDate;
            let endDate;

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
                    default:
                        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        break;
                }
            }

            const hoursRange = (endDate - startDate) / (1000 * 60 * 60);
            let bucket;
            let groupExpr;
            if (hoursRange <= 72) {
                bucket = 'hour';
                groupExpr = 'DATEADD(HOUR, DATEDIFF(HOUR, 0, ed.recorded_at), 0)';
            } else if (hoursRange <= 90 * 24) {
                bucket = 'day';
                groupExpr = 'CAST(ed.recorded_at AS DATE)';
            } else {
                bucket = 'week';
                groupExpr = 'DATEADD(WEEK, DATEDIFF(WEEK, 0, ed.recorded_at), 0)';
            }

            let query = `
                SELECT
                    ${groupExpr} AS bucket_start,
                    AVG(CAST(ed.power AS float)) AS avg_power,
                    AVG(CAST(ed.power2 AS float)) AS avg_power2,
                    AVG(CAST(ed.power3 AS float)) AS avg_power3,
                    AVG(CAST(ed.[current] AS float)) AS avg_current,
                    AVG(CAST(ed.current2 AS float)) AS avg_current2,
                    AVG(CAST(ed.current3 AS float)) AS avg_current3,
                    AVG(CAST(ed.voltage AS float)) AS avg_voltage,
                    AVG(CAST(ed.voltage2 AS float)) AS avg_voltage2,
                    AVG(CAST(ed.voltage3 AS float)) AS avg_voltage3,
                    MAX(CAST(ed.energy AS float)) - MIN(CAST(ed.energy AS float)) AS energy_delta,
                    COUNT_BIG(*) AS sample_count
                FROM energy_data ed
                WHERE ed.recorded_at >= ?
                  AND ed.recorded_at <= ?
            `;
            const params = [startDate.toISOString(), endDate.toISOString()];

            if (device_id && device_id !== 'all') {
                query += ' AND ed.device_id = ?';
                params.push(parseInt(device_id, 10));
            }

            query += ` GROUP BY ${groupExpr} ORDER BY bucket_start ASC`;

            const [rows] = await pool.query(query, params);
            const records = rows || [];

            const totalEnergyDelta = records.reduce((sum, r) => sum + parseFloat(r.energy_delta || 0), 0);
            const avgPowerW = records.length
                ? records.reduce((sum, r) => sum + parseFloat(r.avg_power || 0), 0) / records.length
                : 0;
            const maxPowerW = records.length
                ? Math.max(...records.map(r => parseFloat(r.avg_power || 0)))
                : 0;

            res.json({
                success: true,
                data: {
                    records,
                    bucket,
                    summary: {
                        totalEnergyDelta: parseFloat(totalEnergyDelta.toFixed(2)),
                        avgPowerW: parseFloat(avgPowerW.toFixed(2)),
                        maxPowerW: parseFloat(maxPowerW.toFixed(2)),
                        bucketCount: records.length,
                    },
                    period: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                    },
                },
            });
        } catch (error) {
            console.error('[EnergyController] Error getting energy report:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงรายงานพลังงาน',
                error: error.message,
            });
        }
    }
}

module.exports = new EnergyController();




