const axios = require('axios');
const DigestAuth = require('../utils/digestAuth');
require('dotenv').config();

// CCTV Camera Configuration
const cameraConfig = {
    baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
    username: process.env.CCTV_USERNAME || 'admin',
    password: process.env.CCTV_PASSWORD || 'L@nnac0m'
};

console.log('='.repeat(60));
console.log('🔍 กำลังทดสอบการเชื่อมต่อกับกล้อง CCTV');
console.log('='.repeat(60));
console.log(`📡 Base URL: ${cameraConfig.baseUrl}`);
console.log(`👤 Username: ${cameraConfig.username}`);
console.log(`🔐 Password: ${cameraConfig.password ? '***' : 'NOT SET'}`);
console.log('='.repeat(60));
console.log('');

// Test 1: Basic connectivity (no auth)
async function testBasicConnectivity() {
    console.log('📡 Test 1: ทดสอบการเชื่อมต่อพื้นฐาน (ไม่ใช้ authentication)');
    try {
        const response = await axios.get(cameraConfig.baseUrl, {
            timeout: 5000,
            validateStatus: () => true // Accept any status
        });
        console.log(`  ✅ เชื่อมต่อได้! Status: ${response.status}`);
        console.log(`  📄 Response headers:`, Object.keys(response.headers).slice(0, 5));
        return true;
    } catch (error) {
        if (error.code === 'ETIMEDOUT') {
            console.log(`  ❌ Timeout - ไม่สามารถเชื่อมต่อได้ภายใน 5 วินาที`);
            console.log(`  💡 ตรวจสอบว่า IP address ถูกต้องและกล้องเปิดอยู่`);
        } else if (error.code === 'ECONNREFUSED') {
            console.log(`  ❌ Connection Refused - ไม่มี service ที่ IP นี้`);
            console.log(`  💡 ตรวจสอบว่า IP address ถูกต้อง`);
        } else if (error.code === 'ENOTFOUND') {
            console.log(`  ❌ Host Not Found - ไม่พบ hostname`);
            console.log(`  💡 ตรวจสอบว่า IP address ถูกต้อง`);
        } else {
            console.log(`  ❌ Error: ${error.message}`);
            console.log(`  💡 Code: ${error.code}`);
        }
        return false;
    }
}

// Test 2: Test with authentication
async function testWithAuth() {
    console.log('\n🔐 Test 2: ทดสอบการเชื่อมต่อพร้อม authentication');
    const testEndpoints = [
        '/ISAPI/System/deviceInfo',
        '/ISAPI/System/status',
        '/doc/page/login.asp',
        '/',
        '/ISAPI/Streaming/channels/101/picture'
    ];

    let successCount = 0;
    for (const endpoint of testEndpoints) {
        try {
            const url = `${cameraConfig.baseUrl}${endpoint}`;
            console.log(`  Testing: ${url}`);
            
            let response;
            // Use Digest Auth for ISAPI endpoints, Basic for others
            if (endpoint.includes('ISAPI')) {
                const digestAuth = new DigestAuth(cameraConfig.username, cameraConfig.password);
                response = await digestAuth.request('GET', url, {
                    timeout: 5000,
                    validateStatus: () => true
                });
            } else {
                response = await axios.get(url, {
                    auth: {
                        username: cameraConfig.username,
                        password: cameraConfig.password
                    },
                    timeout: 5000,
                    validateStatus: () => true
                });
            }

            if (response.status === 200) {
                console.log(`    ✅ Success! Status: ${response.status}`);
                if (response.headers['content-type']) {
                    console.log(`    📄 Content-Type: ${response.headers['content-type']}`);
                }
                if (response.data && typeof response.data === 'object') {
                    console.log(`    📦 Response type: ${typeof response.data}`);
                }
                successCount++;
            } else if (response.status === 401) {
                console.log(`    ⚠️  Authentication failed (401) - ตรวจสอบ username/password`);
            } else if (response.status === 404) {
                console.log(`    ⚠️  Not found (404) - endpoint ไม่มีอยู่`);
            } else {
                console.log(`    ⚠️  Status: ${response.status}`);
            }
        } catch (error) {
            if (error.code === 'ETIMEDOUT') {
                console.log(`    ❌ Timeout`);
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`    ❌ Connection Refused`);
            } else {
                console.log(`    ❌ Error: ${error.message}`);
            }
        }
    }

    return successCount > 0;
}

