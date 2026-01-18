const express = require('express');
const router = express.Router();
const cctvController = require('../controllers/cctvController');
const { authenticate } = require('../middleware/auth');

// Get camera video stream (MJPEG - for real-time video in <img> tag - no auth required)
router.get('/stream', cctvController.getVideoStream.bind(cctvController));

// Get camera snapshot as JPEG image (for direct use in <img> tag - no auth required)
router.get('/snapshot', cctvController.getSnapshotImage.bind(cctvController));

// Get camera snapshot as base64 (for JSON response - requires auth)
router.get('/snapshot/base64', authenticate, cctvController.getSnapshot);

// Get camera snapshot as stream (for direct image display - requires auth)
router.get('/snapshot/stream', authenticate, cctvController.getSnapshotStream);

// Get camera info
router.get('/info', authenticate, cctvController.getCameraInfo);

// Test camera connection
router.get('/test', authenticate, cctvController.testConnection);

// Discover available endpoints
router.get('/discover', authenticate, cctvController.discoverEndpoints);

// Image Processing Service endpoints
router.post('/image-processing/start', authenticate, cctvController.startImageProcessing.bind(cctvController));
router.post('/image-processing/stop', authenticate, cctvController.stopImageProcessing.bind(cctvController));
router.get('/image-processing/status', authenticate, cctvController.getImageProcessingStatus.bind(cctvController));
router.put('/image-processing/interval', authenticate, cctvController.updateImageProcessingInterval.bind(cctvController));

module.exports = router;

