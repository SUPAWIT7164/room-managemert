const express = require('express');
const router = express.Router();
const areaController = require('../controllers/areaController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', areaController.getAll);
router.get('/:id', areaController.getById);
router.get('/:id/rooms', areaController.getWithRooms);

// Protected routes (admin only)
router.post('/', authenticate, isAdmin, areaController.create);
router.put('/:id', authenticate, isAdmin, areaController.update);
router.delete('/:id', authenticate, isAdmin, areaController.delete);

module.exports = router;

















