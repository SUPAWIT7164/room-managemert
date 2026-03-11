// DigestClient ใช้เฉพาะใน fetchSnapshot — count-people ใช้ cctvSnapshotService ไม่ผ่านตรงนี้
let DigestClientConstructor = null;
try {
    const m = require('digest-fetch');
    DigestClientConstructor = typeof m === 'function' ? m : (m && (m.default || m.DigestClient || m));
} catch (e) {
    // digest-fetch ไม่จำเป็นสำหรับ countPeople (detectPeople) — เฉพาะ fetchSnapshot ต้องใช้
}

const fs = require('fs').promises;
const path = require('path');

/**
 * Image Processing Service
 * - detectPeople / countPeople: ไม่ใช้ DigestClient (count-people flow ใช้ cctvSnapshotService ดึงภาพ)
 * - fetchSnapshot: ใช้ DigestClient ถ้ามี (สำหรับ flow อื่น)
 */

class ImageProcessingService {
    constructor(cameraConfig) {
        this.cameraConfig = cameraConfig;
        this.digestClient = null;
        if (DigestClientConstructor && typeof DigestClientConstructor === 'function') {
            try {
                this.digestClient = new DigestClientConstructor(
                    cameraConfig.username,
                    cameraConfig.password
                );
            } catch (e) {
                this.digestClient = null;
            }
        }
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
     * ดึงภาพนิ่งจากกล้อง (ใช้โดย flow อื่น — count-people ใช้ cctvSnapshotService)
     * @returns {Promise<Buffer>} Image buffer
     */
    async fetchSnapshot() {
        if (!this.digestClient || typeof this.digestClient.fetch !== 'function') {
            throw new Error('Digest Auth ไม่พร้อม — ติดตั้ง digest-fetch และ node-fetch');
        }
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
     * ตรวจสอบว่าจุด (normalized 0-1) อยู่ภายใน polygon หรือไม่ (ray-casting)
     * @param {number} nx - พิกัด x ปกติ (0-1)
     * @param {number} ny - พิกัด y ปกติ (0-1)
     * @param {Array<{x:number,y:number}|[number,number]>} polygon - array ของจุด (normalized)
     * @returns {boolean}
     */
    pointInPolygon(nx, ny, polygon) {
        if (!polygon || polygon.length < 3) return false;
        let inside = false;
        const n = polygon.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const pi = polygon[i];
            const pj = polygon[j];
            const xi = typeof pi.x === 'number' ? pi.x : pi[0];
            const yi = typeof pi.y === 'number' ? pi.y : pi[1];
            const xj = typeof pj.x === 'number' ? pj.x : pj[0];
            const yj = typeof pj.y === 'number' ? pj.y : pj[1];
            const intersect = ((yi > ny) !== (yj > ny)) &&
                (nx < (xj - xi) * (ny - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Decode JPEG/PNG buffer เป็น raw pixel data ด้วย sharp (fallback เมื่อ tfjs-node ไม่พร้อม)
     * @param {Buffer} imageBuffer
     * @returns {Promise<{ data: Uint8Array, width: number, height: number, channels: number }>}
     */
    /**
     * โหลด COCO-SSD model สำหรับ object detection (person counting)
     * ใช้ @tensorflow/tfjs + WASM backend + @tensorflow-models/coco-ssd
     * @returns {Promise<Object>} coco-ssd model instance
     */
    async _getCocoSsdModel() {
        if (this._cocoModel) return this._cocoModel;

        console.log('[ImageProcessing] Loading COCO-SSD model (mobilenet_v2)...');
        const tf = require('@tensorflow/tfjs');
        require('@tensorflow/tfjs-backend-wasm');
        await tf.setBackend('wasm');
        await tf.ready();
        console.log(`[ImageProcessing] TF.js backend: ${tf.getBackend()}`);

        this._tf = tf;

        const cocoSsd = require('@tensorflow-models/coco-ssd');
        this._cocoModel = await cocoSsd.load({ base: 'mobilenet_v2' });
        console.log('[ImageProcessing] COCO-SSD model loaded successfully');
        return this._cocoModel;
    }

    /**
     * Detect person ด้วย COCO-SSD (SSD MobileNet v2)
     * ใช้ image enhancement (normalize + sharpen) เพื่อเพิ่มความแม่นยำ
     * @param {Buffer} imageBuffer - ภาพจากกล้อง (JPEG/PNG)
     * @returns {Promise<{ people: Array<{x,y,width,height,confidence,source}>, count: number }>}
     */
    async detectPeople(imageBuffer) {
        const empty = { people: [], count: 0 };
        if (!imageBuffer || imageBuffer.length < 100) return empty;
        this._lastDetectWasFallback = false;

        try {
            const model = await this._getCocoSsdModel();
            const tf = this._tf;
            const sharpLib = require('sharp');

            // ====== ปรับภาพก่อน detect (normalize + sharpen ช่วยเพิ่มจำนวนคนที่เจอมาก) ======
            const enhanced = await sharpLib(imageBuffer)
                .normalize()             // auto-adjust contrast & brightness
                .sharpen({ sigma: 1.0 }) // เพิ่มความคมชัด
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const imgW = enhanced.info.width;
            const imgH = enhanced.info.height;

            const tensor = tf.tensor3d(
                new Uint8Array(enhanced.data),
                [imgH, imgW, enhanced.info.channels]
            );

            // maxDetections=30, minScore=0.10 — จับคนให้ได้มากที่สุด
            const predictions = await model.detect(tensor, 30, 0.10);
            tensor.dispose();

            // กรองเฉพาะ class "person"
            const personPreds = predictions.filter(p => p.class === 'person');

            // แปลง bbox [x,y,w,h] pixel → normalized (0-1)
            const people = personPreds.map(p => ({
                x:          p.bbox[0] / imgW,
                y:          p.bbox[1] / imgH,
                width:      p.bbox[2] / imgW,
                height:     p.bbox[3] / imgH,
                confidence: p.score,
                source:     'coco-ssd'
            }));

            console.log(`[ImageProcessing] COCO-SSD: ${people.length} people (${predictions.length} objects total, ${imgW}x${imgH})`);
            return { people, count: people.length };

        } catch (err) {
            const msg = err.message || '';
            const isModuleError = /Cannot find module|require|ENOENT|not found in registry/i.test(msg);
            if (isModuleError) {
                if (!this._countPeopleWarned) {
                    console.warn('[ImageProcessing] detectPeople: AI module error —', msg.substring(0, 200));
                    this._countPeopleWarned = true;
                }
                this._lastDetectWasFallback = true;
                return empty;
            }
            console.error('[ImageProcessing] detectPeople error:', msg);
            this._lastDetectWasFallback = false;
            throw err;
        }
    }

    /**
     * นับเฉพาะ person ที่ center ของ bbox อยู่ใน polygon (ROI)
     * @param {Array<{x,y,width,height}>} people - จาก detectPeople (normalized 0-1)
     * @param {Array<{x,y}|[number,number]>} roi - polygon (normalized 0-1)
     * @returns {{ people: Array<{x,y,width,height}>, count: number }}
     */
    countInROI(people, roi) {
        if (!Array.isArray(people)) return { people: [], count: 0 };
        if (!roi || roi.length < 3) {
            return { people: [...people], count: people.length };
        }
        
        const inRoi = [];
        for (const p of people) {
            const cx = p.x + p.width / 2;
            const cy = p.y + p.height / 2;
            if (this.pointInPolygon(cx, cy, roi)) {
                inRoi.push(p);
            }
        }
        console.log(`[ImageProcessing] ROI filter: ${inRoi.length}/${people.length} people inside ROI`);
        return { people: inRoi, count: inRoi.length };
    }

    /**
     * People Counting — ใช้ detectPeople + countInROI (backward compat)
     * @param {Buffer} imageBuffer
     * @param {Array<{x,y}>} [roi]
     * @returns {Promise<{ count: number, people: Array<{x,y,width,height}> }>}
     */
    async countPeople(imageBuffer, roi) {
        const { people } = await this.detectPeople(imageBuffer);
        const { count, people: inRoi } = this.countInROI(people, roi);
        const aiUnavailable = !!this._lastDetectWasFallback;
        return { count, people: inRoi, aiUnavailable };
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

