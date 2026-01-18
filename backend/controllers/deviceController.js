const Device = require('../models/Device');

class DeviceController {
    // Get all devices
    async getAll(req, res) {
        try {
            const { room_id, type, is_active, search, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const options = {
                room_id: room_id ? parseInt(room_id) : undefined,
                type,
                is_active: is_active !== undefined ? parseInt(is_active) : undefined,
                search,
                limit: parseInt(limit),
                offset
            };

            const devices = await Device.findAll(options);
            const total = await Device.count(options);

            res.json({
                success: true,
                data: devices,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Get all devices error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์',
                error: error.message
            });
        }
    }

    // Get device by ID
    async getById(req, res) {
        try {
            const device = await Device.findById(parseInt(req.params.id));
            
            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลอุปกรณ์'
                });
            }

            res.json({
                success: true,
                data: device
            });
        } catch (error) {
            console.error('Get device by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์',
                error: error.message
            });
        }
    }

    // Get devices by room
    async getByRoom(req, res) {
        try {
            const roomId = parseInt(req.params.roomId);
            const devices = await Device.getByRoom(roomId);

            res.json({
                success: true,
                data: devices
            });
        } catch (error) {
            console.error('Get devices by room error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์',
                error: error.message
            });
        }
    }

    // Create device
    async create(req, res) {
        try {
            const { room_id, device_id, name, type, description, is_active } = req.body;

            if (!room_id || !device_id || !name || !type) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
                });
            }

            const deviceData = {
                room_id: parseInt(room_id),
                device_id,
                name,
                type,
                description,
                is_active: is_active !== undefined ? is_active : 1
            };

            const device = await Device.create(deviceData);

            res.status(201).json({
                success: true,
                message: 'สร้างอุปกรณ์สำเร็จ',
                data: device
            });
        } catch (error) {
            console.error('Create device error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างอุปกรณ์',
                error: error.message
            });
        }
    }

    // Update device
    async update(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { room_id, device_id, name, type, description, is_active } = req.body;

            const deviceData = {};
            if (room_id !== undefined) deviceData.room_id = parseInt(room_id);
            if (device_id !== undefined) deviceData.device_id = device_id;
            if (name !== undefined) deviceData.name = name;
            if (type !== undefined) deviceData.type = type;
            if (description !== undefined) deviceData.description = description;
            if (is_active !== undefined) deviceData.is_active = is_active;

            const device = await Device.update(id, deviceData);

            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลอุปกรณ์'
                });
            }

            res.json({
                success: true,
                message: 'อัปเดตอุปกรณ์สำเร็จ',
                data: device
            });
        } catch (error) {
            console.error('Update device error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัปเดตอุปกรณ์',
                error: error.message
            });
        }
    }

    // Delete device
    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const deleted = await Device.delete(id);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลอุปกรณ์'
                });
            }

            res.json({
                success: true,
                message: 'ลบอุปกรณ์สำเร็จ'
            });
        } catch (error) {
            console.error('Delete device error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบอุปกรณ์',
                error: error.message
            });
        }
    }
}

module.exports = new DeviceController();
