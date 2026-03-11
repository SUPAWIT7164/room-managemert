const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Booking {
    static async findAll(options = {}) {
        console.log('[Booking.findAll] Called with options:', JSON.stringify(options, null, 2));
        
        // Use FORMAT to get datetime as string without timezone conversion
        // FORMAT returns the datetime as stored in the database without timezone conversion
        // Use alias names to avoid reserved keyword issues (end is reserved keyword)
        const startDatetimeCol = "FORMAT(br.[start], 'yyyy-MM-dd HH:mm:ss') as start_datetime";
        const endDatetimeCol = "FORMAT(br.[end], 'yyyy-MM-dd HH:mm:ss') as end_datetime";
        console.log('[Booking.findAll] Using FORMAT() for SQL Server datetime columns');
        console.log('[Booking.findAll] startDatetimeCol:', startDatetimeCol);
        console.log('[Booking.findAll] endDatetimeCol:', endDatetimeCol);
        
        let query = `
            SELECT br.id, br.name, br.booker, br.room, br.description, br.objective,
                   ${startDatetimeCol},
                   ${endDatetimeCol},
                   br.hour, br.instructor, br.attendees, br.status, br.cancel, br.reject,
                   br.reject_reason, br.calendar_id, br.icaluid, br.qrcode, br.online_meeting,
                   br.email_notify, br.transaction_id, br.approve_by, br.created_at, br.updated_at,
                   r.name as room_name,
                   u.name as booker_name, u.email as booker_email,
                   a.name as area_name,
                   b.name as building_name,
                   approver.name as approve_by_name
            FROM booking_requests br
            LEFT JOIN rooms r ON br.[room] = r.id
            LEFT JOIN users u ON br.booker = u.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            LEFT JOIN users approver ON br.approve_by = approver.id
            WHERE 1=1
        `;
        const params = [];

        if (options.room_id) {
            query += ' AND br.[room] = ?';
            params.push(options.room_id);
        }

        if (options.booker_id) {
            query += ' AND br.booker = ?';
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
        } else {
            // Default: exclude cancelled and rejected (like old project: cancel=0, reject=0)
            query += ` AND (br.[cancel] IS NULL OR br.[cancel] = 0) AND (br.[reject] IS NULL OR br.[reject] = 0)`;
        }

        if (options.start_date) {
            query += ' AND DATE(br.[start]) >= ?';
            params.push(options.start_date);
        }

        if (options.end_date) {
            query += ' AND DATE(br.[end]) <= ?';
            params.push(options.end_date);
        }

        if (options.date) {
            query += ' AND DATE(br.[start]) = ?';
            params.push(options.date);
        }

        if (options.building_id) {
            query += ' AND b.id = ?';
            params.push(options.building_id);
        }

        query += ' ORDER BY br.[start] DESC';

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
        console.log('[Booking.findAll] Using FORMAT() for SQL Server');
        try {
            const [rows] = await pool.query(query, params);
            console.log('[Booking.findAll] Returned rows:', rows.length, 'Expected limit:', options.limit);
            
            // Log first row's datetime values before processing
            if (rows.length > 0) {
                console.log('[Booking.findAll] First row raw datetime values:', {
                    start_datetime: rows[0].start_datetime,
                    end_datetime: rows[0].end_datetime,
                    start_datetime_type: typeof rows[0].start_datetime,
                    end_datetime_isDate: rows[0].start_datetime instanceof Date
                });
            }
            
            // Map to unified format
            return rows.map((row, index) => {
                // Format datetime to ensure consistent format (YYYY-MM-DD HH:mm:ss)
                // Use alias names from query (start_datetime, end_datetime)
                let startDatetime = row.start_datetime;
                let endDatetime = row.end_datetime;
                
                // Log original format for first booking
                if (index === 0) {
                    console.log('[Booking.findAll] Original datetime format:', {
                        start_datetime_type: typeof startDatetime,
                        start_datetime_value: startDatetime,
                        start_datetime_isDate: startDatetime instanceof Date,
                        end_datetime_type: typeof endDatetime,
                        end_datetime_value: endDatetime,
                        end_datetime_isDate: endDatetime instanceof Date,
                        'Used FORMAT()': true
                    });
                }
                
                // No timezone conversion - use datetime string exactly as returned from database
                // FORMAT() returns the datetime as stored (no timezone conversion)
                // If it's already a string, use it directly
                if (typeof startDatetime === 'string') {
                    // String from FORMAT() - use directly (no conversion)
                    // Format is already "YYYY-MM-DD HH:mm:ss" from FORMAT()
                    // No timezone adjustment needed
                } else if (startDatetime instanceof Date) {
                    // Date object (shouldn't happen with FORMAT(), but handle it)
                    // Convert to string format "YYYY-MM-DD HH:mm:ss" without timezone conversion
                    const year = startDatetime.getFullYear();
                    const month = String(startDatetime.getMonth() + 1).padStart(2, '0');
                    const day = String(startDatetime.getDate()).padStart(2, '0');
                    const hours = String(startDatetime.getHours()).padStart(2, '0');
                    const minutes = String(startDatetime.getMinutes()).padStart(2, '0');
                    const seconds = String(startDatetime.getSeconds()).padStart(2, '0');
                    startDatetime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                }
                
                if (typeof endDatetime === 'string') {
                    // String from FORMAT() - use directly (no conversion)
                    // Format is already "YYYY-MM-DD HH:mm:ss" from FORMAT()
                    // No timezone adjustment needed
                } else if (endDatetime instanceof Date) {
                    // Date object (shouldn't happen with FORMAT(), but handle it)
                    // Convert to string format "YYYY-MM-DD HH:mm:ss" without timezone conversion
                    const year = endDatetime.getFullYear();
                    const month = String(endDatetime.getMonth() + 1).padStart(2, '0');
                    const day = String(endDatetime.getDate()).padStart(2, '0');
                    const hours = String(endDatetime.getHours()).padStart(2, '0');
                    const minutes = String(endDatetime.getMinutes()).padStart(2, '0');
                    const seconds = String(endDatetime.getSeconds()).padStart(2, '0');
                    endDatetime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                }
                
                // Handle ISO format strings (with T or Z) - extract date/time parts without timezone conversion
                // This preserves the exact time that was stored
                if (typeof startDatetime === 'string' && (startDatetime.includes('T') || startDatetime.includes('Z'))) {
                    // Extract date and time parts directly from the string (no timezone conversion)
                    // Format: "2026-01-26T10:00:00Z" or "2026-01-26T10:00:00.000Z" or "2026-01-26T10:00:00+07:00"
                    const dateTimeMatch = startDatetime.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
                    if (dateTimeMatch) {
                        // Use the extracted date and time directly (no timezone conversion)
                        startDatetime = `${dateTimeMatch[1]} ${dateTimeMatch[2]}`;
                    }
                }
                
                if (typeof endDatetime === 'string' && (endDatetime.includes('T') || endDatetime.includes('Z'))) {
                    // Extract date and time parts directly from the string (no timezone conversion)
                    const dateTimeMatch = endDatetime.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
                    if (dateTimeMatch) {
                        // Use the extracted date and time directly (no timezone conversion)
                        endDatetime = `${dateTimeMatch[1]} ${dateTimeMatch[2]}`;
                    }
                }
                
                // Log formatted result for first booking
                if (index === 0) {
                    console.log('[Booking.findAll] Formatted datetime:', {
                        start_datetime: startDatetime,
                        end_datetime: endDatetime
                    });
                }
                
                return {
                    ...row,
                    start_datetime: startDatetime,
                    end_datetime: endDatetime,
                    start_time: startDatetime,
                    end_time: endDatetime,
                    start: startDatetime,
                    end: endDatetime,
                    name: row.name,
                    room: row.room,
                    room_id: row.room,
                    booker: row.booker,
                    booker_id: row.booker,
                    user_id: row.booker,
                    title: row.name
                };
            });
        } catch (error) {
            console.error('[Booking.findAll] Query execution error:', error);
            console.error('[Booking.findAll] Error message:', error.message);
            console.error('[Booking.findAll] Error stack:', error.stack);
            throw error;
        }
    }

    static async findById(id) {
        const [rows] = await pool.query(`
            SELECT br.*, 
                   r.name as room_name,
                   u.name as booker_name, u.email as booker_email, u.phone as booker_phone,
                   a.name as area_name,
                   b.id as building_id, b.name as building_name,
                   approver.name as approve_by_name
            FROM booking_requests br
            LEFT JOIN rooms r ON br.[room] = r.id
            LEFT JOIN users u ON br.booker = u.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            LEFT JOIN users approver ON br.approve_by = approver.id
            WHERE br.id = ?
        `, [id]);
        
        if (!rows[0]) return null;
        
        const row = rows[0];
        return {
            ...row,
            start_time: row.start,
            end_time: row.end,
            start_datetime: row.start,
            end_datetime: row.end,
            start: row.start,
            end: row.end,
            name: row.name,
            title: row.name,
            room: row.room,
            room_id: row.room,
            booker: row.booker,
            booker_id: row.booker,
            user_id: row.booker
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
            // Validate required fields - use new column names
            const roomId = data.room_id || data.room;
            const bookerId = data.booker_id || data.booker || data.user_id;
            const name = data.name || data.title;
            const startTime = data.start_time || data.start_datetime || data.start;
            const endTime = data.end_time || data.end_datetime || data.end;
            
            if (!roomId || !bookerId || !name || !startTime || !endTime) {
                throw new Error('ข้อมูลการจองไม่ครบถ้วน: room_id/room, booker_id/booker, name/title, start_time/start, end_time/end จำเป็นต้องมี');
            }
            
            // Verify table exists and check structure
            try {
                // SQL Server syntax
                const [tableCheck] = await pool.query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'booking_requests'");
                if (tableCheck.length === 0) {
                    throw new Error('Table booking_requests does not exist in database');
                }
                console.log('✅ Table booking_requests exists');
                
                // Get table structure
                const [columns] = await pool.query("SELECT COLUMN_NAME as Field FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'booking_requests' ORDER BY ORDINAL_POSITION");
                
                console.log('Table columns:', columns.map(c => c.Field).join(', '));
                
                // Check for required columns (new structure)
                const columnNames = columns.map(c => c.Field);
                const requiredColumns = ['room', 'booker', 'name', 'start', 'end'];
                const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
                
                if (missingColumns.length > 0) {
                    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
                }
            } catch (tableError) {
                console.error('❌ Table check failed:', tableError);
                throw new Error('ไม่พบตาราง booking_requests ในฐานข้อมูล: ' + tableError.message);
            }
            
            // Build dynamic INSERT query based on available columns
            // Get table columns for SQL Server
            const [columns] = await pool.query("SELECT COLUMN_NAME as Field FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'booking_requests' ORDER BY ORDINAL_POSITION");
            const columnNames = columns.map(c => c.Field);
            
            // Map data fields to database columns (new structure)
            // IMPORTANT: No timezone conversion - store datetime string exactly as received from client
            // System timezone is set to Asia/Bangkok (UTC+7) in server.js
            // We store the datetime string directly without any adjustment
            
            const columnMapping = {
                'name': name,
                'booker': parseInt(bookerId),
                'room': parseInt(roomId),
                'start': startTime, // Store exactly as received (no timezone conversion)
                'end': endTime,     // Store exactly as received (no timezone conversion)
                'description': data.description || null,
                'objective': data.objective || null,
                'hour': data.hour || null,
                'instructor': data.instructor || null,
                'attendees': parseInt(data.attendees) || 0,
                'calendar_id': data.calendar_id || null,
                'icaluid': data.icaluid || null,
                'qrcode': data.qrcode || '',
                'online_meeting': data.online_meeting !== undefined ? (data.online_meeting ? 1 : 0) : 0,
                'email_notify': data.email_notify !== undefined ? (data.email_notify ? 1 : 0) : 1,
                'status': data.status !== undefined ? (data.status ? 1 : 0) : null,
                'cancel': 0,
                'reject': 0,
                'reject_reason': null,
                'transaction_id': data.transaction_id || null,
                'approve_by': null
            };
            
            // Log datetime values being inserted
            console.log('[Booking.create] Datetime values to insert:', {
                start: columnMapping.start,
                end: columnMapping.end,
                start_type: typeof columnMapping.start,
                end_type: typeof columnMapping.end
            });
            
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
                insertValues.push('GETDATE()');
            }
            if (columnNames.includes('updated_at')) {
                insertColumns.push('updated_at');
                insertValues.push('GETDATE()');
            }
            
            console.log('Insert columns:', insertColumns.join(', '));
            console.log('Insert values count:', insertValues.length);
            
            // Build and execute INSERT query
            // Separate columns that use GETDATE() from those that use parameters
            const nowColumns = [];
            const paramColumns = [];
            const paramValues = [];
            
            for (let i = 0; i < insertColumns.length; i++) {
                const col = insertColumns[i];
                const val = insertValues[i];
                
                if (val === 'GETDATE()' || (col === 'created_at' || col === 'updated_at')) {
                    nowColumns.push(col);
                } else {
                    paramColumns.push(col);
                    paramValues.push(val);
                }
            }
            
            // Build column list and values
            // Wrap reserved keywords (start, end) in brackets
            const allColumns = [...paramColumns, ...nowColumns].map(col => {
                if (col === 'start' || col === 'end') {
                    return `[${col}]`;
                }
                return col;
            });
            
            // For SQL Server, use CONVERT with style 120 to parse datetime string without timezone conversion
            // Style 120: 'yyyy-mm-dd hh:mi:ss' - parses string directly as local time (Asia/Bangkok)
            // No timezone conversion will occur - stores exactly as the string value
            const placeholders = paramColumns.map((col, idx) => {
                // Check if this is a datetime column
                if (col === 'start' || col === 'end') {
                    // Use CONVERT with style 120 to parse "YYYY-MM-DD HH:mm:ss" string directly
                    // This preserves the exact time without any timezone conversion
                    return `CONVERT(DATETIME, ?, 120)`;
                }
                return '?';
            });
            placeholders.push(...nowColumns.map(() => 'GETDATE()'));
            
            const insertQuery = `INSERT INTO booking_requests (${allColumns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            console.log('[Booking.create] Insert query:', insertQuery);
            console.log('[Booking.create] Query parameters:', paramValues);
            console.log('[Booking.create] Column mapping:', {
                start: columnMapping.start,
                end: columnMapping.end,
                start_index: paramColumns.indexOf('start'),
                end_index: paramColumns.indexOf('end')
            });
            
            const [result] = await pool.query(insertQuery, paramValues);
            
            // Log what was actually inserted by querying it back
            if (result.insertId) {
                try {
                    const [verifyRows] = await pool.query(
                        'SELECT [start], [end] FROM booking_requests WHERE id = ?',
                        [result.insertId]
                    );
                    if (verifyRows && verifyRows.length > 0) {
                        console.log('[Booking.create] Verified inserted values:', {
                            start: verifyRows[0].start,
                            end: verifyRows[0].end,
                            start_type: typeof verifyRows[0].start,
                            start_isDate: verifyRows[0].start instanceof Date
                        });
                    }
                } catch (verifyError) {
                    console.warn('[Booking.create] Could not verify inserted values:', verifyError.message);
                }
            }
            
            console.log('Booking created successfully with ID:', result.insertId);
            
            // Return the created booking with all data (include both old and new field names for compatibility)
            const createdBooking = {
                id: result.insertId,
                name: name,
                title: name,
                room: parseInt(roomId),
                room_id: parseInt(roomId),
                booker: parseInt(bookerId),
                booker_id: parseInt(bookerId),
                user_id: parseInt(bookerId),
                description: data.description || null,
                start: startTime,
                end: endTime,
                start_time: startTime,
                end_time: endTime,
                start_datetime: startTime,
                end_datetime: endTime,
                attendees: parseInt(data.attendees) || 0,
                status: data.status || null,
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
            name: 'name',
            title: 'name',  // Map title to name
            description: 'description',
            start_time: 'start',
            start_datetime: 'start',
            start: 'start',
            end_time: 'end',
            end_datetime: 'end',
            end: 'end',
            attendees: 'attendees',
            objective: 'objective',
            hour: 'hour',
            instructor: 'instructor',
            calendar_id: 'calendar_id',
            icaluid: 'icaluid',
            qrcode: 'qrcode',
            online_meeting: 'online_meeting',
            email_notify: 'email_notify',
            status: 'status',
            cancel: 'cancel',
            reject: 'reject',
            reject_reason: 'reject_reason',
            transaction_id: 'transaction_id',
            approve_by: 'approve_by'
        };

        for (const [key, dbField] of Object.entries(fieldMapping)) {
            if (data[key] !== undefined && data[key] !== null) {
                // Handle datetime columns
                if (dbField === 'start' || dbField === 'end') {
                    updates.push(`[${dbField}] = CONVERT(DATETIME, ?, 120)`);
                } else {
                    updates.push(`[${dbField}] = ?`);
                }
                params.push(data[key]);
            }
        }

            if (updates.length === 0) {
                console.log('No updates to perform');
                return this.findById(id);
            }

        updates.push('updated_at = GETDATE()');
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
            `UPDATE booking_requests SET status = 1, approve_by = ?, updated_at = GETDATE() WHERE id = ?`,
            [approverId, id]
        );
        return this.findById(id);
    }

    static async reject(id, approverId, reason) {
        await pool.query(
            `UPDATE booking_requests SET reject = 1, reject_reason = ?, updated_at = GETDATE() WHERE id = ?`,
            [reason, id]
        );
        return this.findById(id);
    }

    static async cancel(id) {
        await pool.query(
            `UPDATE booking_requests SET cancel = 1, updated_at = GETDATE() WHERE id = ?`, 
            [id]
        );
        return this.findById(id);
    }

    static async checkOverlap(roomId, startTime, endTime, excludeId = null) {
        // Standard overlap formula: existing.start < new.end AND existing.end > new.start
        // Also check cancel and reject flags
        let query = `
            SELECT COUNT(*) as count FROM booking_requests 
            WHERE [room] = ? 
              AND (status IS NULL OR status NOT IN ('rejected', 'cancelled'))
              AND ([cancel] IS NULL OR [cancel] = 0)
              AND ([reject] IS NULL OR [reject] = 0)
              AND [start] < ?
              AND [end] > ?
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
            LEFT JOIN rooms r ON br.[room] = r.id
            LEFT JOIN users u ON br.booker = u.id
            LEFT JOIN areas a ON r.area_id = a.id
            LEFT JOIN buildings b ON a.building_id = b.id
            WHERE 1=1
        `;
        const params = [];

        if (options.room_id) {
            query += ' AND br.[room] = ?';
            params.push(options.room_id);
        }

        if (options.booker_id) {
            query += ' AND br.booker = ?';
            params.push(options.booker_id);
        }

        if (options.status !== undefined) {
            if (options.status === null) {
                // Explicitly check for null status (pending bookings)
                query += ' AND br.status IS NULL';
            } else if (Array.isArray(options.status)) {
                query += ` AND br.status IN (${options.status.map(() => '?').join(',')})`;
                params.push(...options.status);
            } else {
                query += ' AND br.status = ?';
                params.push(options.status);
            }
        }
        
        // Always exclude cancelled and rejected (like old project: cancel=0, reject=0)
        query += ` AND ([cancel] IS NULL OR [cancel] = 0) AND ([reject] IS NULL OR [reject] = 0)`;

        if (options.start_date) {
            query += ' AND DATE(br.[start]) >= ?';
            params.push(options.start_date);
        }

        if (options.end_date) {
            query += ' AND DATE(br.[end]) <= ?';
            params.push(options.end_date);
        }

        if (options.date) {
            query += ' AND DATE(br.[start]) = ?';
            params.push(options.date);
        }

        if (options.building_id) {
            query += ' AND b.id = ?';
            params.push(options.building_id);
        }

        console.log('[Booking.count] Query:', query);
        console.log('[Booking.count] Params:', params);
        console.log('[Booking.count] Options:', JSON.stringify(options, null, 2));
        try {
            const [rows] = await pool.query(query, params);
            const total = rows[0].total;
            console.log('[Booking.count] Total count:', total);
            return total;
        } catch (error) {
            console.error('[Booking.count] Query execution error:', error);
            console.error('[Booking.count] Error message:', error.message);
            console.error('[Booking.count] Error stack:', error.stack);
            throw error;
        }
    }

    static async getStatistics(options = {}) {
        const stats = {};

        // Get status counts (using new structure: status BIT, cancel BIT, reject BIT)
        const [statusRows] = await pool.query(`
            SELECT 
                SUM(CASE WHEN (status IS NULL OR status = 0) AND ([cancel] IS NULL OR [cancel] = 0) AND ([reject] IS NULL OR [reject] = 0) THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 1 AND ([cancel] IS NULL OR [cancel] = 0) AND ([reject] IS NULL OR [reject] = 0) THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN [reject] = 1 THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN [cancel] = 1 THEN 1 ELSE 0 END) as cancelled
            FROM booking_requests
        `);
        stats.byStatus = statusRows[0];

        // Get room usage
        // Use TOP 10 instead of LIMIT 10 for SQL Server
        const [roomUsage] = await pool.query(`
            SELECT TOP 10 r.name as room_name, COUNT(br.id) as booking_count
            FROM rooms r
            LEFT JOIN booking_requests br ON r.id = br.[room] 
                AND (br.status = 1 OR (br.status IS NULL AND (br.[cancel] IS NULL OR br.[cancel] = 0) AND (br.[reject] IS NULL OR br.[reject] = 0)))
                AND (br.[cancel] IS NULL OR br.[cancel] = 0)
                AND (br.[reject] IS NULL OR br.[reject] = 0)
            WHERE r.disable = 0
            GROUP BY r.id, r.name
            ORDER BY booking_count DESC
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
            LEFT JOIN rooms r ON br.[room] = r.id
            LEFT JOIN users u ON br.booker = u.id
            WHERE DATE(br.[start]) = CAST(GETDATE() AS DATE)
              AND (br.[cancel] IS NULL OR br.[cancel] = 0)
              AND (br.[reject] IS NULL OR br.[reject] = 0)
            ORDER BY br.[start]
        `);
        return rows.map(row => ({
            ...row,
            start_time: row.start,
            end_time: row.end,
            start_datetime: row.start,
            end_datetime: row.end,
            start: row.start,
            end: row.end,
            name: row.name,
            title: row.name,
            room: row.room,
            room_id: row.room,
            booker: row.booker,
            booker_id: row.booker,
            user_id: row.booker
        }));
    }
}

module.exports = Booking;
