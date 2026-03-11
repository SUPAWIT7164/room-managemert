/**
 * ทดสอบดึงภาพจากกล้อง CCTV ผ่าน ISAPI Snapshot (แบบเดียวกับ Backend)
 * ใช้ digest-fetch + GET /ISAPI/Streaming/channels/101/picture
 *
 * รันจากโฟลเดอร์ backend:
 *   node scripts/test-cctv-snapshot.js
 *
 * ภาพที่ดึงได้จะบันทึกเป็น test-snapshot.jpg ในโฟลเดอร์ backend
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const baseUrl = process.env.CCTV_BASE_URL || 'http://192.168.24.1';
const username = process.env.CCTV_USERNAME || 'admin';
const password = process.env.CCTV_PASSWORD || 'L@nnac0m';
const snapshotUrl = `${baseUrl}/ISAPI/Streaming/channels/101/picture`;
const TIMEOUT_MS = 10000;

async function main() {
    console.log('='.repeat(60));
    console.log('📸 ทดสอบดึงภาพ Backend (ISAPI Snapshot)');
    console.log('='.repeat(60));
    console.log(`  CCTV_BASE_URL : ${baseUrl}`);
    console.log(`  Username      : ${username}`);
    console.log(`  Password      : ${password ? '***' : 'NOT SET'}`);
    console.log(`  Snapshot URL  : ${snapshotUrl}`);
    console.log('='.repeat(60));

    let DigestClient;
    try {
        const digestFetch = require('digest-fetch');
        DigestClient = digestFetch.default || digestFetch.DigestClient || digestFetch;
        if (!DigestClient || typeof DigestClient !== 'function') {
            throw new Error('DigestClient is not a constructor');
        }
    } catch (e) {
        console.error('❌ โหลด digest-fetch ไม่ได้:', e.message);
        console.log('   รัน: npm install digest-fetch');
        process.exit(1);
    }

    const client = new DigestClient(username, password);

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ' + (TIMEOUT_MS / 1000) + ' วินาที')), TIMEOUT_MS);
    });

    const fetchPromise = client.fetch(snapshotUrl, {
        method: 'GET',
        headers: { Accept: 'image/jpeg' },
    });

    try {
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        console.log(`\n  HTTP Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error(`\n❌ กล้องตอบ ${response.status} — ไม่ได้ภาพ`);
            console.log('\n--- ขั้นต่อไป (ถ้าได้ 503 บนเซิร์ฟเวอร์ bms-dev) ---');
            console.log('  1) ตรวจ .env บนเซิร์ฟเวอร์: CCTV_BASE_URL ต้องชี้ไปที่ IP กล้อง (เช่น http://192.168.24.1) ไม่ใช่ URL ของ bms-dev');
            console.log('  2) ถ้าเซิร์ฟเวอร์ bms-dev อยู่คนละเครือข่ายกับกล้อง (192.168.24.x เป็น LAN): พิจารณา VPN หรือย้าย backend ไปรันในเครื่องที่อยู่ LAN เดียวกับกล้อง');
            console.log('  3) ตรวจว่ากล้องเปิดอยู่ และจากเซิร์ฟเวอร์ ping ได้: ping 192.168.24.1');
            process.exit(1);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length < 100) {
            console.error(`\n❌ ได้ข้อมูลเพียง ${buffer.length} bytes — ไม่น่าจะเป็นภาพ`);
            process.exit(1);
        }

        const outPath = path.join(__dirname, '..', 'test-snapshot.jpg');
        fs.writeFileSync(outPath, buffer);
        console.log(`\n✅ ดึงภาพสำเร็จ: ${buffer.length} bytes`);
        console.log(`   บันทึกที่: ${outPath}`);
        console.log('='.repeat(60));
    } catch (err) {
        console.error('\n❌ Error:', err.message);
        if (err.code) console.error('   Code:', err.code);
        console.log('\n--- ขั้นต่อไป ---');
        if (err.code === 'ETIMEDOUT' || err.message.includes('Timeout')) {
            console.log('  1) เครือข่ายจากเครื่องนี้ถึงกล้องช้าหรือไม่ถึง — ตรวจ firewall / routing');
            console.log('  2) ถ้าเซิร์ฟเวอร์อยู่คนละเครือข่ายกับกล้อง: พิจารณา VPN หรือย้าย backend ไปรันใน LAN เดียวกับกล้อง');
        } else if (err.code === 'ECONNREFUSED') {
            console.log('  1) เครื่องนี้เข้า IP กล้องไม่ได้ (Connection Refused) — กล้องปิดหรืออยู่คนละเครือข่าย');
            console.log('  2) พิจารณา VPN หรือย้าย backend ไปรันใน LAN เดียวกับกล้อง');
            console.log('  3) ตรวจ .env: CCTV_BASE_URL ต้องเป็น IP จริงของกล้อง');
        } else if (err.code === 'ENOTFOUND') {
            console.log('  1) ตรวจ .env: CCTV_BASE_URL ต้องเป็น URL ที่ resolve ได้จากเครื่องนี้');
        } else {
            console.log('  1) ตรวจเครือข่ายจากเครื่องนี้เข้า', baseUrl, 'ได้หรือไม่');
            console.log('  2) เปิด https://bms-dev.lanna.co.th/api/cctv/diagnose (หลัง login) เพื่อดูผลจากเซิร์ฟเวอร์');
        }
        process.exit(1);
    }
}

main();
