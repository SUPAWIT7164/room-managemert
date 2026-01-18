/**
 * Test Face Scanner through Backend API
 * ทดสอบการเชื่อมต่อผ่าน Backend API endpoints
 */

const axios = require('axios');

async function testBackendAPI() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const baseUrl = 'http://192.168.22.53';
    const username = 'admin';
    const password = 'lannacom@1';

    console.log('='.repeat(60));
    console.log('Face Scanner Backend API Test');
    console.log('='.repeat(60));
    console.log(`Backend URL: ${backendUrl}`);
    console.log(`Face Scanner: ${baseUrl}`);
    console.log('='.repeat(60));
    console.log('');

    // Note: This requires backend server to be running
    // and proper authentication token

    console.log('⚠️  Note: This test requires:');
    console.log('   1. Backend server running on', backendUrl);
    console.log('   2. Valid authentication token');
    console.log('   3. User logged in');
    console.log('');
    console.log('Please test through frontend or use Postman/curl with auth token');
    console.log('');
    console.log('API Endpoints available:');
    console.log('  POST /api/face/scanner/test');
    console.log('     Body: { "baseUrl": "http://192.168.22.53", "username": "admin", "password": "lannacom@1" }');
    console.log('');
    console.log('  POST /api/face/scanner/info');
    console.log('     Body: { "baseUrl": "http://192.168.22.53", "username": "admin", "password": "lannacom@1" }');
    console.log('');
    console.log('  POST /api/face/scanner/image');
    console.log('     Body: { "baseUrl": "http://192.168.22.53", "username": "admin", "password": "lannacom@1", "targetUsername": "test" }');
    console.log('');
    console.log('  POST /api/face/scanner/register');
    console.log('     Body: { "baseUrl": "http://192.168.22.53", "username": "admin", "password": "lannacom@1", "image": "data:image/jpeg;base64,..." }');
    console.log('');

    // Try to test if backend is accessible
    try {
        const healthCheck = await axios.get(`${backendUrl}/health`, {
            timeout: 3000
        });
        console.log('✅ Backend server is accessible');
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Backend server is not running');
            console.log('   Please start backend server first:');
            console.log('   cd backend && npm start');
        } else {
            console.log('⚠️  Could not check backend health:', error.message);
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
}

testBackendAPI().catch(error => {
    console.error('Error:', error.message);
});


