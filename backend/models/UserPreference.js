const { pool } = require('../config/database');

class UserPreference {
    // Get all preferences for a user
    static async getByUser(userId) {
        const [rows] = await pool.query(
            'SELECT preference_key, preference_value FROM user_preferences WHERE user_id = ?',
            [userId]
        );
        
        // Convert to object
        const preferences = {};
        rows.forEach(row => {
            // Try to parse as JSON, otherwise use as string
            try {
                preferences[row.preference_key] = JSON.parse(row.preference_value);
            } catch (e) {
                preferences[row.preference_key] = row.preference_value;
            }
        });
        
        return preferences;
    }
    
    // Get single preference
    static async getPreference(userId, key) {
        const [rows] = await pool.query(
            'SELECT preference_value FROM user_preferences WHERE user_id = ? AND preference_key = ?',
            [userId, key]
        );
        
        if (rows.length === 0) return null;
        
        // Try to parse as JSON, otherwise return as string
        try {
            return JSON.parse(rows[0].preference_value);
        } catch (e) {
            return rows[0].preference_value;
        }
    }
    
    // Set preference (create or update)
    static async setPreference(userId, key, value) {
        // Convert value to JSON string if it's an object/array, otherwise to string
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        await pool.query(
            `INSERT INTO user_preferences (user_id, preference_key, preference_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE preference_value = VALUES(preference_value)`,
            [userId, key, valueStr]
        );
        
        return true;
    }
    
    // Set multiple preferences at once
    static async setMultiplePreferences(userId, preferences) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            for (const [key, value] of Object.entries(preferences)) {
                const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                await connection.query(
                    `INSERT INTO user_preferences (user_id, preference_key, preference_value)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE preference_value = VALUES(preference_value)`,
                    [userId, key, valueStr]
                );
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
    
    // Delete preference
    static async deletePreference(userId, key) {
        const [result] = await pool.query(
            'DELETE FROM user_preferences WHERE user_id = ? AND preference_key = ?',
            [userId, key]
        );
        return result.affectedRows > 0;
    }
    
    // Delete all preferences for a user
    static async deleteByUser(userId) {
        const [result] = await pool.query('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
        return result.affectedRows;
    }
}

module.exports = UserPreference;










