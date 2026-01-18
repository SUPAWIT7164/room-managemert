const express = require('express');
const router = express.Router();
const faceController = require('../controllers/faceController');
const { authenticate } = require('../middleware/auth');

// All face routes require authentication
router.use(authenticate);

router.get('/check', faceController.checkFace);
router.get('/', faceController.getFace);
router.post('/', faceController.storeFace);

// Face scanner device routes
router.post('/scanner/test', faceController.testScannerConnection);
router.post('/scanner/info', faceController.getScannerInfo);
router.post('/scanner/scan', faceController.scanFaceFromDevice);
router.post('/scanner/image', faceController.getFaceImageFromDevice);
router.post('/scanner/register', faceController.registerFaceToDevice);

module.exports = router;











