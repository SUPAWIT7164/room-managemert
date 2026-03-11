const { pool } = require('../config/database');
const sql = require('mssql');

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
                // Convert status to boolean - handle 0/1, true/false, string, SQL Server bit (อาจเป็น Buffer)
                let statusValue = false;
                const raw = row.status;
                if (raw === 1 || raw === true || raw === '1' || raw === 'true') {
                    statusValue = true;
                } else if (raw === 0 || raw === false || raw === '0' || raw === 'false') {
                    statusValue = false;
                } else if (raw != null) {
                    // SQL Server bit / Buffer หรือค่าอื่น: แปลงเป็นตัวเลขแล้วถือ 0 = ปิด, อื่น = เปิด
                    const n = Buffer.isBuffer(raw) ? raw[0] : Number(raw);
                    statusValue = !Number.isNaN(n) && n !== 0;
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
    
    // Set device state (create or update) - SQL Server compatible
    static async setDeviceState(roomId, deviceType, deviceIndex, status, settings = null) {
        const settingsJson = settings ? JSON.stringify(settings) : null;
        const statusValue = status ? 1 : 0;
        
        // Check if record exists
        const [existing] = await pool.query(
            `SELECT status FROM device_states 
             WHERE room_id = ? AND device_type = ? AND device_index = ?`,
            [roomId, deviceType, deviceIndex]
        );
        
        if (existing.length > 0) {
            // Update existing record
            await pool.query(
                `UPDATE device_states 
                 SET status = ?, settings = ?, updated_at = GETDATE()
                 WHERE room_id = ? AND device_type = ? AND device_index = ?`,
                [statusValue, settingsJson, roomId, deviceType, deviceIndex]
            );
        } else {
            // Insert new record
            await pool.query(
                `INSERT INTO device_states (room_id, device_type, device_index, status, settings, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, GETDATE(), GETDATE())`,
                [roomId, deviceType, deviceIndex, statusValue, settingsJson]
            );
        }
        
        return true;
    }
    
    // Set multiple device states at once - SQL Server compatible
    static async setMultipleStates(roomId, deviceType, states) {
        // Get the actual SQL Server pool from database config
        const { pool: actualPool } = require('../config/database');
        const sql = require('mssql');
        
        // For SQL Server, we need to get the actual ConnectionPool instance
        // The poolWrapper.getConnection() returns the pool itself, but we need the actual pool
        // Let's use the pool directly without transaction for now (or use SQL Server transaction API)
        
        // Since SQL Server transactions are more complex, let's do it without explicit transaction
        // Each query will be atomic, and if one fails, we'll catch and report it
        console.log(`[BACKEND DEBUG] setMultipleStates: roomId=${roomId}, type=${deviceType}, states count=${states.length}`);
        
        try {
            for (let i = 0; i < states.length; i++) {
                const settingsJson = states[i].settings ? JSON.stringify(states[i].settings) : null;
                const statusValue = states[i].status ? 1 : 0;
                console.log(`[BACKEND DEBUG] Saving device state: index=${i}, status=${states[i].status} (${statusValue})`);
                
                try {
                    // Use setDeviceState which handles upsert correctly
                    await this.setDeviceState(roomId, deviceType, i, states[i].status, states[i].settings);
                    console.log(`[BACKEND DEBUG] Successfully saved device state at index ${i}`);
                } catch (queryError) {
                    console.error(`[BACKEND DEBUG] Error saving device state at index ${i}:`, queryError);
                    console.error(`[BACKEND DEBUG] Error code:`, queryError.code);
                    console.error(`[BACKEND DEBUG] Error message:`, queryError.message);
                    console.error(`[BACKEND DEBUG] Error stack:`, queryError.stack);
                    console.error(`[BACKEND DEBUG] Query parameters:`, [roomId, deviceType, i, statusValue, settingsJson]);
                    throw queryError;
                }
            }
            
            console.log(`[BACKEND DEBUG] Successfully saved ${states.length} device states to database`);
            return true;
        } catch (error) {
            console.error(`[BACKEND DEBUG] Error in setMultipleStates:`, error);
            console.error(`[BACKEND DEBUG] Error stack:`, error.stack);
            throw error;
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
