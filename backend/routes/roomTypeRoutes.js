const express = require('express');
const router = express.Router();
const roomTypeController = require('../controllers/roomTypeController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', roomTypeController.getAll);
router.get('/:id', roomTypeController.getById);

// Protected routes (admin only)
router.post('/', authenticate, isAdmin, roomTypeController.create);
router.put('/:id', authenticate, isAdmin, roomTypeController.update);
router.delete('/:id', authenticate, isAdmin, roomTypeController.delete);

module.exports = router;

















