/**
 * Snapshot Loop Service
 * จัดการ loop อัตโนมัติสำหรับดึงภาพนิ่งจากกล้อง + image processing
 * 
 * - ใช้ setInterval สำหรับ loop
 * - interval กำหนดได้ 1–5 นาที
 * - ป้องกันการ start loop ซ้อน
 * - ป้องกัน unhandled rejection (fire-and-forget ใช้ .catch())
 * - เก็บ log ประวัติการ capture
 */

const { captureSnapshot } = require('./cameraSnapshotService');
const { processAndSave } = require('./snapshotImageProcessor');

class SnapshotLoopService {
    constructor() {
        this.intervalId = null;          // setInterval ID
        this.intervalMinutes = 1;        // ค่า interval ปัจจุบัน (นาที)
        this.isRunning = false;          // สถานะ loop
        this.isProcessing = false;       // กำลัง capture+process อยู่
        this.logs = [];                  // ประวัติการ capture
        this.maxLogs = 100;              // เก็บ log สูงสุด 100 รายการ
        this.totalCaptures = 0;          // จำนวนครั้งที่ capture ทั้งหมด
        this.totalErrors = 0;            // จำนวน error ทั้งหมด
        this.lastCapture = null;         // ผลลัพธ์ capture ล่าสุด
        this.startedAt = null;           // เวลาที่เริ่ม loop
    }

    /**
     * เริ่ม loop อัตโนมัติ
     * @param {number} intervalMinutes - ระยะเวลา (1–5 นาที)
     * @returns {{ success: boolean, message: string }}
     */
    startLoop(intervalMinutes) {
        // ป้องกัน start loop ซ้อน
        if (this.isRunning) {
            return {
                success: false,
                message: 'Loop กำลังทำงานอยู่แล้ว — กรุณาหยุดก่อนแล้วเริ่มใหม่',
            };
        }

        // Validate interval (1–5 นาที)
        const interval = Math.max(1, Math.min(5, parseInt(intervalMinutes) || 1));
        this.intervalMinutes = interval;

        const intervalMs = interval * 60 * 1000;

        console.log(`[SnapshotLoop] Starting loop: every ${interval} minute(s)`);

        // ทำงานทันทีครั้งแรก (fire-and-forget แต่ต้องมี .catch ป้องกัน crash)
        this._doCapture().catch(err => {
            console.error('[SnapshotLoop] Initial capture unhandled error:', err.message);
        });

        // ตั้ง setInterval
        this.intervalId = setInterval(() => {
            this._doCapture().catch(err => {
                console.error('[SnapshotLoop] Interval capture unhandled error:', err.message);
            });
        }, intervalMs);

        this.isRunning = true;
        this.startedAt = new Date().toISOString();

        return {
            success: true,
            message: `Loop เริ่มทำงาน — ถ่ายภาพทุก ${interval} นาที`,
            intervalMinutes: interval,
        };
    }

    /**
     * หยุด loop อัตโนมัติ
     * @returns {{ success: boolean, message: string }}
     */
    stopLoop() {
        if (!this.isRunning) {
            return {
                success: true,
                message: 'Loop ไม่ได้ทำงานอยู่',
            };
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        this.isProcessing = false;
        this.startedAt = null;

        console.log('[SnapshotLoop] Loop stopped');

        return {
            success: true,
            message: 'Loop หยุดทำงานแล้ว',
        };
    }

    /**
     * ดึง snapshot + image processing (เรียกจาก loop หรือเรียกตรง)
     * @returns {Promise<Object>} ผลลัพธ์การ capture
     */
    async _doCapture() {
        if (this.isProcessing) {
            console.log('[SnapshotLoop] ยังประมวลผลรอบก่อนอยู่ — ข้าม');
            return null;
        }

        this.isProcessing = true;
        const startTime = Date.now();
        const logEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            success: false,
            error: null,
            snapshot: null,
            processed: null,
            duration: 0,
        };

        try {
            // 1. ดึง snapshot จากกล้อง
            console.log('[SnapshotLoop] Capturing snapshot...');
            const snapshot = await captureSnapshot();

            logEntry.snapshot = {
                filePath: snapshot.filePath,
                fileName: snapshot.fileName,
                fileSize: snapshot.fileSize,
            };

            // 2. Image Processing (resize, grayscale, blur)
            console.log('[SnapshotLoop] Processing image...');
            const processed = await processAndSave(snapshot.buffer, snapshot.fileName);

            logEntry.processed = {
                processedPath: processed.processedPath,
                processedFileName: processed.processedFileName,
                metadata: processed.metadata,
            };

            logEntry.success = true;
            this.totalCaptures++;
            this.lastCapture = logEntry;

            console.log(`[SnapshotLoop] Capture #${this.totalCaptures} success`);
        } catch (err) {
            console.error('[SnapshotLoop] Capture error:', err.message);
            logEntry.error = err.message;
            this.totalErrors++;
            // อัพเดท lastCapture แม้จะ error (เพื่อให้ frontend เห็น error ล่าสุด)
            this.lastCapture = logEntry;
        } finally {
            logEntry.duration = Date.now() - startTime;
            this.isProcessing = false;

            // เพิ่ม log (ใหม่สุดอยู่หน้าสุด)
            this.logs.unshift(logEntry);
            if (this.logs.length > this.maxLogs) {
                this.logs = this.logs.slice(0, this.maxLogs);
            }
        }

        return logEntry;
    }

    /**
     * ถ่ายภาพทันที (ไม่ต้องรอ loop)
     * @returns {Promise<Object>}
     */
    async captureNow() {
        return await this._doCapture();
    }

    /**
     * ดึงสถานะ loop
     * @returns {Object}
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isProcessing: this.isProcessing,
            intervalMinutes: this.intervalMinutes,
            totalCaptures: this.totalCaptures,
            totalErrors: this.totalErrors,
            startedAt: this.startedAt,
            lastCapture: this.lastCapture,
        };
    }

    /**
     * ดึง log ประวัติ
     * @param {number} limit - จำนวน log ที่ต้องการ
     * @returns {Array}
     */
    getLogs(limit = 50) {
        return this.logs.slice(0, limit);
    }
}

// Singleton instance
const loopService = new SnapshotLoopService();

module.exports = loopService;
