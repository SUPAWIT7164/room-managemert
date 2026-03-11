const express = require('express');
const router = express.Router();
const cctvController = require('../controllers/cctvController');
const { authenticate } = require('../middleware/auth');

// Get camera video stream (MJPEG - for real-time video in <img> tag - no auth required)
// Wrap so any rejection sends placeholder image instead of 500
router.get('/stream', (req, res, next) => {
    Promise.resolve(cctvController.getVideoStream(req, res)).catch((err) => {
        console.error('[CCTV] Stream route error:', err?.message || err);
        if (!res.headersSent) {
            cctvController._sendPlaceholderStream(res);
        }
    });
});

// Get camera snapshot as JPEG image (for direct use in <img> tag - no auth required)
router.get('/snapshot', cctvController.getSnapshotImage.bind(cctvController));

// Get camera snapshot as base64 (for JSON response - requires auth)
router.get('/snapshot/base64', authenticate, cctvController.getSnapshot);

// Get camera snapshot as stream (for direct image display - requires auth)
router.get('/snapshot/stream', authenticate, cctvController.getSnapshotStream);

// Get camera info - Simple health check (no auth required)
router.get('/info', cctvController.getCameraInfo.bind(cctvController));

// Test camera connection
router.get('/test', authenticate, cctvController.testConnection);

// Diagnose: ตรวจจากเซิร์ฟเวอร์ว่าเข้าเครือข่ายกล้องได้หรือไม่ (ใช้ digest-fetch เหมือน count-people)
router.get('/diagnose', authenticate, cctvController.diagnose.bind(cctvController));

// Discover available endpoints
router.get('/discover', authenticate, cctvController.discoverEndpoints);

// Count people in CCTV image (for areas on /cctv page) - no auth for stream page
router.post('/count-people', cctvController.countPeopleInArea.bind(cctvController));

// โหลด/บันทึกพื้นที่วาดนับคน (ใช้ทุกครั้งที่เปิดหน้า /cctv) — ต้อง login
router.get('/areas', authenticate, cctvController.getAreas.bind(cctvController));
router.put('/areas', authenticate, cctvController.saveAreas.bind(cctvController));

// ประวัติการนับคน (จาก image processing)
router.get('/people-count-logs', authenticate, cctvController.listPeopleCountLogs.bind(cctvController));

// กล้อง CCTV (IP, user, password) — CRUD
router.get('/cameras', authenticate, cctvController.listCameras.bind(cctvController));
router.get('/cameras/:id', authenticate, cctvController.getCamera.bind(cctvController));
router.post('/cameras', authenticate, cctvController.createCamera.bind(cctvController));
router.put('/cameras/:id', authenticate, cctvController.updateCamera.bind(cctvController));
router.delete('/cameras/:id', authenticate, cctvController.deleteCamera.bind(cctvController));

// Image Processing Service endpoints
router.post('/image-processing/start', authenticate, cctvController.startImageProcessing.bind(cctvController));
router.post('/image-processing/stop', authenticate, cctvController.stopImageProcessing.bind(cctvController));
router.get('/image-processing/status', authenticate, cctvController.getImageProcessingStatus.bind(cctvController));
router.put('/image-processing/interval', authenticate, cctvController.updateImageProcessingInterval.bind(cctvController));

module.exports = router;

