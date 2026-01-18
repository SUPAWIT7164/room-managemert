const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
    try {
        // Check for token in Authorization header or query parameter (for image requests)
        const authHeader = req.headers.authorization;
        const tokenFromQuery = req.query.token;
        
        let token = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (tokenFromQuery) {
            token = tokenFromQuery;
        }
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'กรุณาเข้าสู่ระบบ' 
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'ไม่พบผู้ใช้งาน' 
            });
        }

        if (!user.is_active) {
            return res.status(403).json({ 
                success: false, 
                message: 'บัญชีถูกระงับการใช้งาน' 
            });
        }

        // Get user role
        const role = await User.getUserRole(user.id);
        user.role = role;

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' 
            });
        }
        return res.status(401).json({ 
            success: false, 
            message: 'Token ไม่ถูกต้อง' 
        });
    }
};

const isAdmin = (req, res, next) => {
    const allowedRoles = ['super-admin', 'admin', 'Admin'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
            success: false, 
            message: 'ไม่มีสิทธิ์เข้าถึง (ต้องเป็น Admin)' 
        });
    }
    next();
};

const isApprover = (req, res, next) => {
    const allowedRoles = ['super-admin', 'admin', 'Admin', 'approver', 'Approver'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
            success: false, 
            message: 'ไม่มีสิทธิ์เข้าถึง' 
        });
    }
    next();
};

const isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super-admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'คุณไม่มีสิทธิ์ในการเข้าถึงฟีเจอร์นี้ (ต้องเป็น Super Admin)' 
        });
    }
    next();
};

module.exports = { authenticate, isAdmin, isApprover, isSuperAdmin };
