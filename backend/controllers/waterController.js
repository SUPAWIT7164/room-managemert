const { pool } = require('../config/database');

class WaterController {
    /**
     * GET /api/water/devices
     */
    async getWaterDevices(req, res) {
        try {
            const query = `
                SELECT DISTINCT
                    wm.device_id AS id,
                    COALESCE(d.name, CONCAT('Water Meter #', CAST(wm.device_id AS nvarchar(30)))) AS name
                FROM watermeter_data wm
                LEFT JOIN devices d ON d.id = wm.device_id
                WHERE wm.device_id IS NOT NULL
                ORDER BY name ASC
            `;

            const [rows] = await pool.query(query);

            res.json({
                success: true,
                data: rows || [],
            });
        } catch (error) {
            console.error('[WaterController] Error getting water devices:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงรายการอุปกรณ์วัดน้ำ',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/water/report
     * Query: period=24h|7d|1m OR start=YYYY-MM-DD&end=YYYY-MM-DD
     * Optional: device_id, room_id, building_id, area_id
     */
    async getWaterReport(req, res) {
        try {
            const {
                period,
                start,
                end,
                device_id,
                room_id,
                building_id,
                area_id,
            } = req.query;

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

            let query = `
                SELECT
                    id,
                    device_id,
                    device_type_id,
                    flowrate,
                    totalizer,
                    waterpump,
                    building_id,
                    room_id,
                    area_id,
                    recorded_at
                FROM watermeter_data
                WHERE recorded_at >= ?
                  AND recorded_at <= ?
            `;
            const params = [startDate.toISOString(), endDate.toISOString()];

            if (device_id && device_id !== 'all') {
                query += ' AND device_id = ?';
                params.push(parseInt(device_id, 10));
            }
            if (room_id) {
                query += ' AND room_id = ?';
                params.push(parseInt(room_id, 10));
            }
            if (building_id) {
                query += ' AND building_id = ?';
                params.push(parseInt(building_id, 10));
            }
            if (area_id) {
                query += ' AND area_id = ?';
                params.push(parseInt(area_id, 10));
            }

            query += ' ORDER BY recorded_at ASC';

            const [rows] = await pool.query(query, params);
            const records = rows || [];

            const totalFlow = records.reduce((sum, r) => sum + parseFloat(r.flowrate || 0), 0);
            const avgFlow = records.length ? totalFlow / records.length : 0;
            const maxFlow = records.length
                ? Math.max(...records.map(r => parseFloat(r.flowrate || 0)))
                : 0;

            const firstTotalizer = records.length ? parseFloat(records[0].totalizer || 0) : 0;
            const lastTotalizer = records.length
                ? parseFloat(records[records.length - 1].totalizer || 0)
                : 0;
            const totalUsage = Math.max(0, lastTotalizer - firstTotalizer);

            const pumpOnCount = records.filter(r => Number(r.waterpump) === 1).length;
            const pumpOnRate = records.length ? (pumpOnCount / records.length) * 100 : 0;

            res.json({
                success: true,
                data: {
                    records,
                    summary: {
                        totalUsage: parseFloat(totalUsage.toFixed(2)),
                        avgFlow: parseFloat(avgFlow.toFixed(2)),
                        maxFlow: parseFloat(maxFlow.toFixed(2)),
                        pumpOnRate: parseFloat(pumpOnRate.toFixed(2)),
                        recordCount: records.length,
                    },
                    period: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                    },
                },
            });
        } catch (error) {
            console.error('[WaterController] Error getting water report:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายงานการใช้น้ำ',
                error: error.message,
            });
        }
    }
}

module.exports = new WaterController();
