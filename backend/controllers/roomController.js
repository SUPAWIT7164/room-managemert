const Room = require('../models/Room');
const Approver = require('../models/Approver');
const Device = require('../models/Device');
const DeviceState = require('../models/DeviceState');
const DevicePosition = require('../models/DevicePosition');
const { pool } = require('../config/database');
const roomControlProxyService = require('../services/roomControlProxyService');
const homeAssistantService = require('../services/homeAssistantService');
const homeAssistantSyncService = require('../services/homeAssistantSyncService');
const environmentalHaSyncService = require('../services/environmentalHaSyncService');

/**
 * ดึงสถานะอุปกรณ์จาก Home Assistant โดยใช้ entity_id จากตาราง devices
 * @param {number} roomId - Room ID
 * @returns {Promise<object>} - { light: [{status, ...}], ac: [{status, mode, temperature, ...}], erv: [{status, settings, ...}] }
 */
async function fetchDeviceStatesFromHomeAssistant(roomId) {
    if (!homeAssistantService.isEnabled()) {
        return null;
    }

    try {
        // ดึงอุปกรณ์ทั้งหมดของห้องที่มี entity_id
        const [devices] = await pool.query(
            `SELECT id, device_type, code, entity_id FROM devices 
             WHERE room_id = ? 
             AND entity_id IS NOT NULL AND LTRIM(RTRIM(ISNULL(entity_id, ''))) != ''
             AND (disable = 0 OR disable IS NULL)
             ORDER BY device_type, id`,
            [roomId]
        );

        if (!devices || devices.length === 0) {
            console.log(`[RoomController] No devices with entity_id found for room ${roomId}`);
            return null;
        }

        const result = {
            light: [],
            ac: [],
            erv: []
        };

        for (const device of devices) {
            const entityId = device.entity_id;
            let deviceType = device.device_type || device.code;
            if (deviceType) deviceType = deviceType.toLowerCase();
            if (deviceType === 'air') deviceType = 'ac';

            try {
                const stateResult = await homeAssistantService.getState(entityId);
                const haState = stateResult.state;
                const stateStr = (haState.state || '').toString().toLowerCase();

                // Light devices
                if (deviceType === 'light' || entityId.startsWith('light.') || entityId.startsWith('switch.')) {
                    if (deviceType !== 'erv' && !entityId.includes('erv')) {
                        const isOn = stateStr === 'on';
                        result.light.push({
                            status: isOn,
                            brightness: haState.attributes?.brightness || null
                        });
                        console.log(`[RoomController] HA Light ${entityId}: ${isOn ? 'ON' : 'OFF'}`);
                    }
                }

                // AC / Climate devices
                if (deviceType === 'ac' || entityId.startsWith('climate.')) {
                    const isOn = stateStr !== 'off' && stateStr !== 'unavailable';
                    const mode = isOn ? (haState.state || 'cool') : 'off';
                    const temperature = haState.attributes?.temperature || 25;
                    const fanMode = haState.attributes?.fan_mode || 'auto';
                    
                    result.ac.push({
                        status: isOn,
                        mode: mode,
                        temperature: temperature,
                        settings: {
                            mode: mode,
                            fan_mode: fanMode,
                            temperature: temperature
                        }
                    });
                    console.log(`[RoomController] HA AC ${entityId}: ${isOn ? 'ON' : 'OFF'}, mode=${mode}, temp=${temperature}`);
                }

                // ERV devices — โหมด/ระดับลมจาก sensor+script เดียวกับ sync service
                if (deviceType === 'erv' || entityId.includes('erv')) {
                    const isOn = stateStr === 'on';
                    let settings = { mode: 'normal', speed: 'low' };
                    try {
                        const extra = await homeAssistantSyncService.fetchErvModeAndSpeedFromHomeAssistant(entityId);
                        settings = { mode: extra.mode, speed: extra.speed };
                    } catch (ervExtraErr) {
                        console.warn(`[RoomController] ERV mode/speed from HA failed for ${entityId}:`, ervExtraErr.message);
                    }
                    result.erv.push({
                        status: isOn,
                        settings
                    });
                    console.log(`[RoomController] HA ERV ${entityId}: ${isOn ? 'ON' : 'OFF'}, mode=${settings.mode}, speed=${settings.speed}`);
                }
            } catch (err) {
                console.warn(`[RoomController] Failed to get HA state for ${entityId}:`, err.message);
            }
        }

        console.log(`[RoomController] HA device states for room ${roomId}:`, JSON.stringify(result));
        return result;
    } catch (err) {
        console.error('[RoomController] fetchDeviceStatesFromHomeAssistant error:', err.message);
        return null;
    }
}

/** ดึง entity_id จากตาราง devices ตาม devices.id */
async function getEntityIdByDeviceId(deviceId) {
    const [rows] = await pool.query(
        `SELECT entity_id FROM devices WHERE id = ? AND (disable = 0 OR disable IS NULL)`,
        [deviceId]
    );
    return rows && rows[0] && rows[0].entity_id ? String(rows[0].entity_id).trim() : null;
}

/**
 * ส่งคำสั่งไป Home Assistant สำหรับ entity_id ที่รู้แล้ว
 */
