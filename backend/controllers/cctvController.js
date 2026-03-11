const axios = require('axios');
const https = require('https');
const { pool } = require('../config/database');

// Minimal valid 1x1 grey JPEG (125 bytes) - for placeholder when camera is unavailable
const PLACEHOLDER_JPEG = Buffer.from(
    'ffd8ffe000104a46494600010101004800480000ffdb004300030202020202030202020303030303030404040404040404080606050606090808090a0c0a0a0a0a0c0f0c0a0b0e0b09090d110d0e0f1010101110100a0c1213121210130f101010ffc9000b080001000101011100ffcc000600101005ffda000801010000003f00d2cf20ffd9',
    'hex'
);

// digest-fetch ใช้ global fetch — ถ้าไม่มี (เช่น Node 16) ใช้ node-fetch แทน
if (typeof globalThis.fetch !== 'function') {
    try {
        const nf = require('node-fetch');
        globalThis.fetch = nf.default || nf;
        if (typeof globalThis.fetch === 'function') {
            console.log('[CCTV] fetch polyfilled with node-fetch');
        }
    } catch (e) {
        console.warn('[CCTV] node-fetch not available for polyfill:', e.message);
    }
}

// digest-fetch: package ส่งออกเป็น class (module.exports = DigestClient)
let DigestAuthConstructor = null;
try {
    const m = require('digest-fetch');
    const C = typeof m === 'function' ? m : (m && (m.default || m.DigestClient || m));
    if (C && typeof C === 'function') {
        DigestAuthConstructor = C;
        console.log('[CCTV] digest-fetch loaded (DigestAuth constructor ready)');
    }
} catch (e) {
    console.error('[CCTV] digest-fetch require failed:', e.message, e.stack);
}

const { fetchSnapshot, SNAPSHOT_TIMEOUT_MS } = require('../services/cctvSnapshotService');
const CctvCamera = require('../models/CctvCamera');
const PeopleCountLog = require('../models/PeopleCountLog');

