/**
 * ทดสอบ API นับคน: POST /api/cctv/count-people
 * แสดงว่า API คืนอะไร (status + body) ในแต่ละกรณี
 *
 * รันจากโฟลเดอร์ backend (ให้ backend รันอยู่ที่ port 5000):
 *   node scripts/test-count-people-api.js
 *
 * ตัวอย่าง ROI: polygon normalized 0-1 (สี่เหลี่ยมครึ่งภาพ)
 */
const http = require('http');

const BASE = 'http://localhost:5000';
const PATH = '/api/cctv/count-people';

// ROI ตัวอย่าง: สี่เหลี่ยม normalized 0-1
const sampleBody = {
  cameraId: '0',
  areaId: 'area-test',
  roi: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 }
  ]
};

function request(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (_) {
          json = { _raw: raw };
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout 15s'));
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('POST /api/cctv/count-people — ทดสอบว่า API คืนอันไหน');
  console.log('='.repeat(60));
  console.log('Request body:', JSON.stringify(sampleBody, null, 2));
  console.log('');

  try {
    const { status, body } = await request(BASE + PATH, sampleBody);
    console.log('HTTP Status:', status);
    console.log('Response body:', JSON.stringify(body, null, 2));
    console.log('');
    if (status === 200) {
      console.log('→ สำเร็จ: count =', body.count, ', people =', body.people?.length ?? 0, 'รายการ, timestamp =', body.timestamp);
    } else if (status === 429) {
      console.log('→ 429: ระบบกำลังประมวลผลรอบก่อน — message =', body.message);
    } else if (status === 503) {
      console.log('→ 503: Error จากกล้อง — message =', body.message, ', hint =', body.hint);
    } else if (status >= 500) {
      console.log('→ 500: Error ประมวลผล/อื่น — message =', body.message, ', error =', body.error);
    }
  } catch (err) {
    console.error('Request error:', err.message);
    console.log('  ตรวจสอบว่า backend รันอยู่ที่ port 5000 (npm start หรือ node server.js)');
  }
  console.log('='.repeat(60));
}

main();
