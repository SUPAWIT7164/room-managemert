/**
 * People Counting Service
 * นับจำนวนคนในภาพจากกล้อง IP Camera อัตโนมัติ
 * 
 * - ดึง snapshot จากกล้อง → ตรวจจับคน (AI) → บันทึกจำนวนลง DB
 * - ตั้ง loop อัตโนมัติได้ (ค่าเริ่มต้น 30 วินาที, ปรับได้ 10–300 วินาที)
 * - ป้องกันการ process ซ้อน
 * - เก็บ log ย้อนหลังใน memory + บันทึกลง people_count_logs ใน DB
 */

const { fetchSnapshotFromCamera } = require('./cameraSnapshotService');

// Lazy-load modules ที่ต้องการ DB (ป้องกัน circular dependency / DB ยังไม่พร้อม)
let PeopleCountLog = null;
let CctvCamera = null;
let ImageProcessingService = null;
let _imageService = null;

function getPeopleCountLog() {
    if (!PeopleCountLog) {
        try { PeopleCountLog = require('../models/PeopleCountLog'); } catch (e) {
            console.warn('[PeopleCounting] PeopleCountLog model not available:', e.message);
        }
    }
    return PeopleCountLog;
}

function getCctvCamera() {
    if (!CctvCamera) {
        try { CctvCamera = require('../models/CctvCamera'); } catch (e) {
            console.warn('[PeopleCounting] CctvCamera model not available:', e.message);
        }
    }
    return CctvCamera;
}

function getImageService() {
    if (!_imageService) {
        try {
            require('dotenv').config();
            const IPS = require('./imageProcessingService');
            _imageService = new IPS({
                baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
                username: process.env.CCTV_USERNAME || 'admin',
                password: process.env.CCTV_PASSWORD || 'L@nnac0m',
                snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture',
            });
            console.log('[PeopleCounting] ImageProcessingService initialized');
        } catch (e) {
            console.error('[PeopleCounting] Failed to init ImageProcessingService:', e.message);
        }
    }
    return _imageService;
}

class PeopleCountingService {
    constructor() {
        this.intervalId = null;
        this.intervalSeconds = 30;       // ค่าเริ่มต้น 30 วินาที
        this.isRunning = false;
        this.isProcessing = false;

        // ผลลัพธ์ล่าสุด
        this.lastCount = null;           // จำนวนคนล่าสุด
        this.lastCountTime = null;       // เวลาที่นับล่าสุด
        this.lastSnapshotPath = null;    // path ภาพล่าสุด
        this.aiUnavailable = false;      // AI ไม่พร้อม

        // ROI (Region of Interest) — polygon normalized 0-1
        // Format: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.9 }, { x: 0.1, y: 0.9 }]
        this.roi = null;

        // สถิติ
        this.totalCounts = 0;
        this.totalErrors = 0;
        this.startedAt = null;

        // ประวัติล่าสุด (in-memory)
        this.history = [];
        this.maxHistory = 200;

        // Camera ID สำหรับ DB log (จะหา default ตอน init)
        this._defaultCameraId = null;

        // โหลด ROI จากไฟล์ (ถ้ามี)
        this._loadROI();
    }

    /**
     * โหลด ROI จากไฟล์ (persist ข้าม restart)
     */
    _loadROI() {
        try {
            const fs = require('fs');
            const path = require('path');
            const roiPath = path.join(__dirname, '../data/counting_roi.json');
            if (fs.existsSync(roiPath)) {
                const data = JSON.parse(fs.readFileSync(roiPath, 'utf8'));
                if (data && Array.isArray(data.roi) && data.roi.length >= 3) {
                    this.roi = data.roi;
                    console.log(`[PeopleCounting] Loaded ROI: ${this.roi.length} points`);
                }
            }
        } catch (e) {
            console.warn('[PeopleCounting] Cannot load ROI:', e.message);
        }
    }

