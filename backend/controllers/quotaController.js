const { pool, DB_TYPE } = require('../config/database');
const { createLaravelSettingsTable } = require('../config/createLaravelSettingsTable');

class QuotaController {
    // Get all quota settings (from settings table, module_id = 1)
    async getAll(req, res) {
        try {
            // First check if the table has the Laravel structure (slug, module_id)
            // MySQL: TABLE_SCHEMA = DATABASE(); SQL Server: TABLE_CATALOG = DB_NAME() (converted in database.js)
            const [columns] = await pool.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'settings' 
                AND COLUMN_NAME IN ('slug', 'module_id')
            `);

            const hasLaravelStructure = columns.length === 2;

            if (!hasLaravelStructure) {
                // On MSSQL we don't create the Laravel-style settings table; return empty data
                if (DB_TYPE === 'mssql') {
                    return res.json({ success: true, data: [] });
                }
                try {
                    await createLaravelSettingsTable();
                } catch (error) {
                    console.error('Error creating Laravel settings table:', error);
                    return res.status(500).json({
                        success: false,
                        message: 'ไม่สามารถสร้างตาราง settings ได้',
                        error: error.message
                    });
                }
            }

            // Use Laravel structure
            const [rows] = await pool.query(`
                SELECT id, name, name_en, slug, value, unit, unit_en, disable
                FROM settings
                WHERE module_id = 1 AND disable = 0
                ORDER BY id ASC
            `);

            return res.json({
                success: true,
                data: rows
            });
        } catch (error) {
            // If table doesn't exist, return empty array (MySQL: ER_NO_SUCH_TABLE; MSSQL: various)
            const noTable = error.code === 'ER_NO_SUCH_TABLE' ||
                (error.message && /Invalid object name 'settings'|does not exist/i.test(error.message));
            if (noTable) {
                return res.json({
                    success: true,
                    data: []
                });
            }
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Create quota
    async create(req, res) {
        try {
            const { user_id, room_id, weekly_limit, monthly_limit, weekly_hours_limit } = req.body;

            // Check if quota already exists for this user/room combination
            if (user_id || room_id) {
                let checkQuery = 'SELECT id FROM usage_quotas WHERE 1=1';
                const checkParams = [];

                if (user_id) {
                    checkQuery += ' AND user_id = ?';
                    checkParams.push(user_id);
                } else {
                    checkQuery += ' AND user_id IS NULL';
                }

                if (room_id) {
                    checkQuery += ' AND room_id = ?';
                    checkParams.push(room_id);
                } else {
                    checkQuery += ' AND room_id IS NULL';
                }

                const [existing] = await pool.query(checkQuery, checkParams);
                if (existing.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'โควต้านี้มีอยู่แล้ว'
                    });
                }
            }

            const [result] = await pool.query(
                `INSERT INTO usage_quotas 
                 (user_id, room_id, weekly_limit, monthly_limit, weekly_hours_limit, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
                [user_id || null, room_id || null, weekly_limit || null, monthly_limit || null, weekly_hours_limit || null]
            );

            const [newQuota] = await pool.query(`
                SELECT q.*, 
                       u.name as user_name, u.email as user_email,
                       r.name as room_name
                FROM usage_quotas q
                LEFT JOIN users u ON q.user_id = u.id
                LEFT JOIN rooms r ON q.room_id = r.id
                WHERE q.id = ?
            `, [result.insertId]);

            res.status(201).json({
                success: true,
                message: 'เพิ่มโควต้าเรียบร้อยแล้ว',
                data: newQuota[0]
            });
        } catch (error) {
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(500).json({
                    success: false,
                    message: 'ตาราง usage_quotas ยังไม่ถูกสร้าง กรุณาติดต่อผู้ดูแลระบบ'
                });
            }
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update quota setting (from settings table)
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;

            // If updating by id
            if (data.value !== undefined) {
                await pool.query(
                    `UPDATE settings SET value = ?, updated_at = NOW() WHERE id = ? AND module_id = 1`,
                    [data.value, id]
                );

                const [updated] = await pool.query(`
                    SELECT id, name, name_en, slug, value, unit, unit_en, disable
                    FROM settings
                    WHERE id = ? AND module_id = 1
                `, [id]);

                return res.json({
                    success: true,
                    message: 'อัปเดตโควต้าเรียบร้อยแล้ว',
                    data: updated[0]
                });
            }

            return res.status(400).json({
                success: false,
                message: 'ไม่มีข้อมูลที่จะอัปเดต'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Update quota setting by slug (like Laravel)
    async updateBySlug(req, res) {
        try {
            const data = req.body;

            // Check if table has Laravel structure
            const [columns] = await pool.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'settings' 
                AND COLUMN_NAME IN ('slug', 'module_id')
            `);

            if (columns.length !== 2) {
                return res.status(500).json({
                    success: false,
                    message: 'ตาราง settings ยังไม่มีโครงสร้างตาม Laravel'
                });
            }

            // Update multiple settings at once (like Laravel)
            for (const [slug, value] of Object.entries(data)) {
                await pool.query(
                    `UPDATE settings SET value = ?, updated_at = NOW() WHERE slug = ? AND module_id = 1`,
                    [value, slug]
                );
            }

            return res.json({
                success: true,
                message: 'อัปเดตโควต้าเรียบร้อยแล้ว'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาด',
                error: error.message
            });
        }
    }

    // Delete quota
    async delete(req, res) {
        try {
            const { id } = req.params;

            const [result] = await pool.query('DELETE FROM usage_quotas WHERE id = ?', [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบโควต้า'
                });
            }

            res.json({
                success: true,
                message: 'ลบโควต้าเรียบร้อยแล้ว'
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

module.exports = new QuotaController();




