const Face = require('../models/Face');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const FaceScannerService = require('../services/faceScannerService');

class FaceController {
    // Check if user has registered face
    async checkFace(req, res) {
        try {
            const userId = req.user.id;
            const hasFace = await Face.hasFace(userId);
            
            res.json({
                success: true,
                data: {
                    hasFace
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

    // Get face image (try from scanner first, fallback to database)
    async getFace(req, res) {
        try {
            const userId = req.user.id;
            const user = req.user;
            const username = user?.username || user?.email?.split('@')[0];

            // Try to get from face scanner first (like room-management-portal)
            if (username) {
                try {
                    const scannerService = new FaceScannerService();
                    const scannerResult = await scannerService.getFaceImage(username);
                    
                    if (scannerResult.success && scannerResult.data && scannerResult.data.image) {
                        return res.json({
                            success: true,
                            data: {
                                image: `data:${scannerResult.data.mimeType};base64,${scannerResult.data.image}`,
                                hasFace: true,
                                source: 'scanner'
                            }
                        });
                    }
                } catch (scannerError) {
                    console.log('Could not get face from scanner, trying database:', scannerError.message);
                    // Fallback to database
                }
            }

            // Fallback to database
            const face = await Face.findByUserId(userId);
            if (face) {
                const imageData = face.image_base64 || face.face_encoding || null;
                if (imageData) {
                    return res.json({
                        success: true,
                        data: {
                            image: `data:image/jpeg;base64,${imageData}`,
                            hasFace: true,
                            source: 'database'
                        }
                    });
                }
            }

            return res.status(404).json({
                success: false,
                message: 'ไม่พบภาพใบหน้าของผู้ใช้งาน'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Store face image (save to both scanner and database, like room-management-portal)
    async storeFace(req, res) {
        try {
            const userId = req.user.id;
            const user = req.user;
            const { image } = req.body;

            if (!image) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาส่งภาพใบหน้า'
                });
            }

            const username = user?.username || user?.email?.split('@')[0];

            // Store in face scanner device (like room-management-portal)
            let scannerResult = null;
            if (username) {
                try {
                    const scannerService = new FaceScannerService();
                    scannerResult = await scannerService.registerFace(username, image);
                } catch (scannerError) {
                    console.error('Error storing face in scanner:', scannerError);
                    // Continue to save in database even if scanner fails
                }
            }

            // Remove data URL prefix if present for database storage
            const cleanedString = image.replace(/^data:image\/[a-z]+;base64,/, '');
            
            // Check if face already exists in database
            const existingFace = await Face.findByUserId(userId);
            
            let face;
            if (existingFace) {
                // Update existing face
                face = await Face.update(userId, null, cleanedString);
            } else {
                // Create new face
                face = await Face.create(userId, null, cleanedString);
            }

            // Update user photo with face image
            try {
                // Check if photo column can store long text, if not, try to alter it
                const { pool } = require('../config/database');
                const [columns] = await pool.query(`
                    SELECT COLUMN_TYPE 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'users' 
                    AND COLUMN_NAME = 'photo'
                `);
                
                const columnType = columns[0]?.COLUMN_TYPE || '';
                // If photo is varchar(255), try to change it to TEXT
                if (columnType.includes('varchar(255)')) {
                    try {
                        await pool.query(`
                            ALTER TABLE users 
                            MODIFY COLUMN photo TEXT NULL
                        `);
                    } catch (alterError) {
                        console.log('Note: Could not alter photo column:', alterError.message);
                    }
                }
                
                await User.update(userId, {
                    photo: image // Store full data URL as photo
                });
            } catch (photoError) {
                console.error('Error updating user photo:', photoError);
                // Continue even if photo update fails
            }

            const message = scannerResult 
                ? 'บันทึกภาพใบหน้าในเครื่องสแกนและฐานข้อมูลสำเร็จ'
                : 'บันทึกภาพใบหน้าในฐานข้อมูลสำเร็จ (ไม่สามารถบันทึกในเครื่องสแกนได้)';

            res.json({
                success: true,
                message,
                data: {
                    hasFace: true,
                    scannerSaved: scannerResult !== null
                }
            });
        } catch (error) {
            console.error('Error storing face:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการบันทึกภาพใบหน้า',
                error: error.message
            });
        }
    }

    // Test connection to face scanner
    async testScannerConnection(req, res) {
        try {
            const { baseUrl, username, password } = req.body;
            
            const config = {};
            if (baseUrl) config.baseUrl = baseUrl;
            if (username) config.username = username;
            if (password) config.password = password;

            const scannerService = new FaceScannerService(config);
            const result = await scannerService.testConnection();

            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    data: result
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: result.message,
                    error: result.error,
                    details: result.details
                });
            }
        } catch (error) {
            console.error('Test scanner connection error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการทดสอบการเชื่อมต่อ',
                error: error.message
            });
        }
    }

    // Get device info from face scanner
    async getScannerInfo(req, res) {
        try {
            const { baseUrl, username, password } = req.body;
            
            const config = {};
            if (baseUrl) config.baseUrl = baseUrl;
            if (username) config.username = username;
            if (password) config.password = password;

            const scannerService = new FaceScannerService(config);
            const result = await scannerService.getDeviceInfo();

            res.json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Get scanner info error:', error);
            res.status(500).json({
                success: false,
                message: 'ไม่สามารถดึงข้อมูลอุปกรณ์ได้',
                error: error.message
            });
        }
    }

    // Scan face from scanner device
    async scanFaceFromDevice(req, res) {
        try {
            const { baseUrl, username, password } = req.body;
            
            const config = {};
            if (baseUrl) config.baseUrl = baseUrl;
            if (username) config.username = username;
            if (password) config.password = password;

            const scannerService = new FaceScannerService(config);
            const result = await scannerService.scanFace();

            res.json({
                success: true,
                message: 'สแกนใบหน้าสำเร็จ',
                data: result.data
            });
        } catch (error) {
            console.error('Scan face error:', error);
            res.status(500).json({
                success: false,
                message: 'ไม่สามารถสแกนใบหน้าได้',
                error: error.message
            });
        }
    }

    // Get face image from scanner by username
    async getFaceImageFromDevice(req, res) {
        try {
            const { baseUrl, username: configUsername, password, targetUsername } = req.body;
            const requestUsername = targetUsername || req.user?.username || req.user?.email?.split('@')[0];
            
            if (!requestUsername) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ Username หรือ login เข้าสู่ระบบ'
                });
            }

