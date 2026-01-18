const Building = require('../models/Building');

class BuildingController {
    // Get all buildings
    async getAll(req, res) {
        try {
            const { search, disable } = req.query;
            
            const buildings = await Building.findAll({
                search,
                disable: disable !== undefined ? parseInt(disable) : 0
            });

            res.json({
                success: true,
                data: buildings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get single building
    async getById(req, res) {
        try {
            const building = await Building.findById(req.params.id);
            
            if (!building) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบอาคาร'
                });
            }

            res.json({
                success: true,
                data: building
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get building with areas
    async getWithAreas(req, res) {
        try {
            const building = await Building.findWithAreas(req.params.id);
            
            if (!building) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบอาคาร'
                });
            }

            res.json({
                success: true,
                data: building
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Create building
    async create(req, res) {
        try {
            const { name, name_en, description, address } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกชื่ออาคาร'
                });
            }

            const building = await Building.create({
                name,
                name_en,
                description,
                address
            });

            res.status(201).json({
                success: true,
                message: 'สร้างอาคารสำเร็จ',
                data: building
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update building
    async update(req, res) {
        try {
            const building = await Building.findById(req.params.id);
            
            if (!building) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบอาคาร'
                });
            }

            const updatedBuilding = await Building.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'อัปเดตอาคารสำเร็จ',
                data: updatedBuilding
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete building
    async delete(req, res) {
        try {
            const deleted = await Building.delete(req.params.id);
            
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบอาคาร'
                });
            }

            res.json({
                success: true,
                message: 'ลบอาคารสำเร็จ'
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

module.exports = new BuildingController();

















