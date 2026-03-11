/**
 * Snapshot Routes
 * เชื่อม API endpoints สำหรับ IP Camera Snapshot & Image Processing
 * 
 * POST endpoints ใช้ authenticate (ต้อง login)
 * GET  endpoints ไม่ต้อง authenticate (ไม่พึ่ง DB — ระบบนี้ใช้ file system เท่านั้น)
 */

const express = require('express');
const router = express.Router();
const snapshotController = require('../controllers/snapshotController');
const { authenticate } = require('../middleware/auth');

// ---- POST endpoints (ต้อง login) ----

// POST /api/snapshot — ถ่ายภาพทันที + image processing
router.post('/', authenticate, snapshotController.captureSnapshot.bind(snapshotController));

// POST /api/snapshot/start-loop — เริ่ม loop อัตโนมัติ
router.post('/start-loop', authenticate, snapshotController.startLoop.bind(snapshotController));

// POST /api/snapshot/stop-loop — หยุด loop อัตโนมัติ
router.post('/stop-loop', authenticate, snapshotController.stopLoop.bind(snapshotController));

// ---- People Counting endpoints (POST ต้อง login) ----

// POST /api/snapshot/count-now — นับคนทันที 1 ครั้ง
router.post('/count-now', authenticate, snapshotController.countNow.bind(snapshotController));

// POST /api/snapshot/start-counting — เริ่ม loop นับคนอัตโนมัติ
router.post('/start-counting', authenticate, snapshotController.startCounting.bind(snapshotController));

// POST /api/snapshot/stop-counting — หยุด loop นับคนอัตโนมัติ
router.post('/stop-counting', authenticate, snapshotController.stopCounting.bind(snapshotController));

// PUT /api/snapshot/counting-interval — เปลี่ยน interval นับคน
router.put('/counting-interval', authenticate, snapshotController.updateCountingInterval.bind(snapshotController));

// ---- GET endpoints (ไม่ต้อง login — ระบบ snapshot ไม่พึ่ง DB) ----

// GET /api/snapshot/status — ดูสถานะ loop
router.get('/status', snapshotController.getStatus.bind(snapshotController));

// GET /api/snapshot/logs — ดูประวัติ capture
router.get('/logs', snapshotController.getLogs.bind(snapshotController));

// GET /api/snapshot/latest — ดูภาพล่าสุด
router.get('/latest', snapshotController.getLatest.bind(snapshotController));

// GET /api/snapshot/counting-status — ดูสถานะ loop นับคน
router.get('/counting-status', snapshotController.getCountingStatus.bind(snapshotController));

// GET /api/snapshot/counting-history — ดูประวัตินับคน
router.get('/counting-history', snapshotController.getCountingHistory.bind(snapshotController));

// ---- ROI (Region of Interest) ----

// POST /api/snapshot/counting-roi — ตั้งค่า ROI (ต้อง login)
router.post('/counting-roi', authenticate, snapshotController.setCountingROI.bind(snapshotController));

// GET /api/snapshot/counting-roi — ดึง ROI ปัจจุบัน (ไม่ต้อง login)
router.get('/counting-roi', snapshotController.getCountingROI.bind(snapshotController));

module.exports = router;
