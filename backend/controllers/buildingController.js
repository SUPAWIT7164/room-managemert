const Building = require('../models/Building');

class BuildingController {
    // Get all buildings (optionally with floors from areas and room count from rooms)
    async getAll(req, res) {
        try {
            const { search, disable, withFloors } = req.query;
            const opts = {
                search,
                disable: disable !== undefined ? parseInt(disable) : 0
            };

            const buildings = (withFloors === '1' || withFloors === 'true')
                ? await Building.findAllWithFloorsAndRoomCount(opts)
                : await Building.findAll(opts);

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
            const body = req.body || {};
            const name = body.name != null ? String(body.name).trim() : '';

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกชื่ออาคาร'
                });
            }

            const building = await Building.create({
                name,
                code: body.code != null ? String(body.code).trim() : undefined
            });

            res.status(201).json({
                success: true,
                message: 'สร้างอาคารสำเร็จ',
                data: building
            });
        } catch (error) {
            console.error('Building create error:', error.message, error.stack);
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

    // Upload building image
    async uploadImage(req, res) {
        try {
            const buildingId = req.params.id;

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาอัปโหลดไฟล์รูปภาพ'
                });
            }

            const imagePath = `/uploads/buildings/${req.file.filename}`;
            const building = await Building.update(buildingId, { image: imagePath });

            const baseUrl = req.protocol + '://' + req.get('host');
            res.json({
                success: true,
                message: 'อัปโหลดรูปอาคารสำเร็จ',
                data: {
                    image_url: imagePath,
                    image_full_url: baseUrl + imagePath,
                    building
                }
            });
        } catch (error) {
            console.error('Upload building image error:', error);
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

















