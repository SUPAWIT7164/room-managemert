const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

async function checkServerStatus() {
    console.log('🔍 กำลังตรวจสอบสถานะระบบ...\n');
    
    try {
        // Check health endpoint
        const healthResponse = await axios.get(`${API_URL}/health`);
        console.log('✅ Server Status:', healthResponse.data.status);
        console.log('📅 Timestamp:', healthResponse.data.timestamp);
        console.log('💾 Database:', healthResponse.data.database === 'connected' ? '✅ Connected' : '❌ Disconnected');
        
        if (healthResponse.data.database === 'disconnected') {
            console.log('\n⚠️  ข้อความเตือน: ฐานข้อมูลไม่สามารถเชื่อมต่อได้');
            console.log('   กรุณาตรวจสอบ:');
            console.log('   1. MySQL/MariaDB service กำลังทำงานอยู่หรือไม่');
            console.log('   2. การตั้งค่าในไฟล์ .env ถูกต้องหรือไม่');
            console.log('   3. Database server สามารถเข้าถึงได้หรือไม่\n');
        }
        
        return healthResponse.data.database === 'connected';
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ ไม่สามารถเชื่อมต่อกับ server ได้');
            console.error('   กรุณาตรวจสอบว่า backend server กำลังทำงานอยู่ที่ port 5000');
        } else {
            console.error('❌ เกิดข้อผิดพลาด:', error.message);
        }
        return false;
    }
}

// Run check
checkServerStatus()
    .then(connected => {
        process.exit(connected ? 0 : 1);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });

