const User = require('../models/User');
const Building = require('../models/Building');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Device = require('../models/Device');
const Visitor = require('../models/Visitor');

class DashboardController {
    // Get dashboard statistics
    async getStats(req, res) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const [
                totalUsers,
                totalBuildings,
                totalRooms,
                totalDevices,
                pendingBookings,
                todayBookings,
                approvedBookings,
                todayVisitors
            ] = await Promise.all([
                User.count({ active: 1 }),
                Building.count(),
                Room.count(),
                Device.count(),
                Booking.count({ status: 'pending' }),
                Booking.findAll({ date: today }),
                Booking.count({ status: 'approved' }),
                Visitor.count({ date: today })
            ]);

            res.json({
                success: true,
                data: {
                    users: totalUsers,
                    buildings: totalBuildings,
                    rooms: totalRooms,
                    devices: totalDevices,
                    pendingBookings,
                    todayBookingsCount: todayBookings.length,
                    todayBookings: todayBookings.filter(b => b.status === 'approved' || b.status === 'pending'),
                    approvedBookings,
                    todayVisitors
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
                            const start = new Date(b.start_time);
                            const end = new Date(b.end_time);
                            return now >= start && now <= end && b.status;
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
