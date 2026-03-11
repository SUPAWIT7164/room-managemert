/**
 * อัปเดต role ของ user ที่ email='admin' เป็น super-admin
 * รัน: node scripts/update-admin-role.js (จากโฟลเดอร์ backend)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const User = require('../models/User');

async function main() {
    try {
        // หา user ที่ email='admin'
        const user = await User.findByEmail('admin');
        
        if (!user) {
            console.log('❌ ไม่พบ user ที่ email=admin');
            process.exit(1);
        }
        
        console.log('👤 พบ user:', {
            id: user.id,
            name: user.name,
            email: user.email
        });
        
        // ตรวจสอบ role ปัจจุบัน
        const currentRole = await User.getUserRole(user.id);
        console.log('📋 Role ปัจจุบัน:', currentRole);
        
        if (currentRole === 'super-admin') {
            console.log('✅ User นี้เป็น super-admin อยู่แล้ว');
            process.exit(0);
        }
        
        // อัปเดต role เป็น super-admin
        console.log('🔄 กำลังอัปเดต role เป็น super-admin...');
        await User.updateRole(user.id, 'super-admin');
        
        // ตรวจสอบ role ใหม่
        const newRole = await User.getUserRole(user.id);
        console.log('✅ อัปเดต role สำเร็จ!');
        console.log('📋 Role ใหม่:', newRole);
        
        if (newRole === 'super-admin') {
            console.log('🎉 User admin ตอนนี้เป็น super-admin แล้ว!');
        } else {
            console.log('⚠️  Warning: Role อาจไม่ถูกอัปเดตอย่างถูกต้อง');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.error('Error stack:', error.stack);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main();
