const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthController {
    // Register
    async register(req, res) {
        try {
            const { username, password, name, email, department, phone } = req.body;

            // Check if user exists
            let existingUser;
            try {
                existingUser = await User.findByUsername(username);
            } catch (dbError) {
                if (dbError.code === 'ETIMEDOUT' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
                    console.error('Database connection error:', dbError.message);
                    return res.status(503).json({ 
                        success: false, 
                        message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                    });
                }
                throw dbError;
            }
            
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' 
                });
            }

            // Check email
            if (email) {
                let existingEmail;
                try {
                    existingEmail = await User.findByEmail(email);
                } catch (dbError) {
                    if (dbError.code === 'ETIMEDOUT' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
                        console.error('Database connection error:', dbError.message);
                        return res.status(503).json({ 
                            success: false, 
                            message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                        });
                    }
                    throw dbError;
                }
                
                if (existingEmail) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'อีเมลนี้ถูกใช้งานแล้ว' 
                    });
                }
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const userData = {
                username,
                password: hashedPassword,
                name,
                email,
                department: department || null,
                phone: phone || null,
                is_active: 1
            };

            const user = await User.create(userData);

            res.status(201).json({
                success: true,
                message: 'ลงทะเบียนสำเร็จ',
                data: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email
                }
            });
        } catch (error) {
            console.error('Register error:', error);
            
            // Check for database connection errors
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return res.status(503).json({ 
                    success: false, 
                    message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                });
            }
            
            res.status(500).json({ 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการลงทะเบียน' 
            });
        }
    }

    // Login
    async login(req, res) {
        try {
            const { username, password } = req.body;

            // Find user
            let user;
            try {
                user = await User.findByUsername(username);
            } catch (dbError) {
                // Check if it's a database connection error
                if (dbError.code === 'ETIMEDOUT' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
                    console.error('Database connection error:', dbError.message);
                    return res.status(503).json({ 
                        success: false, 
                        message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                    });
                }
                // Re-throw if it's a different error
                throw dbError;
            }
            
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' 
                });
            }

            // Check if user is active
            if (!user.is_active) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'บัญชีถูกระงับการใช้งาน' 
                });
            }

            // Verify password (handle Laravel $2y$ hash)
            let passwordHash = user.password;
            // Convert Laravel's $2y$ to Node.js bcrypt's $2b$
            if (passwordHash.startsWith('$2y$')) {
                passwordHash = '$2b$' + passwordHash.substring(4);
            }
            
            const isValidPassword = await bcrypt.compare(password, passwordHash);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' 
                });
            }

            // Get user role
            let role;
            try {
                role = await User.getUserRole(user.id);
            } catch (dbError) {
                // If role fetch fails, use default role
                if (dbError.code === 'ETIMEDOUT' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
                    console.error('Database connection error when fetching role:', dbError.message);
                    role = 'user'; // Use default role
                } else {
                    throw dbError;
                }
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    username: user.username,
                    role: role
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Set session
            req.session.userId = user.id;

            res.json({
                success: true,
                message: 'เข้าสู่ระบบสำเร็จ',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        email: user.email,
                        department: user.department,
                        role: role
                    }
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            
            // Check for database connection errors
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return res.status(503).json({ 
                    success: false, 
                    message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                });
            }
            
            res.status(500).json({ 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' 
            });
        }
    }

    // Logout
    async logout(req, res) {
        try {
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).json({ 
                        success: false, 
                        message: 'เกิดข้อผิดพลาดในการออกจากระบบ' 
                    });
                }
                res.json({ 
                    success: true, 
                    message: 'ออกจากระบบสำเร็จ' 
                });
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'เกิดข้อผิดพลาด' 
            });
        }
    }

    // Get current user
    async getMe(req, res) {
        try {
            let user;
            try {
                user = await User.findById(req.user.id);
            } catch (dbError) {
                if (dbError.code === 'ETIMEDOUT' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
                    console.error('Database connection error:', dbError.message);
                    return res.status(503).json({ 
                        success: false, 
                        message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                    });
                }
                throw dbError;
            }
            
            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'ไม่พบข้อมูลผู้ใช้' 
                });
            }

            let role;
            try {
                role = await User.getUserRole(user.id);
            } catch (dbError) {
                if (dbError.code === 'ETIMEDOUT' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
                    console.error('Database connection error when fetching role:', dbError.message);
                    role = 'user'; // Use default role
                } else {
                    throw dbError;
                }
            }

            res.json({
                success: true,
                data: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    department: user.department,
                    phone: user.phone,
                    role: role,
                    is_active: user.is_active
                }
            });
        } catch (error) {
            console.error('Get me error:', error);
            
            // Check for database connection errors
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return res.status(503).json({ 
                    success: false, 
                    message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                });
            }
            
            res.status(500).json({ 
                success: false, 
                message: 'เกิดข้อผิดพลาด' 
            });
        }
    }

    // Change password
    async changePassword(req, res) {
        try {
            const { oldPassword, newPassword } = req.body;

            let user;
            try {
                user = await User.findById(req.user.id);
            } catch (dbError) {
                if (dbError.code === 'ETIMEDOUT' || dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
                    console.error('Database connection error:', dbError.message);
                    return res.status(503).json({ 
                        success: false, 
                        message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                    });
                }
                throw dbError;
            }
            
            if (!user) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'ไม่พบข้อมูลผู้ใช้' 
                });
            }

            // Verify old password
            const isValidPassword = await bcrypt.compare(oldPassword, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'รหัสผ่านเดิมไม่ถูกต้อง' 
                });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await User.updatePassword(user.id, hashedPassword);

            res.json({ 
                success: true, 
                message: 'เปลี่ยนรหัสผ่านสำเร็จ' 
            });
        } catch (error) {
            console.error('Change password error:', error);
            
            // Check for database connection errors
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return res.status(503).json({ 
                    success: false, 
                    message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง' 
                });
            }
            
            res.status(500).json({ 
                success: false, 
                message: 'เกิดข้อผิดพลาด' 
            });
        }
    }

    // Microsoft OAuth - Initiate OAuth flow
    async oauthMicrosoft(req, res) {
        try {
            // For now, return a placeholder response
            // In production, this should redirect to Microsoft OAuth login page
            const redirectUri = req.query.redirectUri || '/dashboard';
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            
            // TODO: Implement actual Microsoft OAuth flow
            // This is a placeholder that redirects back to frontend with error
            res.redirect(`${frontendUrl}/oauth/callback?error=Microsoft OAuth not configured`);
        } catch (error) {
            console.error('OAuth Microsoft error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Microsoft 365' 
            });
        }
    }

    // Microsoft OAuth - Handle callback
    async oauthMicrosoftCallback(req, res) {
        try {
            // For now, return a placeholder response
            // In production, this should handle the OAuth callback from Microsoft
            const { code, error } = req.query;
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            
            if (error) {
                return res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent(error)}`);
            }
            
            // TODO: Implement actual OAuth token exchange
            // This is a placeholder that redirects back to frontend with error
            res.redirect(`${frontendUrl}/oauth/callback?error=Microsoft OAuth not configured`);
        } catch (error) {
            console.error('OAuth Microsoft callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            res.redirect(`${frontendUrl}/oauth/callback?error=เกิดข้อผิดพลาด`);
        }
    }
}

module.exports = new AuthController();
