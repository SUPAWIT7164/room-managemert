const express = require('express');
const router = express.Router();
const floorPlanController = require('../controllers/floorPlanController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/config', floorPlanController.getConfig.bind(floorPlanController));
router.put('/config', floorPlanController.saveConfig.bind(floorPlanController));
router.get('/people-counts', floorPlanController.getPeopleCounts.bind(floorPlanController));
router.get('/debug-detections', floorPlanController.debugDetections.bind(floorPlanController));

module.exports = router;
