const { pool } = require('../config/database');

class DevicePosition {
    // Get all device positions for a room
    static async getByRoom(roomId) {
        const [rows] = await pool.query(
            'SELECT * FROM device_positions WHERE room_id = ?',
            [roomId]
        );
        
        // Group by device type
        const positions = {};
        
        rows.forEach(row => {
            positions[row.device_type] = JSON.parse(row.positions);
        });
        
        return positions;
    }
    
    // Set device positions (create or update)
    static async setPositions(roomId, deviceType, positions) {
        const positionsJson = JSON.stringify(positions);
        
        await pool.query(
            `INSERT INTO device_positions (room_id, device_type, positions)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE positions = VALUES(positions)`,
            [roomId, deviceType, positionsJson]
        );
        
        return true;
    }
    
    // Set all positions for a room at once
    static async setAllPositions(roomId, allPositions) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            for (const [deviceType, positions] of Object.entries(allPositions)) {
                if (['light', 'ac', 'erv'].includes(deviceType)) {
                    const positionsJson = JSON.stringify(positions);
                    await connection.query(
                        `INSERT INTO device_positions (room_id, device_type, positions)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE positions = VALUES(positions)`,
                        [roomId, deviceType, positionsJson]
                    );
                }
            }
            
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    
    // Delete device positions
    static async deletePositions(roomId, deviceType) {
        const [result] = await pool.query(
            'DELETE FROM device_positions WHERE room_id = ? AND device_type = ?',
            [roomId, deviceType]
        );
        return result.affectedRows > 0;
    }
    
    // Delete all device positions for a room
    static async deleteByRoom(roomId) {
        const [result] = await pool.query('DELETE FROM device_positions WHERE room_id = ?', [roomId]);
        return result.affectedRows;
    }
}

module.exports = DevicePosition;










