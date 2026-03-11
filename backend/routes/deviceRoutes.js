const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { authenticate, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ==================== Device Types (สำหรับหน้าเว็บแสดง icon สั่งงาน) ====================
// GET /api/devices/types - คืนรายการประเภทอุปกรณ์ (light, air, erv) พร้อม icon, label
router.get('/types', deviceController.getTypes);

// ==================== ไฟ (Light) ====================
// POST /api/devices/light/:entityId/control - เปิด/ปิดไฟ
router.post('/light/:entityId/control', deviceController.controlLight);
// GET /api/devices/light/:entityId/status - ดึงสถานะไฟ
router.get('/light/:entityId/status', deviceController.getLightStatus);
// POST /api/devices/sync/light/:deviceId - Sync สถานะไฟจาก Home Assistant
router.post('/sync/light/:deviceId', deviceController.syncLight);

// ==================== แอร์ (Air) ====================
// POST /api/devices/air/:deviceId/control - เปิด/ปิดแอร์
router.post('/air/:deviceId/control', deviceController.controlAir);

// POST /api/devices/air/:deviceId/temperature - ตั้งอุณหภูมิ
router.post('/air/:deviceId/temperature', deviceController.setAirTemperature);
// POST /api/devices/air/:deviceId/mode - ตั้งค่าโหมด (cool, dry, fan_only, off)
router.post('/air/:deviceId/mode', deviceController.setAirMode);
// GET /api/devices/air/:deviceId/status - ดึงสถานะแอร์
router.get('/air/:deviceId/status', deviceController.getAirStatus);
// POST /api/devices/sync/air/:deviceId - Sync สถานะแอร์จาก Home Assistant
router.post('/sync/air/:deviceId', deviceController.syncAirConditioner);

// ==================== ERV ====================
// POST /api/devices/erv/:deviceId/control - เปิด/ปิด ERV
router.post('/erv/:deviceId/control', deviceController.controlErv);
// POST /api/devices/erv/:deviceId/mode - ตั้งค่าโหมด ERV (heat, normal)
router.post('/erv/:deviceId/mode', deviceController.setErvMode);
// POST /api/devices/erv/:deviceId/level - ตั้งค่าระดับ ERV (low, high)
router.post('/erv/:deviceId/level', deviceController.setErvLevel);
// GET /api/devices/erv/:deviceId/status - ดึงสถานะ ERV
router.get('/erv/:deviceId/status', deviceController.getErvStatus);
// POST /api/devices/sync/erv/:deviceId - Sync สถานะ ERV จาก Home Assistant
router.post('/sync/erv/:deviceId', deviceController.syncErv);

// POST /api/devices/sync/all - Sync ทุกอุปกรณ์จาก Home Assistant ไปยัง DB
router.post('/sync/all', deviceController.syncAll);

// ==================== Sensor ====================
// GET /api/devices/sensor/am319 - ดึงข้อมูล AM319 Sensor ทั้งหมด
router.get('/sensor/am319', deviceController.getAm319SensorData);

// GET /api/devices/sensor/:entityId - ดึงข้อมูล Sensor ตัวเดียว
router.get('/sensor/:entityId', deviceController.getSensorData);

// Public routes (authenticated users)
router.get('/', deviceController.getAll);
router.get('/room/:roomId', deviceController.getByRoom);
router.get('/:id', deviceController.getById);

// Admin only routes
router.post('/', isAdmin, deviceController.create);
router.put('/:id', isAdmin, deviceController.update);
router.delete('/:id', isAdmin, deviceController.delete);

module.exports = router;
