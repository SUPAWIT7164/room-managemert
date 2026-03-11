/**
 * CCTV Snapshot Service
 * ดึงภาพนิ่ง (1 frame) จากกล้อง Hikvision ต่อการนับ 1 รอบ
 * - ใช้ timeout ไม่เกิน 5 วินาที
 * - ไม่ hardcode auth — รับ cameraConfig และ authClient จาก caller (ที่อ่านจาก env)
 */

const SNAPSHOT_TIMEOUT_MS = 5000;

/**
 * ดึง snapshot 1 ภาพจากกล้อง
 * @param {Object} cameraConfig - { baseUrl, snapshotEndpoint } จาก env
 * @param {Object} authClient - instance ที่มี .fetch(url, options) (Digest client)
 * @param {number} [timeoutMs=5000] - timeout มิลลิวินาที
 * @returns {Promise<Buffer>} ภาพ JPEG
 * @throws {Error} เมื่อกล้องไม่ตอบ / timeout / ภาพไม่ถูกต้อง → caller ส่ง 503
 */
async function fetchSnapshot(cameraConfig, authClient, timeoutMs = SNAPSHOT_TIMEOUT_MS) {
    const endpoint = cameraConfig.snapshotEndpoint || '/ISAPI/Streaming/channels/101/picture';
    const url = `${cameraConfig.baseUrl}${endpoint}`;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Camera request timeout')), timeoutMs);
    });

    const fetchPromise = authClient.fetch(url, {
        method: 'GET',
        headers: { Accept: 'image/jpeg' },
    }).then(async (response) => {
        if (!response.ok) {
            const err = new Error(`Camera returned ${response.status}: ${response.statusText}`);
            err.statusCode = response.status;
            throw err;
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    });

    const buffer = await Promise.race([fetchPromise, timeoutPromise]);

    if (!buffer || buffer.length < 100) {
        throw new Error(`Invalid image size: ${buffer ? buffer.length : 0} bytes`);
    }
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        throw new Error('Response is not a valid JPEG');
    }

    return buffer;
}

module.exports = { fetchSnapshot, SNAPSHOT_TIMEOUT_MS };
