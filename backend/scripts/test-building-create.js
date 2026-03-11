/**
 * ทดสอบสร้างอาคารโดยตรง (ไม่ผ่าน HTTP) เพื่อดู error จริงจาก DB
 * Usage: node scripts/test-building-create.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Building = require('../models/Building');

async function run() {
    console.log('Testing Building.create({ name: "Test Building", code: "TEST-1" })...\n');
    try {
        const building = await Building.create({
            name: 'Test Building ' + Date.now(),
            code: 'TEST-' + Date.now()
        });
        console.log('Success:', building);
        if (building && building.id) {
            console.log('\nCreated building id:', building.id);
        }
    } catch (err) {
        console.error('Error:', err.message);
        console.error('Code:', err.code);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
    process.exit(0);
}

run();
