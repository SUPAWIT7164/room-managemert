/**
 * Test Face Scanner Connection
 * ทดสอบการเชื่อมต่อกับเครื่องสแกนหน้า
 * 
 * Usage: node scripts/test-face-scanner.js [baseUrl] [username] [password]
 */

require('dotenv').config();
const FaceScannerService = require('../services/faceScannerService');

async function testFaceScanner() {
    // Get parameters from command line or use defaults
    const baseUrl = process.argv[2] || process.env.FACE_SCANNER_URL || 'http://192.168.22.53';
    const username = process.argv[3] || process.env.FACE_SCANNER_USERNAME || 'admin';
    const password = process.argv[4] || process.env.FACE_SCANNER_PASSWORD || 'lannacom@1';

    console.log('='.repeat(60));
    console.log('Face Scanner Connection Test');
    console.log('='.repeat(60));
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${'*'.repeat(password.length)}`);
    console.log('='.repeat(60));
    console.log('');

    const scannerService = new FaceScannerService({
        baseUrl,
        username,
        password
    });

    // Test 1: Test Connection
    console.log('Test 1: Testing Connection...');
    try {
        const connectionResult = await scannerService.testConnection();
        if (connectionResult.success) {
            console.log('✅ Connection successful!');
            console.log(`   Endpoint: ${connectionResult.endpoint || 'N/A'}`);
            if (connectionResult.data) {
                console.log('   Response:', JSON.stringify(connectionResult.data, null, 2));
            }
        } else {
            console.log('❌ Connection failed!');
            console.log(`   Error: ${connectionResult.message}`);
            if (connectionResult.details) {
                console.log('   Details:', JSON.stringify(connectionResult.details, null, 2));
            }
        }
    } catch (error) {
        console.log('❌ Connection test error:', error.message);
    }
    console.log('');

    // Test 2: Get Device Info
    console.log('Test 2: Getting Device Info...');
    try {
        const deviceInfo = await scannerService.getDeviceInfo();
        if (deviceInfo.success) {
            console.log('✅ Device info retrieved!');
            console.log('   Data:', JSON.stringify(deviceInfo.data, null, 2));
        }
    } catch (error) {
        console.log('⚠️  Could not get device info:', error.message);
        console.log('   (This is normal if the device doesn\'t support this endpoint)');
    }
    console.log('');

    // Test 3: Get Face Image (requires username)
    console.log('Test 3: Getting Face Image...');
    console.log('   Note: This requires a username - trying with test user');
    try {
        const testUsername = 'test'; // You can modify this
        const faceImage = await scannerService.getFaceImage(testUsername);
        if (faceImage.success) {
            console.log(`✅ Face image retrieved for user "${testUsername}"!`);
            console.log(`   Image size: ${faceImage.data.image.length} bytes (base64)`);
            console.log(`   MIME type: ${faceImage.data.mimeType}`);
        } else {
            console.log(`⚠️  ${faceImage.message}`);
            console.log(`   (User "${testUsername}" may not have registered face yet)`);
        }
    } catch (error) {
        console.log('⚠️  Could not get face image:', error.message);
        console.log('   (This requires a username with registered face)');
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
}

// Run the test
testFaceScanner().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

