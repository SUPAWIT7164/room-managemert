const axios = require('axios');

/**
 * Face Scanner Service
 * เชื่อมต่อกับเครื่องสแกนหน้าทาง IP address
 * ใช้ API format ตาม room-management-portal
 */
class FaceScannerService {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || process.env.FACE_SCANNER_URL || 'http://192.168.22.53';
        this.username = config.username || process.env.FACE_SCANNER_USERNAME || 'admin';
        this.password = config.password || process.env.FACE_SCANNER_PASSWORD || 'lannacom@1';
        this.timeout = config.timeout || 30000;
        
        // Create axios instance with authentication (if needed)
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            // Add auth if provided
            ...(this.username && this.password && {
                auth: {
                    username: this.username,
                    password: this.password
                }
            })
        });
    }

    /**
     * Test connection to face scanner
     * ลองใช้ API endpoint ตาม format room-management-portal
     */
    async testConnection() {
        try {
            // Try the GetFace API endpoint (using test user)
            try {
                const response = await this.client.post('/user/GetFace', {
                    Username: 'test'
                }, {
                    timeout: 5000,
                    validateStatus: (status) => status < 500 // Accept any status < 500
                });
                
                return {
                    success: true,
                    message: 'เชื่อมต่อสำเร็จ (GetFace API)',
                    endpoint: '/user/GetFace',
                    status: response.status,
                    data: response.data
                };
            } catch (getFaceError) {
                // If GetFace fails, try AddFace (but this will fail without proper data, just to test connection)
                try {
                    const response = await this.client.post('/user/AddFace', {
                        Username: 'test',
                        Image: 'test'
                    }, {
                        timeout: 5000,
                        validateStatus: (status) => status < 500
                    });
                    
                    return {
                        success: true,
                        message: 'เชื่อมต่อสำเร็จ (AddFace API)',
                        endpoint: '/user/AddFace',
                        status: response.status,
                        data: response.data
                    };
                } catch (addFaceError) {
                    // Try basic HTTP connection
                    try {
                        const pingResponse = await this.client.get('/', {
                            timeout: 5000,
                            validateStatus: (status) => status < 500
                        });
                        
                        return {
                            success: true,
                            message: 'เชื่อมต่อสำเร็จ (Basic HTTP)',
                            endpoint: '/',
                            status: pingResponse.status,
                            data: pingResponse.data
                        };
                    } catch (pingError) {
                        throw getFaceError; // Throw original error
                    }
                }
            }
        } catch (error) {
            return {
                success: false,
                message: 'ไม่สามารถเชื่อมต่อกับเครื่องสแกนหน้าได้',
                error: error.message,
                details: {
                    baseUrl: this.baseUrl,
                    username: this.username,
                    code: error.code,
                    response: error.response ? {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data
                    } : null
                }
            };
        }
    }

    /**
     * Get device information
     * (Not all face scanner devices support this)
     */
    async getDeviceInfo() {
        try {
            // Try common info endpoints
            const endpoints = ['/info', '/api/info', '/device/info', '/status'];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await this.client.get(endpoint, {
                        timeout: 5000
                    });
                    return {
                        success: true,
                        data: response.data
                    };
                } catch (err) {
                    continue;
                }
            }
            
            throw new Error('ไม่มี endpoint สำหรับดึงข้อมูลอุปกรณ์');
        } catch (error) {
            throw new Error(`ไม่สามารถดึงข้อมูลอุปกรณ์: ${error.message}`);
        }
    }

    /**
     * Scan face (capture face image)
     * Note: This depends on device capabilities - some devices may not support remote scanning
     */
    async scanFace() {
        try {
            // Try common scan endpoints
            const endpoints = ['/scan', '/api/face/scan', '/user/ScanFace'];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await this.client.post(endpoint, {}, {
                        timeout: 30000 // 30 seconds for face scan
                    });
                    return {
                        success: true,
                        data: response.data
                    };
                } catch (err) {
                    continue;
                }
            }
            
            throw new Error('ไม่มี endpoint สำหรับสแกนใบหน้า');
        } catch (error) {
            throw new Error(`ไม่สามารถสแกนใบหน้าได้: ${error.message}`);
        }
    }

    /**
     * Get face image from scanner by username
     * ใช้ API format ตาม room-management-portal: POST /user/GetFace
     */
    async getFaceImage(username) {
        try {
            if (!username) {
                throw new Error('ต้องระบุ Username');
            }

            const response = await this.client.post('/user/GetFace', {
                Username: username
            }, {
                timeout: 15000
            });

            if (!response.data || !response.data.Image) {
                return {
                    success: false,
                    message: 'ไม่พบภาพใบหน้าของผู้ใช้งาน'
                };
            }

            return {
                success: true,
                data: {
                    image: response.data.Image, // Base64 string
                    mimeType: 'image/jpeg'
                }
            };
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return {
                    success: false,
                    message: 'ไม่พบภาพใบหน้าของผู้ใช้งาน'
                };
            }
            throw new Error(`ไม่สามารถดึงภาพใบหน้าได้: ${error.message}`);
        }
    }

    /**
     * Verify face against stored faces
     */
    async verifyFace(faceImageBase64) {
        try {
            const response = await this.client.post('/api/face/verify', {
                image: faceImageBase64
            }, {
                timeout: 30000
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            throw new Error(`ไม่สามารถยืนยันใบหน้าได้: ${error.message}`);
        }
    }

    /**
     * Register face to scanner
     * ใช้ API format ตาม room-management-portal: POST /user/AddFace
     * @param {string} username - Username ของผู้ใช้
     * @param {string} faceImageBase64 - Base64 image string (without data URL prefix)
     */
    async registerFace(username, faceImageBase64) {
        try {
            if (!username) {
                throw new Error('ต้องระบุ Username');
            }

            if (!faceImageBase64) {
                throw new Error('ต้องระบุภาพใบหน้า');
            }

            // Remove data URL prefix if present
            const cleanedImage = faceImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

            const response = await this.client.post('/user/AddFace', {
                Username: username,
                Image: cleanedImage
            }, {
                timeout: 30000
            });

            return {
                success: true,
                data: response.data,
                message: 'ลงทะเบียนใบหน้าสำเร็จ'
            };
        } catch (error) {
            throw new Error(`ไม่สามารถลงทะเบียนใบหน้าได้: ${error.message}`);
        }
    }

    /**
     * Delete face from scanner
     */
    async deleteFace(userId) {
        try {
            const response = await this.client.delete(`/api/face/${userId}`, {
                timeout: 10000
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            throw new Error(`ไม่สามารถลบใบหน้าได้: ${error.message}`);
        }
    }

    /**
     * Get all registered faces
     */
    async getAllFaces() {
        try {
            const response = await this.client.get('/api/face/list', {
                timeout: 10000
            });
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            throw new Error(`ไม่สามารถดึงรายการใบหน้าที่ลงทะเบียนได้: ${error.message}`);
        }
    }
}

module.exports = FaceScannerService;

