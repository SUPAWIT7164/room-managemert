const { pool } = require('../config/database');

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
     * ดึงจำนวนคนที่นับได้ล่าสุดจาก image_processing_detections
     * วิธีคิด: หา id ล่าสุดที่ person_index=0 (จุดเริ่มต้น batch ใหม่) แล้วนับแถวตั้งแต่จุดนั้น = จำนวนคน
     */
    async getPeopleCounts(req, res) {
        try {
            const count = await this._getLatestPersonCount();
            console.log('[FloorPlan] latest person count:', count);
            if (count !== null) {
                return res.json({ success: true, data: { _all: { count } } });
            }
        } catch (err) {
            console.warn('[FloorPlan] _getLatestPersonCount failed:', err.message);
        }

        return res.json({ success: true, data: {} });
    }

    async _getLatestPersonCount() {
        // หา batch ล่าสุด: id ล่าสุดที่ person_index = 0 คือจุดเริ่มของรอบนับล่าสุด
        // จำนวนคน = จำนวนแถวที่ id >= จุดเริ่มนั้น
        const [rows] = await pool.query(`
            SELECT COUNT(*) as people_count
            FROM image_processing_detections
            WHERE id >= (
                SELECT MAX(id) FROM image_processing_detections WHERE person_index = 0
            )
        `);

        if (rows && rows.length > 0 && rows[0].people_count != null) {
            return Number(rows[0].people_count);
        }
        return null;
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
                const count = await this._getLatestPersonCount();
                results.latestCount = count;
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
