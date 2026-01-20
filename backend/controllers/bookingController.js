const Booking = require('../models/Booking');
const Approver = require('../models/Approver');

class BookingController {
    // Get calendar data
    async getCalendarData(req, res) {
        try {
            const { start, end, room_ids } = req.query;
            
            const options = {};
            if (start) options.start_date = start;
            if (end) options.end_date = end;
            
            let bookings = await Booking.findAll(options);
            
            // Filter by room_ids if provided
            if (room_ids) {
                const roomIdArray = Array.isArray(room_ids) ? room_ids : room_ids.split(',');
                bookings = bookings.filter(b => roomIdArray.includes(String(b.room_id)));
            }
            
            res.json({
                success: true,
                data: bookings
            });
        } catch (error) {
            console.error('Get calendar data error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลปฏิทิน',
                error: error.message
            });
        }
    }

    // Get today's bookings
    async getTodayBookings(req, res) {
        try {
            const bookings = await Booking.getTodayBookings();
            
            res.json({
                success: true,
                data: bookings
            });
        } catch (error) {
            console.error('Get today bookings error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจองวันนี้',
                error: error.message
            });
        }
    }

    // Get my bookings
    async getMyBookings(req, res) {
        try {
            const userId = req.user.id;
            const bookings = await Booking.findAll({ booker_id: userId });
            
            res.json({
                success: true,
                data: bookings
            });
        } catch (error) {
            console.error('Get my bookings error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจองของฉัน',
                error: error.message
            });
        }
    }

    // Check overlap
    async checkOverlap(req, res) {
        try {
            const { room_id, start_datetime, end_datetime, exclude_id } = req.body;
            
            if (!room_id || !start_datetime || !end_datetime) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกข้อมูลที่จำเป็น'
                });
            }
            
            const hasOverlap = await Booking.checkOverlap(
                room_id,
                start_datetime,
                end_datetime,
                exclude_id
            );
            
            res.json({
                success: true,
                hasOverlap: hasOverlap
            });
        } catch (error) {
            console.error('Check overlap error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการตรวจสอบการทับซ้อน',
                error: error.message
            });
        }
    }

    // Get pending bookings for approver
    async getPendingForApprover(req, res) {
        try {
            const approverId = req.user.id;
            
            // Use the existing method from Approver model
            const bookings = await Approver.getPendingBookingsForApprover(approverId);
            
            res.json({
                success: true,
                data: bookings
            });
        } catch (error) {
            console.error('Get pending for approver error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจองที่รออนุมัติ',
                error: error.message
            });
        }
    }

    // Get all bookings
    async getAll(req, res) {
        try {
            const { status, room_id, booker_id, start_date, end_date, limit, offset, page } = req.query;
            const user = req.user;
            
            const options = {};
            if (status) options.status = status;
            if (room_id) options.room_id = parseInt(room_id);
            if (start_date) options.start_date = start_date;
            if (end_date) options.end_date = end_date;
            
            // Apply user-based filtering if the user is a regular user
            // user role จะเห็นเฉพาะการจองของตัวเอง
            if (user.role === 'user') {
                options.booker_id = user.id;
            } else if (booker_id) {
                // admin และ super-admin สามารถกรองตาม booker_id ได้
                options.booker_id = parseInt(booker_id);
            }
            
            // Handle pagination
            const limitValue = limit ? parseInt(limit) : 10;
            const pageValue = page ? parseInt(page) : 1;
            const offsetValue = offset ? parseInt(offset) : (pageValue - 1) * limitValue;
            
            console.log('[BookingController] Pagination params:', { limit, page, limitValue, pageValue, offsetValue });
            console.log('[BookingController] Options before findAll:', { ...options, limit: limitValue, offset: offsetValue });
            
            // Get total count for pagination (without limit/offset)
            const countOptions = { ...options };
            delete countOptions.limit;
            delete countOptions.offset;
            const total = await Booking.count(countOptions);
            
            // Apply limit and offset for data fetching
            // Create a new options object to ensure limit and offset are set correctly
            const findAllOptions = {
                ...options,
                limit: limitValue,
                offset: offsetValue
            };
            
            console.log('[BookingController] Options for findAll:', JSON.stringify(findAllOptions, null, 2));
            console.log('[BookingController] Limit value:', findAllOptions.limit, 'Type:', typeof findAllOptions.limit);
            console.log('[BookingController] Offset value:', findAllOptions.offset, 'Type:', typeof findAllOptions.offset);
            
            const bookings = await Booking.findAll(findAllOptions);
            
            console.log('[BookingController] Found bookings:', bookings.length, 'out of', total, 'total');
            console.log('[BookingController] Expected limit:', limitValue, 'Actual returned:', bookings.length);
            
            if (bookings.length !== Math.min(limitValue, total)) {
                console.warn('[BookingController] WARNING: Expected', Math.min(limitValue, total), 'bookings but got', bookings.length);
            }
            
            const totalPages = Math.ceil(total / limitValue);
            
            res.json({
                success: true,
                data: bookings,
                pagination: {
                    page: pageValue,
                    limit: limitValue,
                    total: total,
                    totalPages: totalPages
                }
            });
        } catch (error) {
            console.error('Get all bookings error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจอง',
                error: error.message
            });
        }
    }

    // Get statistics
    async getStatistics(req, res) {
        try {
            const stats = await Booking.getStatistics();
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Get statistics error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ',
                error: error.message
            });
        }
    }

    // Get booking by ID
    async getById(req, res) {
        try {
            const booking = await Booking.findById(req.params.id);
            
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบการจอง'
                });
            }
            
            res.json({
                success: true,
                data: booking
            });
        } catch (error) {
            console.error('Get booking by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการจอง',
                error: error.message
            });
        }
    }

    // Create booking
    async create(req, res) {
        try {
            console.log('=== Create Booking Request ===');
            console.log('Request body:', JSON.stringify(req.body, null, 2));
            console.log('User:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');
            
            const { room_id, title, name, description, start_datetime, end_datetime, attendees, participants, attendeesEmails } = req.body;
            
            // Validate user is authenticated
            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: 'กรุณาเข้าสู่ระบบ'
                });
            }
            
            const userId = req.user.id;
            
            // Use title or name (frontend might send either)
            const bookingTitle = title || name || 'การจอง';
            
            // Validate required fields
            if (!room_id) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาเลือกห้อง'
                });
            }
            
            if (!start_datetime || !end_datetime) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณากรอกเวลาเริ่มต้นและสิ้นสุด'
                });
            }
            
            // Validate datetime format
            const startDate = new Date(start_datetime);
            const endDate = new Date(end_datetime);
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'รูปแบบวันที่เวลาไม่ถูกต้อง'
                });
            }
            
            if (startDate >= endDate) {
                return res.status(400).json({
                    success: false,
                    message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น'
                });
            }
            
            // Check if room exists
            const Room = require('../models/Room');
            let room;
            try {
                room = await Room.findById(room_id);
                if (!room) {
                    return res.status(404).json({
                        success: false,
                        message: 'ไม่พบห้องที่ระบุ'
                    });
                }
            } catch (roomError) {
                console.error('Error finding room:', roomError);
                return res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลห้อง'
                });
            }
            
            // Check for overlap
            let hasOverlap = false;
            try {
                hasOverlap = await Booking.checkOverlap(room_id, start_datetime, end_datetime);
                if (hasOverlap) {
                    return res.status(400).json({
                        success: false,
                        message: 'ห้องนี้ถูกจองในช่วงเวลานี้แล้ว'
                    });
                }
            } catch (overlapError) {
                console.error('Error checking overlap:', overlapError);
                return res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการตรวจสอบการจองซ้ำ'
                });
            }
            
            // Determine status
            const isSuperAdmin = req.user.role === 'super-admin';
            const status = (room && room.auto_approve) || isSuperAdmin ? 'approved' : 'pending';
            
            // Convert attendeesEmails to participants format if provided
            let participantsData = participants;
            if (attendeesEmails && Array.isArray(attendeesEmails) && attendeesEmails.length > 0) {
                participantsData = attendeesEmails.map(email => ({ email: email }));
            }
            
            // Prepare booking data
            const bookingData = {
                room_id: parseInt(room_id),
                booker_id: userId,
                title: bookingTitle,
                description: description || null,
                start_time: start_datetime,
                end_time: end_datetime,
                attendees: parseInt(attendees) || 0,
                participants: participantsData || null,
                status: status
            };
            
            console.log('Booking data to create:', JSON.stringify(bookingData, null, 2));
            
            // Create booking
            let booking;
            try {
                booking = await Booking.create(bookingData);
                console.log('Booking created successfully:', booking.id);
            } catch (createError) {
                console.error('Error in Booking.create:', createError);
                console.error('Create error details:', {
                    message: createError.message,
                    code: createError.code,
                    sqlState: createError.sqlState,
                    sqlMessage: createError.sqlMessage,
                    sql: createError.sql
                });
                throw createError; // Re-throw to be caught by outer catch
            }
            
            res.status(201).json({
                success: true,
                message: 'ส่งคำขอจองห้องเรียบร้อยแล้ว',
                data: booking
            });
        } catch (error) {
            console.error('=== Create Booking Error ===');
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Error code:', error.code);
            console.error('Error errno:', error.errno);
            console.error('Error sqlState:', error.sqlState);
            console.error('Error sqlMessage:', error.sqlMessage);
            if (error.sql) {
                console.error('SQL:', error.sql);
            }
            console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            
            // Provide more specific error messages
            let errorMessage = 'เกิดข้อผิดพลาดในการจองห้อง';
            if (error.code === 'ER_NO_SUCH_TABLE') {
                errorMessage = 'ไม่พบตาราง booking_requests ในฐานข้อมูล';
            } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                errorMessage = 'โครงสร้างตารางฐานข้อมูลไม่ถูกต้อง';
            } else if (error.code === 'ER_DUP_ENTRY') {
                errorMessage = 'มีการจองซ้ำกัน';
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                errorMessage = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined,
                sqlError: process.env.NODE_ENV === 'development' && error.sqlMessage ? error.sqlMessage : undefined,
                errorCode: process.env.NODE_ENV === 'development' ? error.code : undefined
            });
        }
    }

    // Update booking
    async update(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            
            // Check if booking exists and user owns it
            const existingBooking = await Booking.findById(id);
            if (!existingBooking) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบการจอง'
                });
            }
            
            // Check ownership (unless user is admin)
            const isAdmin = ['super-admin', 'admin', 'Admin'].includes(req.user.role);
            if (existingBooking.user_id !== userId && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์แก้ไขการจองนี้'
                });
            }
            
            // Check if booking can be updated (not approved/rejected/cancelled)
            if (existingBooking.status === 'approved' || existingBooking.status === 'rejected' || existingBooking.status === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    message: 'ไม่สามารถแก้ไขการจองที่อนุมัติ/ปฏิเสธ/ยกเลิกแล้ว'
                });
            }
            
            const { title, description, start_datetime, end_datetime, attendees, participants } = req.body;
            
            // Check for overlap if time changed
            if (start_datetime || end_datetime) {
                const startTime = start_datetime || existingBooking.start_datetime;
                const endTime = end_datetime || existingBooking.end_datetime;
                const hasOverlap = await Booking.checkOverlap(existingBooking.room_id, startTime, endTime, id);
                if (hasOverlap) {
                    return res.status(400).json({
                        success: false,
                        message: 'ห้องนี้ถูกจองในช่วงเวลานี้แล้ว'
                    });
                }
            }
            
            const updateData = {};
            if (title) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (start_datetime) updateData.start_time = start_datetime;
            if (end_datetime) updateData.end_time = end_datetime;
            if (attendees !== undefined) updateData.attendees = attendees;
            if (participants !== undefined) updateData.participants = participants;
            
            const booking = await Booking.update(id, updateData);
            
            res.json({
                success: true,
                message: 'อัปเดตการจองเรียบร้อยแล้ว',
                data: booking
            });
        } catch (error) {
            console.error('Update booking error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัปเดตการจอง',
                error: error.message
            });
        }
    }

    // Cancel booking
    async cancel(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            
            const booking = await Booking.findById(id);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบการจอง'
                });
            }
            
            // Check ownership (unless user is admin)
            const isAdmin = ['super-admin', 'admin', 'Admin'].includes(req.user.role);
            if (booking.user_id !== userId && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์ยกเลิกการจองนี้'
                });
            }
            
            // Check if booking can be cancelled
            if (booking.status === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    message: 'การจองนี้ถูกยกเลิกแล้ว'
                });
            }
            
            if (booking.status === 'rejected') {
                return res.status(400).json({
                    success: false,
                    message: 'ไม่สามารถยกเลิกการจองที่ถูกปฏิเสธแล้ว'
                });
            }
            
            await Booking.cancel(id);
            
            res.json({
                success: true,
                message: 'ยกเลิกการจองเรียบร้อยแล้ว'
            });
        } catch (error) {
            console.error('Cancel booking error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการยกเลิกการจอง',
                error: error.message
            });
        }
    }

    // Approve booking
    async approve(req, res) {
        try {
            const { id } = req.params;
            const approverId = req.user.id;
            
            const booking = await Booking.findById(id);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบการจอง'
                });
            }
            
            // Check if user can approve this room
            const canApprove = await Approver.isApprover(approverId, booking.room_id);
            const isAdmin = ['super-admin', 'admin', 'Admin'].includes(req.user.role);
            if (!canApprove && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์อนุมัติการจองนี้'
                });
            }
            
            // Check if booking can be approved
            if (booking.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'การจองนี้ไม่สามารถอนุมัติได้'
                });
            }
            
            await Booking.approve(id, approverId);
            
            res.json({
                success: true,
                message: 'อนุมัติการจองเรียบร้อยแล้ว'
            });
        } catch (error) {
            console.error('Approve booking error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการอนุมัติการจอง',
                error: error.message
            });
        }
    }

    // Reject booking
    async reject(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const approverId = req.user.id;
            
            const booking = await Booking.findById(id);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบการจอง'
                });
            }
            
            // Check if user can approve this room
            const canApprove = await Approver.isApprover(approverId, booking.room_id);
            const isAdmin = ['super-admin', 'admin', 'Admin'].includes(req.user.role);
            if (!canApprove && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'คุณไม่มีสิทธิ์ปฏิเสธการจองนี้'
                });
            }
            
            // Check if booking can be rejected
            if (booking.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'การจองนี้ไม่สามารถปฏิเสธได้'
                });
            }
            
            await Booking.reject(id, approverId, reason || '');
            
            res.json({
                success: true,
                message: 'ปฏิเสธการจองเรียบร้อยแล้ว'
            });
        } catch (error) {
            console.error('Reject booking error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการปฏิเสธการจอง',
                error: error.message
            });
        }
    }

    // Update Auto Cancel
    async updateAutoCancel(req, res) {
        try {
            const { id } = req.params;
            const { auto_cancel } = req.body;
            
            const booking = await Booking.findById(id);
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบการจอง'
                });
            }

            // Update auto_cancel field
            await Booking.update(id, { auto_cancel: auto_cancel ? 1 : 0 });
            
            const updatedBooking = await Booking.findById(id);

            res.json({
                success: true,
                message: 'อัปเดตสถานะการยกเลิกอัตโนมัติสำเร็จ',
                data: updatedBooking
            });
        } catch (error) {
            console.error('Update auto cancel error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Upload Booking (อัปโหลดข้อมูลการจอง)
    async uploadBookings(req, res) {
        try {
            const { bookings } = req.body; // Array of booking objects
            
            if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'กรุณาส่งข้อมูลการจองเป็น array'
                });
            }

            const results = {
                success: [],
                failed: []
            };

            for (const bookingData of bookings) {
                try {
                    // Validate required fields
                    if (!bookingData.room_id || !bookingData.user_id || !bookingData.start_datetime || !bookingData.end_datetime) {
                        results.failed.push({
                            data: bookingData,
                            error: 'ข้อมูลไม่ครบถ้วน'
                        });
                        continue;
                    }

                    // Check for overlap
                    const hasOverlap = await Booking.checkOverlap(
                        bookingData.room_id,
                        bookingData.start_datetime,
                        bookingData.end_datetime
                    );

                    if (hasOverlap) {
                        results.failed.push({
                            data: bookingData,
                            error: 'มีการจองทับซ้อน'
                        });
                        continue;
                    }

                    // Create booking
                    const booking = await Booking.create({
                        room_id: bookingData.room_id,
                        user_id: bookingData.user_id,
                        title: bookingData.title || bookingData.name || 'การจอง',
                        description: bookingData.description || null,
                        start_datetime: bookingData.start_datetime,
                        end_datetime: bookingData.end_datetime,
                        status: bookingData.status || 'pending',
                        attendees: bookingData.attendees || 0
                    });

                    results.success.push(booking);
                } catch (error) {
                    results.failed.push({
                        data: bookingData,
                        error: error.message
                    });
                }
            }

            res.json({
                success: true,
                message: `อัปโหลดสำเร็จ ${results.success.length} รายการ, ล้มเหลว ${results.failed.length} รายการ`,
                results: results
            });
        } catch (error) {
            console.error('Upload bookings error:', error);
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }
}

module.exports = new BookingController();