async function sendHomeAssistantEntityControl(entityId, deviceType, status, settings) {
    const action = status === true || status === 1 || status === 'on' || status === 'true' ? 'on' : 'off';
    const domain = entityId.split('.')[0];
    if (deviceType === 'light' || domain === 'light') {
        const opts = settings && settings.brightness != null ? { brightness: settings.brightness } : undefined;
        await homeAssistantService.controlSwitch(entityId, action, opts);
        return { success: true, entityId, action };
    }
    if (domain === 'switch' || deviceType === 'erv') {
        await homeAssistantService.controlSwitch(entityId, action);
        return { success: true, entityId, action };
    }
    if (deviceType === 'ac' || domain === 'climate') {
        const opts = settings && settings.temperature != null ? { temperature: settings.temperature, hvac_mode: settings.mode || 'cool' } : {};
        await homeAssistantService.controlClimate(entityId, action, opts);
        return { success: true, entityId, action };
    }
    await homeAssistantService.controlSwitch(entityId, action);
    return { success: true, entityId, action };
}

async function controlDeviceViaHomeAssistantByDeviceId(deviceId, deviceType, status, settings) {
    const entityId = await getEntityIdByDeviceId(deviceId);
    if (!entityId) return { skipped: true, reason: 'no_entity_id' };
    return sendHomeAssistantEntityControl(entityId, deviceType, status, settings);
}