// Test 3: Test snapshot endpoint
async function testSnapshot() {
    console.log('\n📸 Test 3: ทดสอบดึงภาพ snapshot');
    const endpoints = [
        '/ISAPI/Streaming/channels/101/picture',
        '/ISAPI/Streaming/channels/1/picture',
        '/snapshot.jpg'
    ];

    for (const endpoint of endpoints) {
        try {
            const url = `${cameraConfig.baseUrl}${endpoint}`;
            console.log(`  Testing: ${url}`);
            
            let response;
            // Use Digest Auth for ISAPI endpoints
            if (endpoint.includes('ISAPI')) {
                const digestAuth = new DigestAuth(cameraConfig.username, cameraConfig.password);
                response = await digestAuth.request('GET', url, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                });
            } else {
                response = await axios.get(url, {
                    auth: {
                        username: cameraConfig.username,
                        password: cameraConfig.password
                    },
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                });
            }

            if (response.status === 200 && response.data) {
                const buffer = Buffer.from(response.data);
                const isImage = buffer[0] === 0xFF && buffer[1] === 0xD8; // JPEG header
                
                if (isImage && buffer.length > 1000) {
                    console.log(`    ✅ Success! Got image: ${buffer.length} bytes`);
                    console.log(`    📷 Image type: JPEG`);
                    return true;
                } else {
                    console.log(`    ⚠️  Got response but may not be image (${buffer.length} bytes)`);
                }
            } else {
                console.log(`    ⚠️  Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}`);
        }
    }

    return false;
}

// Run all tests
async function runTests() {
    const basicConnectivity = await testBasicConnectivity();
    
    if (!basicConnectivity) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ ไม่สามารถเชื่อมต่อกับกล้องได้');
        console.log('='.repeat(60));
        console.log('\n💡 คำแนะนำ:');
        console.log('  1. ตรวจสอบว่า IP address ถูกต้อง: 192.168.24.1');
        console.log('  2. ตรวจสอบว่า backend server อยู่ใน network เดียวกันกับกล้อง');
        console.log('  3. ตรวจสอบว่า firewall ไม่ได้บล็อกการเชื่อมต่อ');
        console.log('  4. ลอง ping 192.168.24.1 จาก terminal');
        process.exit(1);
    }

    const authTest = await testWithAuth();
    const snapshotTest = await testSnapshot();

    console.log('\n' + '='.repeat(60));
    console.log('📊 สรุปผลการทดสอบ');
    console.log('='.repeat(60));
    console.log(`  Basic Connectivity: ${basicConnectivity ? '✅' : '❌'}`);
    console.log(`  Authentication: ${authTest ? '✅' : '❌'}`);
    console.log(`  Snapshot: ${snapshotTest ? '✅' : '❌'}`);
    console.log('='.repeat(60));

    if (basicConnectivity && authTest && snapshotTest) {
        console.log('\n✅ การเชื่อมต่อสำเร็จ! ระบบพร้อมใช้งาน');
        process.exit(0);
    } else {
        console.log('\n⚠️  มีบางส่วนที่ยังไม่สำเร็จ');
        if (!authTest) {
            console.log('  - ตรวจสอบ username/password');
        }
        if (!snapshotTest) {
            console.log('  - ตรวจสอบ endpoint สำหรับ snapshot');
            console.log('  - ลองรัน: npm run discover-cctv');
        }
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('\n❌ เกิดข้อผิดพลาด:', error);
    process.exit(1);
});

