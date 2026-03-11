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
            if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42S02') {
                return null;
            }
            throw error;
        }
    }

    static async checkColumnExists(tableName, columnName) {
        try {
            // SQL Server syntax
            const query = `
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DB_NAME() 
                AND TABLE_NAME = ? 
                AND COLUMN_NAME = ?
            `;
            const [columns] = await pool.query(query, [tableName, columnName]);
            return columns.length > 0;
        } catch (error) {
            console.error('Error checking column:', error);
            return false;
        }
    }

    static async addImageBase64Column() {
        try {
            // SQL Server: Use NVARCHAR(MAX) and don't use AFTER clause
            const alterQuery = `
                ALTER TABLE faces 
                ADD image_base64 NVARCHAR(MAX) NULL
            `;
            await pool.query(alterQuery);
            return true;
        } catch (alterError) {
            // Column might already exist or other error
            console.log('Note: Could not add image_base64 column:', alterError.message);
            return false;
        }
    }

    static async create(userId, image, imageBase64) {
        try {
            console.log(`[Face.create] Creating face for user ${userId}, imageBase64 length: ${imageBase64 ? imageBase64.length : 0}`);
            
            // Check if table has image_base64 column, if not, add it
            let hasImageBase64 = await this.checkColumnExists('faces', 'image_base64');
            console.log(`[Face.create] Has image_base64 column: ${hasImageBase64}`);

            if (!hasImageBase64) {
                console.log(`[Face.create] Attempting to add image_base64 column`);
                const added = await this.addImageBase64Column();
                if (added) {
                    hasImageBase64 = await this.checkColumnExists('faces', 'image_base64');
                    console.log(`[Face.create] Column added, hasImageBase64: ${hasImageBase64}`);
                }
            }

            // Use SQL Server date function
            const dateFunction = 'GETDATE()';

            // Use image_base64 if available, otherwise use face_encoding
            if (hasImageBase64) {
                console.log(`[Face.create] Inserting into image_base64 column`);
                const result = await pool.execute(
                    `INSERT INTO faces (user_id, image_base64, is_active, registered_at, created_at, updated_at) 
                     VALUES (?, ?, 1, ${dateFunction}, ${dateFunction}, ${dateFunction})`,
                    [userId, imageBase64]
                );
                console.log(`[Face.create] Insert successful, insertId: ${result.insertId}`);
                return { id: result.insertId, user_id: userId, image_base64: imageBase64 };
            } else {
                // Fallback: store in face_encoding
                console.log(`[Face.create] Inserting into face_encoding column (fallback)`);
                const result = await pool.execute(
                    `INSERT INTO faces (user_id, face_encoding, is_active, registered_at, created_at, updated_at) 
                     VALUES (?, ?, 1, ${dateFunction}, ${dateFunction}, ${dateFunction})`,
                    [userId, imageBase64]
                );
                console.log(`[Face.create] Insert successful, insertId: ${result.insertId}`);
                return { id: result.insertId, user_id: userId, face_encoding: imageBase64 };
            }
        } catch (error) {
            console.error('[Face.create] Error creating face:', error);
            console.error('[Face.create] Error message:', error.message);
            console.error('[Face.create] Error code:', error.code);
            console.error('[Face.create] Error stack:', error.stack);
            throw error;
        }
    }

    static async update(userId, image, imageBase64) {
        try {
            console.log(`[Face.update] Updating face for user ${userId}, imageBase64 length: ${imageBase64 ? imageBase64.length : 0}`);
            
            // Check if table has image_base64 column
            let hasImageBase64 = await this.checkColumnExists('faces', 'image_base64');
            console.log(`[Face.update] Has image_base64 column: ${hasImageBase64}`);

            if (!hasImageBase64) {
                console.log(`[Face.update] Attempting to add image_base64 column`);
                const added = await this.addImageBase64Column();
                if (added) {
                    hasImageBase64 = await this.checkColumnExists('faces', 'image_base64');
                    console.log(`[Face.update] Column added, hasImageBase64: ${hasImageBase64}`);
                }
            }

            // Use SQL Server date function
            const dateFunction = 'GETDATE()';

            if (hasImageBase64) {
                console.log(`[Face.update] Updating image_base64 column`);
                await pool.execute(
                    `UPDATE faces SET image_base64 = ?, updated_at = ${dateFunction} WHERE user_id = ?`,
                    [imageBase64, userId]
                );
                console.log(`[Face.update] Update successful`);
            } else {
                // Update face_encoding as fallback
                console.log(`[Face.update] Updating face_encoding column (fallback)`);
                await pool.execute(
                    `UPDATE faces SET face_encoding = ?, updated_at = ${dateFunction} WHERE user_id = ?`,
                    [imageBase64, userId]
                );
                console.log(`[Face.update] Update successful`);
            }
            return this.findByUserId(userId);
        } catch (error) {
            console.error('[Face.update] Error updating face:', error);
            console.error('[Face.update] Error message:', error.message);
            console.error('[Face.update] Error code:', error.code);
            console.error('[Face.update] Error stack:', error.stack);
            throw error;
        }
    }

    static async hasFace(userId) {
        const face = await this.findByUserId(userId);
        return !!face;
    }
}

module.exports = Face;

