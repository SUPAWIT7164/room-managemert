/**
 * Test script for Air Control API
 * Usage: node test-air-api.js
 */

const http = require('http');

// Configuration
const API_BASE = 'http://localhost:5000';
const DEVICE_ID = 'CC3F1D03BAE3';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // ต้องใส่ token จาก login

// Test functions
function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            method,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function testAirControl() {
    console.log('=== Testing Air Control API ===\n');

    // Test 1: เปิดแอร์
    console.log('1. Testing: เปิดแอร์ (action: on)');
    try {
        const result = await makeRequest('POST', `/api/device/air/${DEVICE_ID}/control`, {
            action: 'on',
            temperature: 25,
            hvac_mode: 'cool'
        });
        console.log('   Status:', result.status);
        console.log('   Response:', JSON.stringify(result.data, null, 2));
        console.log('');
    } catch (error) {
        console.error('   Error:', error.message);
        console.log('');
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: ตั้งอุณหภูมิ
    console.log('2. Testing: ตั้งอุณหภูมิ (temperature: 26)');
    try {
        const result = await makeRequest('POST', `/api/device/air/${DEVICE_ID}/temperature`, {
            temperature: 26
        });
        console.log('   Status:', result.status);
        console.log('   Response:', JSON.stringify(result.data, null, 2));
        console.log('');
    } catch (error) {
        console.error('   Error:', error.message);
        console.log('');
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: ดึงสถานะ
    console.log('3. Testing: ดึงสถานะแอร์');
    try {
        const result = await makeRequest('GET', `/api/device/air/${DEVICE_ID}/status`);
        console.log('   Status:', result.status);
        console.log('   Response:', JSON.stringify(result.data, null, 2));
        console.log('');
    } catch (error) {
        console.error('   Error:', error.message);
        console.log('');
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: ปิดแอร์
    console.log('4. Testing: ปิดแอร์ (action: off)');
    try {
        const result = await makeRequest('POST', `/api/device/air/${DEVICE_ID}/control`, {
            action: 'off'
        });
        console.log('   Status:', result.status);
        console.log('   Response:', JSON.stringify(result.data, null, 2));
        console.log('');
    } catch (error) {
        console.error('   Error:', error.message);
        console.log('');
    }
}

// Run tests
if (AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    console.log('⚠️  กรุณาใส่ AUTH_TOKEN ในไฟล์ test-air-api.js');
    console.log('   หรือส่ง token ผ่าน environment variable:');
    console.log('   AUTH_TOKEN=your_token node test-air-api.js\n');
    process.exit(1);
}

testAirControl().catch(console.error);










