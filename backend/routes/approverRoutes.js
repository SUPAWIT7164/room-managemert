const express = require('express');
const router = express.Router();
const approverController = require('../controllers/approverController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Protected routes
router.use(authenticate);

// Get my rooms (as approver)
router.get('/my-rooms', approverController.getMyRooms);

// Get pending bookings for approval
router.get('/pending-bookings', approverController.getPendingBookings);

// Get approvers by room
router.get('/room/:roomId', approverController.getByRoom);

// Admin only
router.post('/', isAdmin, approverController.add);
router.delete('/:id', isAdmin, approverController.remove);

module.exports = router;
















