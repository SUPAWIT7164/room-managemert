const express = require('express');
const router = express.Router();
const waterController = require('../controllers/waterController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/devices', waterController.getWaterDevices);
router.get('/report', waterController.getWaterReport);

module.exports = router;
