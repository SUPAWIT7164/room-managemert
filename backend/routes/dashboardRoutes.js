const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

// Protected routes
router.use(authenticate);

router.get('/stats', dashboardController.getStats);
router.get('/recent-activities', dashboardController.getRecentActivities);
router.get('/booking-stats', dashboardController.getBookingStats);
router.get('/room-availability', dashboardController.getRoomAvailability);

module.exports = router;

















