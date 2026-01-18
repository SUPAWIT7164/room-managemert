const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticate, isAdmin, isSuperAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../public/uploads/room_images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.params.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
        }
    }
});

// Public routes (require authentication)
router.use(authenticate);

// Get all rooms
router.get('/', roomController.getAll);

// Get rooms list with full details (for DataTables)
router.get('/list', roomController.list);

// Get room by ID
router.get('/:id', roomController.getById);

// Get room with approvers
router.get('/:id/with-approvers', roomController.getWithApprovers);

// Get room availability
router.get('/:id/availability', roomController.getAvailability);

// Admin only routes
router.post('/', isAdmin, roomController.create);
router.put('/:id', isAdmin, roomController.update);
router.delete('/:id', isAdmin, roomController.delete);

// Room approvers management
router.post('/:id/approvers', isAdmin, roomController.addApprover);
router.delete('/:id/approvers/:approverId', isAdmin, roomController.removeApprover);

// Auto approve setting
router.put('/:id/auto-approve', isAdmin, roomController.updateAutoApprove);

// Room devices
router.get('/:id/devices', roomController.getDevices);
router.post('/:id/devices/:type/:index?', roomController.controlDevice);

// Device positions
router.get('/:id/device-positions', roomController.getDevicePositions);
router.post('/:id/device-positions', roomController.saveDevicePositions);

// Environmental data
router.get('/:id/environmental', roomController.getEnvironmentalData);

// Room Permissions
router.get('/:id/permissions', roomController.getPermissions);
router.post('/:id/permissions', isAdmin, roomController.addPermission);
router.delete('/:id/permissions/:permissionId', isAdmin, roomController.deletePermission);

// Room Schedule
router.get('/:id/schedules', roomController.getSchedules);
router.post('/:id/schedules', isAdmin, roomController.createSchedule);
router.delete('/:id/schedules/:scheduleId', isAdmin, roomController.deleteSchedule);

// Control Door (can use device_id directly or room_id)
router.post('/control-door', isAdmin, roomController.controlDoor);
router.post('/:id/control-door', isAdmin, roomController.controlDoor);

// Automation Status
router.put('/:id/automation', isAdmin, roomController.updateAutomationStatus);

// Room Image Upload (super-admin only)
router.post('/:id/upload-image', isSuperAdmin, upload.single('image'), roomController.uploadImage);

module.exports = router;
