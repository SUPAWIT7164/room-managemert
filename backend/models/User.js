const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    static async findAll(options = {}) {
        let query = `SELECT u.id, u.name, u.email, u.phone, u.department, u.position, u.employee_id, 
                     u.photo, u.is_active, u.last_login_at, u.created_at,
                     COALESCE(r.name, 'user') as role
                     FROM users u
                     LEFT JOIN model_has_roles mhr ON u.id = mhr.model_id AND mhr.model_type = 'App\\\\Models\\\\User'
                     LEFT JOIN roles r ON mhr.role_id = r.id`;
        const params = [];
        const conditions = [];

        if (options.is_active !== undefined) {
            conditions.push('u.is_active = ?');
            params.push(options.is_active);
        }

        if (options.search) {
            conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.department LIKE ?)');
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (options.role) {
            conditions.push('r.name = ?');
            params.push(options.role);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' GROUP BY u.id';
        query += ' ORDER BY u.created_at DESC';

        if (options.limit) {
            query += ' LIMIT ?';
            params.push(parseInt(options.limit));
        }

        if (options.offset) {
            query += ' OFFSET ?';
            params.push(parseInt(options.offset));
        }

        const [rows] = await pool.query(query, params);
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, email, phone, department, position, employee_id, 
             photo, is_active, last_login_at, created_at 
             FROM users WHERE id = ?`,
            [id]
        );
        return rows[0];
    }

    static async findByEmail(email) {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    }

    static async findByUsername(username) {
        // Search by email, name, or employee_id
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR name = ? OR employee_id = ? LIMIT 1',
            [username, username, username]
        );
        return rows[0];
    }

    static async findByEmailOrUsername(identifier) {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? OR email = ?', [identifier, identifier]);
        return rows[0];
    }

    static async create(userData) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const [result] = await pool.query(
            `INSERT INTO users (email, password, name, phone, department, position, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
                userData.email,
                hashedPassword,
                userData.name || null,
                userData.phone || null,
                userData.department || null,
                userData.position || null
            ]
        );
        return { id: result.insertId, ...userData };
    }

    static async update(id, userData) {
        const updates = [];
        const params = [];

        const allowedFields = ['name', 'phone', 'department', 'position', 'is_active', 'photo'];
        
        for (const field of allowedFields) {
            if (userData[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(userData[field]);
            }
        }

        if (userData.password) {
            updates.push('password = ?');
            params.push(await bcrypt.hash(userData.password, 10));
        }

        if (updates.length === 0) return null;

        params.push(id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.findById(id);
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async validatePassword(user, password) {
        if (!user.password) return false;
        return bcrypt.compare(password, user.password);
    }

    static async updatePassword(userId, hashedPassword) {
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        return true;
    }

    static async count(options = {}) {
        let query = 'SELECT COUNT(*) as total FROM users';
        const params = [];
        const conditions = [];

        if (options.is_active !== undefined) {
            conditions.push('is_active = ?');
            params.push(options.is_active);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    }

    // Get user role from model_has_roles and roles tables (Spatie Permission)
    static async getUserRole(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT r.name as role_name 
                FROM model_has_roles mhr 
                JOIN roles r ON mhr.role_id = r.id 
                WHERE mhr.model_id = ? AND mhr.model_type = 'App\\\\Models\\\\User'
                LIMIT 1
            `, [userId]);
            return rows[0]?.role_name || 'user';
        } catch (error) {
            // If tables don't exist, return default role
            return 'user';
        }
    }

    // Update user role in Spatie Permission system
    static async updateRole(userId, roleName) {
        try {
            // Get role_id from roles table
            const [roleRows] = await pool.query(
                'SELECT id FROM roles WHERE name = ?',
                [roleName]
            );

            if (roleRows.length === 0) {
                // Create role if it doesn't exist
                const [insertRole] = await pool.query(
                    'INSERT INTO roles (name, guard_name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
                    [roleName, 'web']
                );
                var roleId = insertRole.insertId;
            } else {
                var roleId = roleRows[0].id;
            }

            // Remove existing role from model_has_roles
            await pool.query(`
                DELETE FROM model_has_roles 
                WHERE model_id = ? AND model_type = 'App\\\\Models\\\\User'
            `, [userId]);

            // Assign new role to model_has_roles
            await pool.query(`
                INSERT INTO model_has_roles (role_id, model_type, model_id) 
                VALUES (?, 'App\\\\Models\\\\User', ?)
            `, [roleId, userId]);

            // Update role in users table (if column exists)
            try {
                await pool.query('UPDATE users SET role = ? WHERE id = ?', [roleName, userId]);
            } catch (err) {
                // If role column doesn't exist, ignore the error
                // This allows the system to work with or without role column in users table
                console.log('Note: users table may not have role column, only updating Spatie Permission system');
            }

            return true;
        } catch (error) {
            console.error('Error updating user role:', error);
            throw error;
        }
    }
}

module.exports = User;