            const config = {};
            if (baseUrl) config.baseUrl = baseUrl;
            if (configUsername) config.username = configUsername;
            if (password) config.password = password;

            const scannerService = new FaceScannerService(config);
            const result = await scannerService.getFaceImage(requestUsername);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message || 'ไม่พบภาพใบหน้าของผู้ใช้งาน'
                });
            }

            res.json({
                success: true,
                message: 'ดึงภาพใบหน้าสำเร็จ',
                data: {
                    image: `data:${result.data.mimeType};base64,${result.data.image}`,
                    mimeType: result.data.mimeType
                }
            });
        } catch (error) {
            console.error('Get face image error:', error);
            res.status(500).json({
                success: false,
                message: 'ไม่สามารถดึงภาพใบหน้าได้',
                error: error.message
            });
        }
    }

    // Register face to scanner device
    async registerFaceToDevice(req, res) {
        try {
            const user = req.user;
            const { baseUrl, username: configUsername, password, image, targetUsername } = req.body;

            if (!image) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาส่งภาพใบหน้า'
                });
            }

            // Use provided username or user's username/email
            const requestUsername = targetUsername || user?.username || user?.email?.split('@')[0];
            
            if (!requestUsername) {
                return res.status(400).json({
                    success: false,
                    message: 'ไม่สามารถระบุ Username ได้ กรุณาระบุ username ใน request'
                });
            }

            const config = {};
            if (baseUrl) config.baseUrl = baseUrl;
            if (configUsername) config.username = configUsername;
            if (password) config.password = password;

            const scannerService = new FaceScannerService(config);
            const result = await scannerService.registerFace(requestUsername, image);

            // Also store in database if user is authenticated
            if (user && user.id) {
                try {
                    // Remove data URL prefix if present
                    const cleanedImage = image.replace(/^data:image\/[a-z]+;base64,/, '');
                    await Face.create(user.id, null, cleanedImage);
                    
                    // Update user photo
                    try {
                        await User.update(user.id, {
                            photo: image
                        });
                    } catch (photoError) {
                        console.error('Error updating user photo:', photoError);
                    }
                } catch (dbError) {
                    console.error('Error storing face in database:', dbError);
                    // Continue even if database save fails
                }
            }

            res.json({
                success: true,
                message: result.message || 'ลงทะเบียนใบหน้าในเครื่องสแกนสำเร็จ',
                data: result.data
            });
        } catch (error) {
            console.error('Register face to device error:', error);
            res.status(500).json({
                success: false,
                message: 'ไม่สามารถลงทะเบียนใบหน้าในเครื่องสแกนได้',
                error: error.message
            });
        }
    }
}

module.exports = new FaceController();

