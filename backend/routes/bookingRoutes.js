const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate, isApprover } = require('../middleware/auth');

// Public routes
router.get('/calendar', bookingController.getCalendarData);
router.get('/today', bookingController.getTodayBookings);

// Protected routes
router.use(authenticate);

// User bookings
router.get('/my-bookings', bookingController.getMyBookings);
router.post('/check-overlap', bookingController.checkOverlap);

// Approver routes
router.get('/pending', isApprover, bookingController.getPendingForApprover);

// Standard CRUD
router.get('/', bookingController.getAll);
router.get('/statistics', bookingController.getStatistics);
router.get('/:id', bookingController.getById);
router.post('/', bookingController.create);
router.put('/:id', bookingController.update);

// Booking actions
router.post('/:id/cancel', bookingController.cancel);
router.post('/:id/approve', isApprover, bookingController.approve);
router.post('/:id/reject', isApprover, bookingController.reject);
router.put('/:id/auto-cancel', bookingController.updateAutoCancel);
router.post('/upload', bookingController.uploadBookings);

module.exports = router;

















