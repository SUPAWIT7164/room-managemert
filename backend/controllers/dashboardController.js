const User = require('../models/User');
const Building = require('../models/Building');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Device = require('../models/Device');
const Visitor = require('../models/Visitor');

class DashboardController {
    // Get dashboard statistics (แต่ละส่วนใช้ default ถ้า query ล้มเหลว เพื่อไม่ให้ 500 ทั้งก้อน)
    async getStats(req, res) {
        const today = new Date().toISOString().split('T')[0];
        const safe = async (fn, fallback) => {
            try {
                return await fn();
            } catch (e) {
                console.error('[Dashboard.getStats]', e?.message || e);
                return fallback;
            }
        };

        const totalUsers = await safe(() => User.count({ is_active: 1 }), 0);
        const totalBuildings = await safe(() => Building.count(), 0);
        const totalRooms = await safe(() => Room.count(), 0);
        const totalDevices = await safe(() => Device.count(), 0);
        const pendingBookings = await safe(() => Booking.count({ status: null }), 0);
        const todayBookings = await safe(() => Booking.findAll({ date: today }), []);
        const approvedBookings = await safe(() => Booking.count({ status: 1 }), 0);
        const todayVisitors = await safe(() => Visitor.count({ date: today }), 0);

        let rooms = await safe(() => Room.findAll({ disable: 0 }), []);
        const now = new Date();
        const roomAvailability = [];

        for (const room of rooms) {
            try {
                const bookings = await Room.getAvailability(room.id, today);
                const isAvailable = bookings.length === 0 || !bookings.some(b => {
                    try {
                        const start = new Date(b.start || b.start_time || b.start_datetime);
                        const end = new Date(b.end || b.end_time || b.end_datetime);
                        const status = b.status;
                        const isApproved = status === 1 || status === 'approved';
                        const isPending = status === null || status === 0 || status === 'pending';
                        const isCancelled = b.cancel === 1;
                        const isRejected = b.reject === 1;
                        return now >= start && now <= end && (isApproved || isPending) && !isCancelled && !isRejected;
                    } catch (e) {
                        return false;
                    }
                });
                roomAvailability.push({
                    id: room.id,
                    name: room.name,
                    building_name: room.building_name || '',
                    area_name: room.area_name || '',
                    isAvailable
                });
            } catch (e) {
                console.error('[Dashboard.getStats] room availability', room.id, e?.message);
                roomAvailability.push({
                    id: room.id,
                    name: room.name,
                    building_name: room.building_name || '',
                    area_name: room.area_name || '',
                    isAvailable: true
                });
            }
        }

        const filteredTodayBookings = Array.isArray(todayBookings) ? todayBookings.filter(b => {
            const status = b.status;
            const isApproved = status === 1 || status === 'approved';
            const isPending = status === null || status === 0 || status === 'pending';
            const isCancelled = b.cancel === 1;
            const isRejected = b.reject === 1;
            return (isApproved || isPending) && !isCancelled && !isRejected;
        }) : [];

        try {
            res.json({
                success: true,
                data: {
                    users: totalUsers,
                    buildings: totalBuildings,
                    rooms: totalRooms,
                    devices: totalDevices,
                    pendingBookings,
                    todayBookingsCount: filteredTodayBookings.length,
                    todayBookings: filteredTodayBookings,
                    approvedBookings,
                    todayVisitors,
                    roomAvailability
                }
            });
        } catch (error) {
            console.error('[Dashboard.getStats] response error:', error?.message);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error?.message
            });
        }
    }

    // Get recent activities
    async getRecentActivities(req, res) {
        try {
            const [recentBookings, recentVisitors] = await Promise.all([
                Booking.findAll({ limit: 10 }),
                Visitor.findAll({ limit: 10 })
            ]);

            res.json({
                success: true,
                data: {
                    bookings: recentBookings,
                    visitors: recentVisitors
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

    // Get booking statistics
    async getBookingStats(req, res) {
        try {
            const { start_date, end_date } = req.query;
            
            const stats = await Booking.getStatistics({
                start_date,
                end_date
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get room availability overview
    async getRoomAvailability(req, res) {
        try {
            const rooms = await Room.findAll({ disable: 0 });
            const today = new Date().toISOString().split('T')[0];

            const roomsWithAvailability = await Promise.all(
                rooms.map(async (room) => {
                    const bookings = await Room.getAvailability(room.id, today);
                    return {
                        ...room,
                        capacity: room.seat,
                        todayBookings: bookings,
                        isAvailable: bookings.length === 0 || !bookings.some(b => {
                            const now = new Date();
                            const start = new Date(b.start || b.start_time || b.start_datetime);
                            const end = new Date(b.end || b.end_time || b.end_datetime);
                            const status = b.status;
                            const isApproved = status === 1 || status === 'approved';
                            const isPending = status === null || status === 0 || status === 'pending';
                            const isCancelled = b.cancel === 1;
                            const isRejected = b.reject === 1;
                            return now >= start && now <= end && (isApproved || isPending) && !isCancelled && !isRejected;
                        })
                    };
                })
            );

            res.json({
                success: true,
                data: roomsWithAvailability
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }
}

module.exports = new DashboardController();
