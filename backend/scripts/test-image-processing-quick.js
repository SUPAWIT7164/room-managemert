/**
 * Quick Test Image Processing Service
 * ทดสอบ Image Processing Service แบบรวดเร็ว (รันครั้งเดียวแล้วจบ)
 */

require('dotenv').config();
const ImageProcessingService = require('../services/imageProcessingService');

async function quickTest() {
    console.log('='.repeat(60));
    console.log('Image Processing Service - Quick Test');
    console.log('='.repeat(60));
    
    const cameraConfig = {
        baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
        username: process.env.CCTV_USERNAME || 'admin',
        password: process.env.CCTV_PASSWORD || 'L@nnac0m',
        snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture'
    };

    console.log(`Camera URL: ${cameraConfig.baseUrl}`);
    console.log(`Snapshot Endpoint: ${cameraConfig.snapshotEndpoint}`);
    console.log('='.repeat(60));
    console.log('');

    const service = new ImageProcessingService(cameraConfig);

    try {
        // Test 1: ดึงภาพนิ่ง
        console.log('📸 Test 1: Fetching snapshot...');
        const snapshot = await service.fetchSnapshot();
        console.log(`✅ Snapshot fetched: ${snapshot.length} bytes`);
        console.log('');

        // Test 2: Process ภาพ
        console.log('🔍 Test 2: Processing image...');
        const results = await service.processImage(snapshot);
        console.log('✅ Image processed successfully!');
        console.log('Results:');
        console.log(JSON.stringify(results, null, 2));
        console.log('');

        // Test 3: ตรวจสอบสถานะ Service
        console.log('📊 Test 3: Service Status');
        const status = service.getStatus();
        console.log(`  - isRunning: ${status.isRunning}`);
        console.log(`  - intervalMinutes: ${status.intervalMinutes}`);
        console.log(`  - processingCount: ${status.processingCount}`);
        console.log(`  - errorCount: ${status.errorCount}`);
        console.log('');

        // Test 4: เริ่ม Service (รัน 1 รอบ)
        console.log('🚀 Test 4: Starting service (will process once)...');
        service.start(1); // 1 minute interval
        
        // รอให้ process ครั้งแรกเสร็จ (ประมาณ 5 วินาที)
        console.log('   Waiting for first process to complete...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        const statusAfter = service.getStatus();
        console.log(`   Processed ${statusAfter.processingCount} time(s)`);
        console.log(`   Errors: ${statusAfter.errorCount}`);
        if (statusAfter.lastProcessedTime) {
            console.log(`   Last processed: ${statusAfter.lastProcessedTime}`);
        }
        console.log('');

        // หยุด Service
        console.log('🛑 Stopping service...');
        service.stop();
        console.log('✅ Service stopped');
        console.log('');

        console.log('='.repeat(60));
        console.log('✅ All tests completed successfully!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('');
        console.error('❌ Error occurred:');
        console.error(error.message);
        if (error.stack) {
            console.error('');
            console.error('Stack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

quickTest();


