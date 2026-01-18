const express = require('express');
const router = express.Router();
const visitorController = require('../controllers/visitorController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.post('/register', visitorController.register);

// Protected routes
router.use(authenticate);

router.get('/', visitorController.getAll);
router.get('/list', visitorController.getAll); // Alias for compatibility
router.get('/today', visitorController.getTodayVisitors);
router.get('/:id', visitorController.getById);
router.put('/:id', visitorController.update);
router.delete('/:id', isAdmin, visitorController.delete);

// Visitor actions
router.post('/:id/approve', visitorController.approve);
router.post('/:id/reject', visitorController.reject);
router.post('/toggleApproval', visitorController.toggleApproval); // For profile/register page
router.post('/rejectVisitor', visitorController.rejectVisitor); // For profile/register page
router.post('/image', visitorController.getImage); // Get visitor image
router.post('/delete', isAdmin, visitorController.deletePost); // Delete visitor via POST
router.post('/:id/check-in', visitorController.checkIn);
router.post('/:id/check-out', visitorController.checkOut);

module.exports = router;

















