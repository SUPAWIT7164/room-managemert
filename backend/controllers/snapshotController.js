/**
 * Snapshot Controller
 * API endpoints สำหรับ IP Camera Snapshot & Image Processing
 * 
 * Endpoints:
 *   POST /api/snapshot        — ดึงภาพนิ่งจากกล้อง (ถ่ายทันที)
 *   POST /api/snapshot/start-loop   — เริ่ม loop อัตโนมัติ
 *   POST /api/snapshot/stop-loop    — หยุด loop อัตโนมัติ
 *   GET  /api/snapshot/status       — ดูสถานะ loop
 *   GET  /api/snapshot/logs         — ดูประวัติ capture
 *   GET  /api/snapshot/latest       — ดูภาพล่าสุด
 */

const loopService = require('../services/snapshotLoopService');
const { getLatestSnapshot } = require('../services/cameraSnapshotService');
const peopleCountingService = require('../services/peopleCountingService');

class SnapshotController {

    /**
     * POST /api/snapshot
     * ดึงภาพนิ่งจากกล้อง + image processing ทันที
     */
    async captureSnapshot(req, res) {
        try {
            console.log('[Snapshot] POST /api/snapshot — capture now');
            const result = await loopService.captureNow();

            if (!result) {
                return res.status(429).json({
                    success: false,
                    message: 'กำลังประมวลผลอยู่ — กรุณารอสักครู่แล้วลองใหม่',
                });
            }

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'ไม่สามารถดึงภาพจากกล้องได้',
                    error: result.error,
                    timestamp: result.timestamp,
                });
            }

            return res.json({
                success: true,
                message: 'ดึงภาพสำเร็จ',
                data: {
                    snapshot: result.snapshot,
                    processed: result.processed,
                    timestamp: result.timestamp,
                    duration: result.duration,
                },
            });
        } catch (error) {
            console.error('[Snapshot] captureSnapshot error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงภาพ',
                error: error.message,
            });
        }
    }

    /**
     * POST /api/snapshot/start-loop
     * เริ่ม loop อัตโนมัติ
     * Body: { interval: 1-5 } (หน่วยเป็นนาที)
     */
    startLoop(req, res) {
        try {
            const { interval } = req.body || {};
            console.log(`[Snapshot] POST /api/snapshot/start-loop — interval: ${interval}`);

            if (!interval || interval < 1 || interval > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ interval ระหว่าง 1–5 นาที',
                });
            }

            const result = loopService.startLoop(parseInt(interval));
            return res.json(result);
        } catch (error) {
            console.error('[Snapshot] startLoop error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเริ่ม loop',
                error: error.message,
            });
        }
    }

    /**
     * POST /api/snapshot/stop-loop
     * หยุด loop อัตโนมัติ
     */
    stopLoop(req, res) {
        try {
            console.log('[Snapshot] POST /api/snapshot/stop-loop');
            const result = loopService.stopLoop();
            return res.json(result);
        } catch (error) {
            console.error('[Snapshot] stopLoop error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการหยุด loop',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/snapshot/status
     * แสดงสถานะ loop
     */
    getStatus(req, res) {
        try {
            const status = loopService.getStatus();
            return res.json({
                success: true,
                data: status,
            });
        } catch (error) {
            console.error('[Snapshot] getStatus error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงสถานะ',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/snapshot/logs
     * แสดง log ประวัติการ capture
     * Query: ?limit=50
     */
    getLogs(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const logs = loopService.getLogs(limit);
            return res.json({
                success: true,
                data: logs,
                total: logs.length,
            });
        } catch (error) {
            console.error('[Snapshot] getLogs error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึง logs',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/snapshot/latest
     * ดูภาพล่าสุด
     */
    async getLatest(req, res) {
        try {
            const latest = await getLatestSnapshot();
            if (!latest) {
                return res.json({
                    success: true,
                    data: null,
                    message: 'ยังไม่มีภาพ — กรุณาถ่ายภาพก่อน',
                });
            }
            return res.json({
                success: true,
                data: latest,
            });
        } catch (error) {
            console.error('[Snapshot] getLatest error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงภาพล่าสุด',
                error: error.message,
            });
        }
    }
    // ==================== People Counting ====================

    /**
     * POST /api/snapshot/count-now
     * นับคนในภาพทันที 1 ครั้ง
     */
    async countNow(req, res) {
        try {
            console.log('[Snapshot] POST /api/snapshot/count-now');
            const result = await peopleCountingService.countNow();

            if (!result) {
                return res.status(429).json({
                    success: false,
                    message: 'กำลังประมวลผลอยู่ — กรุณารอสักครู่',
                });
            }

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'ไม่สามารถนับคนได้',
                    error: result.error,
                });
            }

            return res.json({
                success: true,
                message: `นับคนสำเร็จ: ${result.count} คน`,
                data: result,
            });
        } catch (error) {
            console.error('[Snapshot] countNow error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการนับคน',
                error: error.message,
            });
        }
    }

    /**
     * POST /api/snapshot/start-counting
     * เริ่ม loop นับคนอัตโนมัติ
     * Body: { intervalSeconds: 10-300 } (ค่าเริ่มต้น 30)
     */
    startCounting(req, res) {
        try {
            const { intervalSeconds } = req.body || {};
            console.log(`[Snapshot] POST /api/snapshot/start-counting — interval: ${intervalSeconds}s`);

            const sec = parseInt(intervalSeconds) || 30;
            if (sec < 10 || sec > 300) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ interval ระหว่าง 10–300 วินาที',
                });
            }

            const result = peopleCountingService.startLoop(sec);
            return res.json(result);
        } catch (error) {
            console.error('[Snapshot] startCounting error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเริ่มนับคน',
                error: error.message,
            });
        }
    }

    /**
     * POST /api/snapshot/stop-counting
     * หยุด loop นับคนอัตโนมัติ
     */
    stopCounting(req, res) {
        try {
            console.log('[Snapshot] POST /api/snapshot/stop-counting');
            const result = peopleCountingService.stopLoop();
            return res.json(result);
        } catch (error) {
            console.error('[Snapshot] stopCounting error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการหยุดนับคน',
                error: error.message,
            });
        }
    }

    /**
     * PUT /api/snapshot/counting-interval
     * เปลี่ยน interval ของ loop นับคน
     * Body: { intervalSeconds: 10-300 }
     */
    updateCountingInterval(req, res) {
        try {
            const { intervalSeconds } = req.body || {};
            console.log(`[Snapshot] PUT /api/snapshot/counting-interval — ${intervalSeconds}s`);

            const sec = parseInt(intervalSeconds) || 30;
            if (sec < 10 || sec > 300) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ interval ระหว่าง 10–300 วินาที',
                });
            }

            const result = peopleCountingService.setIntervalSeconds(sec);
            return res.json(result);
        } catch (error) {
            console.error('[Snapshot] updateCountingInterval error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัปเดต interval',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/snapshot/counting-status
     * ดูสถานะ loop นับคน
     */
    getCountingStatus(req, res) {
        try {
            const status = peopleCountingService.getStatus();
            return res.json({
                success: true,
                data: status,
            });
        } catch (error) {
            console.error('[Snapshot] getCountingStatus error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message,
            });
        }
    }

    /**
     * POST /api/snapshot/counting-roi
     * ตั้งค่า ROI (Region of Interest) สำหรับนับคน
     * Body: { roi: [{x: 0.1, y: 0.2}, ...] } หรือ { roi: null } เพื่อล้าง
     */
    async setCountingROI(req, res) {
        try {
            const { roi } = req.body;
            console.log(`[Snapshot] POST /api/snapshot/counting-roi — ${roi ? roi.length + ' points' : 'clear'}`);

            const result = await peopleCountingService.setROI(roi);
            return res.json(result);
        } catch (error) {
            console.error('[Snapshot] setCountingROI error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการตั้งค่า ROI',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/snapshot/counting-roi
     * ดึง ROI ปัจจุบัน
     */
    getCountingROI(req, res) {
        try {
            const roi = peopleCountingService.getROI();
            return res.json({
                success: true,
                data: { roi },
            });
        } catch (error) {
            console.error('[Snapshot] getCountingROI error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึง ROI',
                error: error.message,
            });
        }
    }

    /**
     * GET /api/snapshot/counting-history
     * ดูประวัติการนับคน (in-memory + DB)
     * Query: ?source=memory|db&limit=50&start_date=&end_date=
     */
    async getCountingHistory(req, res) {
        try {
            const { source = 'memory', limit = 50, start_date, end_date } = req.query;

            if (source === 'db') {
                const dbHistory = await peopleCountingService.getDbHistory({
                    start_date,
                    end_date,
                    limit: parseInt(limit) || 50,
                });
                return res.json({
                    success: true,
                    source: 'db',
                    data: dbHistory,
                    total: dbHistory.length,
                });
            }

            // In-memory history
            const history = peopleCountingService.getHistory(parseInt(limit) || 50);
            return res.json({
                success: true,
                source: 'memory',
                data: history,
                total: history.length,
            });
        } catch (error) {
            console.error('[Snapshot] getCountingHistory error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงประวัติ',
                error: error.message,
            });
        }
    }
}

module.exports = new SnapshotController();

