const { DigestClient } = require('digest-fetch');
const fs = require('fs').promises;
const path = require('path');

/**
 * Image Processing Service
 * 
 * หน้าที่:
 * 1. ดึงภาพนิ่ง (snapshot) จากกล้อง CCTV ทุกๆ 1-5 นาที
 * 2. ทำ image processing (เช่น object detection, motion detection, face recognition)
 * 3. บันทึกผลลัพธ์หรือแจ้งเตือน
 * 
 * วิธีทำงาน:
 * - ใช้ setInterval หรือ node-cron สำหรับ scheduling
 * - ดึงภาพจาก snapshot endpoint (ไม่ใช่ stream)
 * - Process ภาพด้วย library เช่น sharp, opencv, tensorflow
 * - บันทึกผลลัพธ์หรือส่ง notification
 */

class ImageProcessingService {
    constructor(cameraConfig) {
        this.cameraConfig = cameraConfig;
        this.digestClient = new DigestClient(
            cameraConfig.username,
            cameraConfig.password
        );
        this.processingInterval = null;
        this.isProcessing = false;
        
        // Configuration
        this.config = {
            intervalMinutes: 5, // Process ทุก 5 นาที (ปรับได้ 1-5 นาที)
            snapshotEndpoint: cameraConfig.snapshotEndpoint || '/ISAPI/Streaming/channels/101/picture',
            saveProcessedImages: true, // บันทึกภาพที่ process แล้ว
            savePath: path.join(__dirname, '../storage/processed_images'),
            enableProcessing: true, // เปิด/ปิด image processing
            lastProcessedTime: null, // เวลาที่ process ล่าสุด
            lastResults: null, // ผลลัพธ์ล่าสุด
            processingCount: 0, // จำนวนครั้งที่ process แล้ว
            errorCount: 0 // จำนวนครั้งที่เกิด error
        };
    }

