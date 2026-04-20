const { pool } = require('../config/database');
const peopleCountSync = require('../services/peopleCountSyncService');

class FloorPlanController {
    async getConfig(req, res) {
        try {
            const [rows] = await pool.query(
                "SELECT areas FROM cctv_area_config WHERE config_key = N'floor_plan'"
            );
            if (rows && rows.length > 0 && rows[0].areas) {
                const data = JSON.parse(rows[0].areas);
                return res.json({ success: true, data: data || {} });
            }
            return res.json({ success: true, data: { floorPlanImage: '', areas: [] } });
        } catch (error) {
            if (error.message && /Invalid object name|does not exist/i.test(error.message)) {
                return res.json({ success: true, data: { floorPlanImage: '', areas: [] } });
            }
            console.error('[FloorPlan] getConfig error:', error.message);
            return res.status(500).json({ success: false, message: 'โหลดข้อมูล Floor Plan ไม่สำเร็จ', error: error.message });
        }
    }

    async saveConfig(req, res) {
        try {
            const config = req.body;
            if (!config || typeof config !== 'object') {
                return res.status(400).json({ success: false, message: 'config must be an object' });
            }
            const json = JSON.stringify(config);
            const result = await pool.execute(
                "UPDATE cctv_area_config SET areas = ?, updated_at = GETDATE() WHERE config_key = N'floor_plan'",
                [json]
            );
            const affectedRows = result && result.affectedRows != null ? result.affectedRows : 0;
            if (affectedRows === 0) {
                await pool.execute(
                    "INSERT INTO cctv_area_config (config_key, areas, updated_at) VALUES (N'floor_plan', ?, GETDATE())",
                    [json]
                );
            }
            return res.json({ success: true, message: 'บันทึก Floor Plan เรียบร้อยแล้ว' });
        } catch (error) {
            console.error('[FloorPlan] saveConfig error:', error.message);
            return res.status(500).json({ success: false, message: 'บันทึก Floor Plan ไม่สำเร็จ', error: error.message });
        }
    }

    /**
     * GET /api/floor-plan/people-counts
     * ดึงจำนวนคนล่าสุดจาก people_count table (synced from image_processing_logs)
     * device_id มาจาก devices table, people_count/faces_count/confidence มาจาก image_processing_logs
     *
     * Query (optional):
     *   - roomId: ดึง people_count ผ่าน devices.room_id
     *   - areaId: ดึง people_count ผ่าน devices.area_id (ยังไม่ใช้ แต่รองรับ)
     *   - sync: ถ้า =1 จะ sync จาก image_processing_logs ก่อนดึงข้อมูล
     */
    async getPeopleCounts(req, res) {
        try {
            // Auto-sync new records from image_processing_logs → people_count
            if (req.query.sync === '1') {
                await peopleCountSync.syncFromImageProcessingLogs();
            }

            const roomIdRaw = req.query.roomId;
            const areaIdRaw = req.query.areaId;
            const roomId = roomIdRaw != null && roomIdRaw !== '' ? parseInt(roomIdRaw, 10) : NaN;
            const areaId = areaIdRaw != null && areaIdRaw !== '' ? parseInt(areaIdRaw, 10) : NaN;

            let result = null;

            if (Number.isFinite(roomId)) {
                result = await peopleCountSync.getLatestByRoomId(roomId);
            }

            if (!result) {
                result = await peopleCountSync.getLatestGlobal();
            }

            if (result && result.people_count != null) {
                console.log('[FloorPlan] people_count:', result.people_count,
                    'faces:', result.faces_count,
                    'confidence:', result.confidence,
                    Number.isFinite(roomId) ? `(room ${roomId})` : '(global)');
                return res.json({
                    success: true,
                    data: {
                        _all: {
                            count: result.people_count,
                            faces_count: result.faces_count,
                            confidence: result.confidence,
                            recorded_at: result.recorded_at || null,
                            device_id: result.device_id || null,
                        },
                    },
                });
            }
        } catch (err) {
            console.warn('[FloorPlan] getPeopleCounts failed:', err.message);
        }

        return res.json({ success: true, data: {} });
    }

    /**
     * POST /api/floor-plan/people-counts/sync
     * Manually trigger sync from image_processing_logs → people_count
     */
    async syncPeopleCounts(req, res) {
        try {
            const result = await peopleCountSync.syncFromImageProcessingLogs();
            return res.json({ success: true, data: result });
        } catch (err) {
            console.error('[FloorPlan] syncPeopleCounts error:', err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /api/floor-plan/debug-detections
     */
    async debugDetections(req, res) {
        const results = { tableExists: false, columns: [], sampleRows: [], totalRows: 0, latestCount: null };
        try {
            const [cols] = await pool.query(`
                SELECT COLUMN_NAME, DATA_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'image_processing_detections'
                ORDER BY ORDINAL_POSITION
            `);
            if (cols && cols.length > 0) {
                results.tableExists = true;
                results.columns = cols.map(c => ({ name: c.COLUMN_NAME, type: c.DATA_TYPE }));
            } else {
                return res.json({ success: true, data: results, message: 'ไม่พบตาราง image_processing_detections' });
            }

            const [countRows] = await pool.query('SELECT COUNT(*) as total FROM image_processing_detections');
            results.totalRows = countRows?.[0]?.total || 0;

            const [sample] = await pool.query(`
                SELECT * FROM image_processing_detections
                ORDER BY id DESC
                OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
            `);
            results.sampleRows = sample || [];

            try {
                const latest = await peopleCountSync.getLatestGlobal();
                results.latestCount = latest ? latest.people_count : null;
            } catch (e) {
                results.latestCount = 'error: ' + e.message;
            }

            return res.json({ success: true, data: results });
        } catch (err) {
            return res.json({ success: false, message: err.message, data: results });
        }
    }
}

module.exports = new FloorPlanController();
