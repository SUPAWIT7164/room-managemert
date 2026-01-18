/**
 * Test Image Processing Service
 * ทดสอบ Image Processing Service ที่ดึงภาพนิ่งและ process วนลูป
 * 
 * Usage: node scripts/test-image-processing.js [intervalMinutes]
 */

require('dotenv').config();
const ImageProcessingService = require('../services/imageProcessingService');

async function testImageProcessing() {
    const intervalMinutes = parseInt(process.argv[2]) || 1; // Default 1 นาทีสำหรับทดสอบ
    
    console.log('='.repeat(60));
    console.log('Image Processing Service Test');
    console.log('='.repeat(60));
    console.log(`Interval: ${intervalMinutes} minutes`);
    console.log(`Camera: ${process.env.CCTV_BASE_URL || 'http://192.168.24.1'}`);
    console.log('='.repeat(60));
    console.log('');

    const cameraConfig = {
        baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
        username: process.env.CCTV_USERNAME || 'admin',
        password: process.env.CCTV_PASSWORD || 'L@nnac0m',
        snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture'
    };

    const service = new ImageProcessingService(cameraConfig);

    // Test 1: ดึงภาพนิ่งครั้งเดียว
    console.log('Test 1: Fetching single snapshot...');
    try {
        const snapshot = await service.fetchSnapshot();
        console.log(`✅ Snapshot fetched: ${snapshot.length} bytes`);
    } catch (error) {
        console.error(`❌ Error fetching snapshot: ${error.message}`);
        process.exit(1);
    }

    console.log('');

    // Test 2: Process ภาพครั้งเดียว
    console.log('Test 2: Processing image...');
    try {
        const snapshot = await service.fetchSnapshot();
        const results = await service.processImage(snapshot);
        console.log(`✅ Image processed:`, JSON.stringify(results, null, 2));
    } catch (error) {
        console.error(`❌ Error processing image: ${error.message}`);
    }

    console.log('');

    // Test 3: เริ่ม Image Processing Loop
    console.log(`Test 3: Starting image processing loop (every ${intervalMinutes} minute(s))...`);
    console.log('Press Ctrl+C to stop');
    console.log('');

    service.start(intervalMinutes);

    // แสดงสถานะทุก 10 วินาที
    const statusInterval = setInterval(() => {
        const status = service.getStatus();
        console.log(`[Status] Running: ${status.isRunning}, Processing: ${status.isProcessing}, Count: ${status.processingCount}, Errors: ${status.errorCount}`);
        if (status.lastProcessedTime) {
            console.log(`  Last processed: ${status.lastProcessedTime}`);
        }
    }, 10000); // Every 10 seconds

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n');
        console.log('Stopping image processing service...');
        service.stop();
        clearInterval(statusInterval);
        console.log('✅ Stopped');
        process.exit(0);
    });

    // Keep process running
    console.log('Image Processing Service is running...');
    console.log(`Will process every ${intervalMinutes} minute(s)`);
    console.log('');
}

testImageProcessing().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});


