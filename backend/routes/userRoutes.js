const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Search users (for autocomplete)
router.get('/search', userController.search);

// Get all users
router.get('/', userController.getAll);

// Get single user
router.get('/:id', userController.getById);

// User preferences (for current user)
router.get('/me/preferences', userController.getPreferences);
router.put('/me/preferences', userController.updatePreferences);
router.get('/me/preferences/:key', userController.getPreference);
router.put('/me/preferences/:key', userController.updatePreference);

// Admin only routes
router.post('/', isAdmin, userController.create);
router.put('/:id', isAdmin, userController.update);
router.patch('/:id/status', isAdmin, userController.updateStatus);
router.patch('/:id/role', isAdmin, userController.updateRole);
router.delete('/:id', isAdmin, userController.delete);

module.exports = router;







