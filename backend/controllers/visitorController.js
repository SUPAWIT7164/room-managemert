const Visitor = require('../models/Visitor');

class VisitorController {
    // Get all visitors
    async getAll(req, res) {
        try {
            const { status, date, search, limit } = req.query;
            
            const visitors = await Visitor.findAll({
                approve: status,
                date,
                search,
                limit: limit ? parseInt(limit) : undefined
            });

            res.json({
                success: true,
                data: visitors
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get single visitor
    async getById(req, res) {
        try {
            const visitor = await Visitor.findById(req.params.id);
            
            if (!visitor) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้เยี่ยมชม'
                });
            }

            res.json({
                success: true,
                data: visitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Register visitor (public)
    async register(req, res) {
        try {
            const { prefix_name, name, name_en, email, phone, citizen_id, organization, purpose } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกชื่อ'
                });
            }

            const visitor = await Visitor.create({
                prefix_name,
                name,
                name_en,
                email,
                phone,
                citizen_id: citizen_id || `TEMP_${Date.now()}`,
                organization,
                purpose
            });

            res.status(201).json({
                success: true,
                message: 'ลงทะเบียนสำเร็จ รอการอนุมัติ',
                data: visitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update visitor
    async update(req, res) {
        try {
            const visitor = await Visitor.findById(req.params.id);
            
            if (!visitor) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้เยี่ยมชม'
                });
            }

            const updatedVisitor = await Visitor.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'อัปเดตข้อมูลสำเร็จ',
                data: updatedVisitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete visitor
    async delete(req, res) {
        try {
            const id = req.params.id;
            const deleted = await Visitor.delete(id);
            
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้เยี่ยมชม'
                });
            }

            res.json({
                success: true,
                message: 'ลบข้อมูลสำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete visitor via POST (for profile/register page)
    async deletePost(req, res) {
        try {
            const { id } = req.body;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ ID'
                });
            }

            const deleted = await Visitor.delete(id);
            
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้เยี่ยมชม'
                });
            }

            res.json({
                success: true,
                message: 'ลบข้อมูลสำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Approve visitor
    async approve(req, res) {
        try {
            const visitor = await Visitor.approve(req.params.id);

            res.json({
                success: true,
                message: 'อนุมัติสำเร็จ',
                data: visitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Reject visitor
    async reject(req, res) {
        try {
            const visitor = await Visitor.reject(req.params.id);

            res.json({
                success: true,
                message: 'ปฏิเสธสำเร็จ',
                data: visitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Check in visitor (same as approve for this schema)
    async checkIn(req, res) {
        try {
            const visitor = await Visitor.approve(req.params.id);

            res.json({
                success: true,
                message: 'เช็คอินสำเร็จ',
                data: visitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Check out visitor
    async checkOut(req, res) {
        try {
            // For this schema, we don't have check_out field
            // Just return success
            const visitor = await Visitor.findById(req.params.id);

            res.json({
                success: true,
                message: 'เช็คเอาท์สำเร็จ',
                data: visitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get today's visitors
    async getTodayVisitors(req, res) {
        try {
            const visitors = await Visitor.getTodayVisitors();

            res.json({
                success: true,
                data: visitors
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Toggle approval (for profile/register page)
    async toggleApproval(req, res) {
        try {
            const { id } = req.body;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ ID'
                });
            }

            const visitor = await Visitor.findById(id);
            if (!visitor) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้เยี่ยมชม'
                });
            }

            // Toggle approval status
            const newStatus = visitor.approve === null ? 1 : visitor.approve === 1 ? 0 : null;
            const updatedVisitor = await Visitor.update(id, { approve: newStatus });

            res.json({
                success: true,
                message: 'อัปเดตสถานะสำเร็จ',
                data: updatedVisitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Reject visitor (POST method for profile/register page)
    async rejectVisitor(req, res) {
        try {
            const { id } = req.body;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ ID'
                });
            }

            const visitor = await Visitor.reject(id);

            res.json({
                success: true,
                message: 'ปฏิเสธสำเร็จ',
                data: visitor
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get visitor image
    async getImage(req, res) {
        try {
            const { id } = req.body;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ ID'
                });
            }

            const visitor = await Visitor.findById(id);
            if (!visitor) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้เยี่ยมชม'
                });
            }

            // If image path exists, read and return as base64
            if (visitor.image) {
                const fs = require('fs');
                const path = require('path');
                const imagePath = path.join(__dirname, '../public/uploads', visitor.image);
                
                if (fs.existsSync(imagePath)) {
                    const imageBuffer = fs.readFileSync(imagePath);
                    const base64Image = imageBuffer.toString('base64');
                    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
                    
                    return res.json({
                        success: true,
                        image: `data:${mimeType};base64,${base64Image}`
                    });
                }
            }

            res.json({
                success: false,
                message: 'ไม่พบรูปภาพ'
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

module.exports = new VisitorController();