// ป้องกัน request ซ้อน — ถ้ายังประมวลผล count-people ไม่เสร็จ → return 429
let countPeopleProcessing = false;

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
     * Send a single placeholder JPEG as MJPEG-style stream (so <img> loads without 500/503).
     * Use when camera is unreachable or DigestClient fails.
     */
    _sendPlaceholderStream(res) {
        if (res.headersSent) return;
        res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=--jpgboundary');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-CCTV-Placeholder', '1');
        res.write('--jpgboundary\r\n');
        res.write('Content-Type: image/jpeg\r\n');
        res.write(`Content-Length: ${PLACEHOLDER_JPEG.length}\r\n\r\n`);
        res.write(PLACEHOLDER_JPEG);
        res.write('\r\n');
        res.end();
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

    /**
     * GET /api/cctv/areas — โหลดพื้นที่วาดนับคนจาก DB (ใช้ทุกครั้งที่เปิดหน้า /cctv)
     */
    async getAreas(req, res) {
        try {
            const [rows] = await pool.query(
                "SELECT areas FROM cctv_area_config WHERE config_key = N'default'"
            );
            if (rows && rows.length > 0 && rows[0].areas) {
                const data = JSON.parse(rows[0].areas);
                return res.json({ success: true, data: Array.isArray(data) ? data : [] });
            }
            return res.json({ success: true, data: [] });
        } catch (error) {
            if (error.message && /Invalid object name|does not exist/i.test(error.message)) {
                return res.json({ success: true, data: [] });
            }
            console.error('[CCTV] getAreas error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'โหลดพื้นที่ไม่สำเร็จ',
                error: error.message
            });
        }
    }

    /**
     * PUT /api/cctv/areas — บันทึกพื้นที่วาดนับคนลง DB (เรียกเมื่อเพิ่ม/ลบพื้นที่)
     */
    async saveAreas(req, res) {
        try {
            const areas = req.body.areas;
            if (!Array.isArray(areas)) {
                return res.status(400).json({
                    success: false,
                    message: 'areas must be an array'
                });
            }
            const json = JSON.stringify(areas);
            const result = await pool.execute(
                "UPDATE cctv_area_config SET areas = ?, updated_at = GETDATE() WHERE config_key = N'default'",
                [json]
            );
            const affectedRows = result && result.affectedRows != null ? result.affectedRows : 0;
            if (affectedRows === 0) {
                await pool.execute(
                    "INSERT INTO cctv_area_config (config_key, areas, updated_at) VALUES (N'default', ?, GETDATE())",
                    [json]
                );
            }
            return res.json({ success: true, message: 'บันทึกพื้นที่เรียบร้อยแล้ว' });
        } catch (error) {
            if (error.message && /Invalid object name|does not exist/i.test(error.message)) {
                return res.status(500).json({
                    success: false,
                    message: 'ยังไม่มีตาราง cctv_area_config — กรุณารันสคริปต์ create_smart_room_booking_mssql.sql',
                    error: error.message
                });
            }
            console.error('[CCTV] saveAreas error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'บันทึกพื้นที่ไม่สำเร็จ',
                error: error.message
            });
        }
    }

    /**
     * GET /api/cctv/people-count-logs — รายการบันทึกการนับคน
     */
    async listPeopleCountLogs(req, res) {
        try {
            const { camera_id, start_date, end_date, limit } = req.query;
            const list = await PeopleCountLog.findAll({
                camera_id: camera_id || undefined,
                start_date: start_date || undefined,
                end_date: end_date || undefined,
                limit: limit || 100
            });
            return res.json({ success: true, data: list });
        } catch (error) {
            if (error.message && /Invalid object name|does not exist/i.test(error.message)) {
                return res.json({ success: true, data: [] });
            }
            console.error('[CCTV] listPeopleCountLogs error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'โหลดประวัติการนับคนไม่สำเร็จ',
                error: error.message
            });
        }
    }

    /**
     * POST /api/cctv/count-people
     * Body: { cameraId?, areaId?, roi: [{x,y}, ...], image? } — roi = polygon normalized 0-1.
     * image = base64 string (optional). ถ้ามี ใช้รูปนี้แทนการดึงจากกล้อง (นับคนในรูป).
     * ถ้าไม่มี image จะดึง snapshot จากกล้อง (timeout 5s).
     * - ถ้ายังประมวลผลไม่เสร็จ → 429
     * - error จากกล้อง (เมื่อไม่ส่ง image) → 503
     * - image processing error → 500
     */
    async countPeopleInArea(req, res) {
        const send429 = (payload) => {
            if (!res.headersSent) res.status(429).json({ success: false, count: 0, ...payload });
        };
        const send503 = (payload) => {
            if (!res.headersSent) res.status(503).json({ success: false, count: 0, people: [], ...payload });
        };
        const send500 = (payload) => {
            if (!res.headersSent) res.status(500).json({ success: false, count: 0, people: [], ...payload });
        };

        const cameraId = req.body && (req.body.cameraId !== undefined) ? String(req.body.cameraId) : '0';
        const areaId = req.body && req.body.areaId != null ? String(req.body.areaId) : '';
        const roi = req.body && Array.isArray(req.body.roi) ? req.body.roi : null;
        const imageBase64 = req.body && typeof req.body.image === 'string' ? req.body.image.trim() : '';

        // โหลด config กล้องจาก DB ถ้ามี cameraId (ใช้สำหรับ log หรือกรณีดึงจากกล้อง)
        if (cameraId && cameraId !== '0') {
            try {
                const cam = await CctvCamera.findById(parseInt(cameraId, 10));
                if (cam) {
                    this.cameraConfig = {
                        baseUrl: cam.base_url,
                        username: cam.username,
                        password: cam.password,
                        snapshotEndpoint: cam.snapshot_endpoint || '/ISAPI/Streaming/channels/101/picture'
                    };
                }
            } catch (e) {
                console.warn('[CCTV] countPeopleInArea: load camera from DB failed', e.message);
            }
        } else {
            require('dotenv').config();
            this.cameraConfig = {
                baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
                username: process.env.CCTV_USERNAME || 'admin',
                password: process.env.CCTV_PASSWORD || 'L@nnac0m',
                snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture'
            };
        }

        // ป้องกัน request ซ้อน
        if (countPeopleProcessing) {
            console.warn('[CCTV] countPeopleInArea: 429 — ยังประมวลผลรอบก่อนอยู่');
            return send429({ message: 'ระบบกำลังประมวลผลรอบก่อน — รอสักครู่แล้วลองใหม่', reason: 'busy' });
        }

        const useImageFromBody = imageBase64.length > 0;

        if (!useImageFromBody) {
            // ใช้กล้อง — ต้องมี Digest Auth
            if (!DigestAuthConstructor || typeof DigestAuthConstructor !== 'function') {
                console.warn('[CCTV] countPeopleInArea: digest-fetch constructor not available');
                return send503({
                    message: 'ระบบ Digest Auth ไม่พร้อม (ติดตั้ง digest-fetch บนเซิร์ฟเวอร์)',
                    reason: 'digest_auth_unavailable',
                    hint: 'บนเซิร์ฟเวอร์: npm install digest-fetch แล้วรีสตาร์ท backend'
                });
            }

            let client;
            try {
                client = new DigestAuthConstructor(
                    this.cameraConfig.username,
                    this.cameraConfig.password
                );
            } catch (ctorErr) {
                const errMsg = ctorErr && (ctorErr.message || String(ctorErr));
                console.warn('[CCTV] countPeopleInArea: new DigestAuth failed:', errMsg);
                return send503({
                    message: 'ระบบ Digest Auth บนเซิร์ฟเวอร์ใช้ไม่ได้',
                    reason: 'digest_auth_unavailable',
                    hint: errMsg ? `รายละเอียด: ${errMsg}` : 'npm install digest-fetch node-fetch แล้วรีสตาร์ท'
                });
            }
            if (!client || typeof client.fetch !== 'function') {
                return send503({
                    message: 'ระบบ Digest Auth ไม่พร้อม (instance ไม่มี fetch)',
                    reason: 'digest_auth_unavailable'
                });
            }
        }

        countPeopleProcessing = true;
        try {
            let buffer;
            if (useImageFromBody) {
                // นับคนในรูปที่ส่งมา (base64) — ไม่ดึงจากกล้อง
                let b64 = imageBase64;
                const dataUrlMatch = /^data:image\/[^;]+;base64,(.+)$/i.exec(b64);
                if (dataUrlMatch) b64 = dataUrlMatch[1];
                try {
                    buffer = Buffer.from(b64, 'base64');
                } catch (decodeErr) {
                    console.warn('[CCTV] countPeopleInArea: invalid base64 image', decodeErr.message);
                    return send500({
                        message: 'รูปภาพ (base64) ไม่ถูกต้อง',
                        reason: 'invalid_image'
                    });
                }
                if (buffer.length === 0) {
                    return send500({ message: 'รูปภาพว่างเปล่า', reason: 'empty_image' });
                }
            } else {
                // 1. Snapshot — ดึง 1 frame จากกล้อง, timeout 5 วินาที
                try {
                    buffer = await fetchSnapshot(this.cameraConfig, client, SNAPSHOT_TIMEOUT_MS);
                } catch (snapErr) {
                    const statusCode = snapErr.statusCode;
                    const msg = snapErr.message || '';
                    const isTimeout = /timeout/i.test(msg);
                    const isCamera = statusCode === 401 || statusCode === 404 || statusCode === 503 || statusCode >= 400;
                    console.warn('[CCTV] countPeopleInArea: snapshot failed', statusCode || '', msg);
                    return send503({
                        message: isTimeout ? 'กล้องตอบสนองช้าเกินไป (เกิน 5 วินาที)' : (isCamera ? `กล้องตอบ ${statusCode}` : 'ไม่สามารถดึงภาพจากกล้องได้'),
                        reason: isTimeout ? 'timeout' : 'camera_error',
                        hint: 'ตรวจสอบ CCTV_BASE_URL ใน .env และให้กล้องเปิดอยู่'
                    });
                }
            }

            // 2. Image processing — detect person, count ใน ROI
            let service;
            try {
                service = this.initImageProcessingService();
            } catch (initErr) {
                console.error('[CCTV] countPeopleInArea initImageProcessingService error:', initErr.message, initErr.stack);
                return send500({
                    message: 'ไม่สามารถเริ่ม Image Processing Service ได้',
                    reason: 'service_init_error',
                    error: initErr.message
                });
            }
            let result;
            try {
                result = await service.countPeople(buffer, roi);
            } catch (procErr) {
                console.error('[CCTV] countPeopleInArea image processing error:', procErr.message, procErr.stack);
                return send500({
                    message: 'เกิดข้อผิดพลาดในการประมวลผลภาพ (image processing)',
                    reason: 'image_processing_error',
                    error: procErr.message
                });
            }

            const count = result && typeof result.count === 'number' ? result.count : 0;
            const people = Array.isArray(result && result.people) ? result.people : [];
            const aiUnavailable = !!(result && result.aiUnavailable);
            const timestamp = new Date().toISOString();

            // บันทึกผลการนับคนลง DB (ถ้ามีตาราง people_count_logs และ camera_id)
            const cameraIdForLog = cameraId && cameraId !== '0' ? parseInt(cameraId, 10) : null;
            if (cameraIdForLog && !isNaN(cameraIdForLog)) {
                try {
                    await PeopleCountLog.create({
                        camera_id: cameraIdForLog,
                        zone_name: areaId || null,
                        count,
                        snapshot_path: null
                    });
                } catch (logErr) {
                    console.warn('[CCTV] countPeopleInArea: save people_count_logs failed', logErr.message);
                }
            }

            if (!res.headersSent) {
                res.json({
                    count,
                    people,
                    timestamp,
                    aiUnavailable
                });
            }
        } catch (error) {
            console.error('[CCTV] countPeopleInArea unexpected error:', error.message, error.stack);
            if (!res.headersSent) send500({ message: 'เกิดข้อผิดพลาดไม่คาดคิด', error: error.message });
        } finally {
            countPeopleProcessing = false;
        }
    }

    /**
     * GET /api/cctv/cameras — รายการกล้อง CCTV (ถ้าว่างจะ seed จาก env)
     */
    async listCameras(req, res) {
        try {
            let list = await CctvCamera.findAll();
            if (list.length === 0) {
                require('dotenv').config();
                const baseUrl = process.env.CCTV_BASE_URL || 'http://192.168.24.1';
                const username = process.env.CCTV_USERNAME || 'admin';
                const password = process.env.CCTV_PASSWORD || 'L@nnac0m';
                try {
                    const id = await CctvCamera.create({
                        name: 'กล้องหลัก',
                        base_url: baseUrl,
                        username,
                        password,
                        snapshot_endpoint: '/ISAPI/Streaming/channels/101/picture'
                    });
                    list = await CctvCamera.findAll();
                } catch (seedErr) {
                    console.warn('[CCTV] seed default camera failed', seedErr.message);
                }
            }
            const data = list.map(c => ({
                id: c.id,
                name: c.name,
                base_url: c.base_url,
                username: c.username,
                password: c.password ? '***' : '',
                snapshot_endpoint: c.snapshot_endpoint
            }));
            return res.json({ success: true, data });
        } catch (error) {
            console.error('[CCTV] listCameras error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'โหลดรายการกล้องไม่สำเร็จ',
                error: error.message
            });
        }
    }

    /**
     * GET /api/cctv/cameras/:id
     */
    async getCamera(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const cam = await CctvCamera.findById(id);
            if (!cam) {
                return res.status(404).json({ success: false, message: 'ไม่พบกล้อง' });
            }
            const data = {
                id: cam.id,
                name: cam.name,
                base_url: cam.base_url,
                username: cam.username,
                password: cam.password ? '***' : '',
                snapshot_endpoint: cam.snapshot_endpoint
            };
            return res.json({ success: true, data });
        } catch (error) {
            console.error('[CCTV] getCamera error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'โหลดข้อมูลกล้องไม่สำเร็จ',
                error: error.message
            });
        }
    }

    /**
     * POST /api/cctv/cameras — สร้างกล้องใหม่
     */
    async createCamera(req, res) {
        try {
            const { name, base_url, username, password, snapshot_endpoint } = req.body || {};
            if (!base_url || !username) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอก base_url และ username'
                });
            }
            const id = await CctvCamera.create({
                name: name || null,
                base_url: base_url.trim(),
                username: username.trim(),
                password: password != null ? String(password) : '',
                snapshot_endpoint: snapshot_endpoint || '/ISAPI/Streaming/channels/101/picture'
            });
            const cam = await CctvCamera.findById(id);
            return res.status(201).json({
                success: true,
                message: 'สร้างกล้องเรียบร้อยแล้ว',
                data: { id: cam.id, name: cam.name, base_url: cam.base_url, username: cam.username, password: '***', snapshot_endpoint: cam.snapshot_endpoint }
            });
        } catch (error) {
            console.error('[CCTV] createCamera error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'สร้างกล้องไม่สำเร็จ',
                error: error.message
            });
        }
    }

    /**
     * PUT /api/cctv/cameras/:id
     */
    async updateCamera(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const cam = await CctvCamera.findById(id);
            if (!cam) {
                return res.status(404).json({ success: false, message: 'ไม่พบกล้อง' });
            }
            const { name, base_url, username, password, snapshot_endpoint } = req.body || {};
            await CctvCamera.update(id, {
                name: name !== undefined ? name : cam.name,
                base_url: base_url !== undefined ? base_url : cam.base_url,
                username: username !== undefined ? username : cam.username,
                password: password !== undefined ? password : cam.password,
                snapshot_endpoint: snapshot_endpoint !== undefined ? snapshot_endpoint : cam.snapshot_endpoint
            });
            const updated = await CctvCamera.findById(id);
            return res.json({
                success: true,
                message: 'อัปเดตกล้องเรียบร้อยแล้ว',
                data: { id: updated.id, name: updated.name, base_url: updated.base_url, username: updated.username, password: '***', snapshot_endpoint: updated.snapshot_endpoint }
            });
        } catch (error) {
            console.error('[CCTV] updateCamera error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'อัปเดตกล้องไม่สำเร็จ',
                error: error.message
            });
        }
    }

    /**
     * DELETE /api/cctv/cameras/:id
     */
    async deleteCamera(req, res) {
        try {
            const id = parseInt(req.params.id, 10);
            const deleted = await CctvCamera.delete(id);
            if (!deleted) {
                return res.status(404).json({ success: false, message: 'ไม่พบกล้อง' });
            }
            return res.json({ success: true, message: 'ลบกล้องเรียบร้อยแล้ว' });
        } catch (error) {
            console.error('[CCTV] deleteCamera error:', error.message);
            return res.status(500).json({
                success: false,
                message: 'ลบกล้องไม่สำเร็จ',
                error: error.message
            });
        }
    }

    // Get camera MJPEG video stream (for real-time video in <img> tag)
    // This endpoint doesn't require authentication - it's a proxy
    // Uses snapshot endpoint with fast refresh to simulate real-time stream
    async getVideoStream(req, res) {
        // Wrap entire function in try-catch to prevent any unhandled errors
        try {
            return await this._getVideoStreamInternal(req, res);
        } catch (outerError) {
            // Final safety net - catch ANY error that wasn't caught
            console.error('[CCTV] ========== OUTER ERROR HANDLER ==========');
            console.error('[CCTV] Unhandled error in getVideoStream:', outerError);
            console.error('[CCTV] Error stack:', outerError.stack);
            
            try {
                if (!res.headersSent) {
                    this._sendPlaceholderStream(res);
                }
            } catch (placeholderError) {
                console.error('[CCTV] Failed to send placeholder:', placeholderError.message);
            }
        }
    }
    
    async _getVideoStreamInternal(req, res) {
        let streamInterval = null;
        let client = null;
        
        // Log entry point
        console.log('[CCTV] ========== getVideoStream ENTRY ==========');
        console.log('[CCTV] Request query:', req.query);
        console.log('[CCTV] Request method:', req.method);
        console.log('[CCTV] Request URL:', req.url);
        
        try {
            // Validate cameraId parameter
            const cameraIdParam = req.query.cameraId;
            console.log('[CCTV] cameraIdParam:', cameraIdParam);
            
            if (cameraIdParam === undefined || cameraIdParam === null || cameraIdParam === '') {
                console.error('[CCTV] Error: cameraId parameter is missing');
                this._sendPlaceholderStream(res);
                return;
            }
            
            const cameraId = Number(cameraIdParam);
            if (isNaN(cameraId) || cameraId < 0) {
                console.error('[CCTV] Error: Invalid cameraId:', cameraIdParam);
                this._sendPlaceholderStream(res);
                return;
            }
            
            const channel = 101; // Default Hikvision channel
            console.log(`[CCTV] getVideoStream processing - cameraId: ${cameraId}, channel: ${channel}`);
            
            // Validate camera configuration exists
            if (!this.cameraConfig) {
                console.error('[CCTV] Error: cameraConfig is not initialized');
                this._sendPlaceholderStream(res);
                return;
            }
            
            // Validate camera configuration values
            if (!this.cameraConfig.baseUrl) {
                console.error('[CCTV] Error: CCTV_BASE_URL is not configured');
                this._sendPlaceholderStream(res);
                return;
            }
            
            if (!this.cameraConfig.username || !this.cameraConfig.password) {
                console.error('[CCTV] Error: CCTV username or password is not configured');
                this._sendPlaceholderStream(res);
                return;
            }
            
            // Build RTSP/snapshot URL
            const snapshotUrl = `${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/${channel}/picture`;
            console.log(`[CCTV] RTSP/Snapshot URL: ${snapshotUrl}`);
            console.log(`[CCTV] Camera config: baseUrl=${this.cameraConfig.baseUrl}, username=${this.cameraConfig.username}, hasPassword=${!!this.cameraConfig.password}`);
            
            // Use digest-fetch for Digest Authentication
            try {
                if (!DigestAuthConstructor || typeof DigestAuthConstructor !== 'function') {
                    throw new Error('digest-fetch not available - npm install digest-fetch');
                }
                client = new DigestAuthConstructor(
                    this.cameraConfig.username,
                    this.cameraConfig.password
                );
                console.log('[CCTV] DigestAuth client created');
            } catch (clientError) {
                console.error('[CCTV] Error creating DigestAuth:', clientError.message);
                console.error('[CCTV] DigestAuthConstructor available:', !!DigestAuthConstructor);
                this._sendPlaceholderStream(res);
                return;
            }
            
            // Test connection with a single fetch (with timeout)
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Camera connection timeout (5 seconds)')), 5000);
                });
                
                console.log('[CCTV] Attempting to fetch camera snapshot...');
                const fetchPromise = client.fetch(snapshotUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'image/jpeg'
                    }
                });
                
                const testResponse = await Promise.race([fetchPromise, timeoutPromise]);
                console.log(`[CCTV] Camera response status: ${testResponse.status} ${testResponse.statusText}`);
                
                if (!testResponse.ok) {
                    throw new Error(`Camera returned status ${testResponse.status}: ${testResponse.statusText}`);
                }
                
                console.log('[CCTV] Camera connection test successful');
            } catch (testError) {
                console.error('[CCTV] Camera connection test failed:', testError.message);
                console.error('[CCTV] Error stack:', testError.stack);
                console.error('[CCTV] RTSP URL:', snapshotUrl);
                this._sendPlaceholderStream(res);
                return;
            }
            
            // Set headers for MJPEG-like stream
            res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=--jpgboundary');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            let frameCount = 0;
            let errorCount = 0;
            const maxErrors = 10; // Stop after 10 consecutive errors
            
            // Stream loop - fetch snapshot every 100ms to simulate real-time video
            streamInterval = setInterval(async () => {
                try {
                    // Check if response is still open
                    if (res.closed || res.destroyed) {
                        console.log('[CCTV] Response closed, stopping stream');
                        clearInterval(streamInterval);
                        return;
                    }
                    
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Frame fetch timeout (3 seconds)')), 3000);
                    });
                    
                    const fetchPromise = client.fetch(snapshotUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'image/jpeg'
                        }
                    });
                    
                    const response = await Promise.race([fetchPromise, timeoutPromise]);

                    if (response.ok) {
                        try {
                            const arrayBuffer = await response.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            
                            if (buffer.length > 100 && !res.closed && !res.destroyed) {
                                // Send multipart frame
                                res.write(`--jpgboundary\r\n`);
                                res.write(`Content-Type: image/jpeg\r\n`);
                                res.write(`Content-Length: ${buffer.length}\r\n\r\n`);
                                res.write(buffer);
                                res.write(`\r\n`);
                                
                                frameCount++;
                                errorCount = 0; // Reset error count on success
                                
                                // Log every 100 frames
                                if (frameCount % 100 === 0) {
                                    console.log(`[CCTV] Stream frames sent: ${frameCount} (cameraId: ${cameraId})`);
                                }
                            }
                        } catch (writeError) {
                            // Handle write errors (client disconnected, etc.)
                            if (writeError.code === 'ECONNRESET' || writeError.code === 'EPIPE') {
                                console.log('[CCTV] Client disconnected during write');
                                clearInterval(streamInterval);
                                return;
                            }
                            throw writeError;
                        }
                    } else {
                        errorCount++;
                        console.warn(`[CCTV] Stream frame error: HTTP ${response.status} (cameraId: ${cameraId}, RTSP: ${snapshotUrl})`);
                        if (errorCount >= maxErrors) {
                            console.error(`[CCTV] Too many consecutive errors (${errorCount}), stopping stream`);
                            clearInterval(streamInterval);
                            if (!res.closed && !res.destroyed) {
                                res.end();
                            }
                            return;
                        }
                    }
                } catch (error) {
                    errorCount++;
                    console.error('[CCTV] Stream frame error:', error.message);
                    console.error('[CCTV] Error details:', {
                        cameraId: cameraId,
                        rtspUrl: snapshotUrl,
                        errorCount: errorCount,
                        error: error.message,
                        code: error.code
                    });
                    
                    // Stop streaming if too many errors
                    if (errorCount >= maxErrors) {
                        console.error(`[CCTV] Stopping stream due to ${errorCount} consecutive errors (cameraId: ${cameraId})`);
                        clearInterval(streamInterval);
                        if (!res.closed && !res.destroyed) {
                            res.end();
                        }
                    }
                }
            }, 100); // 100ms = ~10 FPS
            
            // Handle client disconnect
            req.on('close', () => {
                console.log(`[CCTV] Client disconnected from stream (cameraId: ${cameraId})`);
                if (streamInterval) {
                    clearInterval(streamInterval);
                    streamInterval = null;
                }
                if (!res.closed && !res.destroyed) {
                    res.end();
                }
            });
            
            req.on('error', (error) => {
                console.error('[CCTV] Request error:', error);
                console.error('[CCTV] Error details:', {
                    cameraId: cameraId,
                    rtspUrl: snapshotUrl,
                    error: error.message,
                    code: error.code
                });
                if (streamInterval) {
                    clearInterval(streamInterval);
                    streamInterval = null;
                }
            });
            
            // Handle response errors
            res.on('error', (error) => {
                console.error('[CCTV] Response error:', error);
                console.error('[CCTV] Error details:', {
                    cameraId: cameraId,
                    rtspUrl: snapshotUrl,
                    error: error.message,
                    code: error.code
                });
                if (streamInterval) {
                    clearInterval(streamInterval);
                    streamInterval = null;
                }
            });
            
        } catch (error) {
            // Catch ALL errors - server must never crash
            console.error('[CCTV] ========== ERROR IN getVideoStream ==========');
            console.error('[CCTV] Error message:', error.message);
            console.error('[CCTV] Error name:', error.name);
            console.error('[CCTV] Error stack:', error.stack);
            console.error('[CCTV] Error code:', error.code);
            console.error('[CCTV] Camera config:', {
                baseUrl: this.cameraConfig?.baseUrl,
                hasUsername: !!this.cameraConfig?.username,
                hasPassword: !!this.cameraConfig?.password,
                username: this.cameraConfig?.username
            });
            console.error('[CCTV] Request params:', {
                cameraId: req.query.cameraId,
                channel: 101
            });
            console.error('[CCTV] ============================================');
            
            // Clean up interval if it was created
            if (streamInterval) {
                clearInterval(streamInterval);
                streamInterval = null;
            }
            
            // Always return image stream (placeholder) so <img> does not get 500/503
            if (!res.headersSent) {
                this._sendPlaceholderStream(res);
                return;
            } else {
                // Headers already sent, just end the response safely
                try {
                    if (!res.closed && !res.destroyed) {
                        res.end();
                    }
                } catch (endError) {
                    // Ignore errors when ending response
                    console.warn('[CCTV] Error ending response (ignored):', endError.message);
                }
            }
        }
    }

    /**
     * ส่ง placeholder JPEG (200) เมื่อกล้องไม่พร้อม — ให้ frontend ไม่ติด 503
     */
    _sendPlaceholderSnapshot(res) {
        if (res.headersSent) return;
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('X-Snapshot-Placeholder', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(PLACEHOLDER_JPEG);
    }

    // Get camera snapshot as JPEG image (for direct use in <img> tag)
    // เมื่อกล้องไม่พร้อมหรือ error จะส่ง placeholder JPEG 200 แทน 503/500 — frontend ไม่ติด 503
    async getSnapshotImage(req, res) {
        try {
            const cameraId = Number(req.query.cameraId ?? 0);
            const channel = 101; // Default Hikvision channel

            if (cameraId > 0) {
                try {
                    const cam = await CctvCamera.findById(cameraId);
                    if (cam) {
                        this.cameraConfig = {
                            baseUrl: cam.base_url,
                            username: cam.username,
                            password: cam.password,
                            snapshotEndpoint: cam.snapshot_endpoint || '/ISAPI/Streaming/channels/101/picture'
                        };
                    }
                } catch (e) {
                    console.warn('[CCTV] getSnapshotImage: load camera from DB failed', e.message);
                }
            } else {
                require('dotenv').config();
                this.cameraConfig = {
                    baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
                    username: process.env.CCTV_USERNAME || 'admin',
                    password: process.env.CCTV_PASSWORD || 'L@nnac0m',
                    snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture'
                };
            }

            console.log(`[CCTV] getSnapshotImage called - cameraId: ${cameraId}, baseUrl: ${this.cameraConfig.baseUrl}`);

            if (!DigestAuthConstructor || typeof DigestAuthConstructor !== 'function') {
                console.warn('[CCTV] getSnapshotImage: Digest Auth ไม่พร้อม — ส่ง placeholder');
                this._sendPlaceholderSnapshot(res);
                return;
            }
            let client;
            try {
                client = new DigestAuthConstructor(
                    this.cameraConfig.username,
                    this.cameraConfig.password
                );
            } catch (ctorErr) {
                console.warn('[CCTV] getSnapshotImage: DigestAuth failed — ส่ง placeholder', ctorErr?.message);
                this._sendPlaceholderSnapshot(res);
                return;
            }
            if (!client || typeof client.fetch !== 'function') {
                this._sendPlaceholderSnapshot(res);
                return;
            }

            const url = `${this.cameraConfig.baseUrl}${this.cameraConfig.snapshotEndpoint || `/ISAPI/Streaming/channels/${channel}/picture`}`;
            console.log(`[CCTV] Fetching from: ${url}`);

            let response;
            try {
                response = await client.fetch(url, {
                    method: 'GET',
                    headers: { 'Accept': 'image/jpeg' }
                });
            } catch (fetchErr) {
                console.warn('[CCTV] getSnapshotImage: fetch failed — ส่ง placeholder', fetchErr?.message);
                this._sendPlaceholderSnapshot(res);
                return;
            }

            if (!response.ok) {
                console.warn(`[CCTV] getSnapshotImage: camera ${response.status} — ส่ง placeholder`);
                this._sendPlaceholderSnapshot(res);
                return;
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length < 100) {
                console.warn('[CCTV] getSnapshotImage: response too small — ส่ง placeholder');
                this._sendPlaceholderSnapshot(res);
                return;
            }

            console.log(`[CCTV] getSnapshotImage success, size: ${buffer.length} bytes`);
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.status(200).send(buffer);
        } catch (error) {
            console.error('[CCTV] getSnapshotImage error:', error?.message);
            this._sendPlaceholderSnapshot(res);
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

    /**
     * GET /api/cctv/diagnose — ตรวจสอบจากเซิร์ฟเวอร์ว่าเข้าเครือข่ายกล้องได้หรือไม่ (ใช้ digest-fetch เหมือน count-people)
     * เปิดจากเบราว์เซอร์: https://bms-dev.lanna.co.th/api/cctv/diagnose (ต้อง login ก่อน)
     * คืนค่า ok, status, message, hint, nextSteps เพื่อใช้ตรวจ .env และเครือข่าย
     */
    async diagnose(req, res) {
        const snapshotUrl = `${this.cameraConfig.baseUrl}/ISAPI/Streaming/channels/101/picture`;
        const TIMEOUT_MS = 10000;
        const baseUrl = this.cameraConfig.baseUrl;

        const nextSteps503 = [
            '1) ตรวจ .env บนเซิร์ฟเวอร์: CCTV_BASE_URL ต้องชี้ไปที่ IP กล้อง (เช่น http://192.168.24.1) ไม่ใช่ URL ของ bms-dev',
            '2) ถ้าเซิร์ฟเวอร์ bms-dev อยู่คนละเครือข่ายกับกล้อง (192.168.24.x เป็น LAN): พิจารณา VPN หรือย้าย backend ไปรันในเครื่องที่อยู่ LAN เดียวกับกล้อง',
            '3) ตรวจว่ากล้องเปิดอยู่ และจากเซิร์ฟเวอร์ ping ได้: ping 192.168.24.1'
        ];
        const nextStepsTimeout = [
            '1) เครือข่ายจากเซิร์ฟเวอร์ถึงกล้องช้าหรือไม่ถึง — ตรวจ firewall / routing',
            '2) พิจารณา VPN ถ้าเซิร์ฟเวอร์อยู่คนละเครือข่ายกับกล้อง',
            '3) รันบนเซิร์ฟเวอร์: node scripts/test-cctv-snapshot.js'
        ];
        const nextStepsRefused = [
            '1) เซิร์ฟเวอร์เข้า IP กล้องไม่ได้ (Connection Refused) — กล้องปิดหรืออยู่คนละเครือข่าย',
            '2) พิจารณา VPN หรือย้าย backend ไปรันใน LAN เดียวกับกล้อง',
            '3) ตรวจ .env: CCTV_BASE_URL ต้องเป็น IP จริงของกล้อง'
        ];

        if (!DigestAuthConstructor || typeof DigestAuthConstructor !== 'function') {
            return res.status(200).json({
                ok: false,
                status: 'digest_unavailable',
                message: 'ระบบ Digest Auth ไม่พร้อมบนเซิร์ฟเวอร์',
                hint: 'npm install digest-fetch แล้วรีสตาร์ท backend (แนะนำ Node 18+)',
                nextSteps: ['รัน npm install digest-fetch', 'รีสตาร์ท backend', 'ตรวจ Node: node -v (แนะนำ 18+)']
            });
        }

        let client;
        try {
            client = new DigestAuthConstructor(this.cameraConfig.username, this.cameraConfig.password);
        } catch (e) {
            return res.status(200).json({
                ok: false,
                status: 'digest_error',
                message: 'สร้าง Digest client ไม่ได้: ' + (e.message || ''),
                nextSteps: ['ตรวจเวอร์ชัน Node (แนะนำ 18+)', 'รีสตาร์ท backend']
            });
        }

        if (!client || typeof client.fetch !== 'function') {
            return res.status(200).json({
                ok: false,
                status: 'digest_error',
                message: 'instance ไม่มี fetch',
                nextSteps: ['npm install digest-fetch', 'รีสตาร์ท backend']
            });
        }

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS);
        });
        const fetchPromise = client.fetch(snapshotUrl, { method: 'GET', headers: { Accept: 'image/jpeg' } });

        try {
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            if (!response.ok) {
                const status = response.status;
                return res.status(200).json({
                    ok: false,
                    status: 'camera_http_' + status,
                    message: status === 503
                        ? 'กล้องหรือ path ไปกล้องตอบ 503 — เซิร์ฟเวอร์อาจอยู่คนละเครือข่ายกับกล้อง'
                        : `กล้องตอบ HTTP ${status}`,
                    baseUrl,
                    snapshotUrl,
                    hint: 'ตรวจ .env บนเซิร์ฟเวอร์ และว่าเซิร์ฟเวอร์เข้าเครือข่ายกล้องได้หรือไม่',
                    nextSteps: nextSteps503
                });
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length < 100) {
                return res.status(200).json({
                    ok: false,
                    status: 'invalid_image',
                    message: 'ได้ข้อมูลไม่ใช่ภาพ (' + buffer.length + ' bytes)',
                    baseUrl,
                    nextSteps: nextSteps503
                });
            }
            return res.status(200).json({
                ok: true,
                status: 'ok',
                message: 'ดึงภาพจากกล้องได้ (' + buffer.length + ' bytes)',
                baseUrl,
                size: buffer.length,
                nextSteps: []
            });
        } catch (err) {
            const code = err.code || (err.message === 'Timeout' ? 'ETIMEDOUT' : null);
            let message = err.message || 'ไม่ทราบสาเหตุ';
            let nextSteps = nextSteps503;
            if (code === 'ETIMEDOUT' || err.message === 'Timeout') {
                message = 'Timeout — เครือข่ายจากเซิร์ฟเวอร์ถึงกล้องไม่ถึงหรือช้า';
                nextSteps = nextStepsTimeout;
            } else if (code === 'ECONNREFUSED') {
                message = 'Connection Refused — เซิร์ฟเวอร์เข้า IP กล้องไม่ได้';
                nextSteps = nextStepsRefused;
            } else if (code === 'ENOTFOUND') {
                message = 'Host Not Found — ตรวจ CCTV_BASE_URL ใน .env';
                nextSteps = ['ตรวจ .env: CCTV_BASE_URL ต้องเป็น URL ที่ resolve ได้จากเซิร์ฟเวอร์'];
            }
            return res.status(200).json({
                ok: false,
                status: 'error',
                message,
                baseUrl,
                snapshotUrl,
                code: code || undefined,
                nextSteps
            });
        }
    }

    // Get camera info - Simple health check endpoint
    // ALWAYS returns 200 OK, never depends on camera, RTSP, ffmpeg, or hardware
    async getCameraInfo(req, res) {
        try {
            console.log('[CCTV] getCameraInfo called - health check endpoint');
            
            // Simple health check - no camera initialization, no RTSP, no ffmpeg
            // This endpoint should ALWAYS return 200 OK
            res.status(200).json({
                success: true,
                service: 'cctv-backend',
                status: 'ok',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Even if there's an error, return 200 OK (this should never happen)
            console.error('[CCTV] Unexpected error in getCameraInfo (should not happen):', error);
            res.status(200).json({
                success: true,
                service: 'cctv-backend',
                status: 'ok',
                timestamp: new Date().toISOString(),
                note: 'Health check endpoint - always returns OK'
            });
        }
    }
}

module.exports = new CCTVController();

