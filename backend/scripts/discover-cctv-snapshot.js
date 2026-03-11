/**
 * ค้นหา endpoint snapshot ที่กล้องตอบ 200 + ภาพ (ใช้ Digest Auth เหมือน backend)
 * รันจากโฟลเดอร์ backend: node scripts/discover-cctv-snapshot.js
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const baseUrl = process.env.CCTV_BASE_URL || 'http://192.168.24.1';
const username = process.env.CCTV_USERNAME || 'admin';
const password = process.env.CCTV_PASSWORD || 'L@nnac0m';
const TIMEOUT_MS = 8000;

// รายการ endpoint snapshot ที่มักใช้กับ Hikvision (ลองตามลำดับ)
const SNAPSHOT_ENDPOINTS = [
    '/ISAPI/Streaming/channels/101/picture',
    '/ISAPI/Streaming/channels/1/picture',
    '/ISAPI/Streaming/channels/001/picture',
    '/ISAPI/Streaming/channels/201/picture',
    '/ISAPI/Streaming/channels/102/picture',
    '/ISAPI/Streaming/channels/2/picture',
    '/ISAPI/Streaming/channels/1/0/picture',
    '/ISAPI/Streaming/channels/101/0/picture',
    '/ISAPI/Streaming/channels/301/picture',
    '/snapshot.jpg',
    '/snapshot.cgi',
    '/cgi-bin/snapshot.cgi',
    '/doc/page/snapshot.cgi',
];

async function main() {
    console.log('='.repeat(60));
    console.log('🔍 ค้นหา Snapshot Endpoint (Digest Auth)');
    console.log('='.repeat(60));
    console.log(`  CCTV_BASE_URL : ${baseUrl}`);
    console.log(`  Username      : ${username}`);
    console.log(`  Password      : ${password ? '***' : 'NOT SET'}`);
    console.log('='.repeat(60));

    let DigestAuth;
    try {
        const m = require('digest-fetch');
        DigestAuth = typeof m === 'function' ? m : (m && (m.default || m.DigestClient || m));
        if (!DigestAuth || typeof DigestAuth !== 'function') {
            throw new Error('DigestAuth not found');
        }
    } catch (e) {
        console.error('❌ โหลด digest-fetch ไม่ได้:', e.message);
        console.log('   รัน: npm install digest-fetch');
        process.exit(1);
    }

    const client = new DigestAuth(username, password);
    const working = [];

    for (const endpoint of SNAPSHOT_ENDPOINTS) {
        const url = baseUrl + endpoint;
        process.stdout.write(`  Testing ${endpoint} ... `);
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS);
            });
            const fetchPromise = client.fetch(url, {
                method: 'GET',
                headers: { Accept: 'image/jpeg, image/*' }
            });
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            const status = response.status;
            if (!response.ok) {
                console.log(`${status}`);
                continue;
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const isJpeg = buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8;
            const contentType = response.headers.get('content-type') || '';
            if (buffer.length < 100) {
                console.log(`200 but small (${buffer.length} B)`);
                continue;
            }
            working.push({
                endpoint,
                url,
                status: 200,
                size: buffer.length,
                isImage: isJpeg || contentType.startsWith('image/')
            });
            console.log(`✅ 200 OK, ${buffer.length} bytes${isJpeg ? ' (JPEG)' : ''}`);
        } catch (err) {
            const code = err.code || (err.message === 'Timeout' ? 'ETIMEDOUT' : '');
            console.log(err.message === 'Timeout' ? 'Timeout' : (code || err.message));
        }
    }

    console.log('');
    console.log('='.repeat(60));
    if (working.length > 0) {
        console.log('✅ Snapshot Endpoints ที่ใช้งานได้ (Digest Auth):');
        working.forEach((w, i) => {
            console.log(`   ${i + 1}. ${w.endpoint}`);
            console.log(`      URL: ${w.url}`);
            console.log(`      Size: ${w.size} bytes${w.isImage ? ', Image: yes' : ''}`);
        });
        const best = working.filter(w => w.isImage && w.size > 1000).sort((a, b) => b.size - a.size)[0] || working[0];
        console.log('');
        console.log('⭐ แนะนำใช้ endpoint:');
        console.log(`   ${best.endpoint}`);
        console.log(`   (ใส่ใน .env หรือ backend เป็น path: ${best.endpoint})`);
        console.log('');
        console.log('   ตัวอย่างใน backend:');
        console.log(`   snapshotUrl = baseUrl + '${best.endpoint}'`);
    } else {
        console.log('❌ ไม่พบ endpoint snapshot ที่ตอบ 200 + ภาพ');
        console.log('');
        console.log('   ขั้นต่อไป:');
        console.log('   1) ตรวจ username/password ตรงกับกล้อง (admin / L@nnac0m)');
        console.log('   2) เปิด http://192.168.24.1/doc/index.html#/preview ในเบราว์เซอร์ ดูว่าเห็นภาพหรือไม่');
        console.log('   3) ถ้ากล้องรุ่นอื่น อาจมี path อื่น — ดูคู่มือ ISAPI ของกล้อง');
    }
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
