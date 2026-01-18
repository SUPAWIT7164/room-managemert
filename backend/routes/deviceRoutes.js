const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { authenticate, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Public routes (authenticated users)
router.get('/', deviceController.getAll);
router.get('/room/:roomId', deviceController.getByRoom);
router.get('/:id', deviceController.getById);

// Admin only routes
router.post('/', isAdmin, deviceController.create);
router.put('/:id', isAdmin, deviceController.update);
router.delete('/:id', isAdmin, deviceController.delete);

module.exports = router;