    /**
     * ดึงภาพนิ่งจากกล้อง
     * @returns {Promise<Buffer>} Image buffer
     */
    async fetchSnapshot() {
        try {
            const url = `${this.cameraConfig.baseUrl}${this.config.snapshotEndpoint}`;
            console.log(`[ImageProcessing] Fetching snapshot from: ${url}`);
            
            const response = await this.digestClient.fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'image/jpeg',
                    'Connection': 'keep-alive'
                },
                timeout: 10000 // 10 seconds timeout
            });

            if (!response.ok) {
                throw new Error(`Camera returned ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // ตรวจสอบว่าเป็น JPEG image (เริ่มต้นด้วย FF D8 FF)
            if (buffer.length < 100) {
                throw new Error(`Image too small: ${buffer.length} bytes`);
            }

            // Verify it's a valid JPEG
            const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
            if (!isJPEG) {
                console.warn('[ImageProcessing] Warning: Response might not be a valid JPEG image');
            }

            console.log(`[ImageProcessing] Snapshot fetched: ${buffer.length} bytes (JPEG: ${isJPEG ? 'Yes' : 'No'})`);
            return buffer;
        } catch (error) {
            console.error('[ImageProcessing] Error fetching snapshot:', error.message);
            throw new Error(`Failed to fetch snapshot: ${error.message}`);
        }
    }

    /**
     * ทำ Image Processing
     * @param {Buffer} imageBuffer - ภาพที่ดึงมาจากกล้อง
     * @returns {Promise<Object>} ผลลัพธ์จากการ process
     */
    async processImage(imageBuffer) {
        try {
            console.log('[ImageProcessing] Starting image processing...');
            
            // ตัวอย่าง Image Processing Tasks:
            const results = {
                timestamp: new Date().toISOString(),
                imageSize: imageBuffer.length,
                processing: {}
            };

            // 1. Motion Detection (เปรียบเทียบกับภาพก่อนหน้า)
            // results.processing.motionDetected = await this.detectMotion(imageBuffer);
            
            // 2. Object Detection (ตรวจจับวัตถุ เช่น คน, รถ)
            // results.processing.objects = await this.detectObjects(imageBuffer);
            
            // 3. Face Recognition (จดจำใบหน้า)
            // results.processing.faces = await this.recognizeFaces(imageBuffer);
            
            // 4. People Counting (นับจำนวนคน)
            // results.processing.peopleCount = await this.countPeople(imageBuffer);
            
            // 5. Anomaly Detection (ตรวจจับสิ่งผิดปกติ)
            // results.processing.anomalies = await this.detectAnomalies(imageBuffer);
            
            // ตัวอย่าง: วิเคราะห์ความสว่างของภาพ
            results.processing.brightness = await this.analyzeBrightness(imageBuffer);
            
            console.log('[ImageProcessing] Processing completed:', results);
            return results;
        } catch (error) {
            console.error('[ImageProcessing] Error processing image:', error);
            throw error;
        }
    }

    /**
     * วิเคราะห์ความสว่างของภาพ (ตัวอย่างง่ายๆ)
     */
    async analyzeBrightness(imageBuffer) {
        try {
            // ตัวอย่างง่ายๆ: วิเคราะห์ขนาดไฟล์ (ภาพสว่างมักมีขนาดใหญ่กว่า)
            // ในอนาคตสามารถใช้ sharp หรือ opencv เพื่อวิเคราะห์ความสว่างจริงๆ
            const fileSize = imageBuffer.length;
            let brightnessLevel = 'medium';
            
            if (fileSize > 100000) {
                brightnessLevel = 'bright';
            } else if (fileSize < 30000) {
                brightnessLevel = 'dark';
            }
            
            return {
                level: brightnessLevel,
                fileSize: fileSize,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ImageProcessing] Error analyzing brightness:', error);
            return {
                level: 'unknown',
                fileSize: imageBuffer.length,
                error: error.message
            };
        }
    }

    /**
     * Motion Detection (ตัวอย่าง - ต้องเปรียบเทียบกับภาพก่อนหน้า)
     */
    async detectMotion(currentImage) {
        // TODO: เปรียบเทียบกับภาพก่อนหน้า
        // ใช้ library เช่น opencv หรือ sharp
        return {
            detected: false,
            confidence: 0
        };
    }

    /**
     * Object Detection (ตัวอย่าง - ต้องใช้ AI model)
     */
    async detectObjects(imageBuffer) {
        // TODO: ใช้ TensorFlow.js, YOLO, หรือ COCO-SSD
        // const model = await tf.loadLayersModel('path/to/model');
        // const predictions = await model.predict(imageBuffer);
        return [];
    }

    /**
     * Face Recognition (ตัวอย่าง - ต้องใช้ face-api.js หรือ similar)
     */
    async recognizeFaces(imageBuffer) {
        // TODO: ใช้ face-api.js หรือ face-recognition
        return [];
    }

    /**
     * People Counting (ตัวอย่าง - ใช้ object detection + filtering)
     */
    async countPeople(imageBuffer) {
        // TODO: ใช้ object detection แล้ว filter เฉพาะ 'person' class
        return 0;
    }

    /**
     * Anomaly Detection (ตัวอย่าง - ตรวจจับสิ่งผิดปกติ)
     */
    async detectAnomalies(imageBuffer) {
        // TODO: ใช้ AI model สำหรับ anomaly detection
        return [];
    }

    /**
     * บันทึกภาพที่ process แล้ว
     */
    async saveProcessedImage(imageBuffer, results) {
        if (!this.config.saveProcessedImages) return;

        try {
            // สร้างโฟลเดอร์ถ้ายังไม่มี
            await fs.mkdir(this.config.savePath, { recursive: true });
            
            // บันทึกภาพ
            const filename = `processed_${Date.now()}.jpg`;
            const filepath = path.join(this.config.savePath, filename);
            await fs.writeFile(filepath, imageBuffer);
            
            // บันทึก metadata
            const metadataPath = path.join(this.config.savePath, `metadata_${Date.now()}.json`);
            await fs.writeFile(metadataPath, JSON.stringify(results, null, 2));
            
            console.log(`[ImageProcessing] Saved processed image: ${filepath}`);
        } catch (error) {
            console.error('[ImageProcessing] Error saving processed image:', error);
        }
    }

    /**
     * ส่ง Notification (ตัวอย่าง - email, LINE, webhook)
     */
    async sendNotification(results) {
        // ตัวอย่าง: ส่ง notification เมื่อพบ motion หรือ anomaly
        if (results.processing.motionDetected || results.processing.anomalies?.length > 0) {
            console.log('[ImageProcessing] Sending notification...');
            // TODO: ส่ง email, LINE Notify, หรือ webhook
        }
    }

    /**
     * งานหลัก: ดึงภาพ -> Process -> บันทึก/แจ้งเตือน
     */
    async processSnapshot() {
        if (this.isProcessing) {
            console.log('[ImageProcessing] Already processing, skipping...');
            return;
        }

        this.isProcessing = true;
        const startTime = Date.now();

        try {
            // 1. ดึงภาพนิ่งจากกล้อง
            const imageBuffer = await this.fetchSnapshot();
            
            // 2. ทำ Image Processing
            const results = await this.processImage(imageBuffer);
            
            // 3. บันทึกภาพ (ถ้าต้องการ)
            await this.saveProcessedImage(imageBuffer, results);
            
            // 4. ส่ง Notification (ถ้ามีเหตุการณ์สำคัญ)
            await this.sendNotification(results);
            
            // 5. อัปเดตสถานะ
            this.config.lastProcessedTime = new Date().toISOString();
            this.config.lastResults = results;
            this.config.processingCount++;
            
            const duration = Date.now() - startTime;
            console.log(`[ImageProcessing] Completed in ${duration}ms (Total: ${this.config.processingCount} times)`);
        } catch (error) {
            console.error('[ImageProcessing] Error in processSnapshot:', error);
            this.config.errorCount++;
            
            // Log error details
            const errorInfo = {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack
            };
            console.error('[ImageProcessing] Error details:', errorInfo);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * เริ่มต้น Image Processing Loop
     * @param {number} intervalMinutes - ระยะเวลาระหว่างการ process (1-5 นาที)
     */
    start(intervalMinutes = 5) {
        if (this.processingInterval) {
            console.log('[ImageProcessing] Already running');
            return;
        }

        this.config.intervalMinutes = Math.max(1, Math.min(5, intervalMinutes));
        const intervalMs = this.config.intervalMinutes * 60 * 1000;

        console.log(`[ImageProcessing] Starting image processing service (every ${this.config.intervalMinutes} minutes)`);
        
        // Process ทันทีครั้งแรก
        this.processSnapshot();
        
        // แล้ว process ทุกๆ X นาที
        this.processingInterval = setInterval(() => {
            this.processSnapshot();
        }, intervalMs);
    }

    /**
     * หยุด Image Processing Loop
     */
    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            this.isProcessing = false;
            console.log('[ImageProcessing] Stopped image processing service');
        }
    }

    /**
     * ตรวจสอบสถานะ Image Processing Service
     */
    getStatus() {
        return {
            isRunning: this.processingInterval !== null,
            isProcessing: this.isProcessing,
            intervalMinutes: this.config.intervalMinutes,
            lastProcessedTime: this.config.lastProcessedTime,
            processingCount: this.config.processingCount,
            errorCount: this.config.errorCount,
            lastResults: this.config.lastResults,
            config: {
                saveProcessedImages: this.config.saveProcessedImages,
                snapshotEndpoint: this.config.snapshotEndpoint
            }
        };
    }

    /**
     * เปลี่ยน interval (1-5 นาที)
     */
    setInterval(intervalMinutes) {
        const wasRunning = this.processingInterval !== null;
        if (wasRunning) {
            this.stop();
        }
        this.config.intervalMinutes = Math.max(1, Math.min(5, intervalMinutes));
        if (wasRunning) {
            this.start(this.config.intervalMinutes);
        }
    }
}

module.exports = ImageProcessingService;

