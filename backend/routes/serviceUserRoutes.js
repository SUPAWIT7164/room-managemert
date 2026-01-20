const express = require('express');
const router = express.Router();
const serviceUserController = require('../controllers/serviceUserController');
const { authenticate } = require('../middleware/auth');

// Get current service users
router.get('/current', authenticate, serviceUserController.getCurrentServiceUsers.bind(serviceUserController));

// Server-Sent Events for real-time updates (token in query for EventSource compatibility)
router.get('/updates', serviceUserController.subscribeToUpdates.bind(serviceUserController));

// Log service entry
router.post('/entry', authenticate, serviceUserController.logServiceEntry.bind(serviceUserController));

// Log service exit
router.post('/exit', authenticate, serviceUserController.logServiceExit.bind(serviceUserController));

module.exports = router;

