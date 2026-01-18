/**
 * Discover Face Scanner API Endpoints
 * ค้นหา API endpoints ที่เครื่องสแกนหน้ารองรับ
 */

require('dotenv').config();
const axios = require('axios');

async function discoverEndpoints() {
    const baseUrl = process.argv[2] || 'http://192.168.22.53';
    const username = process.argv[3] || 'admin';
    const password = process.argv[4] || 'lannacom@1';

    console.log('='.repeat(60));
    console.log('Face Scanner Endpoint Discovery');
    console.log('='.repeat(60));
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Username: ${username}`);
    console.log('='.repeat(60));
    console.log('');

    const client = axios.create({
        baseURL: baseUrl,
        timeout: 5000,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        auth: {
            username,
            password
        },
        validateStatus: (status) => status < 500 // Accept any status < 500
    });

    // List of possible endpoints to try
    const endpoints = [
        // Room-management-portal format
        { method: 'POST', path: '/user/GetFace', body: { Username: 'test' } },
        { method: 'POST', path: '/user/AddFace', body: { Username: 'test', Image: 'test' } },
        
        // Alternative formats
        { method: 'GET', path: '/api/user/GetFace?username=test' },
        { method: 'POST', path: '/api/user/GetFace', body: { username: 'test' } },
        { method: 'POST', path: '/api/user/GetFace', body: { user: 'test' } },
        { method: 'POST', path: '/api/face/get', body: { username: 'test' } },
        { method: 'POST', path: '/api/face/get', body: { user: 'test' } },
        { method: 'GET', path: '/api/face/test' },
        { method: 'POST', path: '/face/get', body: { username: 'test' } },
        { method: 'POST', path: '/face/get', body: { user: 'test' } },
        
        // Device info endpoints
        { method: 'GET', path: '/api/info' },
        { method: 'GET', path: '/info' },
        { method: 'GET', path: '/status' },
        { method: 'GET', path: '/api/status' },
        { method: 'GET', path: '/device/info' },
        { method: 'GET', path: '/api/device/info' },
        
        // Root endpoints
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/api' },
    ];

    console.log('Testing endpoints...\n');

    for (const endpoint of endpoints) {
        try {
            let response;
            if (endpoint.method === 'GET') {
                response = await client.get(endpoint.path);
            } else if (endpoint.method === 'POST') {
                response = await client.post(endpoint.path, endpoint.body || {});
            }

            const status = response.status;
            const isSuccess = status >= 200 && status < 300;
            const isNotFound = status === 404;
            const isError = status >= 400;

            if (isSuccess && !isNotFound) {
                console.log(`✅ ${endpoint.method} ${endpoint.path}`);
                console.log(`   Status: ${status}`);
                if (response.data && typeof response.data === 'object') {
                    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
                } else {
                    console.log(`   Response: ${String(response.data).substring(0, 200)}...`);
                }
                console.log('');
            } else if (isNotFound) {
                console.log(`❌ ${endpoint.method} ${endpoint.path} - Not Found (404)`);
            } else if (isError) {
                console.log(`⚠️  ${endpoint.method} ${endpoint.path} - Error ${status}`);
                if (response.data) {
                    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
                }
            }
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                if (status === 404) {
                    // Silently skip 404s
                } else {
                    console.log(`⚠️  ${endpoint.method} ${endpoint.path} - Error ${status}`);
                }
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                console.log(`❌ ${endpoint.method} ${endpoint.path} - Connection failed`);
                break; // Stop if can't connect
            }
        }
    }

    console.log('='.repeat(60));
    console.log('Discovery Complete');
    console.log('='.repeat(60));
}

discoverEndpoints().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
});


