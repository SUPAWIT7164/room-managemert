const axios = require('axios');
const https = require('https');
const { DigestClient } = require('digest-fetch');

class CCTVController {
    // CCTV Camera Configuration
    // Based on http://192.168.24.1/doc/index.html#/preview (Hikvision camera)
    constructor() {
        // Ensure dotenv is loaded
        require('dotenv').config();
        
        this.cameraConfig = {
            baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
            username: process.env.CCTV_USERNAME || 'admin',
            password: process.env.CCTV_PASSWORD || 'L@nnac0m',
            // Hikvision ISAPI endpoint for snapshot
            snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture'
        };
        
        // Image Processing Service (optional - lazy load)
        this.imageProcessingService = null;
        
        // Log configuration (without password)
        console.log('[CCTV] Configuration loaded:');
        console.log(`  Base URL: ${this.cameraConfig.baseUrl}`);
        console.log(`  Username: ${this.cameraConfig.username}`);
        console.log(`  Password: ${this.cameraConfig.password ? '***' : 'NOT SET'}`);
        console.log(`  From .env: ${process.env.CCTV_BASE_URL ? 'YES' : 'NO'}`);
    }

    /**
     * Initialize Image Processing Service (lazy load)
     */
    initImageProcessingService() {
        if (!this.imageProcessingService) {
            const ImageProcessingService = require('../services/imageProcessingService');
            this.imageProcessingService = new ImageProcessingService(this.cameraConfig);
            console.log('[CCTV] Image Processing Service initialized');
        }
        return this.imageProcessingService;
    }

