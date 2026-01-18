/**
 * Start Image Processing Service
 * เริ่มต้น Image Processing Service ให้ดึงภาพทุกๆ 5 นาที
 */

require('dotenv').config();
const ImageProcessingService = require('../services/imageProcessingService');

async function startService() {
    const intervalMinutes = 5; // ตั้งค่าให้ดึงทุกๆ 5 นาที
    
    console.log('='.repeat(60));
    console.log('Starting Image Processing Service');
    console.log('='.repeat(60));
    console.log(`Interval: ${intervalMinutes} minutes`);
    console.log(`Camera: ${process.env.CCTV_BASE_URL || 'http://192.168.24.1'}`);
    console.log(`Save Path: backend/storage/processed_images/`);
    console.log('='.repeat(60));
    console.log('');

    const cameraConfig = {
        baseUrl: process.env.CCTV_BASE_URL || 'http://192.168.24.1',
        username: process.env.CCTV_USERNAME || 'admin',
        password: process.env.CCTV_PASSWORD || 'L@nnacom@1',
        snapshotEndpoint: '/ISAPI/Streaming/channels/101/picture'
    };

    const service = new ImageProcessingService(cameraConfig);

    try {
        // เริ่มต้น service ด้วย interval 5 นาที
        service.start(intervalMinutes);
        
        console.log(`✅ Image Processing Service started successfully!`);
        console.log(`   - Will process every ${intervalMinutes} minutes`);
        console.log(`   - Images will be saved to: backend/storage/processed_images/`);
        console.log('');
        console.log('Service is now running in the background...');
        console.log('Press Ctrl+C to stop the service');
        console.log('');

        // แสดงสถานะทุก 30 วินาที
        const statusInterval = setInterval(() => {
            const status = service.getStatus();
            const timestamp = new Date().toLocaleString('th-TH');
            console.log(`[${timestamp}] Status:`, {
                Running: status.isRunning ? 'Yes' : 'No',
                Processing: status.isProcessing ? 'Yes' : 'No',
                'Processed Count': status.processingCount,
                'Error Count': status.errorCount,
                'Interval': `${status.intervalMinutes} minutes`,
                'Last Processed': status.lastProcessedTime 
                    ? new Date(status.lastProcessedTime).toLocaleString('th-TH')
                    : 'N/A'
            });
        }, 30000); // Every 30 seconds

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n');
            console.log('Stopping Image Processing Service...');
            service.stop();
            clearInterval(statusInterval);
            const status = service.getStatus();
            console.log(`✅ Service stopped`);
            console.log(`   - Total processed: ${status.processingCount} times`);
            console.log(`   - Total errors: ${status.errorCount}`);
            console.log('');
            process.exit(0);
        });

        // Keep process running
        console.log('Waiting for first process...');
        console.log('');
        
    } catch (error) {
        console.error('');
        console.error('❌ Error starting service:');
        console.error(error.message);
        if (error.stack) {
            console.error('');
            console.error('Stack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

startService();


