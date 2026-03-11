/**
 * อัปเดตรหัสผ่านของ user ที่ email='admin' เป็น Lannacom@1
 * รัน: node scripts/update-admin-password.js (จากโฟลเดอร์ backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

async function main() {
  const newPassword = 'Lannacom@1';
  const hash = await bcrypt.hash(newPassword, 10);
  const [rows, f] = await pool.query("UPDATE users SET password = ? WHERE email = N'admin'", [hash]);
  const [r2] = await pool.query("SELECT id, name, email FROM users WHERE email = N'admin'");
  if (r2 && r2.length > 0) {
    console.log('Updated password for user:', r2[0].email, '(id:', r2[0].id, ')');
    console.log('Use: admin /', newPassword);
  } else {
    console.log('No user with email=admin found. Create one or use another existing email.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
