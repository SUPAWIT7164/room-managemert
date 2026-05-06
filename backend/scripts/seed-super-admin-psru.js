/**
 * สร้างหรืออัปเดต super-admin สำหรับ PSRU
 * Login: username = employee_id (adminpsru) — ตรงกับ User.findByUsername
 *
 * รัน: node scripts/seed-super-admin-psru.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const User = require('../models/User');

const LOGIN = 'adminpsru';
const EMAIL = 'adminpsru@psru.local';
const PASSWORD = 'Lannacom@1';
const DISPLAY_NAME = 'Super Admin';

async function main() {
    const hash = await bcrypt.hash(PASSWORD, 10);
    let existing = await User.findByUsername(LOGIN);

    let userId;
    if (existing) {
        userId = existing.id;
        await pool.query(
            `UPDATE users SET password = ?, email = ?, name = ?, employee_id = ?, is_active = 1, updated_at = GETDATE() WHERE id = ?`,
            [hash, EMAIL, DISPLAY_NAME, LOGIN, userId]
        );
        console.log('Updated existing user id', userId);
    } else {
        const result = await pool.execute(
            `INSERT INTO users (email, password, name, employee_id, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, GETDATE(), GETDATE())`,
            [EMAIL, hash, DISPLAY_NAME, LOGIN]
        );
        userId = result.insertId;
        if (userId == null) {
            const [rows] = await pool.query('SELECT id FROM users WHERE email = ? ORDER BY id DESC LIMIT 1', [EMAIL]);
            userId = rows[0]?.id;
        }
        if (!userId) {
            throw new Error('Could not determine new user id after insert');
        }
        console.log('Created user id', userId);
    }

    await User.updateRole(userId, 'super-admin');
    console.log('Role set to super-admin.');
    console.log('Login username:', LOGIN, '| Password:', PASSWORD);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
