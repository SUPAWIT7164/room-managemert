const User = require('../models/User');
const UserPreference = require('../models/UserPreference');

class UserController {
    // Get all users
    async getAll(req, res) {
        try {
            const currentUser = req.user;
            const { search, role, active, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            // user role ไม่สามารถดูรายการผู้ใช้ได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้'
                });
            }

            const users = await User.findAll({
                search,
                role,
                active: active !== undefined ? parseInt(active) : undefined,
                limit: parseInt(limit),
                offset
            });

            const total = await User.count({ active: active !== undefined ? parseInt(active) : undefined });

            res.json({
                success: true,
                data: users,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get single user
    async getById(req, res) {
        try {
            const user = await User.findById(req.params.id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้ใช้'
                });
            }

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Create user (admin only)
    async create(req, res) {
        try {
            const currentUser = req.user;
            
            // เฉพาะ admin และ super-admin เท่านั้นที่สามารถสร้างผู้ใช้ได้
            const isAdmin = ['super-admin', 'admin', 'Admin'].includes(currentUser.role);
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์สร้างผู้ใช้'
                });
            }

            const { username, email, password, name, role, phone, organization } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกข้อมูลที่จำเป็น'
                });
            }

            // Check existing
            const existingUsername = await User.findByUsername(username);
            if (existingUsername) {
                return res.status(400).json({
                    success: false,
                    message: 'Username นี้ถูกใช้งานแล้ว'
                });
            }

            const existingEmail = await User.findByEmail(email);
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email นี้ถูกใช้งานแล้ว'
                });
            }

            const user = await User.create({
                username,
                email,
                password,
                name,
                role: role || 'user',
                phone,
                organization
            });

            res.status(201).json({
                success: true,
                message: 'สร้างผู้ใช้สำเร็จ',
                data: user
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update user
    async update(req, res) {
        try {
            const currentUser = req.user;
            const user = await User.findById(req.params.id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้ใช้'
                });
            }

            // user role ไม่สามารถแก้ไขผู้ใช้ได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์แก้ไขผู้ใช้'
                });
            }

            // ป้องกันการแก้ไขตัวเอง
            if (user.id === currentUser.id) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่สามารถแก้ไขข้อมูลของตนเองได้'
                });
            }

            const updatedUser = await User.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'อัปเดตข้อมูลสำเร็จ',
                data: updatedUser
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update user status
    async updateStatus(req, res) {
        try {
            const currentUser = req.user;
            const { active } = req.body;
            
            // user role ไม่สามารถเปลี่ยนสถานะผู้ใช้ได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์เปลี่ยนสถานะผู้ใช้'
                });
            }

            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้ใช้'
                });
            }

            // ป้องกันการเปลี่ยนสถานะตัวเอง
            if (user.id === currentUser.id) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่สามารถเปลี่ยนสถานะของตนเองได้'
                });
            }

            // admin ไม่สามารถเปลี่ยนสถานะ super-admin ได้
            const userRole = await User.getUserRole(user.id);
            if ((userRole === 'super-admin' || userRole === 'admin') && currentUser.role !== 'super-admin') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์เปลี่ยนสถานะของผู้ใช้ระดับนี้'
                });
            }
            
            const updatedUser = await User.update(req.params.id, { active });

            res.json({
                success: true,
                message: active ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับบัญชีสำเร็จ',
                data: user
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update user role
    async updateRole(req, res) {
        try {
            const currentUser = req.user;
            const { role } = req.body;
            
            // user role ไม่สามารถเปลี่ยน role ได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์เปลี่ยน role'
                });
            }

            if (!['admin', 'user', 'approver', 'super-admin'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Role ไม่ถูกต้อง'
                });
            }

            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้ใช้'
                });
            }

            // ป้องกันการเปลี่ยน role ของตัวเอง
            if (user.id === currentUser.id) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่สามารถเปลี่ยน role ของตนเองได้'
                });
            }

            // เฉพาะ super-admin เท่านั้นที่สามารถเปลี่ยน role เป็น super-admin ได้
            if (role === 'super-admin' && currentUser.role !== 'super-admin') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์เลื่อนขั้นเป็น super-admin'
                });
            }

            // admin ไม่สามารถลดระดับ super-admin ได้
            const userRole = await User.getUserRole(user.id);
            if (userRole === 'super-admin' && currentUser.role !== 'super-admin') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่สามารถลดระดับ super-admin ได้'
                });
            }

            // Update role in Spatie Permission system
            await User.updateRole(req.params.id, role);

            // Get updated user with role
            const updatedRole = await User.getUserRole(req.params.id);
            const updatedUser = await User.findById(req.params.id);
            updatedUser.role = updatedRole;

            res.json({
                success: true,
                message: 'อัปเดต Role สำเร็จ',
                data: updatedUser
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete user
    async delete(req, res) {
        try {
            const currentUser = req.user;
            
            // user role ไม่สามารถลบผู้ใช้ได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์ลบผู้ใช้'
                });
            }

            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้ใช้'
                });
            }

            // ป้องกันการลบตัวเอง
            if (user.id === currentUser.id) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่สามารถลบตนเองได้'
                });
            }

            // admin ไม่สามารถลบ super-admin ได้
            const userRole = await User.getUserRole(user.id);
            if (userRole === 'super-admin' && currentUser.role !== 'super-admin') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่สามารถลบ super-admin ได้'
                });
            }

            const deleted = await User.delete(req.params.id);
            
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้ใช้'
                });
            }

            res.json({
                success: true,
                message: 'ลบผู้ใช้สำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Search users
    async search(req, res) {
        try {
            const { q } = req.query;
            
            const users = await User.findAll({
                search: q,
                limit: 10
            });

            res.json({
                success: true,
                data: users
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get user preferences
    async getPreferences(req, res) {
        try {
            const userId = req.user.id; // From authenticated user
            const preferences = await UserPreference.getByUser(userId);

            res.json({
                success: true,
                data: preferences
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update user preferences
    async updatePreferences(req, res) {
        try {
            const userId = req.user.id; // From authenticated user
            const preferences = req.body;

            await UserPreference.setMultiplePreferences(userId, preferences);

            res.json({
                success: true,
                message: 'อัปเดตการตั้งค่าสำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get single preference
    async getPreference(req, res) {
        try {
            const userId = req.user.id; // From authenticated user
            const { key } = req.params;
            const value = await UserPreference.getPreference(userId, key);

            res.json({
                success: true,
                data: { [key]: value }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update single preference
    async updatePreference(req, res) {
        try {
            const userId = req.user.id; // From authenticated user
            const { key } = req.params;
            const { value } = req.body;

            await UserPreference.setPreference(userId, key, value);

            res.json({
                success: true,
                message: 'อัปเดตการตั้งค่าสำเร็จ'
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

module.exports = new UserController();







