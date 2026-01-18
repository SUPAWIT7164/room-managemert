const { pool } = require('../config/database');

class DeviceState {
    // Get all device states for a room
    static async getByRoom(roomId) {
        const [rows] = await pool.query(
            'SELECT * FROM device_states WHERE room_id = ? ORDER BY device_type, device_index',
            [roomId]
        );
        
        console.log(`[BACKEND DEBUG] getByRoom: roomId=${roomId}, found ${rows.length} rows`);
        rows.forEach(row => {
            console.log(`[BACKEND DEBUG] Row: type=${row.device_type}, index=${row.device_index}, status=${row.status} (${typeof row.status})`);
        });
        
        // Group by device type - use dense arrays
        const grouped = {
            light: [],
            ac: [],
            erv: []
        };
        
        // Find max index for each device type to create dense arrays
        const maxIndices = { light: -1, ac: -1, erv: -1 };
        rows.forEach(row => {
            if (grouped[row.device_type] && row.device_index > maxIndices[row.device_type]) {
                maxIndices[row.device_type] = row.device_index;
            }
        });
        
        // Initialize arrays with null values
        for (const [type, maxIndex] of Object.entries(maxIndices)) {
            if (maxIndex >= 0) {
                grouped[type] = new Array(maxIndex + 1).fill(null);
            }
        }
        
        // Fill in the actual states
        rows.forEach(row => {
            if (grouped[row.device_type] && row.device_index >= 0) {
                // Convert status to boolean - handle both 0/1 and true/false
                let statusValue = false;
                if (row.status === 1 || row.status === true || row.status === '1' || row.status === 'true') {
                    statusValue = true;
                } else if (row.status === 0 || row.status === false || row.status === '0' || row.status === 'false') {
                    statusValue = false;
                }
                grouped[row.device_type][row.device_index] = {
                    status: statusValue,
                    settings: row.settings ? JSON.parse(row.settings) : null,
                    updated_at: row.updated_at
                };
                console.log(`[BACKEND DEBUG] Set grouped[${row.device_type}][${row.device_index}] = {status: ${statusValue}} (from DB value: ${row.status}, type: ${typeof row.status})`);
            }
        });
        
        console.log(`[BACKEND DEBUG] Returning grouped states:`, JSON.stringify(grouped, null, 2));
        return grouped;
    }
    
    // Get single device state
    static async getDeviceState(roomId, deviceType, deviceIndex) {
        const [rows] = await pool.query(
            'SELECT * FROM device_states WHERE room_id = ? AND device_type = ? AND device_index = ?',
            [roomId, deviceType, deviceIndex]
        );
        
        if (rows.length === 0) return null;
        
        return {
            status: Boolean(rows[0].status),
            settings: rows[0].settings ? JSON.parse(rows[0].settings) : null,
            updated_at: rows[0].updated_at
        };
    }
    
    // Set device state (create or update)
    static async setDeviceState(roomId, deviceType, deviceIndex, status, settings = null) {
        const settingsJson = settings ? JSON.stringify(settings) : null;
        
        await pool.query(
            `INSERT INTO device_states (room_id, device_type, device_index, status, settings)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), settings = VALUES(settings)`,
            [roomId, deviceType, deviceIndex, status ? 1 : 0, settingsJson]
        );
        
        return true;
    }
    
    // Set multiple device states at once
    static async setMultipleStates(roomId, deviceType, states) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            console.log(`[BACKEND DEBUG] setMultipleStates: roomId=${roomId}, type=${deviceType}, states count=${states.length}`);
            for (let i = 0; i < states.length; i++) {
                const settingsJson = states[i].settings ? JSON.stringify(states[i].settings) : null;
                const statusValue = states[i].status ? 1 : 0;
                console.log(`[BACKEND DEBUG] Saving device state: index=${i}, status=${states[i].status} (${statusValue})`);
                
                try {
                    // First, check if record exists
                    const [checkResult] = await connection.query(
                        `SELECT status FROM device_states 
                         WHERE room_id = ? AND device_type = ? AND device_index = ?`,
                        [roomId, deviceType, i]
                    );
                    
                    if (checkResult.length > 0) {
                        const currentStatus = checkResult[0].status;
                        console.log(`[BACKEND DEBUG] Existing record found at index ${i}: current status=${currentStatus} (${typeof currentStatus}), new status=${statusValue}`);
                        
                        // Update existing record
                        const [updateResult] = await connection.query(
                            `UPDATE device_states 
                             SET status = ?, settings = ?, updated_at = CURRENT_TIMESTAMP
                             WHERE room_id = ? AND device_type = ? AND device_index = ?`,
                            [statusValue, settingsJson, roomId, deviceType, i]
                        );
                        
                        console.log(`[BACKEND DEBUG] Updated existing device state at index ${i}:`, {
                            affectedRows: updateResult.affectedRows,
                            changedRows: updateResult.changedRows || 0
                        });
                        
                        // Verify the update actually changed the value
                        if (updateResult.affectedRows === 0) {
                            console.error(`[BACKEND DEBUG] ERROR: Update did not affect any rows at index ${i}!`);
                        } else if (updateResult.changedRows === 0) {
                            console.log(`[BACKEND DEBUG] WARNING: Update did not change any rows - value may already be ${statusValue}`);
                        } else {
                            console.log(`[BACKEND DEBUG] SUCCESS: Updated device state at index ${i} from ${currentStatus} to ${statusValue}`);
                        }
                    } else {
                        console.log(`[BACKEND DEBUG] No existing record found, inserting new device state at index ${i}`);
                        const [insertResult] = await connection.query(
                            `INSERT INTO device_states (room_id, device_type, device_index, status, settings)
                             VALUES (?, ?, ?, ?, ?)`,
                            [roomId, deviceType, i, statusValue, settingsJson]
                        );
                        console.log(`[BACKEND DEBUG] Inserted new device state at index ${i}:`, {
                            affectedRows: insertResult.affectedRows,
                            insertId: insertResult.insertId
                        });
                    }
                } catch (queryError) {
                    console.error(`[BACKEND DEBUG] Error saving device state at index ${i}:`, queryError);
                    console.error(`[BACKEND DEBUG] Error code:`, queryError.code);
                    console.error(`[BACKEND DEBUG] Error message:`, queryError.message);
                    console.error(`[BACKEND DEBUG] Error stack:`, queryError.stack);
                    console.error(`[BACKEND DEBUG] Query parameters:`, [roomId, deviceType, i, statusValue, settingsJson]);
                    throw queryError;
                }
            }
            
            await connection.commit();
            console.log(`[BACKEND DEBUG] Successfully committed ${states.length} device states to database`);
            return true;
        } catch (error) {
            await connection.rollback();
            console.error(`[BACKEND DEBUG] Error in setMultipleStates:`, error);
            console.error(`[BACKEND DEBUG] Error stack:`, error.stack);
            throw error;
        } finally {
            connection.release();
        }
    }
    
    // Delete device state
    static async deleteDeviceState(roomId, deviceType, deviceIndex) {
        const [result] = await pool.query(
            'DELETE FROM device_states WHERE room_id = ? AND device_type = ? AND device_index = ?',
            [roomId, deviceType, deviceIndex]
        );
        return result.affectedRows > 0;
    }
    
    // Delete all device states for a room
    static async deleteByRoom(roomId) {
        const [result] = await pool.query('DELETE FROM device_states WHERE room_id = ?', [roomId]);
        return result.affectedRows;
    }
}

module.exports = DeviceState;
