const RoomType = require('../models/RoomType');

class RoomTypeController {
    // Get all room types
    async getAll(req, res) {
        try {
            const roomTypes = await RoomType.findAll();

            res.json({
                success: true,
                data: roomTypes
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get single room type
    async getById(req, res) {
        try {
            const roomType = await RoomType.findById(req.params.id);
            
            if (!roomType) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบประเภทห้อง'
                });
            }

            res.json({
                success: true,
                data: roomType
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Create room type
    async create(req, res) {
        try {
            const { name, name_en, description, color, icon } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกชื่อประเภทห้อง'
                });
            }

            const roomType = await RoomType.create({
                name,
                name_en,
                description,
                color,
                icon
            });

            res.status(201).json({
                success: true,
                message: 'สร้างประเภทห้องสำเร็จ',
                data: roomType
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update room type
    async update(req, res) {
        try {
            const roomType = await RoomType.findById(req.params.id);
            
            if (!roomType) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบประเภทห้อง'
                });
            }

            const updatedRoomType = await RoomType.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'อัปเดตประเภทห้องสำเร็จ',
                data: updatedRoomType
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete room type
    async delete(req, res) {
        try {
            const deleted = await RoomType.delete(req.params.id);
            
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบประเภทห้อง'
                });
            }

            res.json({
                success: true,
                message: 'ลบประเภทห้องสำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }
}

module.exports = new RoomTypeController();

















