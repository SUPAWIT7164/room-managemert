const express = require('express');
const router = express.Router();
const areaController = require('../controllers/areaController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', areaController.getAll);
router.get('/:id/devices', areaController.getDevices);
// New (device_id-based) control route
router.post('/:id/devices/by-id/:deviceId', areaController.controlDeviceById);
router.get('/:id', areaController.getById);
router.get('/:id/rooms', areaController.getWithRooms);

// Protected routes (admin only)
router.post('/', authenticate, isAdmin, areaController.create);
router.put('/:id', authenticate, isAdmin, areaController.update);
router.delete('/:id', authenticate, isAdmin, areaController.delete);

module.exports = router;

















