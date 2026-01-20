const express = require('express');
const router = express.Router();
const environmentController = require('../controllers/environmentController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get environmental data (with optional time-series)
router.get('/data', environmentController.getEnvironmentalData);

// Get current environmental data
router.get('/current', environmentController.getCurrentEnvironmentalData);

// Get environmental statistics
router.get('/statistics', environmentController.getEnvironmentalStatistics);

module.exports = router;



