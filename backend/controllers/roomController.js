const Room = require('../models/Room');
const Approver = require('../models/Approver');
const Device = require('../models/Device');
const DeviceState = require('../models/DeviceState');
const DevicePosition = require('../models/DevicePosition');
const { pool } = require('../config/database');

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
            
            // Get device positions
            const positions = await DevicePosition.getByRoom(roomId);
            
            // Get device states
            const deviceStates = await DeviceState.getByRoom(roomId);
            
            res.json({
                success: true,
                data: {
                    positions,
                    deviceStates
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

    // Control individual device
    async controlDevice(req, res) {
        console.log(`[BACKEND DEBUG] ========== controlDevice called ==========`);
        console.log(`[BACKEND DEBUG] Request method: ${req.method}`);
        console.log(`[BACKEND DEBUG] Request URL: ${req.originalUrl}`);
        console.log(`[BACKEND DEBUG] Request params:`, req.params);
        console.log(`[BACKEND DEBUG] Request body:`, req.body);
        console.log(`[BACKEND DEBUG] Request user:`, req.user?.id, req.user?.role);
        try {
            const roomId = parseInt(req.params.id);
            const deviceType = req.params.type; // light, ac, erv
            const deviceIndex = req.params.index ? parseInt(req.params.index) : null;
            let { status, settings, temperature, mode, speed } = req.body;
            
            // Convert status to boolean if it's a string
            console.log(`[BACKEND DEBUG] controlDevice: received status=${status} (${typeof status})`);
            if (typeof status === 'string') {
                status = status === 'on' || status === 'true' || status === '1';
                console.log(`[BACKEND DEBUG] controlDevice: converted string status to boolean: ${status}`);
            } else if (typeof status === 'number') {
                status = status === 1;
                console.log(`[BACKEND DEBUG] controlDevice: converted number status to boolean: ${status}`);
            } else {
                console.log(`[BACKEND DEBUG] controlDevice: status is already boolean: ${status}`);
            }
            
            // Build settings object if individual properties are provided
            if (!settings && (temperature !== undefined || mode !== undefined || speed !== undefined)) {
                settings = {};
                if (temperature !== undefined) settings.temperature = temperature;
                if (mode !== undefined) settings.mode = mode;
                if (speed !== undefined) settings.speed = speed;
            }
            
            if (deviceIndex !== null) {
                // Control single device
                console.log(`[BACKEND DEBUG] Setting single device state: roomId=${roomId}, type=${deviceType}, index=${deviceIndex}, status=${status}`);
                await DeviceState.setDeviceState(roomId, deviceType, deviceIndex, status, settings);
            } else {
                // Control all devices of this type
                const positions = await DevicePosition.getByRoom(roomId);
                const devicePositions = positions[deviceType] || [];
                
                console.log(`[BACKEND DEBUG] Setting multiple device states: roomId=${roomId}, type=${deviceType}`);
                console.log(`[BACKEND DEBUG] Device positions from DB:`, devicePositions);
                console.log(`[BACKEND DEBUG] Device positions count: ${devicePositions.length}`);
                
                // IMPORTANT: Check BOTH device positions AND existing device_states
                // Use the MAXIMUM count to ensure we update ALL existing devices
                let deviceCount = devicePositions.length;
                
                // Always check existing device_states
                console.log(`[BACKEND DEBUG] Checking existing device states for maximum count...`);
                const [existingStates] = await pool.query(
                    `SELECT MAX(device_index) as max_index FROM device_states 
                     WHERE room_id = ? AND device_type = ?`,
                    [roomId, deviceType]
                );
                
                if (existingStates.length > 0 && existingStates[0].max_index !== null) {
                    const existingCount = existingStates[0].max_index + 1;
                    console.log(`[BACKEND DEBUG] Found ${existingCount} existing device_states`);
                    // Use the MAXIMUM of positions count and existing states count
                    deviceCount = Math.max(deviceCount, existingCount);
                    console.log(`[BACKEND DEBUG] Using maximum count: ${deviceCount}`);
                } else if (deviceCount === 0) {
                    // No device data found at all, create default devices
                    console.log(`[BACKEND DEBUG] No device data found, creating default devices for type ${deviceType}`);
                    const defaultCounts = {
                        light: 14,
                        ac: 3,
                        erv: 3
                    };
                    deviceCount = defaultCounts[deviceType] || 0;
                    if (deviceCount === 0) {
                        console.error(`[BACKEND DEBUG] ERROR: Unknown device type ${deviceType}`);
                        return res.status(400).json({
                            success: false,
                            message: `ไม่รู้จักประเภทอุปกรณ์ ${deviceType}`
                        });
                    }
                    console.log(`[BACKEND DEBUG] Creating ${deviceCount} default ${deviceType} devices with status=false`);
                }
                
                const states = Array(deviceCount).fill(null).map(() => ({
                    status: status,
                    settings: settings
                }));
                
                console.log(`[BACKEND DEBUG] Creating ${states.length} device states with status=${status}`);
                const result = await DeviceState.setMultipleStates(roomId, deviceType, states);
                console.log(`[BACKEND DEBUG] setMultipleStates result:`, result);
                console.log(`[BACKEND DEBUG] Successfully saved ${states.length} device states to database`);
            }
            
            res.json({
                success: true,
                message: 'ควบคุมอุปกรณ์สำเร็จ'
            });
        } catch (error) {
            console.error(`[BACKEND DEBUG] Error in controlDevice:`, error);
            console.error(`[BACKEND DEBUG] Error stack:`, error.stack);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get device positions
    async getDevicePositions(req, res) {
        try {
            const roomId = parseInt(req.params.id);
            const positions = await DevicePosition.getByRoom(roomId);
            
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

    // Save device positions
    async saveDevicePositions(req, res) {
        try {
            const roomId = parseInt(req.params.id);
            const { positions } = req.body;
            
            if (!positions) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาส่งข้อมูลตำแหน่งอุปกรณ์'
                });
            }
            
            await DevicePosition.setAllPositions(roomId, positions);
            
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

    // Get environmental data
    async getEnvironmentalData(req, res) {
        try {
            const roomId = parseInt(req.params.id);
            
            // Sample environmental data (can be replaced with actual sensor data)
            const environmentalData = {
                co2: 497,
                temp: 25.8,
                noise: 45.5,
                humidity: 57,
                motion: 'Active',
                pm25: 46,
                pm10: 55,
                pressure: 978.3,
                hcho: 0.02,
                tvoc: 1.45
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