    /**
     * บันทึก ROI ลงไฟล์
     */
    async _saveROI() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const dataDir = path.join(__dirname, '../data');
            await fs.mkdir(dataDir, { recursive: true });
            const roiPath = path.join(dataDir, 'counting_roi.json');
            await fs.writeFile(roiPath, JSON.stringify({ roi: this.roi, updatedAt: new Date().toISOString() }, null, 2));
            console.log(`[PeopleCounting] Saved ROI: ${this.roi ? this.roi.length + ' points' : 'cleared'}`);
        } catch (e) {
            console.warn('[PeopleCounting] Cannot save ROI:', e.message);
        }
    }

    /**
     * ตั้งค่า ROI (Region of Interest)
     * @param {Array<{x: number, y: number}>|null} roi — polygon normalized 0-1, null = ใช้ทั้งภาพ
     * @returns {{ success: boolean, message: string }}
     */
    async setROI(roi) {
        if (roi === null || roi === undefined || (Array.isArray(roi) && roi.length === 0)) {
            this.roi = null;
            await this._saveROI();
            return { success: true, message: 'ล้าง ROI แล้ว — จะนับคนทั้งภาพ', roi: null };
        }

        if (!Array.isArray(roi) || roi.length < 3) {
            return { success: false, message: 'ROI ต้องมีอย่างน้อย 3 จุด' };
        }

        // Validate แต่ละจุด
        const cleanROI = roi.map(p => ({
            x: Math.max(0, Math.min(1, parseFloat(p.x) || 0)),
            y: Math.max(0, Math.min(1, parseFloat(p.y) || 0)),
        }));

        this.roi = cleanROI;
        await this._saveROI();
        return { success: true, message: `ตั้งค่า ROI สำเร็จ (${cleanROI.length} จุด)`, roi: cleanROI };
    }

    /**
     * ดึง ROI ปัจจุบัน
     * @returns {Array<{x,y}>|null}
     */
    getROI() {
        return this.roi;
    }

    /**
     * หา default camera_id จาก DB (ใช้ตัวแรกที่เจอ)
     */
    async _getDefaultCameraId() {
        if (this._defaultCameraId) return this._defaultCameraId;
        try {
            const Cam = getCctvCamera();
            if (!Cam) return null;
            const list = await Cam.findAll();
            if (list && list.length > 0) {
                this._defaultCameraId = list[0].id;
                console.log(`[PeopleCounting] Default camera_id: ${this._defaultCameraId}`);
                return this._defaultCameraId;
            }
        } catch (e) {
            console.warn('[PeopleCounting] Cannot get default camera_id:', e.message);
        }
        return null;
    }

    /**
     * นับคนในภาพ 1 ครั้ง
     * @returns {Object|null} ผลลัพธ์ หรือ null ถ้ากำลัง process อยู่
     */
    async countNow() {
        if (this.isProcessing) {
            console.log('[PeopleCounting] ยังประมวลผลรอบก่อนอยู่ — ข้าม');
            return null;
        }

        this.isProcessing = true;
        const startTime = Date.now();
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            success: false,
            count: 0,
            people: [],
            aiUnavailable: false,
            snapshotPath: null,
            savedToDb: false,
            error: null,
            duration: 0,
        };

        try {
            // 1. ดึง snapshot จากกล้อง
            console.log('[PeopleCounting] Capturing snapshot...');
            const imageBuffer = await fetchSnapshotFromCamera();
            console.log(`[PeopleCounting] Snapshot: ${imageBuffer.length} bytes`);

            // (optional) บันทึกไฟล์ snapshot สำหรับอ้างอิง
            const fs = require('fs').promises;
            const path = require('path');
            const snapshotsDir = path.join(__dirname, '../snapshots');
            await fs.mkdir(snapshotsDir, { recursive: true });
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const fileName = `count_${ts}.jpg`;
            const filePath = path.join(snapshotsDir, fileName);
            await fs.writeFile(filePath, imageBuffer);
            entry.snapshotPath = `/snapshots/${fileName}`;

            // 2. AI detect — นับคน
            console.log('[PeopleCounting] Detecting people...');
            if (this.roi && this.roi.length >= 3) {
                console.log(`[PeopleCounting] Using ROI: ${this.roi.length} points`);
            }
            const service = getImageService();
            if (!service) throw new Error('ImageProcessingService ไม่พร้อม');

            const result = await service.countPeople(imageBuffer, this.roi);
            entry.count = result.count;
            entry.people = result.people || [];
            entry.aiUnavailable = !!result.aiUnavailable;
            entry.roiUsed = !!this.roi;
            entry.success = true;

            // อัปเดตสถานะ
            this.lastCount = entry.count;
            this.lastCountTime = entry.timestamp;
            this.lastSnapshotPath = entry.snapshotPath;
            this.aiUnavailable = entry.aiUnavailable;
            this.totalCounts++;

            console.log(`[PeopleCounting] Detected: ${entry.count} people (AI unavailable: ${entry.aiUnavailable})`);

            // 3. บันทึกลง DB
            try {
                const cameraId = await this._getDefaultCameraId();
                const Model = getPeopleCountLog();
                if (cameraId && Model) {
                    await Model.create({
                        camera_id: cameraId,
                        zone_name: 'snapshot-auto',
                        count: entry.count,
                        snapshot_path: entry.snapshotPath,
                    });
                    entry.savedToDb = true;
                    console.log(`[PeopleCounting] Saved to DB: camera_id=${cameraId}, count=${entry.count}`);
                } else {
                    console.warn('[PeopleCounting] Skip DB save: no camera_id or model');
                }
            } catch (dbErr) {
                console.warn('[PeopleCounting] DB save failed:', dbErr.message);
                // ไม่ throw — ยังคง return ผลนับคน
            }

        } catch (err) {
            console.error('[PeopleCounting] Error:', err.message);
            entry.error = err.message;
            this.totalErrors++;
        } finally {
            entry.duration = Date.now() - startTime;
            this.isProcessing = false;

            // เก็บ history
            this.history.unshift(entry);
            if (this.history.length > this.maxHistory) {
                this.history = this.history.slice(0, this.maxHistory);
            }
        }

        return entry;
    }

    /**
     * เริ่ม loop นับคนอัตโนมัติ
     * @param {number} intervalSeconds — ระยะเวลา (10–300 วินาที, ค่าเริ่มต้น 30)
     * @returns {{ success: boolean, message: string }}
     */
    startLoop(intervalSeconds) {
        if (this.isRunning) {
            return {
                success: false,
                message: 'People counting loop กำลังทำงานอยู่แล้ว — กรุณาหยุดก่อน',
            };
        }

        // Validate: 10–300 วินาที
        const sec = Math.max(10, Math.min(300, parseInt(intervalSeconds) || 30));
        this.intervalSeconds = sec;

        const intervalMs = sec * 1000;

        console.log(`[PeopleCounting] Starting loop: every ${sec} seconds`);

        // ทำงานทันทีครั้งแรก
        this.countNow().catch(err => {
            console.error('[PeopleCounting] Initial count error:', err.message);
        });

        // ตั้ง setInterval
        this.intervalId = setInterval(() => {
            this.countNow().catch(err => {
                console.error('[PeopleCounting] Loop count error:', err.message);
            });
        }, intervalMs);

        this.isRunning = true;
        this.startedAt = new Date().toISOString();

        return {
            success: true,
            message: `เริ่มนับคนอัตโนมัติทุก ${sec} วินาที`,
            intervalSeconds: sec,
        };
    }

    /**
     * หยุด loop
     * @returns {{ success: boolean, message: string }}
     */
    stopLoop() {
        if (!this.isRunning) {
            return { success: true, message: 'People counting loop ไม่ได้ทำงานอยู่' };
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        this.isProcessing = false;
        this.startedAt = null;

        console.log('[PeopleCounting] Loop stopped');

        return { success: true, message: 'หยุดนับคนอัตโนมัติแล้ว' };
    }

    /**
     * เปลี่ยน interval (จะ restart loop อัตโนมัติถ้ากำลังทำงาน)
     * @param {number} seconds
     * @returns {{ success: boolean, message: string }}
     */
    setIntervalSeconds(seconds) {
        const sec = Math.max(10, Math.min(300, parseInt(seconds) || 30));
        const wasRunning = this.isRunning;

        if (wasRunning) {
            this.stopLoop();
        }

        this.intervalSeconds = sec;

        if (wasRunning) {
            return this.startLoop(sec);
        }

        return {
            success: true,
            message: `อัปเดต interval เป็น ${sec} วินาที`,
            intervalSeconds: sec,
        };
    }

    /**
     * ดึงสถานะ
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isProcessing: this.isProcessing,
            intervalSeconds: this.intervalSeconds,
            lastCount: this.lastCount,
            lastCountTime: this.lastCountTime,
            lastSnapshotPath: this.lastSnapshotPath,
            aiUnavailable: this.aiUnavailable,
            totalCounts: this.totalCounts,
            totalErrors: this.totalErrors,
            startedAt: this.startedAt,
            roi: this.roi,
        };
    }

    /**
     * ดึง history ย้อนหลัง (in-memory)
     * @param {number} limit
     */
    getHistory(limit = 50) {
        return this.history.slice(0, limit);
    }

    /**
     * ดึง history จาก DB (people_count_logs)
     * @param {Object} options
     */
    async getDbHistory(options = {}) {
        try {
            const Model = getPeopleCountLog();
            if (!Model) return [];
            const cameraId = await this._getDefaultCameraId();
            return await Model.findAll({
                camera_id: cameraId || undefined,
                start_date: options.start_date,
                end_date: options.end_date,
                limit: options.limit || 100,
            });
        } catch (err) {
            console.error('[PeopleCounting] getDbHistory error:', err.message);
            return [];
        }
    }
}

// Singleton
const peopleCountingService = new PeopleCountingService();

module.exports = peopleCountingService;

