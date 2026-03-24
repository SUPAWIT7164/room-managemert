const { Area, Building, Room } = require('../models');
const { pool } = require('../config/database');
const DeviceState = require('../models/DeviceState');
const roomControlProxyService = require('../services/roomControlProxyService');
const homeAssistantService = require('../services/homeAssistantService');

// Map UI/DB mode values to Home Assistant climate hvac_mode
const mapModeToHA = (mode) => {
    const m = (mode || '').toString().toLowerCase().trim();
    const modeMap = {
        'cool': 'cool',
        'dry': 'dry',
        'fan_only': 'fan_only',
        'fan only': 'fan_only',
        // backward/extra support -> default to cool
        'heat': 'cool',
        'heat/cool': 'cool',
        'auto': 'cool',
        'off': 'cool',
    };
    return modeMap[m] || 'cool';
};

// GET /areas/:id/devices - อุปกรณ์ที่ตั้ง area_id เท่านั้น พร้อม deviceStates (ใช้ area_id โดยตรง)
exports.getDevices = async (req, res) => {
    try {
        const areaId = parseInt(req.params.id);
        const [rows] = await pool.query(
            `SELECT d.id, d.name, d.device_type, d.code, d.area_id, d.x, d.y, dt.name as device_type_name
             FROM devices d
             LEFT JOIN device_types dt ON d.device_type_id = dt.id
             WHERE d.area_id = ? AND d.room_id IS NULL
             AND (LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), d.code, dt.name)) IN ('light','ac','erv','vent_fan','fan','exhaust_fan','ventilation_fan'))
             AND (d.disable = 0 OR d.disable IS NULL)
             ORDER BY COALESCE(d.device_type, d.code, dt.name), d.id`,
            [areaId]
        );
        const devices = rows || [];
        const resolveType = (d) => (d.device_type || d.code || (d.device_type_name ? String(d.device_type_name).toLowerCase() : null));
        const byType = { light: [], ac: [], erv: [], vent_fan: [] };
        devices.forEach((d) => {
            let t = resolveType(d);
            if (t === 'fan' || t === 'exhaust_fan' || t === 'ventilation_fan') t = 'vent_fan';
            if (t && byType[t]) byType[t].push(d);
        });

        // ใช้ DeviceState.getByArea แทน proxy room
        let deviceStates = null;
        if (byType.light.length || byType.ac.length || byType.erv.length || byType.vent_fan.length) {
            deviceStates = await DeviceState.getByArea(areaId);
        }

        const toApiFormat = (arr, type) => {
            if (!arr || !Array.isArray(arr)) return [];
            const count = (byType[type] || []).length;
            if (count === 0) return [];
            return Array.from({ length: count }, (_, i) => {
                const item = arr[i] ?? arr[0];
                if (item && typeof item === 'object' && 'status' in item) return item;
                return { status: !!item };
            });
        };
        const apiDeviceStates = deviceStates ? {
            light: toApiFormat(deviceStates.light, 'light'),
            ac: toApiFormat(deviceStates.ac, 'ac'),
            erv: toApiFormat(deviceStates.erv, 'erv'),
            vent_fan: toApiFormat(deviceStates.vent_fan, 'vent_fan')
        } : { light: [], ac: [], erv: [], vent_fan: [] };

        const deviceIdsByType = {
            light: (byType.light || []).map(d => d.id),
            ac: (byType.ac || []).map(d => d.id),
            erv: (byType.erv || []).map(d => d.id),
            vent_fan: (byType.vent_fan || []).map(d => d.id),
        };

        res.json({
            success: true,
            data: {
                hasDevices: devices.length > 0,
                devices,
                deviceStates: apiDeviceStates,
                deviceIdsByType,
                count: devices.length
            }
        });
    } catch (error) {
        console.error('Error fetching area devices:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

// POST /areas/:id/devices/by-id/:deviceId - Control area device by device_id
exports.controlDeviceById = async (req, res) => {
    try {
        const areaId = parseInt(req.params.id, 10);
        const deviceId = parseInt(req.params.deviceId, 10);
        const { status, mode, speed, temperature, settings } = req.body;

        if (Number.isNaN(areaId) || Number.isNaN(deviceId)) {
            return res.status(400).json({ success: false, message: 'Invalid areaId/deviceId' });
        }

        // Validate device belongs to this area (area device: room_id IS NULL)
        const [rows] = await pool.query(
            `SELECT d.id, d.area_id,
                    d.entity_id,
                    LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''), NULLIF(LTRIM(RTRIM(dt.name)), ''))) AS t
             FROM devices d
             LEFT JOIN device_types dt ON d.device_type_id = dt.id
             WHERE d.id = ? AND d.area_id = ? AND d.room_id IS NULL
               AND (d.disable = 0 OR d.disable IS NULL)`,
            [deviceId, areaId]
        );
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Device not found in this area' });
        }

        let deviceType = rows[0].t;
        const entityId = rows[0].entity_id ? String(rows[0].entity_id).trim() : null;
        if (deviceType === 'air') deviceType = 'ac';
        if (deviceType === 'fan' || deviceType === 'exhaust_fan' || deviceType === 'ventilation_fan') deviceType = 'vent_fan';
        if (!['light', 'ac', 'erv', 'vent_fan'].includes(deviceType)) {
            return res.status(400).json({ success: false, message: 'Unsupported device type for control' });
        }

        // Normalize boolean status
        let newStatus = status;
        if (typeof newStatus === 'string') newStatus = newStatus === 'on' || newStatus === 'true' || newStatus === '1';
        if (typeof newStatus === 'number') newStatus = newStatus === 1;

        // Build settings object
        let newSettings = settings ?? null;
        if (!newSettings) {
            if (deviceType === 'ac' && (mode || temperature)) {
                newSettings = {};
                if (mode) newSettings.mode = mode;
                if (temperature) newSettings.temperature = temperature;
            } else if (deviceType === 'erv' && (mode || speed)) {
                newSettings = {};
                if (mode) newSettings.mode = mode;
                if (speed) newSettings.speed = speed;
            }
        }

        // Call Home Assistant first (if enabled) so DB doesn't drift from HA.
        // Area control currently doesn't go through the frontend HA shortcut.
        if (homeAssistantService.isEnabled() && entityId) {
            const action = newStatus ? 'on' : 'off';
            try {
                if (deviceType === 'ac') {
                    const hvacMode = mapModeToHA(mode ?? newSettings?.mode ?? 'cool');
                    const opts = {
                        // temperature is optional; controlClimate will only set if provided
                        temperature: (temperature ?? newSettings?.temperature) != null ? (temperature ?? newSettings?.temperature) : undefined,
                        hvac_mode: hvacMode,
                    };
                    // For action=off, controlClimate won't apply hvac_mode/temperature
                    await homeAssistantService.controlClimate(entityId, action, opts);
                } else {
                    if (deviceType === 'light' && newSettings?.brightness != null) {
                        await homeAssistantService.controlSwitch(entityId, action, { brightness: newSettings.brightness });
                    } else {
                        await homeAssistantService.controlSwitch(entityId, action);
                    }
                }
            } catch (haErr) {
                return res.status(502).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการควบคุมผ่าน Home Assistant (area)',
                    error: haErr.message
                });
            }
        }

        const settingsJson = newSettings ? JSON.stringify(newSettings) : null;
        const statusValue = newStatus ? 1 : 0;

        const areaDeviceIndexRaw = await DeviceState.getAreaDeviceIndexForDeviceId(areaId, deviceType, deviceId);
        const areaDeviceIndex = areaDeviceIndexRaw != null ? areaDeviceIndexRaw : Number(deviceId);
        const [existing] = await pool.query(`SELECT id FROM device_states WHERE device_id = ?`, [deviceId]);
        if (existing && existing.length > 0) {
            await pool.query(
                `UPDATE device_states
                 SET status = ?, settings = ?, updated_at = GETDATE(),
                     area_id = ?, room_id = NULL, device_type = ?, device_index = ?
                 WHERE device_id = ?`,
                [statusValue, settingsJson, areaId, deviceType, areaDeviceIndex, deviceId]
            );
        } else {
            await pool.query(
                `INSERT INTO device_states (device_id, area_id, room_id, device_type, device_index, status, settings, created_at, updated_at)
                 VALUES (?, ?, NULL, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                [deviceId, areaId, deviceType, areaDeviceIndex, statusValue, settingsJson]
            );
        }

        res.json({
            success: true,
            message: 'Device state updated',
            data: { areaId, deviceId, deviceType, status: !!newStatus, settings: newSettings }
        });
    } catch (error) {
        console.error('Error controlling area device by id:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        console.log('Fetching areas...');
        const areas = await Area.findAll();
        console.log('Areas fetched successfully:', areas ? areas.length : 0);
        
        res.json({
            success: true,
            data: areas || []
        });
    } catch (error) {
        console.error('Error in getAll:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        
        // Return empty array instead of error if table doesn't exist
        if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42S02') {
            console.warn('Areas table does not exist, returning empty array');
            return res.json({
                success: true,
                data: []
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findById(id);
        
        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.getWithRooms = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findWithRooms(id);
        
        if (!area) {
            return res.status(404).json({   
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area with rooms:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.create = async (req, res) => {
    try {
        const { name, building_id, floor, description } = req.body;

        if (!name || !building_id) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อและอาคาร'
            });
        }

        const newArea = await Area.create({
            name,
            building_id,
            floor,
            description
        });

        res.status(201).json({
            success: true,
            message: 'สร้างพื้นที่สำเร็จ',
            data: newArea
        });
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างพื้นที่',
            error: error.message
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updated = await Area.update(id, updateData);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการอัปเดต'
            });
        }

        res.json({
            success: true,
            message: 'อัปเดตพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error updating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตพื้นที่',
            error: error.message
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Area.delete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบพื้นที่',
            error: error.message
        });
    }
};

exports.getAll = async (req, res) => {
    try {
        console.log('Fetching areas...');
        const areas = await Area.findAll();
        console.log('Areas fetched successfully:', areas ? areas.length : 0);
        
        res.json({
            success: true,
            data: areas || []
        });
    } catch (error) {
        console.error('Error in getAll:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        
        // Return empty array instead of error if table doesn't exist
        if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42S02') {
            console.warn('Areas table does not exist, returning empty array');
            return res.json({
                success: true,
                data: []
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findById(id);
        
        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.getWithRooms = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findWithRooms(id);
        
        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area with rooms:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.create = async (req, res) => {
    try {
        const { name, building_id, floor, description } = req.body;

        if (!name || !building_id) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อและอาคาร'
            });
        }

        const newArea = await Area.create({
            name,
            building_id,
            floor,
            description
        });

        res.status(201).json({
            success: true,
            message: 'สร้างพื้นที่สำเร็จ',
            data: newArea
        });
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างพื้นที่',
            error: error.message
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updated = await Area.update(id, updateData);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการอัปเดต'
            });
        }

        res.json({
            success: true,
            message: 'อัปเดตพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error updating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตพื้นที่',
            error: error.message
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Area.delete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบพื้นที่',
            error: error.message
        });
    }
};
