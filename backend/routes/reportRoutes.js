const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const quotaController = require('../controllers/quotaController');
const { authenticate, isAdmin } = require('../middleware/auth');

// All report routes require authentication and admin role
router.use(authenticate);
router.use(isAdmin);

router.get('/service-usage', reportController.getServiceUsageReport);
router.get('/room-usage', reportController.getRoomUsageReport);
router.post('/booking', reportController.getBookingReport);
router.get('/booking', reportController.getBookingReport);
router.post('/access', reportController.getAccessReport);
router.get('/access', reportController.getAccessReport);
router.post('/room-usage-summary', reportController.getRoomUsageSummary);
router.get('/room-usage-summary', reportController.getRoomUsageSummary);
router.get('/usage-quota', quotaController.getAll);

module.exports = router;














