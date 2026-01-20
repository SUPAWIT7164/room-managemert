const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Booking {
    static async findAll(options = {}) {
        console.log('[Booking.findAll] Called with options:', JSON.stringify(options, null, 2));
        
        let query = `
            SELECT br.*, 
                   r.name as room_name,
                   u.name as booker_name, u.email as booker_email,
                   a.name as area_name,
                   b.name as building_name,
                   approver.name as approved_by_name
            FROM booking_requests br
            LEFT JOIN rooms r ON br.room_id = r.id
            LEFT JOIN users u ON br.user_id = u.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            LEFT JOIN users approver ON br.approved_by = approver.id
            WHERE 1=1
        `;
        const params = [];

        if (options.room_id) {
            query += ' AND br.room_id = ?';
            params.push(options.room_id);
        }

        if (options.booker_id) {
            query += ' AND br.user_id = ?';
            params.push(options.booker_id);
        }

        if (options.status) {
            if (Array.isArray(options.status)) {
                query += ` AND br.status IN (${options.status.map(() => '?').join(',')})`;
                params.push(...options.status);
            } else {
                query += ' AND br.status = ?';
                params.push(options.status);
            }
        }

        if (options.start_date) {
            query += ' AND DATE(br.start_datetime) >= ?';
            params.push(options.start_date);
        }

        if (options.end_date) {
            query += ' AND DATE(br.end_datetime) <= ?';
            params.push(options.end_date);
        }

        if (options.date) {
            query += ' AND DATE(br.start_datetime) = ?';
            params.push(options.date);
        }

        if (options.building_id) {
            query += ' AND b.id = ?';
            params.push(options.building_id);
        }

        query += ' ORDER BY br.start_datetime DESC';

        if (options.limit !== undefined && options.limit !== null) {
            const limitValue = parseInt(options.limit);
            if (!isNaN(limitValue) && limitValue > 0) {
                query += ' LIMIT ?';
                params.push(limitValue);
                console.log('[Booking.findAll] Adding LIMIT:', limitValue);
            } else {
                console.warn('[Booking.findAll] Invalid limit value:', options.limit);
            }
        } else {
            console.log('[Booking.findAll] No limit specified');
        }

        if (options.offset !== undefined && options.offset !== null) {
            const offsetValue = parseInt(options.offset);
            if (!isNaN(offsetValue) && offsetValue >= 0) {
                query += ' OFFSET ?';
                params.push(offsetValue);
                console.log('[Booking.findAll] Adding OFFSET:', offsetValue);
            } else {
                console.warn('[Booking.findAll] Invalid offset value:', options.offset);
            }
        } else {
            console.log('[Booking.findAll] No offset specified');
        }

        console.log('[Booking.findAll] Final query:', query);
        console.log('[Booking.findAll] Params:', params);
        const [rows] = await pool.query(query, params);
        console.log('[Booking.findAll] Returned rows:', rows.length, 'Expected limit:', options.limit);
        
        // Map to unified format
        return rows.map(row => ({
            ...row,
            start_time: row.start_datetime,
            end_time: row.end_datetime,
            start: row.start_datetime,
            end: row.end_datetime,
            name: row.title,
            room: row.room_id,
            booker: row.user_id,
            booker_id: row.user_id
        }));
    }

    static async findById(id) {
        const [rows] = await pool.query(`
            SELECT br.*, 
                   r.name as room_name,
                   u.name as booker_name, u.email as booker_email, u.phone as booker_phone,
                   a.name as area_name,
                   b.id as building_id, b.name as building_name,
                   approver.name as approved_by_name
            FROM booking_requests br
            LEFT JOIN rooms r ON br.room_id = r.id
            LEFT JOIN users u ON br.user_id = u.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            LEFT JOIN users approver ON br.approved_by = approver.id
            WHERE br.id = ?
        `, [id]);
        
        if (!rows[0]) return null;
        
        const row = rows[0];
        return {
            ...row,
            start_time: row.start_datetime,
            end_time: row.end_datetime,
            start: row.start_datetime,
            end: row.end_datetime,
            name: row.title,
            room: row.room_id,
            booker: row.user_id,
            booker_id: row.user_id
        };
    }

    static async create(data) {
        const bookingNumber = 'BK' + Date.now();
        
        console.log('Booking.create - Inserting with data:', {
            title: data.title,
            room_id: data.room_id,
            user_id: data.booker_id,
            start: data.start_time,
            end: data.end_time,
            status: data.status,
            attendees: data.attendees,
            participants: data.participants
        });

        try {
            // Validate required fields
            if (!data.room_id || !data.booker_id || !data.title || !data.start_time || !data.end_time) {
                throw new Error('ข้อมูลการจองไม่ครบถ้วน: room_id, booker_id, title, start_time, end_time จำเป็นต้องมี');
            }
            
            // Prepare participants data
            let participantsJson = null;
            if (data.participants) {
                try {
                    participantsJson = typeof data.participants === 'string' 
                        ? data.participants 
                        : JSON.stringify(data.participants);
                } catch (jsonError) {
                    console.error('Error stringifying participants:', jsonError);
                    participantsJson = null;
                }
            }
            
            const insertParams = [
                bookingNumber,
                parseInt(data.room_id),
                parseInt(data.booker_id),
                data.title,
                data.description || null,
                data.start_time,
                data.end_time,
                parseInt(data.attendees) || 0,
                participantsJson,
                data.status || 'pending',
                data.send_notification || 0,
                data.auto_cancel || 0
            ];
            
            console.log('Insert parameters:', insertParams);
            console.log('Insert parameters count:', insertParams.length);
            console.log('Expected columns: booking_number, room_id, user_id, title, description, start_datetime, end_datetime, attendees, participants, status, send_notification, auto_cancelled, created_at, updated_at');
            
            // Verify table exists and check structure
            try {
                const [tableCheck] = await pool.query('SHOW TABLES LIKE "booking_requests"');
                if (tableCheck.length === 0) {
                    throw new Error('Table booking_requests does not exist in database');
                }
                console.log('✅ Table booking_requests exists');
                
                // Get table structure
                const [columns] = await pool.query('DESCRIBE booking_requests');
                console.log('Table columns:', columns.map(c => c.Field).join(', '));
                
                // Check for required columns
                const columnNames = columns.map(c => c.Field);
                const requiredColumns = ['room_id', 'user_id', 'title', 'start_datetime', 'end_datetime', 'status'];
                const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
                
                if (missingColumns.length > 0) {
                    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
                }
            } catch (tableError) {
                console.error('❌ Table check failed:', tableError);
                throw new Error('ไม่พบตาราง booking_requests ในฐานข้อมูล: ' + tableError.message);
            }
            
            // Build dynamic INSERT query based on available columns
            const [columns] = await pool.query('DESCRIBE booking_requests');
            const columnNames = columns.map(c => c.Field);
            
            // Map data fields to database columns
            // Note: Database uses 'auto_cancelled' not 'auto_cancel'
            const columnMapping = {
                'booking_number': bookingNumber,
                'room_id': parseInt(data.room_id),
                'user_id': parseInt(data.booker_id),
                'title': data.title,
                'description': data.description || null,
                'start_datetime': data.start_time,
                'end_datetime': data.end_time,
                'attendees': parseInt(data.attendees) || 0,
                'participants': participantsJson,
                'status': data.status || 'pending',
                'send_notification': data.send_notification !== undefined ? (data.send_notification ? 1 : 0) : 1,
                'auto_cancelled': data.auto_cancel !== undefined ? (data.auto_cancel ? 1 : 0) : 0
            };
            
            // Only include columns that exist in the table
            const insertColumns = [];
            const insertValues = [];
            
            for (const [dbColumn, value] of Object.entries(columnMapping)) {
                if (columnNames.includes(dbColumn)) {
                    insertColumns.push(dbColumn);
                    insertValues.push(value);
                } else {
                    console.warn(`⚠️ Column ${dbColumn} not found in table, skipping`);
                }
            }
            
            // Add created_at and updated_at if they exist
            if (columnNames.includes('created_at')) {
                insertColumns.push('created_at');
                insertValues.push('NOW()');
            }
            if (columnNames.includes('updated_at')) {
                insertColumns.push('updated_at');
                insertValues.push('NOW()');
            }
            
            console.log('Insert columns:', insertColumns.join(', '));
            console.log('Insert values count:', insertValues.length);
            
            // Build and execute INSERT query
            // Separate columns that use NOW() from those that use parameters
            const nowColumns = [];
            const paramColumns = [];
            const paramValues = [];
            
            for (let i = 0; i < insertColumns.length; i++) {
                const col = insertColumns[i];
                const val = insertValues[i];
                
                if (val === 'NOW()' || (col === 'created_at' || col === 'updated_at')) {
                    nowColumns.push(col);
                } else {
                    paramColumns.push(col);
                    paramValues.push(val);
                }
            }
            
            // Build column list and values
            const allColumns = [...paramColumns, ...nowColumns];
            const placeholders = [
                ...paramColumns.map(() => '?'),
                ...nowColumns.map(() => 'NOW()')
            ];
            
            const insertQuery = `INSERT INTO booking_requests (${allColumns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            console.log('Insert query:', insertQuery);
            console.log('Query parameters:', paramValues);
            
            const [result] = await pool.query(insertQuery, paramValues);
            
            console.log('Booking created successfully with ID:', result.insertId);
            
            // Return the created booking with all data
            const createdBooking = {
                id: result.insertId,
                booking_number: bookingNumber,
                room_id: parseInt(data.room_id),
                user_id: parseInt(data.booker_id),
                booker_id: parseInt(data.booker_id),
                title: data.title,
                description: data.description || null,
                start_datetime: data.start_time,
                end_datetime: data.end_time,
                start_time: data.start_time,
                end_time: data.end_time,
                attendees: parseInt(data.attendees) || 0,
                participants: data.participants,
                status: data.status || 'pending',
                created_at: new Date(),
                updated_at: new Date()
            };
            
            return createdBooking;
        } catch (error) {
            console.error('=== Database Insert Error ===');
            console.error('Error message:', error.message);
            console.error('Error code:', error.code);
            console.error('SQL State:', error.sqlState);
            console.error('SQL Message:', error.sqlMessage);
            if (error.sql) {
                console.error('SQL:', error.sql);
            }
            console.error('Full error:', error);
            throw error;
        }
    }

    static async update(id, data) {
        try {
        const updates = [];
        const params = [];

        const fieldMapping = {
            title: 'title',
            description: 'description',
            start_time: 'start_datetime',
            end_time: 'end_datetime',
            attendees: 'attendees',
            participants: 'participants',
            objective: 'objective',
            instructor: 'instructor',
            online_meeting: 'online_meeting',
            meeting_link: 'meeting_link',
            auto_cancel: 'auto_cancelled'  // Database column is 'auto_cancelled'
        };

        for (const [key, dbField] of Object.entries(fieldMapping)) {
                if (data[key] !== undefined && data[key] !== null) {
                updates.push(`${dbField} = ?`);
                if (key === 'participants' && typeof data[key] === 'object') {
                    params.push(JSON.stringify(data[key]));
                } else {
                    params.push(data[key]);
                }
            }
        }

            if (updates.length === 0) {
                console.log('No updates to perform');
                return this.findById(id);
            }

        updates.push('updated_at = NOW()');
        params.push(id);
            
            const query = `UPDATE booking_requests SET ${updates.join(', ')} WHERE id = ?`;
            console.log('Booking update query:', query);
            console.log('Booking update params:', params);
            
            await pool.query(query, params);
        return this.findById(id);
        } catch (error) {
            console.error('Booking.update error:', error);
            throw error;
        }
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM booking_requests WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async approve(id, approverId) {
        await pool.query(
            `UPDATE booking_requests SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [approverId, id]
        );
        return this.findById(id);
    }

    static async reject(id, approverId, reason) {
        await pool.query(
            `UPDATE booking_requests SET status = 'rejected', rejected_by = ?, rejection_reason = ?, rejected_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [approverId, reason, id]
        );
        return this.findById(id);
    }

    static async cancel(id) {
        await pool.query(
            `UPDATE booking_requests SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = ?`, 
            [id]
        );
        return this.findById(id);
    }

    static async checkOverlap(roomId, startTime, endTime, excludeId = null) {
        // Standard overlap formula: existing.start < new.end AND existing.end > new.start
        let query = `
            SELECT COUNT(*) as count FROM booking_requests 
            WHERE room_id = ? 
              AND status NOT IN ('rejected', 'cancelled')
              AND start_datetime < ?
              AND end_datetime > ?
        `;
        const params = [roomId, endTime, startTime];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        console.log('Checking overlap:', { roomId, startTime, endTime, excludeId });
        
        const [rows] = await pool.query(query, params);
        console.log('Overlap result:', rows[0].count);
        
        return rows[0].count > 0;
    }

    static async count(options = {}) {
        // Use the same query structure as findAll but with COUNT
        // This ensures consistency between count and findAll filters
        let query = `
            SELECT COUNT(*) as total 
            FROM booking_requests br
            LEFT JOIN rooms r ON br.room_id = r.id
            LEFT JOIN users u ON br.user_id = u.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (options.room_id) {
            query += ' AND br.room_id = ?';
            params.push(options.room_id);
        }

        if (options.booker_id) {
            query += ' AND br.user_id = ?';
            params.push(options.booker_id);
        }

        if (options.status) {
            if (Array.isArray(options.status)) {
                query += ` AND br.status IN (${options.status.map(() => '?').join(',')})`;
                params.push(...options.status);
            } else {
                query += ' AND br.status = ?';
                params.push(options.status);
            }
        }

        if (options.start_date) {
            query += ' AND DATE(br.start_datetime) >= ?';
            params.push(options.start_date);
        }

        if (options.end_date) {
            query += ' AND DATE(br.end_datetime) <= ?';
            params.push(options.end_date);
        }

        if (options.date) {
            query += ' AND DATE(br.start_datetime) = ?';
            params.push(options.date);
        }

        if (options.building_id) {
            query += ' AND b.id = ?';
            params.push(options.building_id);
        }

        console.log('[Booking.count] Query:', query);
        console.log('[Booking.count] Params:', params);
        console.log('[Booking.count] Options:', JSON.stringify(options, null, 2));
        const [rows] = await pool.query(query, params);
        const total = rows[0].total;
        console.log('[Booking.count] Total count:', total);
        return total;
    }

    static async getStatistics(options = {}) {
        const stats = {};

        // Get status counts
        const [statusRows] = await pool.query(`
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM booking_requests
        `);
        stats.byStatus = statusRows[0];

        // Get room usage
        const [roomUsage] = await pool.query(`
            SELECT r.name as room_name, COUNT(br.id) as booking_count
            FROM rooms r
            LEFT JOIN booking_requests br ON r.id = br.room_id AND br.status = 'approved'
            WHERE r.disable = 0
            GROUP BY r.id
            ORDER BY booking_count DESC
            LIMIT 10
        `);
        stats.topRooms = roomUsage;

        return stats;
    }

    static async getTodayBookings() {
        const [rows] = await pool.query(`
            SELECT br.*, 
                   r.name as room_name,
                   u.name as booker_name
            FROM booking_requests br
            LEFT JOIN rooms r ON br.room_id = r.id
            LEFT JOIN users u ON br.user_id = u.id
            WHERE DATE(br.start_datetime) = CURDATE()
              AND br.status NOT IN ('rejected', 'cancelled')
            ORDER BY br.start_datetime
        `);
        return rows.map(row => ({
            ...row,
            start_time: row.start_datetime,
            end_time: row.end_datetime,
            start: row.start_datetime,
            end: row.end_datetime,
            name: row.title,
            room: row.room_id
        }));
    }
}

module.exports = Booking;