class RoomController {
    // Get all rooms
    async getAll(req, res) {
        try {
            const { area_id, building_id, room_type_id, search, disable } = req.query;
            
            const rooms = await Room.findAll({
                area_id: area_id ? parseInt(area_id) : undefined,
                building_id: building_id ? parseInt(building_id) : undefined,
                room_type_id: room_type_id ? parseInt(room_type_id) : undefined,
                search,
                disable: disable !== undefined ? parseInt(disable) : 0
            });

            res.json({
                success: true,
                data: rooms
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get rooms list with full details (for DataTables - similar to room-management-portal)
    async list(req, res) {
        try {
            const { booking, id } = req.query;
            
            // Get all rooms with full details
            let query = `
                SELECT r.*, 
                       rt.name as room_type_name,
                       rt.id as room_type_id,
                       a.name as area_name,
                       a.id as area_id,
                       b.id as building_id, 
                       b.name as building_name
                FROM rooms r
                LEFT JOIN room_types rt ON r.room_type_id = rt.id
                LEFT JOIN areas a ON r.area_id = a.id
                LEFT JOIN buildings b ON a.building_id = b.id
                WHERE 1=1
            `;
            const params = [];

            if (id) {
                query += ' AND r.id = ?';
                params.push(parseInt(id));
            }

            if (booking === 'true' || booking === '1') {
                // Only show enabled rooms for booking
                query += ' AND r.disable = 0';
                
                // TODO: Add schedule check if needed
                // This would require checking room_schedules table
            }

            query += ' ORDER BY b.name, a.name, r.name';

            const [rooms] = await pool.query(query, params);

            // Get approvers, devices, and access_users for each room
            const roomsWithDetails = await Promise.all(rooms.map(async (room) => {
                // Get approvers (handle case where table might not exist)
                let approvers = [];
                try {
                    const [approversResult] = await pool.query(`
                        SELECT ap.id, ap.user_id, u.name, u.email
                        FROM approvers ap
                        JOIN users u ON ap.user_id = u.id
                        WHERE ap.room_id = ?
                    `, [room.id]);
                    approvers = approversResult;
                } catch (error) {
                    console.warn(`Error fetching approvers for room ${room.id}:`, error.message);
                    approvers = [];
                }

                // Get devices for the room
                let devices = [];
                try {
                    // First try to get all devices for the room (most reliable method)
                    devices = await Device.getByRoom(room.id);
                    
                    // If we have devices, try to filter for door devices (device_type_id 34 or 35)
                    if (devices.length > 0) {
                        try {
                            const [doorDevices] = await pool.query(`
                                SELECT d.*
                                FROM devices d
                                WHERE d.room_id = ?
                                AND (d.device_type_id IN (34, 35) OR d.device_type_id IS NULL)
                            `, [room.id]);
                            // Only use filtered devices if we found any door devices
                            if (doorDevices && doorDevices.length > 0) {
                                devices = doorDevices;
                            }
                        } catch (error) {
                            // If device_type_id column doesn't exist, just use all devices
                            if (error.code === 'ER_BAD_FIELD_ERROR') {
                                // Keep using all devices
                            } else {
                                console.warn(`Error filtering door devices for room ${room.id}:`, error.message);
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Error fetching devices for room ${room.id}:`, error.message);
                    devices = [];
                }

                // Get access users (users with permanent access to room)
                let accessUsers = [];
                try {
                    const [accessUsersResult] = await pool.query(`
                        SELECT ap.id, u.id as user_id, u.name
                        FROM access_permissions ap
                        JOIN users u ON ap.user_id = u.id
                        WHERE ap.room_id = ?
                    `, [room.id]);
                    accessUsers = accessUsersResult;
                } catch (error) {
                    console.warn(`Error fetching access_users for room ${room.id}:`, error.message);
                    accessUsers = [];
                }

                // Format approvers to match room-management-portal format
                const formattedApprovers = approvers.map(ap => ({
                    id: ap.id,
                    user_id: ap.user_id,
                    user: {
                        id: ap.user_id,
                        name: ap.name,
                        email: ap.email
                    }
                }));

                // Format access users
                const formattedAccessUsers = accessUsers.map(au => ({
                    id: au.id,
                    name: au.name
                }));

                return {
                    ...room,
                    is_active: room.disable === 0 || room.disable === false || room.disable === null,
                    seat: room.capacity || room.seat || null,
                    room_type: room.room_type_name ? {
                        id: room.room_type_id,
                        name: room.room_type_name
                    } : null,
                    area: room.area_name ? {
                        id: room.area_id,
                        name: room.area_name
                    } : null,
                    approvers: formattedApprovers,
                    devices: devices,
                    access_users: formattedAccessUsers,
                    automation: room.automation_enabled || 0,
                    auto_approve: room.auto_approve || 0
                };
            }));

            res.json(roomsWithDetails);
        } catch (error) {
            console.error('List rooms error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get single room
    async getById(req, res) {
        try {
            const room = await Room.findById(req.params.id);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบห้อง'
                });
            }

            res.json({
                success: true,
                data: room
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get room with approvers
    async getWithApprovers(req, res) {
        try {
            const room = await Room.findWithApprovers(req.params.id);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบห้อง'
                });
            }

            res.json({
                success: true,
                data: room
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Create room
    async create(req, res) {
        try {
            const currentUser = req.user;
            
            // user role ไม่สามารถสร้างห้องได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์สร้างห้อง'
                });
            }

            const { name, description, area_id, room_type_id, capacity, facilities, auto_approve, automation_enabled } = req.body;

            if (!name || !area_id) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกข้อมูลที่จำเป็น'
                });
            }

            const room = await Room.create({
                name,
                description,
                area_id,
                room_type_id,
                capacity,
                facilities,
                auto_approve,
                automation_enabled
            });

            res.status(201).json({
                success: true,
                message: 'สร้างห้องสำเร็จ',
                data: room
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update room
    async update(req, res) {
        try {
            const currentUser = req.user;
            console.log('=== UPDATE ROOM REQUEST ===');
            console.log('Room ID:', req.params.id);
            console.log('Body:', JSON.stringify(req.body, null, 2));
            console.log('User:', currentUser?.id, currentUser?.role);
            
            // user role ไม่สามารถแก้ไขห้องได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์แก้ไขห้อง'
                });
            }

            const room = await Room.findById(req.params.id);
            
            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบห้อง'
                });
            }

            const updatedRoom = await Room.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'อัปเดตห้องสำเร็จ',
                data: updatedRoom
            });
        } catch (error) {
            console.error('Room update error:', error);
            console.error('Error stack:', error.stack);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete room
    async delete(req, res) {
        try {
            const currentUser = req.user;
            
            // user role ไม่สามารถลบห้องได้
            if (currentUser.role === 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์ลบห้อง'
                });
            }

            const deleted = await Room.delete(req.params.id);
            
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบห้อง'
                });
            }

            res.json({
                success: true,
                message: 'ลบห้องสำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get room availability for a specific date
    async getAvailability(req, res) {
        try {
            const { date } = req.query;
            
            if (!date) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุวันที่'
                });
            }

            const bookings = await Room.getAvailability(req.params.id, date);

            res.json({
                success: true,
                data: bookings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Add approver to room
    async addApprover(req, res) {
        try {
            const { user_id } = req.body;
            const room_id = req.params.id;

            // Check if already an approver
            const isApprover = await Approver.isApprover(user_id, room_id);
            if (isApprover) {
                return res.status(400).json({
                    success: false,
                    message: 'ผู้ใช้นี้เป็นผู้อนุมัติอยู่แล้ว'
                });
            }

            await Approver.create({ room_id, user_id });

            const approvers = await Approver.findByRoom(room_id);

            res.json({
                success: true,
                message: 'เพิ่มผู้อนุมัติสำเร็จ',
                data: approvers
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Remove approver from room
    async removeApprover(req, res) {
        try {
            const { user_id } = req.body;
            const room_id = req.params.id;

            await Approver.deleteByRoomAndUser(room_id, user_id);

            const approvers = await Approver.findByRoom(room_id);

            res.json({
                success: true,
                message: 'ลบผู้อนุมัติสำเร็จ',
                data: approvers
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update auto approve setting
    async updateAutoApprove(req, res) {
        try {
            const { auto_approve } = req.body;
            
            const room = await Room.update(req.params.id, { auto_approve });

            res.json({
                success: true,
                message: auto_approve ? 'เปิดใช้งานอนุมัติอัตโนมัติ' : 'ปิดใช้งานอนุมัติอัตโนมัติ',
                data: room
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get room devices (positions and states)
    async getDevices(req, res) {
        try {
            const roomId = parseInt(req.params.id);
            const room = await Room.findById(roomId);
            const areaId = room && room.area_id != null ? Number(room.area_id) : null;

            // Get device positions (จาก rooms.x1,y1,x2,y2 / device_positions; fallback ไป devices หรือ device_positions)
            let positions;
            try {
                positions = await Room.getDevicePositions(roomId);
            } catch (e1) {
                try {
                    positions = await Device.getPositionsByRoom(roomId);
                } catch (e2) {
                    console.warn('[RoomController] Room/Device positions failed, using device_positions:', e2.message);
                    positions = await DevicePosition.getByRoom(roomId);
                }
            }

            // Get device states (prefer Home Assistant > Control API > DB)
            let deviceStates = null;
            let source = 'db';

            // ลอง Home Assistant ก่อน (ถ้าเปิดใช้งาน)
            if (homeAssistantService.isEnabled()) {
                try {
                    const haStates = await fetchDeviceStatesFromHomeAssistant(roomId);
                    if (haStates && (haStates.light.length > 0 || haStates.ac.length > 0 || haStates.erv.length > 0)) {
                        deviceStates = haStates;
                        source = 'home-assistant';
                        console.log(`[RoomController] Using Home Assistant states for room ${roomId}`);
                    }
                } catch (err) {
                    console.warn('[RoomController] Home Assistant fetch failed:', err.message);
                }
            }

            // ลอง Control API (ถ้า HA ไม่มีหรือล้มเหลว)
            if (!deviceStates && roomControlProxyService.isStatusEnabled()) {
                try {
                    const remote = await roomControlProxyService.fetchDeviceStatesByRoomId({ roomId });
                    if (remote && remote.deviceStates) {
                        deviceStates = remote.deviceStates;
                        source = 'control-api';
                    }
                } catch (err) {
                    console.warn('[RoomController] Control API status fetch failed:', err.message);
                }
            }

            // Fallback to DB
            if (!deviceStates) {
                deviceStates = await DeviceState.getByRoom(roomId);
                source = 'db';
            }

            // deviceIdsByType: ใช้ map icon index -> device_id (ORDER BY devices.id)
            const [devRows] = await pool.query(
                `SELECT id,
                        LOWER(COALESCE(NULLIF(LTRIM(RTRIM(device_type)), ''), NULLIF(LTRIM(RTRIM(code)), ''))) AS t
                 FROM devices
                 WHERE room_id = ? AND (disable = 0 OR disable IS NULL)
                   AND (
                        LOWER(COALESCE(NULLIF(LTRIM(RTRIM(device_type)), ''), NULLIF(LTRIM(RTRIM(code)), ''))) IN ('light','ac','erv','air','vent_fan','fan','exhaust_fan','ventilation_fan')
                   )
                 ORDER BY id`,
                [roomId]
            );
            const deviceIdsByType = { light: [], ac: [], erv: [], vent_fan: [] };
            (devRows || []).forEach((r) => {
                let t = r.t;
                if (t === 'air') t = 'ac';
                if (t === 'fan' || t === 'exhaust_fan' || t === 'ventilation_fan') t = 'vent_fan';
                if (deviceIdsByType[t]) deviceIdsByType[t].push(r.id);
            });

            // หมายเหตุ: อุปกรณ์ area_id (room_id IS NULL) แสดงเฉพาะบน floor plan หน้า area เท่านั้น
            // ไม่รวมใน room getDevices — ห้องแสดงเฉพาะอุปกรณ์ที่ตั้ง room_id ตรงกับห้องนี้

            res.json({
                success: true,
                data: {
                    positions,
                    deviceStates,
                    deviceIdsByType,
                    source
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    /** ควบคุมอุปกรณ์ทุกตัวของประเภทนั้นในห้อง — POST /rooms/:id/devices/:type (ไม่มี device_index) */
    async controlDevice(req, res) {
        console.log(`[BACKEND DEBUG] ========== controlDevice (bulk by type) ==========`);
        try {
            const roomId = parseInt(req.params.id, 10);
            const room = await Room.findById(roomId);
            const areaId = room && room.area_id != null ? Number(room.area_id) : null;
            const deviceType = req.params.type;

            if (!['light', 'ac', 'erv', 'vent_fan'].includes(deviceType)) {
                return res.status(400).json({ success: false, message: 'Invalid device type' });
            }

            let { status, settings, temperature, mode, speed } = req.body;

            if (typeof status === 'string') {
                status = status === 'on' || status === 'true' || status === '1';
            } else if (typeof status === 'number') {
                status = status === 1;
            }

            if (!settings && (temperature !== undefined || mode !== undefined || speed !== undefined)) {
                settings = {};
                if (temperature !== undefined) settings.temperature = temperature;
                if (mode !== undefined) settings.mode = mode;
                if (speed !== undefined) settings.speed = speed;
            }

            const idsByType = await DeviceState.listRoomDeviceIdsByType(roomId);
            const deviceIds = idsByType[deviceType] || [];

            const isUsingRealAPI = roomControlProxyService.isControlEnabled();
            if (isUsingRealAPI) {
                try {
                    console.log(`[RoomController] Control API bulk: room=${roomId} type=${deviceType} localDevices=${deviceIds.length}`);
                    if (deviceIds.length > 0) {
                        const controlPromises = deviceIds.map((_, idx) =>
                            roomControlProxyService.controlDeviceByRoomId({
                                roomId,
                                deviceType,
                                deviceIndex: idx,
                                status,
                                settings,
                                requestedBy: req.user ? { id: req.user.id, role: req.user.role } : null,
                            }).catch(err => {
                                console.error(`[RoomController] Failed to control device index ${idx}:`, err.message);
                                return { error: err.message, deviceIndex: idx };
                            })
                        );
                        const results = await Promise.allSettled(controlPromises);
                        const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
                        const failed = results.filter(r => r.status === 'rejected' || r.value?.error).length;
                        if (failed > 0 && successful === 0) {
                            throw new Error(`ไม่สามารถควบคุมอุปกรณ์ได้ (ล้มเหลวทั้งหมด ${failed} อุปกรณ์)`);
                        }
                    } else if (roomControlProxyService.isStatusEnabled()) {
                        try {
                            const statusData = await roomControlProxyService.fetchDeviceStatesByRoomId({ roomId });
                            const deviceStates = statusData.deviceStates || {};
                            const devices = deviceStates[deviceType] || [];
                            if (Array.isArray(devices) && devices.length > 0) {
                                const controlPromises = devices.map((device, index) =>
                                    roomControlProxyService.controlDeviceByRoomId({
                                        roomId,
                                        deviceType,
                                        deviceIndex: device.device_index !== undefined ? device.device_index : index,
                                        status,
                                        settings,
                                        requestedBy: req.user ? { id: req.user.id, role: req.user.role } : null,
                                    }).catch(err => ({ error: err.message }))
                                );
                                const results = await Promise.allSettled(controlPromises);
                                const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
                                const failed = results.filter(r => r.status === 'rejected' || r.value?.error).length;
                                if (failed > 0 && successful === 0) {
                                    throw new Error(`ไม่สามารถควบคุมอุปกรณ์ได้ (ล้มเหลวทั้งหมด ${failed} อุปกรณ์)`);
                                }
                            } else {
                                await roomControlProxyService.controlDeviceByRoomId({
                                    roomId,
                                    deviceType,
                                    deviceIndex: null,
                                    status,
                                    settings,
                                    requestedBy: req.user ? { id: req.user.id, role: req.user.role } : null,
                                });
                            }
                        } catch (statusErr) {
                            console.warn('[RoomController] fetchDeviceStatesByRoomId failed:', statusErr.message);
                            await roomControlProxyService.controlDeviceByRoomId({
                                roomId,
                                deviceType,
                                deviceIndex: null,
                                status,
                                settings,
                                requestedBy: req.user ? { id: req.user.id, role: req.user.role } : null,
                            });
                        }
                    } else {
                        await roomControlProxyService.controlDeviceByRoomId({
                            roomId,
                            deviceType,
                            deviceIndex: null,
                            status,
                            settings,
                            requestedBy: req.user ? { id: req.user.id, role: req.user.role } : null,
                        });
                    }
                } catch (err) {
                    console.error('[RoomController] Control API call failed:', err.message);
                    return res.status(502).json({
                        success: false,
                        message: 'ไม่สามารถสั่งควบคุมอุปกรณ์ได้ (Control API)',
                        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
                    });
                }
            }

            if (!isUsingRealAPI && homeAssistantService.isEnabled()) {
                try {
                    const roomDevIds = (await DeviceState.listRoomDeviceIdsByType(roomId))[deviceType] || [];
                    for (const did of roomDevIds) {
                        try {
                            await controlDeviceViaHomeAssistantByDeviceId(did, deviceType, status, settings);
                        } catch (err) {
                            console.warn(`[RoomController] HA control failed device_id=${did}:`, err.message);
                        }
                    }
                    if (areaId != null) {
                        const areaDevIds = (await DeviceState.listAreaDeviceIdsByType(areaId))[deviceType] || [];
                        for (const did of areaDevIds) {
                            try {
                                await controlDeviceViaHomeAssistantByDeviceId(did, deviceType, status, settings);
                            } catch (err) {
                                console.warn(`[RoomController] HA area control failed device_id=${did}:`, err.message);
                            }
                        }
                    }
                } catch (err) {
                    console.warn('[RoomController] Direct HA control failed:', err.message);
                }
            }

            if (deviceIds.length > 0) {
                if (isUsingRealAPI) {
                    for (const deviceId of deviceIds) {
                        await DeviceState.upsertRoomStateByDeviceId(roomId, deviceId, deviceType, status, settings);
                    }
                } else {
                    await DeviceState.setMultipleStates(
                        roomId,
                        deviceType,
                        deviceIds.map(() => ({ status, settings }))
                    );
                }
            } else if (!isUsingRealAPI) {
                return res.json({
                    success: true,
                    message: `ไม่มีอุปกรณ์ ${deviceType} ในห้องนี้`,
                });
            }

            res.json({
                success: true,
                message: 'ควบคุมอุปกรณ์สำเร็จ',
            });
        } catch (error) {
            console.error(`[BACKEND DEBUG] Error in controlDevice:`, error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message,
            });
        }
    }

    // Control device by device_id (preferred)
    // POST /rooms/:id/devices/by-id/:deviceId
    async controlDeviceById(req, res) {
        try {
            const roomId = parseInt(req.params.id, 10);
            const deviceId = parseInt(req.params.deviceId, 10);
            if (Number.isNaN(roomId) || Number.isNaN(deviceId)) {
                return res.status(400).json({ success: false, message: 'Invalid roomId/deviceId' });
            }

            const { status, settings, temperature, mode, speed } = req.body;

            // Validate device belongs to this room
            const [rows] = await pool.query(
                `SELECT id, room_id,
                        LOWER(COALESCE(NULLIF(LTRIM(RTRIM(device_type)), ''), NULLIF(LTRIM(RTRIM(code)), ''))) AS t
                 FROM devices
                 WHERE id = ? AND room_id = ? AND (disable = 0 OR disable IS NULL)`,
                [deviceId, roomId]
            );
            if (!rows || rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Device not found in this room' });
            }

            let deviceType = rows[0].t;
            if (deviceType === 'air') deviceType = 'ac';
            if (deviceType === 'fan' || deviceType === 'exhaust_fan' || deviceType === 'ventilation_fan') deviceType = 'vent_fan';
            if (!['light', 'ac', 'erv', 'vent_fan'].includes(deviceType)) {
                return res.status(400).json({ success: false, message: 'Unsupported device type for control' });
            }

            // Normalize boolean status
            let newStatus = status;
            if (typeof newStatus === 'string') newStatus = newStatus === 'on' || newStatus === 'true' || newStatus === '1';
            if (typeof newStatus === 'number') newStatus = newStatus === 1;

            // Build settings if split fields provided
            let newSettings = settings ?? null;
            if (!newSettings && (temperature !== undefined || mode !== undefined || speed !== undefined)) {
                newSettings = {};
                if (temperature !== undefined) newSettings.temperature = temperature;
                if (mode !== undefined) newSettings.mode = mode;
                if (speed !== undefined) newSettings.speed = speed;
            }

            if (typeof status === 'undefined') {
                const [cur] = await pool.query('SELECT status FROM device_states WHERE device_id = ?', [deviceId]);
                newStatus = cur && cur[0] ? !!cur[0].status : false;
            }

            const room = await Room.findById(roomId);
            const areaId = room && room.area_id != null ? Number(room.area_id) : null;
            const isUsingRealAPI = roomControlProxyService.isControlEnabled();

            // Control API ก่อน (ถ้าเปิด) — ล้มเหลวแล้วไม่อัปเดต DB
            if (isUsingRealAPI) {
                try {
                    const extIdx = await DeviceState.getRoomDeviceIndexForDeviceId(roomId, deviceType, deviceId);
                    if (extIdx === null) {
                        return res.status(400).json({
                            success: false,
                            message: 'ไม่พบลำดับอุปกรณ์สำหรับ Control API',
                        });
                    }
                    await roomControlProxyService.controlDeviceByRoomId({
                        roomId,
                        deviceType,
                        deviceIndex: extIdx,
                        status: newStatus,
                        settings: newSettings,
                        requestedBy: req.user ? { id: req.user.id, role: req.user.role } : null,
                    });
                } catch (err) {
                    console.error('[RoomController] controlDeviceById Control API failed:', err.message);
                    return res.status(502).json({
                        success: false,
                        message: 'ไม่สามารถสั่งควบคุมอุปกรณ์ได้ (Control API)',
                        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
                    });
                }
            } else if (homeAssistantService.isEnabled()) {
                try {
                    const haResult = await controlDeviceViaHomeAssistantByDeviceId(deviceId, deviceType, newStatus, newSettings);
                    if (haResult.skipped) {
                        console.log(`[RoomController] controlDeviceById: no entity_id for device_id=${deviceId}, skip HA`);
                    }
                } catch (err) {
                    console.warn('[RoomController] controlDeviceById HA failed:', err.message);
                }
            }

            await DeviceState.upsertRoomStateByDeviceId(roomId, deviceId, deviceType, newStatus, newSettings);

            res.json({
                success: true,
                message: 'Device state updated',
                data: { roomId, deviceId, deviceType, status: !!newStatus, settings: newSettings }
            });
        } catch (error) {
            console.error('Error controlling device by id:', error);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด', error: error.message });
        }
    }

    // Get device positions (จาก rooms; fallback ไป devices / device_positions)
    async getDevicePositions(req, res) {
        try {
            const roomId = parseInt(req.params.id);
            let positions;
            try {
                positions = await Room.getDevicePositions(roomId);
            } catch (e1) {
                try {
                    positions = await Device.getPositionsByRoom(roomId);
                } catch (e2) {
                    positions = await DevicePosition.getByRoom(roomId);
                }
            }
            if (!positions.light) positions.light = [];
            if (!positions.ac) positions.ac = [];
            if (!positions.erv) positions.erv = [];
            
            res.json({
                success: true,
                data: positions
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำแหน่งอุปกรณ์',
                error: error.message
            });
        }
    }

    // Save device positions (ลงตาราง devices โดยใช้ x, y columns)
    async saveDevicePositions(req, res) {
        try {
            const roomId = parseInt(req.params.id);
            const { positions } = req.body;
            
            console.log('[RoomController] saveDevicePositions roomId=', roomId, 'positions=', JSON.stringify(positions));
            
            if (!positions) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาส่งข้อมูลตำแหน่งอุปกรณ์'
                });
            }
            
            // บันทึกลงตาราง devices (x, y columns)
            await Room.setDevicePositions(roomId, positions);
            console.log('[RoomController] บันทึกตำแหน่งลง devices table แล้ว roomId=', roomId);
            
            res.json({
                success: true,
                message: 'บันทึกตำแหน่งอุปกรณ์สำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการบันทึกตำแหน่งอุปกรณ์',
                error: error.message
            });
        }
    }

    // Get environmental data (ล่าสุดจาก environmental_data ตาม room_id)
    async getEnvironmentalData(req, res) {
        try {
            const roomId = parseInt(req.params.id, 10);
            if (Number.isNaN(roomId)) {
                return res.status(400).json({ success: false, message: 'room id ไม่ถูกต้อง' });
            }

            // ดึงค่าล่าสุดจาก Home Assistant ลง environmental_data ก่อน (ถ้าเปิด HA และห้องมี aqi/am319)
            try {
                const syncResult = await environmentalHaSyncService.syncEnvironmentalFromHaForRoom(roomId);
                if (syncResult.ok && syncResult.reason === 'inserted') {
                    console.log(`[RoomController] environmental HA sync for room ${roomId}:`, syncResult.reason);
                }
            } catch (syncErr) {
                console.warn('[RoomController] environmental HA sync skipped:', syncErr.message);
            }

            let row = null;
            try {
                // อุปกรณ์คุณภาพอากาศ (AQI / AM319): ใช้ devices.id เป็น device_id ใน environmental_data
                const [aqiDevices] = await pool.query(
                    `SELECT d.id FROM devices d
                     LEFT JOIN device_types dt ON d.device_type_id = dt.id
                     WHERE d.room_id = ?
                     AND (d.disable = 0 OR d.disable IS NULL)
                     AND (
                       LOWER(LTRIM(RTRIM(ISNULL(d.device_type, N'')))) IN (N'aqi', N'am319')
                       OR LOWER(LTRIM(RTRIM(ISNULL(d.code, N'')))) IN (N'aqi', N'am319')
                       OR LOWER(LTRIM(RTRIM(ISNULL(d.code, N'')))) LIKE N'am319%'
                       OR LOWER(LTRIM(RTRIM(ISNULL(d.code, N'')))) LIKE N'aqi%'
                       OR LOWER(LTRIM(RTRIM(ISNULL(dt.name, N'')))) IN (N'aqi', N'am319')
                       OR LOWER(LTRIM(RTRIM(ISNULL(dt.name, N'')))) LIKE N'am319%'
                       OR LOWER(LTRIM(RTRIM(ISNULL(dt.name, N'')))) LIKE N'aqi%'
                     )`,
                    [roomId]
                );
                const aqiDeviceIds = (aqiDevices || [])
                    .map((r) => r.id)
                    .filter((id) => id != null)
                    .map((id) => Number(id));

                let rows = [];
                if (aqiDeviceIds.length > 0) {
                    const inPlaceholders = aqiDeviceIds.map(() => '?').join(', ');
                    // รองรับข้อมูลที่ ingest ใส่แค่ device_id โดย room_id ยังเป็น NULL
                    [rows] = await pool.query(
                        `SELECT TOP 1 temperature, humidity, co2, tvoc, pressure, pm25, pm10, hcho, noise, timestamp
                         FROM environmental_data
                         WHERE device_id IN (${inPlaceholders})
                         AND (room_id IS NULL OR room_id = ?)
                         ORDER BY timestamp DESC`,
                        [...aqiDeviceIds, roomId]
                    );
                }
                if (!rows || !rows[0]) {
                    [rows] = await pool.query(
                        `SELECT TOP 1 temperature, humidity, co2, tvoc, pressure, pm25, pm10, hcho, noise, timestamp
                         FROM environmental_data
                         WHERE room_id = ?
                         ORDER BY timestamp DESC`,
                        [roomId]
                    );
                }
                row = rows && rows[0];
            } catch (dbErr) {
                console.warn('[RoomController] environmental_data query failed:', dbErr.message);
            }

            const environmentalData = row
                ? {
                    co2: row.co2 != null ? parseFloat(row.co2) : null,
                    temp: row.temperature != null ? parseFloat(row.temperature) : null,
                    noise: row.noise != null ? parseFloat(row.noise) : null,
                    humidity: row.humidity != null ? parseFloat(row.humidity) : null,
                    motion: null,
                    pm25: row.pm25 != null ? parseFloat(row.pm25) : null,
                    pm10: row.pm10 != null ? parseFloat(row.pm10) : null,
                    pressure: row.pressure != null ? parseFloat(row.pressure) : null,
                    hcho: row.hcho != null ? parseFloat(row.hcho) : null,
                    tvoc: row.tvoc != null ? parseFloat(row.tvoc) : null,
                    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : null,
                }
                : {
                    co2: null,
                    temp: null,
                    noise: null,
                    humidity: null,
                    motion: null,
                    pm25: null,
                    pm10: null,
                    pressure: null,
                    hcho: null,
                    tvoc: null,
                    timestamp: null,
                };

            res.json({
                success: true,
                data: environmentalData
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสภาพแวดล้อม',
                error: error.message
            });
        }
    }

    // Get Room Permissions
    async getPermissions(req, res) {
        try {
            const room_id = req.params.id;
            
            const [rows] = await pool.query(`
                SELECT ap.id, ap.room_id, ap.user_id, u.name as user_name, u.email as user_email,
                       ap.created_at, ap.updated_at
                FROM access_permissions ap
                LEFT JOIN users u ON ap.user_id = u.id
                WHERE ap.room_id = ?
                ORDER BY ap.created_at DESC
            `, [room_id]);

            res.json({
                success: true,
                data: rows
            });
        } catch (error) {
            console.error('Get permissions error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Add Room Permission
    async addPermission(req, res) {
        try {
            const room_id = req.params.id;
            const { user_ids } = req.body;

            if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ user_ids เป็น array'
                });
            }

            const results = {
                success: [],
                failed: []
            };

            for (const user_id of user_ids) {
                try {
                    // Check if permission already exists
                    const [existing] = await pool.query(
                        'SELECT id FROM access_permissions WHERE room_id = ? AND user_id = ?',
                        [room_id, user_id]
                    );

                    if (existing.length > 0) {
                        results.failed.push({
                            user_id: user_id,
                            error: 'มีสิทธิ์การเข้าถึงอยู่แล้ว'
                        });
                        continue;
                    }

                    // Create permission
                    const [result] = await pool.query(
                        'INSERT INTO access_permissions (room_id, user_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
                        [room_id, user_id]
                    );

                    results.success.push({
                        id: result.insertId,
                        room_id: room_id,
                        user_id: user_id
                    });
                } catch (error) {
                    results.failed.push({
                        user_id: user_id,
                        error: error.message
                    });
                }
            }

            res.json({
                success: true,
                message: `เพิ่มสิทธิ์สำเร็จ ${results.success.length} รายการ, ล้มเหลว ${results.failed.length} รายการ`,
                results: results
            });
        } catch (error) {
            console.error('Add permission error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete Room Permission
    async deletePermission(req, res) {
        try {
            const { id, permissionId } = req.params;

            const [result] = await pool.query(
                'DELETE FROM access_permissions WHERE id = ? AND room_id = ?',
                [permissionId, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบสิทธิ์การเข้าถึง'
                });
            }

            res.json({
                success: true,
                message: 'ลบสิทธิ์การเข้าถึงสำเร็จ'
            });
        } catch (error) {
            console.error('Delete permission error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get Room Schedules
    async getSchedules(req, res) {
        try {
            const room_id = req.params.id;

            const [rows] = await pool.query(`
                SELECT * FROM room_schedules
                WHERE room_id = ?
                ORDER BY start_datetime ASC
            `, [room_id]);

            res.json({
                success: true,
                data: rows
            });
        } catch (error) {
            console.error('Get schedules error:', error);
            // If table doesn't exist, return empty array
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.json({
                    success: true,
                    data: []
                });
            }
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Create Room Schedule
    async createSchedule(req, res) {
        try {
            const room_id = req.params.id;
            const { start_datetime, end_datetime, disable } = req.body;

            if (!start_datetime || !end_datetime) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด'
                });
            }

            const [result] = await pool.query(`
                INSERT INTO room_schedules (room_id, start_datetime, end_datetime, disable, created_at, updated_at)
                VALUES (?, ?, ?, ?, NOW(), NOW())
            `, [room_id, start_datetime, end_datetime, disable ? 1 : 0]);

            res.json({
                success: true,
                message: 'สร้างตารางเวลาสำเร็จ',
                data: {
                    id: result.insertId,
                    room_id: room_id,
                    start_datetime: start_datetime,
                    end_datetime: end_datetime,
                    disable: disable ? 1 : 0
                }
            });
        } catch (error) {
            console.error('Create schedule error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete Room Schedule
    async deleteSchedule(req, res) {
        try {
            const { id, scheduleId } = req.params;

            const [result] = await pool.query(
                'DELETE FROM room_schedules WHERE id = ? AND room_id = ?',
                [scheduleId, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบตารางเวลา'
                });
            }

            res.json({
                success: true,
                message: 'ลบตารางเวลาสำเร็จ'
            });
        } catch (error) {
            console.error('Delete schedule error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Control Door
    async controlDoor(req, res) {
        try {
            // Support both formats:
            // 1. POST /rooms/control-door with { id: device_id, action: ... } in body (room-management-portal format)
            // 2. POST /rooms/:id/control-door with { device_id, action } in body
            const device_id = req.body.id || req.body.device_id;
            const action = req.body.action;
            const room_id = req.params.id;

            if (!device_id || !action) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาระบุ device_id (id) และ action'
                });
            }

            if (!['open', 'close', 'alwaysOpen', 'alwaysClose'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    message: 'action ต้องเป็น open, close, alwaysOpen, หรือ alwaysClose'
                });
            }

            // Get device info
            const device = await Device.findById(device_id);

            if (!device) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบอุปกรณ์'
                });
            }

            // Get room_id from device if not provided
            const actualRoomId = room_id || device.room_id;

            // Here you would integrate with your door control system
            // For now, we'll just log and return success
            console.log(`Controlling door: Room ${actualRoomId}, Device ${device_id}, Action: ${action}`);

            // TODO: Implement actual door control logic here
            // This should integrate with the physical door control system

            res.json({
                success: true,
                message: `ควบคุมประตูสำเร็จ: ${action}`,
                data: {
                    room_id: room_id,
                    device_id: device_id,
                    action: action
                }
            });
        } catch (error) {
            console.error('Control door error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update Automation Status
    async updateAutomationStatus(req, res) {
        try {
            const room_id = req.params.id;
            // Support both automation_enabled and automation (for compatibility)
            const automation_enabled = req.body.automation_enabled !== undefined 
                ? req.body.automation_enabled 
                : req.body.automation;

            const room = await Room.update(room_id, { automation_enabled: automation_enabled ? 1 : 0 });

            res.json({
                success: true,
                message: 'อัปเดตสถานะอัตโนมัติสำเร็จ',
                data: room
            });
        } catch (error) {
            console.error('Update automation status error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Upload Room Image (super-admin only)
    async uploadImage(req, res) {
        try {
            const room_id = req.params.id;
            
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาอัปโหลดไฟล์รูปภาพ'
                });
            }

            // Update room with image path (multer already saved the file)
            const imagePath = `/uploads/room_images/${req.file.filename}`;
            const room = await Room.update(room_id, { image: imagePath });

            // Return full URL
            const baseUrl = req.protocol + '://' + req.get('host');

            res.json({
                success: true,
                message: 'อัปโหลดรูปภาพสำเร็จ',
                data: {
                    image_url: imagePath,
                    image_full_url: baseUrl + imagePath,
                    room: room
                }
            });
        } catch (error) {
            console.error('Upload image error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }
}

module.exports = new RoomController();




