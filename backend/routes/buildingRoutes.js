const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const buildingController = require('../controllers/buildingController');
const { authenticate, isAdmin } = require('../middleware/auth');
const multer = require('multer');

const uploadDir = path.join(__dirname, '../public/uploads/buildings');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, req.params.id + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('อนุญาตเฉพาะไฟล์ JPEG, PNG, GIF'));
    },
});

// Public routes
router.get('/', buildingController.getAll);
router.get('/:id', buildingController.getById);
router.get('/:id/areas', buildingController.getWithAreas);

// Protected routes (admin only)
router.post('/', authenticate, isAdmin, buildingController.create);
router.put('/:id', authenticate, isAdmin, buildingController.update);
router.delete('/:id', authenticate, isAdmin, buildingController.delete);
router.post('/:id/upload-image', authenticate, isAdmin, upload.single('image'), buildingController.uploadImage);

module.exports = router;

















