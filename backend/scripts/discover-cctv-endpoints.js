const axios = require('axios');
require('dotenv').config();

// CCTV Camera Configuration
const cameraConfig = {
    baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
    username: process.env.CCTV_USERNAME || 'admin',
    password: process.env.CCTV_PASSWORD || 'L@nnac0m'
};

// Common Hikvision and camera API endpoints to test
const endpointsToTest = [
    // Hikvision ISAPI endpoints
    '/ISAPI/Streaming/channels/101/picture',
    '/ISAPI/Streaming/channels/1/picture',
    '/ISAPI/Streaming/channels/001/picture',
    '/ISAPI/Streaming/channels/201/picture',
    '/ISAPI/Streaming/channels/301/picture',
    
    // Alternative Hikvision formats
    '/ISAPI/Streaming/channels/1/0/picture',
    '/ISAPI/Streaming/channels/101/0/picture',
    
    // Generic snapshot endpoints
    '/snapshot.jpg',
    '/snapshot.cgi',
    '/cgi-bin/snapshot.cgi',
    '/cgi-bin/snapshot',
    
    // Web interface related
    '/doc/page/preview.html',
    '/doc/page/snapshot.cgi',
    '/doc/snapshot.jpg',
    
    // API endpoints
    '/api/snapshot',
    '/api/camera/snapshot',
    '/api/v1/snapshot',
    
    // Video/Stream endpoints that might return image
    '/video.cgi',
    '/video.jpg',
    '/stream.jpg',
    
    // Other common formats
    '/image.jpg',
    '/capture.jpg',
    '/picture.jpg',
    '/photo.jpg'
];

// System/Info endpoints to detect camera type
const infoEndpoints = [
    '/ISAPI/System/deviceInfo',
    '/ISAPI/System/status',
    '/ISAPI/System/capabilities',
    '/doc/page/login.asp',
    '/api/system/info',
    '/cgi-bin/param.cgi',
    '/cgi-bin/status.cgi'
];

async function testEndpoint(url, options = {}) {
    try {
        const response = await axios.get(url, {
            auth: {
                username: cameraConfig.username,
                password: cameraConfig.password
            },
            timeout: 5000,
            validateStatus: (status) => status < 500,
            ...options
        });

        return {
            url,
            status: response.status,
            contentType: response.headers['content-type'],
            contentLength: response.headers['content-length'] || (response.data ? response.data.length : 0),
            success: response.status === 200,
            isImage: response.headers['content-type']?.startsWith('image/') || false,
            data: response.data
        };
    } catch (error) {
        return {
            url,
            status: error.response?.status || 'ERROR',
            error: error.message,
            success: false
        };
    }
}

async function discoverEndpoints() {
    console.log('='.repeat(60));
    console.log('🔍 กำลังค้นหา API Endpoints จากกล้อง CCTV');
    console.log('='.repeat(60));
    console.log(`📡 Base URL: ${cameraConfig.baseUrl}`);
    console.log(`👤 Username: ${cameraConfig.username}`);
    console.log(`🔐 Password: ${cameraConfig.password ? '***' : 'ไม่ระบุ'}`);
    console.log('='.repeat(60));
    console.log('');

    // Test system/info endpoints first to detect camera type
    console.log('📋 กำลังตรวจสอบข้อมูลระบบ...');
    const infoResults = [];
    for (const endpoint of infoEndpoints) {
        const url = `${cameraConfig.baseUrl}${endpoint}`;
        console.log(`  Testing: ${url}`);
        const result = await testEndpoint(url);
        if (result.success) {
            infoResults.push(result);
            console.log(`  ✅ Success! Status: ${result.status}, Content-Type: ${result.contentType}`);
        } else {
            console.log(`  ❌ Failed: ${result.status || result.error}`);
        }
    }
    console.log('');

    // Test snapshot/image endpoints
    console.log('📸 กำลังค้นหา Snapshot/Image Endpoints...');
    const snapshotResults = [];
    
    for (const endpoint of endpointsToTest) {
        const url = `${cameraConfig.baseUrl}${endpoint}`;
        console.log(`  Testing: ${url}`);
        
        // Try with arraybuffer first to check if it's an image
        const result = await testEndpoint(url, { responseType: 'arraybuffer' });
        
        if (result.success) {
            const isImage = result.isImage || 
                          (result.data && result.data.length > 100 && 
                           (result.data[0] === 0xFF && result.data[1] === 0xD8)); // JPEG header
            
            if (isImage || result.contentLength > 100) {
                snapshotResults.push({
                    ...result,
                    isImage,
                    size: result.data ? result.data.length : result.contentLength
                });
                console.log(`  ✅ Success! Status: ${result.status}, Size: ${result.size} bytes, Image: ${isImage}`);
            } else {
                console.log(`  ⚠️  Response received but may not be an image (Size: ${result.size} bytes)`);
            }
        } else {
            console.log(`  ❌ Failed: ${result.status || result.error}`);
        }
    }
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('📊 สรุปผลการค้นหา');
    console.log('='.repeat(60));
    
    if (infoResults.length > 0) {
        console.log('\n✅ System/Info Endpoints ที่ใช้งานได้:');
        infoResults.forEach(result => {
            console.log(`   - ${result.url} (Status: ${result.status})`);
        });
    }
    
    if (snapshotResults.length > 0) {
        console.log('\n✅ Snapshot/Image Endpoints ที่ใช้งานได้:');
        snapshotResults.forEach(result => {
            console.log(`   - ${result.url}`);
            console.log(`     Status: ${result.status}, Size: ${result.size} bytes, Content-Type: ${result.contentType}`);
        });
        
        // Recommend the best endpoint
        const bestEndpoint = snapshotResults
            .filter(r => r.isImage && r.size > 1000)
            .sort((a, b) => b.size - a.size)[0];
        
        if (bestEndpoint) {
            console.log('\n⭐ Recommended Endpoint:');
            console.log(`   ${bestEndpoint.url}`);
            console.log(`   (Size: ${bestEndpoint.size} bytes, Content-Type: ${bestEndpoint.contentType})`);
        }
    } else {
        console.log('\n❌ ไม่พบ Snapshot/Image Endpoint ที่ใช้งานได้');
        console.log('\n💡 คำแนะนำ:');
        console.log('   1. ตรวจสอบว่า IP address ถูกต้อง');
        console.log('   2. ตรวจสอบ username/password');
        console.log('   3. ตรวจสอบว่า backend สามารถเข้าถึงกล้องได้');
        console.log('   4. ตรวจสอบ firewall/network settings');
    }
    
    console.log('\n' + '='.repeat(60));
}

// Run discovery
discoverEndpoints()
    .then(() => {
        console.log('\n✅ การค้นหาเสร็จสมบูรณ์');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ เกิดข้อผิดพลาด:', error);
        process.exit(1);
    });

