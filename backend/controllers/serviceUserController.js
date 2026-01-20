const { pool } = require('../config/database');
const DigestAuth = require('../utils/digestAuth');
const fs = require('fs').promises;
const path = require('path');

class ServiceUserController {
    /**
     * Get current service users (ผู้ใช้เข้าใช้บริการปัจจุบัน)
     * ดึงข้อมูลจากตาราง service_access_logs หรือ face scanner
     */
    async getCurrentServiceUsers(req, res) {
        try {
            const { device = 'all', page = 1, limit = 15 } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Check if service_access_logs table exists, if not create it
            try {
                await this.ensureServiceAccessLogsTable();
            } catch (tableError) {
                console.error('Error creating table:', tableError);
                // Continue anyway, table might exist
            }

            // First check if table exists and has data
            let query = `
                SELECT 
                    sal.*,
                    u.name as user_name,
                    u.surname as user_surname,
                    u.prefix_name,
                    u.personnel_type,
                    u.image as user_image,
                    d.name as device_name,
                    d.camera_id
                FROM service_access_logs sal
                LEFT JOIN users u ON sal.user_id = u.id
                LEFT JOIN devices d ON sal.device_id = d.id
                WHERE sal.exit_time IS NULL
            `;

            const params = [];

            if (device && device !== 'all') {
                query += ' AND d.name LIKE ?';
                params.push(`%${device}%`);
            }

            query += ' ORDER BY sal.entry_time DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), offset);

            let rows = [];
            let querySucceeded = false;
            try {
                const [result] = await pool.query(query, params);
                rows = result || [];
                querySucceeded = true;
                console.log(`[ServiceUserController] Database query returned ${rows.length} rows`);
            } catch (queryError) {
                // If table doesn't exist or query fails, try to get processed images
                console.error('[ServiceUserController] Query error (table might not exist yet):', queryError.message);
                querySucceeded = false;
                // Don't return yet, try to get processed images instead
            }

            // If no data or query failed, try to get images from processed images
            if (!querySucceeded || !rows || rows.length === 0) {
                try {
                    console.log('[ServiceUserController] No database records, trying to get processed images...');
                    // Get images from Image Processing storage
                    const processedImages = await this.getCCTVImagesForCurrentUsers();
                    
                    console.log(`[ServiceUserController] Found ${processedImages ? processedImages.length : 0} processed images`);
                    
                    if (processedImages && processedImages.length > 0) {
                        console.log('[ServiceUserController] Returning processed images');
                        return res.json({
                            success: true,
                            data: processedImages,
                            pagination: {
                                page: parseInt(page),
                                limit: parseInt(limit),
                                total: processedImages.length,
                                totalPages: Math.ceil(processedImages.length / parseInt(limit))
                            }
                        });
                    } else {
                        console.log('[ServiceUserController] No processed images found');
                    }
                } catch (cctvError) {
                    console.error('[ServiceUserController] Error getting processed images:', cctvError);
                    console.error('[ServiceUserController] Error stack:', cctvError.stack);
                    // Continue to return empty array
                }
                
                return res.json({
                    success: true,
                    data: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        totalPages: 0
                    }
                });
            }

            // Get total count
            let total = 0;
            try {
                let countQuery = `
                    SELECT COUNT(*) as total 
                    FROM service_access_logs sal
                    LEFT JOIN devices d ON sal.device_id = d.id
                    WHERE sal.exit_time IS NULL
                `;
                const countParams = [];

                if (device && device !== 'all') {
                    countQuery += ' AND d.name LIKE ?';
                    countParams.push(`%${device}%`);
                }

                const [countRows] = await pool.query(countQuery, countParams);
                total = countRows[0] ? countRows[0].total : 0;
            } catch (countError) {
                console.error('Count query error:', countError.message);
                total = 0;
            }

            // Process images for each user (skip CCTV for now to avoid timeout)
            const processedRows = rows.map((row) => {
                // Use user image if available, otherwise null
                // Note: CCTV image fetching is disabled to avoid timeout issues
                // You can enable it later if needed
                const displayImage = row.user_image || null;

                return {
                    id: row.id,
                    date_time: row.entry_time,
                    image: displayImage,
                    name: row.user_name || 'Unknown',
                    surname: row.user_surname || '',
                    full_name: `${row.prefix_name || ''} ${row.user_name || 'Unknown'} ${row.user_surname || ''}`.trim(),
                    personnel_type: row.personnel_type || 'ไม่ทราบข้อมูล',
                    door: row.device_name || 'ไม่ทราบข้อมูล',
                    camera_id: row.camera_id,
                    entry_time: row.entry_time
                };
            });

            res.json({
                success: true,
                data: processedRows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('Error getting current service users:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    /**
     * Get processed images from Image Processing storage (when no database records)
     * ดึงภาพจาก Image Processing ที่เก็บไว้ใน storage/processed_images
     */
    async getCCTVImagesForCurrentUsers() {
        try {
            // Use path.resolve for absolute path
            const processedImagesPath = path.resolve(__dirname, '../storage/processed_images');
            console.log(`[ServiceUserController] Reading processed images from: ${processedImagesPath}`);
            console.log(`[ServiceUserController] __dirname: ${__dirname}`);
            
            // Check if directory exists
            try {
                await fs.access(processedImagesPath);
                console.log(`[ServiceUserController] Directory exists: ${processedImagesPath}`);
            } catch (accessError) {
                console.error(`[ServiceUserController] Directory does not exist: ${processedImagesPath}`);
                console.error(`[ServiceUserController] Access error:`, accessError.message);
                return [];
            }
            
            // Read all files in processed_images directory
            const files = await fs.readdir(processedImagesPath);
            console.log(`[ServiceUserController] Found ${files.length} files in directory`);
            console.log(`[ServiceUserController] First 10 files:`, files.slice(0, 10));
            
            // Filter only .jpg files and sort by filename (timestamp) descending
            const imageFiles = files
                .filter(file => {
                    const isJpg = file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg');
                    const startsWithProcessed = file.toLowerCase().startsWith('processed_');
                    return isJpg && startsWithProcessed;
                })
                .sort()
                .reverse(); // Latest first
            
            console.log(`[ServiceUserController] Found ${imageFiles.length} processed image files`);
            if (imageFiles.length > 0) {
                console.log(`[ServiceUserController] First 5 image files:`, imageFiles.slice(0, 5));
            }
            
            if (imageFiles.length === 0) {
                console.log('[ServiceUserController] No processed images found');
                return [];
            }
            
            // Get latest 5 images
            const latestImages = imageFiles.slice(0, 5);
            const images = [];
            
            console.log(`[ServiceUserController] Processing ${latestImages.length} latest images`);
            
            for (const imageFile of latestImages) {
                try {
                    console.log(`[ServiceUserController] Processing image: ${imageFile}`);
                    
                    // Extract timestamp from filename (processed_1767863477626.jpg)
                    const timestampMatch = imageFile.match(/processed_(\d+)\.jpg/);
                    const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : Date.now();
                    
                    // Read corresponding metadata file if exists
                    const metadataFile = imageFile.replace('.jpg', '.json');
                    let metadata = null;
                    let entryTime = new Date(timestamp); // Default to filename timestamp
                    
                    try {
                        const metadataPath = path.join(processedImagesPath, metadataFile);
                        const metadataContent = await fs.readFile(metadataPath, 'utf8');
                        metadata = JSON.parse(metadataContent);
                        
                        // Use timestamp from metadata if available
                        if (metadata.timestamp) {
                            entryTime = new Date(metadata.timestamp);
                        }
                    } catch (metadataError) {
                        // Metadata file might not exist, use filename timestamp
                        console.log(`[ServiceUserController] No metadata file for ${imageFile}, using filename timestamp`);
                    }
                    
                    // Create image URL (served via static file)
                    const imageUrl = `/processed-images/${imageFile}`;
                    
                    // Verify file exists
                    const imageFilePath = path.join(processedImagesPath, imageFile);
                    try {
                        await fs.access(imageFilePath);
                    } catch (accessError) {
                        console.error(`[ServiceUserController] Image file does not exist: ${imageFilePath}`);
                        continue; // Skip this image
                    }
                    
                    const imageData = {
                        id: `processed_${timestamp}`,
                        date_time: entryTime.toISOString(),
                        image: imageUrl, // Use URL instead of base64
                        name: 'Unknown',
                        surname: '',
                        full_name: 'Unknown',
                        personnel_type: 'ไม่ทราบข้อมูล',
                        door: 'PeopleCam/CAM-F-02',
                        camera_id: 'CAM-F-02',
                        entry_time: entryTime.toISOString(),
                        metadata: metadata
                    };
                    
                    images.push(imageData);
                    console.log(`[ServiceUserController] Added image: ${imageFile} with URL: ${imageUrl}`);
                } catch (fileError) {
                    console.error(`[ServiceUserController] Error processing image file ${imageFile}:`, fileError.message);
                    console.error(`[ServiceUserController] Error stack:`, fileError.stack);
                    // Continue to next file
                }
            }
            
            console.log(`[ServiceUserController] Returning ${images.length} images`);
            if (images.length > 0) {
                console.log(`[ServiceUserController] Sample image data:`, JSON.stringify(images[0], null, 2));
            }
            return images;
        } catch (error) {
            console.error('[ServiceUserController] Error getting processed images for current users:', error);
            console.error('[ServiceUserController] Error message:', error.message);
            console.error('[ServiceUserController] Error stack:', error.stack);
            return [];
        }
    }

    /**
     * Get processed image from CCTV camera
     */
    async getProcessedImageFromCCTV(cameraId) {
        try {
            const cameraConfig = {
                baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
                username: process.env.CCTV_USERNAME || 'admin',
                password: process.env.CCTV_PASSWORD || 'L@nnac0m'
            };

            const digestAuth = new DigestAuth(
                cameraConfig.username,
                cameraConfig.password
            );

            const url = `${cameraConfig.baseUrl}/ISAPI/Streaming/channels/101/picture`;
            const response = await digestAuth.request('GET', url, {
                responseType: 'arraybuffer',
                timeout: 10000,
                validateStatus: (status) => status < 500
            });

            if (response.status !== 200 || !response.data) {
                throw new Error(`Camera returned ${response.status}`);
            }

            const imageBuffer = Buffer.from(response.data);

            // Check if it's actually an image
            if (imageBuffer.length < 100) {
                throw new Error(`Image too small: ${imageBuffer.length} bytes`);
            }

            // Basic image processing: convert to base64
            // Note: For advanced processing (resize, grayscale), you would need sharp or canvas
            // For now, we'll return the image as-is but in base64 format
            const base64Image = imageBuffer.toString('base64');
            return `data:image/jpeg;base64,${base64Image}`;
        } catch (error) {
            console.error('Error processing image from CCTV:', error);
            throw error;
        }
    }

    /**
     * Ensure service_access_logs table exists
     */
    async ensureServiceAccessLogsTable() {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS service_access_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    device_id INT,
                    entry_time DATETIME NOT NULL,
                    exit_time DATETIME NULL,
                    camera_id VARCHAR(255),
                    image_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_device_id (device_id),
                    INDEX idx_entry_time (entry_time),
                    INDEX idx_exit_time (exit_time)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('[ServiceUserController] service_access_logs table ensured');
        } catch (error) {
            console.error('Error ensuring service_access_logs table:', error);
            console.error('Error details:', error.message, error.stack);
            // Table might already exist, continue
            throw error; // Re-throw to see the actual error
        }
    }

    /**
     * Server-Sent Events endpoint for real-time updates
     * Send updates when someone enters the area
     */
    subscribeToUpdates(req, res) {
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to service users updates' })}\n\n`);
        
        // Store this connection
        if (!this.sseConnections) {
            this.sseConnections = [];
        }
        this.sseConnections.push(res);
        
        console.log(`[ServiceUserController] SSE client connected. Total connections: ${this.sseConnections.length}`);
        
        // Start watching for new processed images if not already started
        if (!this.imageWatcherInterval) {
            this.startWatchingProcessedImages();
        }
        
        // Remove connection when client disconnects
        req.on('close', () => {
            const index = this.sseConnections.indexOf(res);
            if (index > -1) {
                this.sseConnections.splice(index, 1);
            }
            console.log(`[ServiceUserController] SSE client disconnected. Remaining connections: ${this.sseConnections.length}`);
            res.end();
        });
    }
    
    /**
     * Broadcast update to all connected clients
     */
    broadcastUpdate(data) {
        if (!this.sseConnections || this.sseConnections.length === 0) return;
        
        const message = `data: ${JSON.stringify(data)}\n\n`;
        const connectionsToRemove = [];
        
        this.sseConnections.forEach((client, index) => {
            try {
                if (client.writable) {
                    client.write(message);
                } else {
                    connectionsToRemove.push(index);
                }
            } catch (error) {
                console.error('[ServiceUserController] Error sending SSE message:', error);
                connectionsToRemove.push(index);
            }
        });
        
        // Remove broken connections
        connectionsToRemove.reverse().forEach(index => {
            this.sseConnections.splice(index, 1);
        });
    }
    
    /**
     * Watch for new processed images and broadcast updates
     */
    startWatchingProcessedImages() {
        // Only start watching once
        if (this.imageWatcherInterval) {
            return;
        }
        
        const processedImagesPath = path.resolve(__dirname, '../storage/processed_images');
        let lastCheckTime = Date.now();
        
        console.log('[ServiceUserController] Starting to watch for new processed images...');
        
        // Check for new files every 2 seconds
        this.imageWatcherInterval = setInterval(async () => {
            try {
                const files = await fs.readdir(processedImagesPath);
                const imageFiles = files
                    .filter(file => {
                        const isJpg = file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg');
                        const startsWithProcessed = file.toLowerCase().startsWith('processed_');
                        return isJpg && startsWithProcessed;
                    })
                    .map(file => {
                        const timestampMatch = file.match(/processed_(\d+)\.jpg/i);
                        return {
                            file,
                            timestamp: timestampMatch ? parseInt(timestampMatch[1]) : 0
                        };
                    })
                    .filter(item => item.timestamp > lastCheckTime)
                    .sort((a, b) => b.timestamp - a.timestamp);
                
                if (imageFiles.length > 0) {
                    console.log(`[ServiceUserController] Found ${imageFiles.length} new processed images`);
                    lastCheckTime = Math.max(...imageFiles.map(f => f.timestamp), lastCheckTime);
                    
                    // Broadcast update to all connected clients
                    this.broadcastUpdate({
                        type: 'new_entry',
                        message: 'มีคนเข้าพื้นที่',
                        timestamp: new Date().toISOString(),
                        imageCount: imageFiles.length
                    });
                }
            } catch (error) {
                console.error('[ServiceUserController] Error watching processed images:', error);
            }
        }, 2000); // Check every 2 seconds
    }
    
    /**
     * Log service entry (called when user enters)
     */
    async logServiceEntry(req, res) {
        try {
            const { user_id, device_id, camera_id, image_data } = req.body;

            await this.ensureServiceAccessLogsTable();

            const [result] = await pool.query(
                `INSERT INTO service_access_logs (user_id, device_id, entry_time, camera_id, image_data)
                 VALUES (?, ?, NOW(), ?, ?)`,
                [user_id, device_id, camera_id, image_data]
            );

            // Broadcast update to all connected clients
            this.broadcastUpdate({
                type: 'new_entry',
                message: 'มีคนเข้าพื้นที่',
                data: { id: result.insertId, user_id, device_id }
            });

            res.json({
                success: true,
                message: 'บันทึกการเข้าใช้บริการสำเร็จ',
                data: { id: result.insertId }
            });
        } catch (error) {
            console.error('Error logging service entry:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการบันทึก',
                error: error.message
            });
        }
    }

    /**
     * Log service exit (called when user exits)
     */
    async logServiceExit(req, res) {
        try {
            const { user_id, device_id } = req.body;

            await this.ensureServiceAccessLogsTable();

            const [result] = await pool.query(
                `UPDATE service_access_logs 
                 SET exit_time = NOW() 
                 WHERE user_id = ? AND device_id = ? AND exit_time IS NULL
                 ORDER BY entry_time DESC LIMIT 1`,
                [user_id, device_id]
            );

            res.json({
                success: true,
                message: 'บันทึกการออกจากบริการสำเร็จ',
                data: { affectedRows: result.affectedRows }
            });
        } catch (error) {
            console.error('Error logging service exit:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการบันทึก',
                error: error.message
            });
        }
    }
}

module.exports = new ServiceUserController();