    /**
     * Start Image Processing Service
     */
    startImageProcessing(req, res) {
        try {
            const { intervalMinutes = 5 } = req.body;
            const service = this.initImageProcessingService();
            
            // Validate interval (1-5 minutes)
            const validInterval = Math.max(1, Math.min(5, parseInt(intervalMinutes) || 5));
            
            service.start(validInterval);
            
            res.json({
                success: true,
                message: `Image Processing Service started (every ${validInterval} minutes)`,
                intervalMinutes: validInterval
            });
        } catch (error) {
            console.error('[CCTV] Error starting image processing:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการเริ่มต้น Image Processing Service',
                error: error.message
            });
        }
    }

    /**
     * Stop Image Processing Service
     */
    stopImageProcessing(req, res) {
        try {
            if (this.imageProcessingService) {
                this.imageProcessingService.stop();
                res.json({
                    success: true,
                    message: 'Image Processing Service stopped'
                });
            } else {
                res.json({
                    success: true,
                    message: 'Image Processing Service is not running'
                });
            }
        } catch (error) {
            console.error('[CCTV] Error stopping image processing:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการหยุด Image Processing Service',
                error: error.message
            });
        }
    }

    /**
     * Get Image Processing Service Status
     */
    getImageProcessingStatus(req, res) {
        try {
            if (!this.imageProcessingService) {
                return res.json({
                    success: true,
                    running: false,
                    message: 'Image Processing Service is not initialized'
                });
            }

            const service = this.imageProcessingService;
            const status = service.getStatus();
            res.json({
                success: true,
                data: status,
                message: status.isRunning 
                    ? `Running (every ${status.intervalMinutes} minutes)`
                    : 'Stopped'
            });
        } catch (error) {
            console.error('[CCTV] Error getting image processing status:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงสถานะ',
                error: error.message
            });
        }
    }

    /**
     * Update Image Processing Interval
     */
    updateImageProcessingInterval(req, res) {
        try {
            const { intervalMinutes } = req.body;
            
            if (!intervalMinutes || intervalMinutes < 1 || intervalMinutes > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Interval must be between 1 and 5 minutes'
                });
            }

            const service = this.initImageProcessingService();
            service.setInterval(parseInt(intervalMinutes));
            
            res.json({
                success: true,
                message: `Image Processing interval updated to ${intervalMinutes} minutes`,
                intervalMinutes: parseInt(intervalMinutes)
            });
        } catch (error) {
            console.error('[CCTV] Error updating interval:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัพเดท interval',
                error: error.message
            });
        }
    }

    // Get camera MJPEG video stream (for real-time video in <img> tag)
    // This endpoint doesn't require authentication - it's a proxy
    // Uses snapshot endpoint with fast refresh to simulate real-time stream
    async getVideoStream(req, res) {
        try {
            const cameraId = Number(req.query.cameraId ?? 0);
            const channel = 101; // Default Hikvision channel
            
            console.log(`[CCTV] getVideoStream called - cameraId: ${cameraId}, channel: ${channel}`);
            
            // Use digest-fetch for Digest Authentication
            const client = new DigestClient(
                this.cameraConfig.username,
                this.cameraConfig.password
            );
            
            const snapshotUrl = `${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/${channel}/picture`;
            
            // Set headers for MJPEG-like stream
            res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=--jpgboundary');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // Stream loop - fetch snapshot every 100ms to simulate real-time video
            const streamInterval = setInterval(async () => {
                try {
                    const response = await client.fetch(snapshotUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'image/jpeg'
                        }
                    });

                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        
                        if (buffer.length > 100 && !res.closed) {
                            // Send multipart frame
                            res.write(`--jpgboundary\r\n`);
                            res.write(`Content-Type: image/jpeg\r\n`);
                            res.write(`Content-Length: ${buffer.length}\r\n\r\n`);
                            res.write(buffer);
                            res.write(`\r\n`);
                        }
                    }
                } catch (error) {
                    console.error('[CCTV] Stream frame error:', error.message);
                    // Continue streaming even if one frame fails
                }
            }, 100); // 100ms = ~10 FPS
            
            // Handle client disconnect
            req.on('close', () => {
                console.log('[CCTV] Client disconnected from stream');
                clearInterval(streamInterval);
                if (!res.closed) {
                    res.end();
                }
            });
            
            req.on('error', (error) => {
                console.error('[CCTV] Request error:', error);
                clearInterval(streamInterval);
            });
            
        } catch (error) {
            console.error('[CCTV] Error getting video stream:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับกล้อง',
                    error: error.message
                });
            }
        }
    }

    // Get camera snapshot as JPEG image (for direct use in <img> tag)
    // This endpoint doesn't require authentication - it's a proxy
    async getSnapshotImage(req, res) {
        try {
            const cameraId = Number(req.query.cameraId ?? 0);
            const channel = 101; // Default Hikvision channel
            
            console.log(`[CCTV] getSnapshotImage called - cameraId: ${cameraId}, channel: ${channel}`);
            
            // Use digest-fetch for Digest Authentication
            const client = new DigestClient(
                this.cameraConfig.username,
                this.cameraConfig.password
            );
            
            const url = `${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/${channel}/picture`;
            console.log(`[CCTV] Fetching from: ${url}`);
            
            const response = await client.fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'image/jpeg'
                }
            });

            if (!response.ok) {
                console.error(`[CCTV] Camera error: ${response.status} ${response.statusText}`);
                // Return error image or JSON based on Accept header
                const acceptHeader = req.headers.accept || '';
                if (acceptHeader.includes('image/')) {
                    // If client expects image, send error as JSON
                    res.setHeader('Content-Type', 'application/json');
                    return res.status(response.status).json({
                        success: false,
                        message: 'ไม่สามารถดึงภาพจากกล้องได้',
                        error: `Camera returned ${response.status}`
                    });
                }
                return res.status(response.status).json({
                    success: false,
                    message: 'ไม่สามารถดึงภาพจากกล้องได้',
                    error: `Camera returned ${response.status}`
                });
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Check if it's actually an image
            if (buffer.length < 100) {
                console.error(`[CCTV] Response too small: ${buffer.length} bytes`);
                return res.status(500).json({
                    success: false,
                    message: 'ได้รับข้อมูลที่ไม่ถูกต้องจากกล้อง'
                });
            }

            console.log(`[CCTV] Success! Image size: ${buffer.length} bytes`);

            // Set headers for image
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // Send image buffer directly
            res.send(buffer);
        } catch (error) {
            console.error('[CCTV] Error getting snapshot image:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงภาพจากกล้อง',
                error: error.message
            });
        }
    }

    // Get camera snapshot as base64 (for JSON response)
    async getSnapshot(req, res) {
        try {
            const { cameraId = 0 } = req.query;
            
            console.log('[CCTV] getSnapshot called', { cameraId, baseUrl: this.cameraConfig.baseUrl });
            
            // Use Hikvision ISAPI endpoint based on http://192.168.24.1/doc/index.html#/preview
            // The #/preview is a frontend route, but the actual API endpoint is ISAPI
            const endpoints = [
                `/ISAPI/Streaming/channels/101/picture`, // Hikvision default channel (most common)
                `/ISAPI/Streaming/channels/${cameraId}01/picture`, // Hikvision API with channel ID
                `/ISAPI/Streaming/channels/1/picture`, // Alternative channel format
            ];

            let imageBuffer = null;
            let lastError = null;
            let lastStatusCode = null;

            // Try each endpoint until one works
            for (const endpoint of endpoints) {
                try {
                    const fullUrl = `${this.cameraConfig.baseUrl}${endpoint}`;
                    console.log(`[CCTV] Trying endpoint: ${fullUrl}`);
                    
                    // Use Digest Auth directly (server requires Digest)
                    console.log(`[CCTV] Using Digest Authentication...`);
                    const digestAuth = new DigestAuth(
                        this.cameraConfig.username,
                        this.cameraConfig.password
                    );
                    const response = await digestAuth.request('GET', fullUrl, {
                        responseType: 'arraybuffer',
                        timeout: 10000,
                        validateStatus: (status) => status < 500
                    });
                    lastStatusCode = response.status;
                    console.log(`[CCTV] Digest Auth response status: ${response.status} for ${fullUrl}`);

                    if (response.status === 200 && response.data) {
                        try {
                            imageBuffer = Buffer.from(response.data);
                            // Check if it's actually an image
                            if (imageBuffer.length > 100) {
                                console.log(`[CCTV] Success with endpoint: ${fullUrl}, image size: ${imageBuffer.length} bytes`);
                                break;
                            } else {
                                console.log(`[CCTV] Endpoint returned small buffer (${imageBuffer.length} bytes): ${fullUrl}`);
                            }
                        } catch (bufferError) {
                            console.error(`[CCTV] Error converting to buffer:`, bufferError.message);
                            lastError = bufferError;
                            continue;
                        }
                    } else {
                        console.log(`[CCTV] Endpoint returned status ${response.status}: ${fullUrl}`);
                        if (response.status === 401) {
                            lastError = new Error('Authentication failed - ตรวจสอบ username/password');
                        } else if (response.status === 404) {
                            lastError = new Error('Endpoint not found');
                        }
                    }
                } catch (error) {
                    lastError = error;
                    console.error(`[CCTV] Error with endpoint ${endpoint}:`, {
                        message: error.message,
                        code: error.code,
                        status: error.response?.status,
                        response: error.response?.data?.toString?.()?.substring(0, 200)
                    });
                    continue;
                }
            }

            if (!imageBuffer) {
                console.error('[CCTV] Failed to get image from all endpoints');
                console.error('[CCTV] Base URL:', this.cameraConfig.baseUrl);
                console.error('[CCTV] Username:', this.cameraConfig.username);
                console.error('[CCTV] Last error:', lastError?.message);
                console.error('[CCTV] Last status code:', lastStatusCode);
                
                // Check for specific error types
                let errorMessage = 'ไม่สามารถดึงภาพจากกล้องได้';
                let hint = 'ตรวจสอบว่า URL http://192.168.24.1/doc/index.html#/preview สามารถเข้าถึงได้';
                
                if (lastError?.code === 'ETIMEDOUT' || lastError?.code === 'ECONNREFUSED') {
                    errorMessage = 'ไม่สามารถเชื่อมต่อกับกล้องได้';
                    hint = 'ตรวจสอบการเชื่อมต่อเครือข่ายและ IP address ของกล้อง';
                } else if (lastStatusCode === 401) {
                    errorMessage = 'การยืนยันตัวตนล้มเหลว';
                    hint = 'ตรวจสอบ username และ password ในไฟล์ .env';
                } else if (lastStatusCode === 404) {
                    errorMessage = 'ไม่พบ API endpoint';
                    hint = 'ลองใช้คำสั่ง: npm run discover-cctv เพื่อค้นหา endpoint ที่ใช้งานได้';
                }
                
                return res.status(404).json({
                    success: false,
                    message: errorMessage,
                    error: lastError?.message || 'Camera endpoint not found',
                    hint: hint,
                    cameraUrl: `${this.cameraConfig.baseUrl}/doc/index.html#/preview`,
                    apiEndpoint: `${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/101/picture`,
                    lastStatusCode: lastStatusCode,
                    errorCode: lastError?.code
                });
            }

            // Convert to base64
            try {
                const base64Image = imageBuffer.toString('base64');
                const imageType = this.detectImageType(imageBuffer);

                console.log(`[CCTV] Successfully converted image to base64, type: ${imageType}, size: ${base64Image.length} chars`);

                res.json({
                    success: true,
                    data: {
                        image: `data:image/${imageType};base64,${base64Image}`,
                        timestamp: new Date().toISOString(),
                        cameraId: cameraId
                    }
                });
            } catch (convertError) {
                console.error('[CCTV] Error converting to base64:', convertError);
                throw convertError;
            }
        } catch (error) {
            console.error('[CCTV] Error getting CCTV snapshot:', {
                message: error.message,
                stack: error.stack,
                code: error.code
            });
            
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงภาพจากกล้อง',
                error: error.message,
                errorCode: error.code,
                hint: 'ตรวจสอบ backend logs สำหรับรายละเอียดเพิ่มเติม'
            });
        }
    }

    // Get camera snapshot as stream (for direct image display)
    async getSnapshotStream(req, res) {
        try {
            const { cameraId = 0 } = req.query;
            
            // Use Hikvision ISAPI endpoint based on http://192.168.24.1/doc/index.html#/preview
            // The #/preview is a frontend route, but the actual API endpoint is ISAPI
            const endpoints = [
                `/ISAPI/Streaming/channels/101/picture`, // Hikvision default channel (most common)
                `/ISAPI/Streaming/channels/${cameraId}01/picture`, // Hikvision API with channel ID
                `/ISAPI/Streaming/channels/1/picture`, // Alternative channel format
            ];

            let success = false;
            let lastError = null;
            let triedEndpoints = [];

            for (const endpoint of endpoints) {
                try {
                    const fullUrl = `${this.cameraConfig.baseUrl}${endpoint}`;
                    console.log(`[CCTV] Trying endpoint: ${fullUrl}`);
                    triedEndpoints.push(fullUrl);

                    // Use Digest Auth (server requires Digest)
                    const digestAuth = new DigestAuth(
                        this.cameraConfig.username,
                        this.cameraConfig.password
                    );
                    const response = await digestAuth.request('GET', fullUrl, {
                        responseType: 'stream',
                        timeout: 10000,
                        validateStatus: (status) => status < 500
                    });

                    if (response.status === 200) {
                        console.log(`[CCTV] Success with endpoint: ${fullUrl}`);
                        // Set headers for image
                        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        res.setHeader('Access-Control-Allow-Origin', '*');
                        
                        response.data.on('error', (err) => {
                            console.error('[CCTV] Stream error:', err);
                            if (!res.headersSent) {
                                res.status(500).json({
                                    success: false,
                                    message: 'เกิดข้อผิดพลาดในการส่งภาพ',
                                    error: err.message
                                });
                            }
                        });
                        
                        response.data.pipe(res);
                        success = true;
                        break;
                    } else {
                        console.log(`[CCTV] Endpoint returned status ${response.status}: ${fullUrl}`);
                    }
                } catch (error) {
                    lastError = error;
                    console.error(`[CCTV] Error with endpoint ${endpoint}:`, error.message);
                    continue;
                }
            }

            if (!success) {
                console.error('[CCTV] All endpoints failed. Last error:', lastError?.message);
                console.error('[CCTV] Tried endpoints:', triedEndpoints);
                console.error('[CCTV] Base URL:', this.cameraConfig.baseUrl);
                console.error('[CCTV] Camera URL:', `${this.cameraConfig.baseUrl}/doc/index.html#/preview`);
                
                // Return error as JSON if headers not sent
                if (!res.headersSent) {
                    res.status(404).json({
                        success: false,
                        message: 'ไม่สามารถดึงภาพจากกล้องได้',
                        error: lastError?.message || 'Camera endpoint not found',
                        hint: 'ตรวจสอบว่า URL http://192.168.24.1/doc/index.html#/preview สามารถเข้าถึงได้ และใช้ endpoint /ISAPI/Streaming/channels/101/picture',
                        triedEndpoints: triedEndpoints,
                        cameraUrl: `${this.cameraConfig.baseUrl}/doc/index.html#/preview`,
                        apiEndpoint: `${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/101/picture`,
                        cameraConfig: {
                            baseUrl: this.cameraConfig.baseUrl,
                            username: this.cameraConfig.username,
                            hasPassword: !!this.cameraConfig.password
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[CCTV] Error streaming CCTV snapshot:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการดึงภาพจากกล้อง',
                    error: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }
    }

    // Detect image type from buffer
    detectImageType(buffer) {
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            return 'jpeg';
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
            return 'png';
        } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
            return 'gif';
        }
        return 'jpeg'; // Default
    }

    // Discover available endpoints
    async discoverEndpoints(req, res) {
        try {
            const snapshotEndpoints = [
                '/ISAPI/Streaming/channels/101/picture',
                '/ISAPI/Streaming/channels/1/picture',
                '/ISAPI/Streaming/channels/001/picture',
                '/ISAPI/Streaming/channels/201/picture',
                '/snapshot.jpg',
                '/snapshot.cgi',
                '/cgi-bin/snapshot.cgi',
                '/doc/page/snapshot.cgi',
                '/api/snapshot',
                '/video.cgi',
                '/image.jpg'
            ];

            const infoEndpoints = [
                '/ISAPI/System/deviceInfo',
                '/ISAPI/System/status',
                '/doc/page/login.asp',
                '/api/system/info'
            ];

            const results = {
                baseUrl: this.cameraConfig.baseUrl,
                cameraUrl: `${this.cameraConfig.baseUrl}/doc/index.html#/preview`,
                username: this.cameraConfig.username,
                snapshotEndpoints: [],
                infoEndpoints: [],
                cameraType: 'Unknown'
            };

            // Test info endpoints
            for (const endpoint of infoEndpoints) {
                try {
                    const response = await axios.get(`${this.cameraConfig.baseUrl}${endpoint}`, {
                        auth: {
                            username: this.cameraConfig.username,
                            password: this.cameraConfig.password
                        },
                        timeout: 3000,
                        validateStatus: () => true
                    });

                    if (response.status === 200 || response.status === 401) {
                        results.infoEndpoints.push({
                            endpoint,
                            status: response.status,
                            contentType: response.headers['content-type']
                        });

                        if (endpoint.includes('ISAPI')) {
                            results.cameraType = 'Hikvision';
                        } else if (endpoint.includes('doc')) {
                            results.cameraType = 'Hikvision (Web Interface)';
                        }
                    }
                } catch (error) {
                    // Continue to next endpoint
                }
            }

            // Test snapshot endpoints
            for (const endpoint of snapshotEndpoints) {
                try {
                    const response = await axios.get(`${this.cameraConfig.baseUrl}${endpoint}`, {
                        auth: {
                            username: this.cameraConfig.username,
                            password: this.cameraConfig.password
                        },
                        responseType: 'arraybuffer',
                        timeout: 5000,
                        validateStatus: (status) => status < 500
                    });

                    if (response.status === 200 && response.data) {
                        const isImage = response.headers['content-type']?.startsWith('image/') ||
                                       (response.data[0] === 0xFF && response.data[1] === 0xD8); // JPEG header

                        if (isImage && response.data.length > 100) {
                            results.snapshotEndpoints.push({
                                endpoint,
                                status: response.status,
                                contentType: response.headers['content-type'],
                                size: response.data.length,
                                url: `${this.cameraConfig.baseUrl}${endpoint}`
                            });
                        }
                    }
                } catch (error) {
                    // Continue to next endpoint
                }
            }

            // Sort by size (larger images are usually better)
            results.snapshotEndpoints.sort((a, b) => b.size - a.size);

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('Error discovering endpoints:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการค้นหา endpoints',
                error: error.message
            });
        }
    }

    // Test camera connection
    async testConnection(req, res) {
        try {
            const results = {
                baseUrl: this.cameraConfig.baseUrl,
                username: this.cameraConfig.username,
                hasPassword: !!this.cameraConfig.password,
                tests: {}
            };

            // Test 1: Basic connectivity
            try {
                const response = await axios.get(this.cameraConfig.baseUrl, {
                    timeout: 5000,
                    validateStatus: () => true
                });
                results.tests.basicConnectivity = {
                    success: true,
                    status: response.status,
                    message: 'เชื่อมต่อได้'
                };
            } catch (error) {
                results.tests.basicConnectivity = {
                    success: false,
                    error: error.message,
                    code: error.code,
                    message: error.code === 'ETIMEDOUT' ? 'Timeout - ไม่สามารถเชื่อมต่อได้' :
                            error.code === 'ECONNREFUSED' ? 'Connection Refused - ไม่มี service' :
                            error.code === 'ENOTFOUND' ? 'Host Not Found' : 'เกิดข้อผิดพลาด'
                };
            }

            // Test 2: Authentication
            try {
                const response = await axios.get(`${this.cameraConfig.baseUrl}/ISAPI/System/deviceInfo`, {
                    auth: {
                        username: this.cameraConfig.username,
                        password: this.cameraConfig.password
                    },
                    timeout: 5000,
                    validateStatus: () => true
                });
                results.tests.authentication = {
                    success: response.status === 200,
                    status: response.status,
                    message: response.status === 200 ? 'Authentication สำเร็จ' :
                            response.status === 401 ? 'Authentication ล้มเหลว - ตรวจสอบ username/password' :
                            'Status: ' + response.status
                };
            } catch (error) {
                results.tests.authentication = {
                    success: false,
                    error: error.message,
                    code: error.code,
                    message: 'ไม่สามารถทดสอบ authentication ได้'
                };
            }

            // Test 3: Snapshot endpoint
            try {
                const response = await axios.get(`${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/101/picture`, {
                    auth: {
                        username: this.cameraConfig.username,
                        password: this.cameraConfig.password
                    },
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                });

                if (response.status === 200 && response.data) {
                    const buffer = Buffer.from(response.data);
                    const isImage = buffer[0] === 0xFF && buffer[1] === 0xD8;
                    results.tests.snapshot = {
                        success: isImage && buffer.length > 1000,
                        status: response.status,
                        size: buffer.length,
                        isImage: isImage,
                        message: isImage && buffer.length > 1000 ? 
                                `ดึงภาพสำเร็จ (${buffer.length} bytes)` :
                                'ได้ response แต่ไม่ใช่ภาพ'
                    };
                } else {
                    results.tests.snapshot = {
                        success: false,
                        status: response.status,
                        message: `Status: ${response.status}`
                    };
                }
            } catch (error) {
                results.tests.snapshot = {
                    success: false,
                    error: error.message,
                    code: error.code,
                    message: 'ไม่สามารถดึงภาพได้'
                };
            }

            // Overall status
            const allTestsPassed = results.tests.basicConnectivity?.success &&
                                  results.tests.authentication?.success &&
                                  results.tests.snapshot?.success;

            res.json({
                success: true,
                data: results,
                overallStatus: allTestsPassed ? 'connected' : 'partial',
                message: allTestsPassed ? 'การเชื่อมต่อสำเร็จทั้งหมด' : 'มีบางส่วนที่ยังไม่สำเร็จ'
            });
        } catch (error) {
            console.error('Error testing connection:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการทดสอบการเชื่อมต่อ',
                error: error.message
            });
        }
    }

    // Get camera info
    async getCameraInfo(req, res) {
        try {
            res.json({
                success: true,
                data: {
                    baseUrl: this.cameraConfig.baseUrl,
                    cameraUrl: `${this.cameraConfig.baseUrl}/doc/index.html#/preview`,
                    username: this.cameraConfig.username,
                    hasPassword: !!this.cameraConfig.password,
                    recommendedEndpoint: '/ISAPI/Streaming/channels/101/picture',
                    fullUrl: `${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/101/picture`
                }
            });
        } catch (error) {
            console.error('Error getting camera info:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }
}

module.exports = new CCTVController();

