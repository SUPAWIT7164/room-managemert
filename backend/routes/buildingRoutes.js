const express = require('express');
const router = express.Router();
const buildingController = require('../controllers/buildingController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', buildingController.getAll);
router.get('/:id', buildingController.getById);
router.get('/:id/areas', buildingController.getWithAreas);

// Protected routes (admin only)
router.post('/', authenticate, isAdmin, buildingController.create);
router.put('/:id', authenticate, isAdmin, buildingController.update);
router.delete('/:id', authenticate, isAdmin, buildingController.delete);

module.exports = router;

















