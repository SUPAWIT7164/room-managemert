/**
 * Test Face Scanner Direct Connection
 * ทดสอบการเชื่อมต่อโดยตรงเหมือน room-management-portal
 */

const axios = require('axios');

async function testDirectConnection() {
    const baseUrl = 'http://192.168.22.53';
    const username = 'admin';
    const password = 'lannacom@1';
    const testUsername = 'test'; // หรือ username ที่มีในระบบ

    console.log('='.repeat(60));
    console.log('Direct Face Scanner Test (room-management-portal format)');
    console.log('='.repeat(60));
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Username: ${username}`);
    console.log(`Test Username: ${testUsername}`);
    console.log('='.repeat(60));
    console.log('');

    // Test 1: GetFace (เหมือน room-management-portal)
    console.log('Test 1: POST /user/GetFace (room-management-portal format)...');
    try {
        const response = await axios.post(
            `${baseUrl}/user/GetFace`,
            {
                Username: testUsername
            },
            {
                auth: {
                    username,
                    password
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000,
                validateStatus: (status) => status < 500
            }
        );

        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));

        if (response.status === 200 && response.data && response.data.Image) {
            console.log('✅ GetFace API ทำงานได้!');
            console.log(`   Image size: ${response.data.Image.length} bytes (base64)`);
        } else if (response.status === 404) {
            console.log('❌ Endpoint /user/GetFace ไม่พบ (404)');
            console.log('   เครื่องสแกนหน้าอาจใช้ API format ที่แตกต่าง');
        } else {
            console.log(`⚠️  Response: ${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        if (error.response) {
            console.log(`❌ Error ${error.response.status}: ${error.response.statusText}`);
            if (error.response.data) {
                console.log('Response:', JSON.stringify(error.response.data).substring(0, 200));
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.log('❌ Connection refused - เครื่องสแกนหน้าไม่สามารถเข้าถึงได้');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('❌ Connection timeout - เครื่องสแกนหน้าไม่ตอบสนอง');
        } else {
            console.log(`❌ Error: ${error.message}`);
        }
    }
    console.log('');

    // Test 2: AddFace (เหมือน room-management-portal)
    console.log('Test 2: POST /user/AddFace (room-management-portal format)...');
    console.log('   Note: This will fail if user already exists, but tests the endpoint');
    try {
        const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 pixel PNG
        
        const response = await axios.post(
            `${baseUrl}/user/AddFace`,
            {
                Username: testUsername,
                Image: testImage
            },
            {
                auth: {
                    username,
                    password
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000,
                validateStatus: (status) => status < 500
            }
        );

        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));

        if (response.status === 200) {
            console.log('✅ AddFace API ทำงานได้!');
        } else if (response.status === 404) {
            console.log('❌ Endpoint /user/AddFace ไม่พบ (404)');
        } else {
            console.log(`⚠️  Response: ${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        if (error.response) {
            console.log(`❌ Error ${error.response.status}: ${error.response.statusText}`);
            if (error.response.data) {
                const dataStr = typeof error.response.data === 'string' 
                    ? error.response.data.substring(0, 200)
                    : JSON.stringify(error.response.data).substring(0, 200);
                console.log('Response:', dataStr);
            }
        } else {
            console.log(`❌ Error: ${error.message}`);
        }
    }
    console.log('');

    // Test 3: Try without authentication (some devices don't need it)
    console.log('Test 3: Testing without authentication...');
    try {
        const response = await axios.post(
            `${baseUrl}/user/GetFace`,
            {
                Username: testUsername
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000,
                validateStatus: (status) => status < 500
            }
        );

        console.log(`Status: ${response.status}`);
        if (response.status === 200) {
            console.log('✅ API ทำงานได้โดยไม่ต้อง authentication!');
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('⚠️  ต้องการ authentication (401)');
        } else {
            console.log(`⚠️  ${error.message}`);
        }
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
    console.log('');
    console.log('สรุป:');
    console.log('- หาก endpoint /user/GetFace และ /user/AddFace ไม่พบ (404)');
    console.log('  แสดงว่าเครื่องสแกนหน้า IP 192.168.22.53 ใช้ API format ที่แตกต่าง');
    console.log('  จากเครื่อง 10.1.244.42 ที่ใช้ใน room-management-portal');
    console.log('- ต้องตรวจสอบ documentation ของเครื่องสแกนหน้านี้เพื่อหา API ที่ถูกต้อง');
}

testDirectConnection().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});


