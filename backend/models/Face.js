const { pool } = require('../config/database');

class Face {
    static async findByUserId(userId) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM faces WHERE user_id = ? AND is_active = 1',
                [userId]
            );
            return rows[0] || null;
        } catch (error) {
            // If table doesn't exist, return null
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return null;
            }
            throw error;
        }
    }

    static async create(userId, image, imageBase64) {
        try {
            // Check if table has image_base64 column, if not, add it
            const [columns] = await pool.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'faces' 
                AND COLUMN_NAME = 'image_base64'
            `);

            const hasImageBase64 = columns.length > 0;

            if (!hasImageBase64) {
                // Add image_base64 column if it doesn't exist
                try {
                    await pool.query(`
                        ALTER TABLE faces 
                        ADD COLUMN image_base64 LONGTEXT NULL AFTER face_encoding
                    `);
                } catch (alterError) {
                    // Column might already exist or other error, continue
                    console.log('Note: Could not add image_base64 column:', alterError.message);
                }
            }

            // Use image_base64 if available, otherwise use face_encoding
            if (hasImageBase64 || columns.length > 0) {
                const [result] = await pool.query(
                    `INSERT INTO faces (user_id, image_base64, is_active, registered_at, created_at, updated_at) 
                     VALUES (?, ?, 1, NOW(), NOW(), NOW())`,
                    [userId, imageBase64]
                );
                return { id: result.insertId, user_id: userId, image_base64: imageBase64 };
            } else {
                // Fallback: store in face_encoding
                const [result] = await pool.query(
                    `INSERT INTO faces (user_id, face_encoding, is_active, registered_at, created_at, updated_at) 
                     VALUES (?, ?, 1, NOW(), NOW(), NOW())`,
                    [userId, imageBase64]
                );
                return { id: result.insertId, user_id: userId, face_encoding: imageBase64 };
            }
        } catch (error) {
            console.error('Error creating face:', error);
            throw error;
        }
    }

    static async update(userId, image, imageBase64) {
        try {
            // Check if table has image_base64 column
            const [columns] = await pool.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'faces' 
                AND COLUMN_NAME = 'image_base64'
            `);

            const hasImageBase64 = columns.length > 0;

            if (!hasImageBase64) {
                // Try to add column if it doesn't exist
                try {
                    await pool.query(`
                        ALTER TABLE faces 
                        ADD COLUMN image_base64 LONGTEXT NULL AFTER face_encoding
                    `);
                } catch (alterError) {
                    // Column might already exist or other error, continue
                    console.log('Note: Could not add image_base64 column:', alterError.message);
                }
            }

            // Check again after potential alter
            const [columnsAfter] = await pool.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'faces' 
                AND COLUMN_NAME = 'image_base64'
            `);

            if (columnsAfter.length > 0) {
                await pool.query(
                    `UPDATE faces SET image_base64 = ?, updated_at = NOW() WHERE user_id = ?`,
                    [imageBase64, userId]
                );
            } else {
                // Update face_encoding as fallback
                await pool.query(
                    `UPDATE faces SET face_encoding = ?, updated_at = NOW() WHERE user_id = ?`,
                    [imageBase64, userId]
                );
            }
            return this.findByUserId(userId);
        } catch (error) {
            console.error('Error updating face:', error);
            throw error;
        }
    }

    static async hasFace(userId) {
        const face = await this.findByUserId(userId);
        return !!face;
    }
}

module.exports = Face;

