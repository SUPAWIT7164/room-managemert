const Approver = require('../models/Approver');

class ApproverController {
    // Get approvers by room
    async getByRoom(req, res) {
        try {
            const approvers = await Approver.findByRoom(req.params.roomId);

            res.json({
                success: true,
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

    // Get rooms that user is approver of
    async getMyRooms(req, res) {
        try {
            const rooms = await Approver.findByUser(req.user.id);

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

    // Add approver
    async add(req, res) {
        try {
            const { room_id, user_id } = req.body;

            // Check if already an approver
            const isApprover = await Approver.isApprover(user_id, room_id);
            if (isApprover) {
                return res.status(400).json({
                    success: false,
                    message: 'ผู้ใช้นี้เป็นผู้อนุมัติอยู่แล้ว'
                });
            }

            const approver = await Approver.create({ room_id, user_id });

            res.status(201).json({
                success: true,
                message: 'เพิ่มผู้อนุมัติสำเร็จ',
                data: approver
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Remove approver
    async remove(req, res) {
        try {
            const deleted = await Approver.delete(req.params.id);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบผู้อนุมัติ'
                });
            }

            res.json({
                success: true,
                message: 'ลบผู้อนุมัติสำเร็จ'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Get pending bookings for approver
    async getPendingBookings(req, res) {
        try {
            const bookings = await Approver.getPendingBookingsForApprover(req.user.id);

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
}

module.exports = new ApproverController();

















