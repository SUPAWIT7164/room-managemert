const axios = require('axios');
require('dotenv').config();

async function testAuth() {
    const cameraConfig = {
        baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
        username: process.env.CCTV_USERNAME || 'admin',
        password: process.env.CCTV_PASSWORD || 'L@nnac0m'
    };

    console.log('='.repeat(60));
    console.log('🔐 ทดสอบ Authentication Methods');
    console.log('='.repeat(60));
    console.log(`📡 Base URL: ${cameraConfig.baseUrl}`);
    console.log(`👤 Username: ${cameraConfig.username}`);
    console.log(`🔐 Password: ${cameraConfig.password ? '***' : 'NOT SET'}`);
    console.log('='.repeat(60));
    console.log('');

    // Test endpoint
    const testUrl = `${cameraConfig.baseUrl}/ISAPI/Streaming/channels/101/picture`;

    // Test 1: No auth
    console.log('1️⃣  Testing without authentication...');
    try {
        const response = await axios.get(testUrl, {
            timeout: 5000,
            validateStatus: () => true
        });
        console.log(`   Status: ${response.status}`);
        if (response.status === 401) {
            const authHeader = response.headers['www-authenticate'] || response.headers['WWW-Authenticate'];
            console.log(`   Auth Method: ${authHeader}`);
            if (authHeader) {
                if (authHeader.toLowerCase().includes('digest')) {
                    console.log('   ✅ Server uses Digest Authentication');
                } else if (authHeader.toLowerCase().includes('basic')) {
                    console.log('   ✅ Server uses Basic Authentication');
                }
            }
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 2: Basic Auth
    console.log('\n2️⃣  Testing with Basic Authentication...');
    try {
        const response = await axios.get(testUrl, {
            auth: {
                username: cameraConfig.username,
                password: cameraConfig.password
            },
            timeout: 5000,
            validateStatus: () => true
        });
        console.log(`   Status: ${response.status}`);
        if (response.status === 200) {
            console.log('   ✅ Basic Auth สำเร็จ!');
        } else if (response.status === 401) {
            console.log('   ❌ Basic Auth ล้มเหลว');
            const authHeader = response.headers['www-authenticate'] || response.headers['WWW-Authenticate'];
            console.log(`   Auth Header: ${authHeader}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }

    // Test 3: Try different username/password combinations
    console.log('\n3️⃣  Testing common username/password combinations...');
    const commonCredentials = [
        { username: 'admin', password: 'admin' },
        { username: 'admin', password: '12345' },
        { username: 'admin', password: '' },
        { username: 'root', password: 'root' },
        { username: 'admin', password: 'L@nnac0m' }, // Current
    ];

    for (const cred of commonCredentials) {
        try {
            const response = await axios.get(testUrl, {
                auth: {
                    username: cred.username,
                    password: cred.password
                },
                timeout: 3000,
                validateStatus: () => true
            });
            if (response.status === 200) {
                console.log(`   ✅ สำเร็จ! Username: ${cred.username}, Password: ${cred.password}`);
                break;
            }
        } catch (error) {
            // Continue
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 คำแนะนำ:');
    console.log('  1. ตรวจสอบ username/password ในกล้อง');
    console.log('  2. ลองเปิด http://192.168.24.1/doc/index.html#/preview ใน browser');
    console.log('  3. ตรวจสอบว่า login ด้วย username/password อะไร');
    console.log('  4. อัพเดท .env file ด้วย credentials ที่ถูกต้อง');
    console.log('='.repeat(60));
}

testAuth().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

