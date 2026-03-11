const Device = require('../models/Device');
const DeviceState = require('../models/DeviceState');
const homeAssistantService = require('../services/homeAssistantService');
const homeAssistantSyncService = require('../services/homeAssistantSyncService');
const { getControllableDeviceTypes } = require('../config/deviceTypes');

/** ประเภทที่ sync จาก Home Assistant ลง device_states */
const HA_DEVICE_TYPES = ['light', 'ac', 'erv'];

/**
 * เติมสถานะจาก device_states (ที่ sync จาก HA) ให้อุปกรณ์ทุกตัว — ใช้ HA เป็นหลัก
 * @param {Array} devices - รายการอุปกรณ์จาก Device.findAll
 * @returns {Promise<Array>} devices ที่มี is_active, status มาจาก HA เมื่อมีใน device_states
 */
async function enrichDevicesWithHAStatus(devices) {
    if (!devices || devices.length === 0) return devices;

    const deviceTypeKey = (d) => (d.device_type || d.type || '').toLowerCase();
    const roomIds = [...new Set(devices.map((d) => d.room_id).filter(Boolean))];

    const statesByRoom = {};
    for (const roomId of roomIds) {
        try {
            statesByRoom[roomId] = await DeviceState.getByRoom(roomId);
        } catch (err) {
            console.warn('[Device] enrichDevicesWithHAStatus getByRoom failed:', roomId, err?.message);
            statesByRoom[roomId] = { light: [], ac: [], erv: [] };
        }
    }

    const byRoomAndType = {};
    for (const d of devices) {
        const r = d.room_id;
        const t = deviceTypeKey(d);
        if (!byRoomAndType[r]) byRoomAndType[r] = {};
        if (!byRoomAndType[r][t]) byRoomAndType[r][t] = [];
        byRoomAndType[r][t].push(d);
    }
    for (const r of Object.keys(byRoomAndType)) {
        for (const t of Object.keys(byRoomAndType[r])) {
            byRoomAndType[r][t].sort((a, b) => (a.id || 0) - (b.id || 0));
        }
    }

    for (const d of devices) {
        const r = d.room_id;
        const t = deviceTypeKey(d);
        if (!HA_DEVICE_TYPES.includes(t)) continue;

        const list = byRoomAndType[r]?.[t] || [];
        const idx = list.findIndex((x) => x.id === d.id);
        const deviceIndex = idx >= 0 ? idx : 0;

        const roomStates = statesByRoom[r];
        const typeStates = roomStates?.[t];
        const stateAt = typeStates && deviceIndex < typeStates.length ? typeStates[deviceIndex] : null;

        if (stateAt != null && typeof stateAt === 'object' && 'status' in stateAt) {
            const on = Boolean(stateAt.status);
            d.is_active = on ? 1 : 0;
            d.status = on ? 'active' : 'inactive';
            if (d.disable !== 0 && d.disable !== 1) d.disable = on ? 0 : 0;
            d.status_source = 'home_assistant';
        }
    }

    return devices;
}

class DeviceController {
    /**
     * คืนรายการประเภทอุปกรณ์ที่สั่งงานได้ (พร้อม icon สำหรับหน้าเว็บ)
     * GET /api/devices/types
     * เมื่อเพิ่มอุปกรณ์ใหม่ใน config/deviceTypes.js หน้าเว็บจะแสดง icon ตามที่กำหนด
     */
    async getTypes(req, res) {
        try {
            const types = getControllableDeviceTypes();
            res.json({
                success: true,
                data: types,
                message: 'ดึงรายการประเภทอุปกรณ์สำเร็จ',
            });
        } catch (error) {
            console.error('[Device] getTypes error:', error.message);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงรายการประเภทอุปกรณ์',
                error: error.message,
            });
        }
    }

    // Get all devices
    async getAll(req, res) {
        try {
            const { room_id, type, is_active, search, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const options = {
                room_id: room_id ? parseInt(room_id) : undefined,
                type,
                is_active: is_active !== undefined ? parseInt(is_active) : undefined,
                search,
                limit: parseInt(limit),
                offset
            };

            const devices = await Device.findAll(options);
            const total = await Device.count(options);
            await enrichDevicesWithHAStatus(devices);

            res.json({
                success: true,
                data: devices,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Get all devices error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์',
                error: error.message
            });
        }
    }

    // Get device by ID
    async getById(req, res) {
        try {
            const device = await Device.findById(parseInt(req.params.id));
            
            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลอุปกรณ์'
                });
            }

            await enrichDevicesWithHAStatus([device]);

            res.json({
                success: true,
                data: device
            });
        } catch (error) {
            console.error('Get device by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์',
                error: error.message
            });
        }
    }

    // Get devices by room
    async getByRoom(req, res) {
        try {
            const roomId = parseInt(req.params.roomId);
            const devices = await Device.getByRoom(roomId);
            await enrichDevicesWithHAStatus(devices);

            res.json({
                success: true,
                data: devices
            });
        } catch (error) {
            console.error('Get devices by room error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์',
                error: error.message
            });
        }
    }

    // Create device
    async create(req, res) {
        try {
            const { room_id, device_id, name, type, description, is_active } = req.body;

            if (!room_id || !device_id || !name || !type) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
                });
            }

            const deviceData = {
                room_id: parseInt(room_id),
                device_id,
                name,
                type,
                description,
                is_active: is_active !== undefined ? is_active : 1
            };

            const device = await Device.create(deviceData);

            res.status(201).json({
                success: true,
                message: 'สร้างอุปกรณ์สำเร็จ',
                data: device
            });
        } catch (error) {
            console.error('Create device error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างอุปกรณ์',
                error: error.message
            });
        }
    }

    // Update device
    async update(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { room_id, device_id, name, type, description, is_active } = req.body;

            const deviceData = {};
            if (room_id !== undefined) deviceData.room_id = parseInt(room_id);
            if (device_id !== undefined) deviceData.device_id = device_id;
            if (name !== undefined) deviceData.name = name;
            if (type !== undefined) deviceData.type = type;
            if (description !== undefined) deviceData.description = description;
            if (is_active !== undefined) deviceData.is_active = is_active;

            const device = await Device.update(id, deviceData);

            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลอุปกรณ์'
                });
            }

            res.json({
                success: true,
                message: 'อัปเดตอุปกรณ์สำเร็จ',
                data: device
            });
        } catch (error) {
            console.error('Update device error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัปเดตอุปกรณ์',
                error: error.message
            });
        }
    }

    // Delete device
    async delete(req, res) {
        try {
            const id = parseInt(req.params.id);
            const deleted = await Device.delete(id);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลอุปกรณ์'
                });
            }

            res.json({
                success: true,
                message: 'ลบอุปกรณ์สำเร็จ'
            });
        } catch (error) {
            console.error('Delete device error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบอุปกรณ์',
                error: error.message
            });
        }
    }

    /**
     * เปิด/ปิดแอร์ผ่าน Home Assistant
     * POST /api/device/air/:deviceId/control
     * Body: { action: "on" | "off", temperature?: number, hvac_mode?: string }
     */
    async controlAir(req, res) {
        try {
            const { deviceId } = req.params;
            const { action, temperature, hvac_mode } = req.body;

            console.log('[Device] controlAir called:', { deviceId, action, temperature, hvac_mode });

            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ action เป็น "on" หรือ "off"'
                });
            }

            // Entity ID สำหรับแอร์ (climate.air_02)
            const entityId = 'climate.air_02';

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            // ควบคุมแอร์
            const result = await homeAssistantService.controlClimate(
                entityId,
                action.toLowerCase(),
                {
                    temperature: temperature || (action.toLowerCase() === 'on' ? 25 : undefined),
                    hvac_mode: hvac_mode || (action.toLowerCase() === 'on' ? 'cool' : undefined)
                }
            );

            // Sync สถานะไปยัง DB (async, ไม่ต้องรอ)
            homeAssistantSyncService.syncAirConditioner(deviceId)
                .catch(err => console.error('[Device] Auto-sync AC failed:', err.message));

            res.json({
                success: true,
                message: result.message,
                data: {
                    deviceId,
                    entityId,
                    action: action.toLowerCase(),
                    temperature: temperature || (action.toLowerCase() === 'on' ? 25 : null),
                    hvac_mode: hvac_mode || (action.toLowerCase() === 'on' ? 'cool' : null),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] controlAir error:', {
                message: error.message,
                stack: error.stack,
                response: error.response?.data
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการควบคุมแอร์',
                error: error.message
            });
        }
    }

    /**
     * ตั้งค่าอุณหภูมิแอร์
     * POST /api/device/air/:deviceId/temperature
     * Body: { temperature: number }
     */
    async setAirTemperature(req, res) {
        try {
            const { deviceId } = req.params;
            const { temperature } = req.body;

            if (temperature === undefined || isNaN(temperature)) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุอุณหภูมิ (temperature)'
                });
            }

            const temp = parseFloat(temperature);
            if (temp < 16 || temp > 30) {
                return res.status(400).json({
                    success: false,
                    message: 'อุณหภูมิต้องอยู่ระหว่าง 16-30 องศาเซลเซียส'
                });
            }

            const entityId = 'climate.air_02';
            const result = await homeAssistantService.setTemperature(entityId, temp);

            // Sync สถานะไปยัง DB (async, ไม่ต้องรอ)
            homeAssistantSyncService.syncAirConditioner(deviceId)
                .catch(err => console.error('[Device] Auto-sync AC after temperature change failed:', err.message));

            res.json({
                success: true,
                message: result.message,
                data: {
                    deviceId,
                    entityId,
                    temperature: temp,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] setAirTemperature error:', error.message);
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการตั้งอุณหภูมิ',
                error: error.message
            });
        }
    }

    /**
     * ตั้งค่า HVAC mode
     * POST /api/device/air/:deviceId/mode
     * Body: { hvac_mode: "off" | "cool" | "dry" | "fan_only" }
     */
    async setAirMode(req, res) {
        try {
            const { deviceId } = req.params;
            const { hvac_mode } = req.body;

            // Home Assistant รองรับ: "off", "cool", "dry", "fan_only"
            // รองรับ backward compatibility: "heat", "auto", "heat_cool" (แปลงเป็น "cool")
            const validModes = ['off', 'cool', 'dry', 'fan_only', 'heat', 'auto', 'heat_cool'];
            const mode = hvac_mode?.toLowerCase();
            
            if (!mode || !validModes.includes(mode)) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ hvac_mode เป็น "off", "cool", "dry" หรือ "fan_only"'
                });
            }
            
            // แปลงโหมดเก่าเป็นโหมดใหม่
            let finalMode = mode;
            if (mode === 'heat' || mode === 'auto' || mode === 'heat_cool') {
                finalMode = 'cool'; // แปลงโหมดเก่าที่ไม่รองรับแล้วเป็น cool
            }

            const entityId = 'climate.air_02';
            const result = await homeAssistantService.setHvacMode(entityId, finalMode);

            // Sync สถานะไปยัง DB (async, ไม่ต้องรอ)
            homeAssistantSyncService.syncAirConditioner(deviceId)
                .catch(err => console.error('[Device] Auto-sync AC after mode change failed:', err.message));

            res.json({
                success: true,
                message: result.message,
                data: {
                    deviceId,
                    entityId,
                    hvac_mode: finalMode,
                    original_mode: mode, // เก็บค่าเดิมไว้สำหรับ reference
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] setAirMode error:', error.message);
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการตั้งค่าโหมด',
                error: error.message
            });
        }
    }

    /**
     * ดึงสถานะแอร์
     * GET /api/device/air/:deviceId/status
     */
    async getAirStatus(req, res) {
        try {
            const { deviceId } = req.params;
            const entityId = 'climate.air_02';

            const result = await homeAssistantService.getState(entityId);

            res.json({
                success: true,
                message: 'ดึงสถานะแอร์สำเร็จ',
                data: {
                    deviceId,
                    entityId,
                    state: result.state,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] getAirStatus error:', error.message);
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการดึงสถานะ',
                error: error.message
            });
        }
    }

    // ==================== ERV Control ====================

    /**
     * เปิด/ปิด ERV
     * POST /api/devices/erv/:deviceId/control
     * Body: { action: "on" | "off" }
     */
    async controlErv(req, res) {
        try {
            const { deviceId } = req.params;
            const { action } = req.body;

            console.log('[Device] controlErv called:', { deviceId, action });

            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ action เป็น "on" หรือ "off"'
                });
            }

            // Entity ID สำหรับ ERV power switch
            const entityId = 'switch.erv_u1_power';

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            // ควบคุม ERV
            const result = await homeAssistantService.controlSwitch(
                entityId,
                action.toLowerCase()
            );

            // Sync สถานะไปยัง DB (async, ไม่ต้องรอ)
            homeAssistantSyncService.syncErv(deviceId)
                .catch(err => console.error('[Device] Auto-sync ERV failed:', err.message));

            res.json({
                success: true,
                message: result.message,
                data: {
                    deviceId,
                    entityId,
                    action: action.toLowerCase(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] controlErv error:', {
                message: error.message,
                stack: error.stack,
                response: error.response?.data
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการควบคุม ERV',
                error: error.message
            });
        }
    }

    /**
     * ตั้งค่าโหมด ERV
     * POST /api/devices/erv/:deviceId/mode
     * Body: { mode: "heat" | "normal" }
     */
    async setErvMode(req, res) {
        try {
            const { deviceId } = req.params;
            const { mode } = req.body;

            console.log('[Device] setErvMode called:', { deviceId, mode });

            if (!mode || !['heat', 'normal'].includes(mode.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ mode เป็น "heat" หรือ "normal"'
                });
            }

            // Entity ID สำหรับ ERV mode script
            const entityId = mode.toLowerCase() === 'heat' 
                ? 'script.erv_u1_mode_heat' 
                : 'script.erv_u1_mode_normal';

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            // เรียก script สำหรับตั้งค่าโหมด
            const result = await homeAssistantService.callScript(entityId);

            // Sync สถานะไปยัง DB (async, ไม่ต้องรอ)
            homeAssistantSyncService.syncErv(deviceId)
                .catch(err => console.error('[Device] Auto-sync ERV after mode change failed:', err.message));

            res.json({
                success: true,
                message: result.message,
                data: {
                    deviceId,
                    entityId,
                    mode: mode.toLowerCase(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] setErvMode error:', {
                message: error.message,
                stack: error.stack,
                response: error.response?.data
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการตั้งค่าโหมด ERV',
                error: error.message
            });
        }
    }

    /**
     * ตั้งค่าระดับ ERV
     * POST /api/devices/erv/:deviceId/level
     * Body: { level: "low" | "high" }
     */
    async setErvLevel(req, res) {
        try {
            const { deviceId } = req.params;
            const { level } = req.body;

            console.log('[Device] setErvLevel called:', { deviceId, level });

            if (!level || !['low', 'high'].includes(level.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ level เป็น "low" หรือ "high"'
                });
            }

            // Entity ID สำหรับ ERV level script
            const entityId = level.toLowerCase() === 'low' 
                ? 'script.erv_u1_air_low' 
                : 'script.erv_u1_air_high';

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            // เรียก script สำหรับตั้งค่าระดับ
            const result = await homeAssistantService.callScript(entityId);

            // Sync สถานะไปยัง DB (async, ไม่ต้องรอ)
            homeAssistantSyncService.syncErv(deviceId)
                .catch(err => console.error('[Device] Auto-sync ERV after level change failed:', err.message));

            res.json({
                success: true,
                message: result.message,
                data: {
                    deviceId,
                    entityId,
                    level: level.toLowerCase(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] setErvLevel error:', {
                message: error.message,
                stack: error.stack,
                response: error.response?.data
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการตั้งค่าระดับ ERV',
                error: error.message
            });
        }
    }

    /**
     * ดึงสถานะ ERV
     * GET /api/devices/erv/:deviceId/status
     */
    async getErvStatus(req, res) {
        try {
            const { deviceId } = req.params;
            const entityId = 'switch.erv_u1_power';

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            const result = await homeAssistantService.getState(entityId);

            res.json({
                success: true,
                message: 'ดึงสถานะ ERV สำเร็จ',
                data: {
                    deviceId,
                    entityId,
                    state: result.state,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] getErvStatus error:', error.message);
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการดึงสถานะ ERV',
                error: error.message
            });
        }
    }

    // ==================== Home Assistant Sync ====================

    /**
     * Sync สถานะแอร์จาก Home Assistant ไปยัง DB
     * POST /api/devices/sync/air/:deviceId
     */
    async syncAirConditioner(req, res) {
        try {
            const { deviceId } = req.params;

            console.log('[Device] syncAirConditioner called:', { deviceId });

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            const result = await homeAssistantSyncService.syncAirConditioner(deviceId);

            res.json({
                success: true,
                message: 'Sync สถานะแอร์สำเร็จ',
                data: result
            });
        } catch (error) {
            console.error('[Device] syncAirConditioner error:', {
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการ sync สถานะแอร์',
                error: error.message
            });
        }
    }

    /**
     * Sync สถานะ ERV จาก Home Assistant ไปยัง DB
     * POST /api/devices/sync/erv/:deviceId
     */
    async syncErv(req, res) {
        try {
            const { deviceId } = req.params;

            console.log('[Device] syncErv called:', { deviceId });

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            const result = await homeAssistantSyncService.syncErv(deviceId);

            res.json({
                success: true,
                message: 'Sync สถานะ ERV สำเร็จ',
                data: result
            });
        } catch (error) {
            console.error('[Device] syncErv error:', {
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการ sync สถานะ ERV',
                error: error.message
            });
        }
    }

    /**
     * Sync สถานะไฟจาก Home Assistant ไปยัง DB
     * POST /api/devices/sync/light/:deviceId
     */
    async syncLight(req, res) {
        try {
            const { deviceId } = req.params;

            console.log('[Device] syncLight called:', { deviceId });

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            const result = await homeAssistantSyncService.syncLight(deviceId);

            res.json({
                success: true,
                message: 'Sync สถานะไฟสำเร็จ',
                data: result
            });
        } catch (error) {
            console.error('[Device] syncLight error:', {
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการ sync สถานะไฟ',
                error: error.message
            });
        }
    }

    /**
     * Sync ทุกอุปกรณ์จาก Home Assistant ไปยัง DB
     * POST /api/devices/sync/all
     */
    async syncAll(req, res) {
        try {
            console.log('[Device] syncAll called');

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            const result = await homeAssistantSyncService.syncAll();

            res.json({
                success: true,
                message: `Sync สำเร็จ: ${result.success.length} อุปกรณ์, ล้มเหลว: ${result.failed.length} อุปกรณ์`,
                data: result
            });
        } catch (error) {
            console.error('[Device] syncAll error:', {
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการ sync สถานะอุปกรณ์',
                error: error.message
            });
        }
    }

    // ==================== AM319 Sensor Data ====================

    /**
     * ดึงข้อมูล AM319 Sensor ทั้งหมด
     * GET /api/devices/sensor/am319
     */
    async getAm319SensorData(req, res) {
        try {
            console.log('[Device] getAm319SensorData called');

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            // Entity IDs สำหรับ AM319 sensors
            const entityIds = [
                'sensor.am319_am319_co2',
                'sensor.am319_am319_hcho',
                'sensor.am319_am319_humidity',
                'binary_sensor.am319_am319_motion',
                'sensor.am319_am319_pm2_5',
                'sensor.am319_am319_pm10',
                'sensor.am319_am319_pressure',
                'sensor.am319_am319_temperature',
                'sensor.am319_am319_tvoc'
            ];

            // ดึงข้อมูลจาก Home Assistant
            const result = await homeAssistantService.getMultipleStates(entityIds);

            // Format ข้อมูลให้ง่ายต่อการใช้งาน
            const formattedData = {
                co2: result.data['sensor.am319_am319_co2']?.state?.state || null,
                hcho: result.data['sensor.am319_am319_hcho']?.state?.state || null,
                humidity: result.data['sensor.am319_am319_humidity']?.state?.state || null,
                motion: result.data['binary_sensor.am319_am319_motion']?.state?.state || null,
                pm2_5: result.data['sensor.am319_am319_pm2_5']?.state?.state || null,
                pm10: result.data['sensor.am319_am319_pm10']?.state?.state || null,
                pressure: result.data['sensor.am319_am319_pressure']?.state?.state || null,
                temperature: result.data['sensor.am319_am319_temperature']?.state?.state || null,
                tvoc: result.data['sensor.am319_am319_tvoc']?.state?.state || null
            };

            // ดึง attributes สำหรับข้อมูลเพิ่มเติม
            const rawData = {};
            entityIds.forEach(entityId => {
                const sensorData = result.data[entityId];
                if (sensorData?.success && sensorData?.state) {
                    rawData[entityId] = {
                        state: sensorData.state.state,
                        attributes: sensorData.state.attributes,
                        last_changed: sensorData.state.last_changed,
                        last_updated: sensorData.state.last_updated
                    };
                } else {
                    rawData[entityId] = {
                        error: sensorData?.error || 'ไม่สามารถดึงข้อมูลได้'
                    };
                }
            });

            res.json({
                success: true,
                message: 'ดึงข้อมูล AM319 Sensor สำเร็จ',
                data: {
                    formatted: formattedData,
                    raw: rawData,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] getAm319SensorData error:', {
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล sensor',
                error: error.message
            });
        }
    }

    /**
     * ดึงข้อมูล Sensor ตัวเดียว
     * GET /api/devices/sensor/:entityId
     */
    async getSensorData(req, res) {
        try {
            const { entityId } = req.params;

            console.log('[Device] getSensorData called:', { entityId });

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            const result = await homeAssistantService.getState(entityId);

            res.json({
                success: true,
                message: 'ดึงข้อมูล sensor สำเร็จ',
                data: {
                    entityId,
                    state: result.state.state,
                    attributes: result.state.attributes,
                    last_changed: result.state.last_changed,
                    last_updated: result.state.last_updated,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] getSensorData error:', {
                message: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล sensor',
                error: error.message
            });
        }
    }

    /**
     * ควบคุมไฟ (เปิด/ปิด)
     * POST /api/devices/light/:entityId/control
     * Body: { action: "on" | "off" }
     */
    async controlLight(req, res) {
        try {
            const { entityId } = req.params;
            const { action } = req.body;

            console.log('[Device] controlLight called:', { entityId, action });

            if (!action || !['on', 'off'].includes(action.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ action เป็น "on" หรือ "off"'
                });
            }

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            // ใช้ controlSwitch สำหรับ light entity (light domain ใช้ turn_on/turn_off เหมือน switch)
            const result = await homeAssistantService.controlSwitch(entityId, action.toLowerCase());

            // Sync สถานะไปยัง DB (async, ไม่ต้องรอ)
            // ใช้ deviceId จาก entityId (เช่น "light.lights_17" -> "LIGHTS_17")
            if (entityId === 'light.lights_17') {
                homeAssistantSyncService.syncLight('LIGHTS_17')
                    .catch(err => console.error('[Device] Auto-sync Light after control failed:', err.message));
            }

            res.json({
                success: true,
                message: result.message,
                data: {
                    entityId,
                    action: action.toLowerCase(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] controlLight error:', {
                message: error.message,
                stack: error.stack,
                response: error.response?.data
            });
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการควบคุมไฟ',
                error: error.message
            });
        }
    }

    /**
     * ดึงสถานะไฟ
     * GET /api/devices/light/:entityId/status
     */
    async getLightStatus(req, res) {
        try {
            const { entityId } = req.params;

            console.log('[Device] getLightStatus called:', { entityId });

            // ตรวจสอบว่า Home Assistant service พร้อมใช้งานหรือไม่
            if (!homeAssistantService.isEnabled()) {
                return res.status(503).json({
                    success: false,
                    message: 'Home Assistant ไม่ได้ตั้งค่า (กรุณาตรวจสอบ HOME_ASSISTANT_URL และ HOME_ASSISTANT_TOKEN ใน .env)'
                });
            }

            const result = await homeAssistantService.getState(entityId);

            res.json({
                success: true,
                message: 'ดึงสถานะไฟสำเร็จ',
                data: {
                    entityId,
                    state: result.state,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[Device] getLightStatus error:', error.message);
            res.status(500).json({
                success: false,
                message: error.message || 'เกิดข้อผิดพลาดในการดึงสถานะไฟ',
                error: error.message
            });
        }
    }
}

module.exports = new DeviceController();
