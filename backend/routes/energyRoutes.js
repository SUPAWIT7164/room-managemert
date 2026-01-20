const express = require('express');
const router = express.Router();
const energyController = require('../controllers/energyController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get notification settings list
router.post('/notification/list', energyController.getNotificationList);

// Update notification setting
router.post('/notification/update', energyController.notificationUpdate);

module.exports = router;



