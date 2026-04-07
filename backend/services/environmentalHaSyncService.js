const { pool } = require('../config/database');
const homeAssistantService = require('./homeAssistantService');
const { getAm319EntityIds, haStatesToEnvironmentalFields } = require('../config/am319HaEntities');

/** ไม่เรียก HA ถ้ามีแถวใหม่กว่านี้ (ms) — ลดโหลดเมื่อเปิดหลายแท็บ */
const DEFAULT_MIN_INTERVAL_MS = 8000;

function getMinSyncIntervalMs() {
    const n = parseInt(process.env.HA_ENV_SYNC_MIN_INTERVAL_MS || String(DEFAULT_MIN_INTERVAL_MS), 10);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_INTERVAL_MS;
}

const AQI_DEVICE_QUERY = `
SELECT d.id FROM devices d
LEFT JOIN device_types dt ON d.device_type_id = dt.id
WHERE d.room_id = ?
AND (d.disable = 0 OR d.disable IS NULL)
AND (
  LOWER(LTRIM(RTRIM(ISNULL(d.device_type, N'')))) IN (N'aqi', N'am319')
  OR LOWER(LTRIM(RTRIM(ISNULL(d.code, N'')))) IN (N'aqi', N'am319')
  OR LOWER(LTRIM(RTRIM(ISNULL(d.code, N'')))) LIKE N'am319%'
  OR LOWER(LTRIM(RTRIM(ISNULL(d.code, N'')))) LIKE N'aqi%'
  OR LOWER(LTRIM(RTRIM(ISNULL(dt.name, N'')))) IN (N'aqi', N'am319')
  OR LOWER(LTRIM(RTRIM(ISNULL(dt.name, N'')))) LIKE N'am319%'
  OR LOWER(LTRIM(RTRIM(ISNULL(dt.name, N'')))) LIKE N'aqi%'
)
ORDER BY d.id`;

/**
 * ดึงค่า AM319 จาก Home Assistant แล้ว INSERT environmental_data (สำหรับห้องที่มีอุปกรณ์ aqi/am319)
 * @param {number} roomId
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function syncEnvironmentalFromHaForRoom(roomId) {
    if (!homeAssistantService.isEnabled()) {
        return { ok: false, reason: 'ha_disabled' };
    }

    const rid = parseInt(String(roomId), 10);
    if (Number.isNaN(rid)) {
        return { ok: false, reason: 'bad_room_id' };
    }

    let deviceRows;
    try {
        [deviceRows] = await pool.query(AQI_DEVICE_QUERY, [rid]);
    } catch (e) {
        console.warn('[EnvironmentalHaSync] device lookup failed:', e.message);
        return { ok: false, reason: 'db_error' };
    }

    if (!deviceRows || deviceRows.length === 0) {
        return { ok: false, reason: 'no_aqi_device' };
    }

    const deviceId = Number(deviceRows[0].id);
    const minMs = getMinSyncIntervalMs();

    if (minMs > 0) {
        try {
            const [lastRows] = await pool.query(
                `SELECT TOP 1 timestamp FROM environmental_data
                 WHERE device_id = ? AND room_id = ?
                 ORDER BY timestamp DESC`,
                [deviceId, rid]
            );
            if (lastRows && lastRows[0] && lastRows[0].timestamp != null) {
                const t = new Date(lastRows[0].timestamp).getTime();
                if (Number.isFinite(t) && Date.now() - t < minMs) {
                    return { ok: true, reason: 'throttled' };
                }
            }
        } catch (e) {
            console.warn('[EnvironmentalHaSync] throttle check failed:', e.message);
        }
    }

    const entityIds = getAm319EntityIds();
    if (!entityIds.length) {
        return { ok: false, reason: 'no_entities' };
    }

    let result;
    try {
        result = await homeAssistantService.getMultipleStates(entityIds);
    } catch (e) {
        console.warn('[EnvironmentalHaSync] getMultipleStates failed:', e.message);
        return { ok: false, reason: 'ha_fetch_failed' };
    }

    const fields = haStatesToEnvironmentalFields(result.data);
    const ts = new Date();

    try {
        await pool.query(
            `INSERT INTO environmental_data (room_id, device_id, timestamp, temperature, humidity, co2, tvoc, pressure, pm25, pm10, hcho, noise)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                rid,
                deviceId,
                ts,
                fields.temperature,
                fields.humidity,
                fields.co2,
                fields.tvoc,
                fields.pressure,
                fields.pm25,
                fields.pm10,
                fields.hcho,
                fields.noise,
            ]
        );
        console.log(`[EnvironmentalHaSync] room ${rid} device ${deviceId}: inserted environmental row from HA`);
        return { ok: true, reason: 'inserted' };
    } catch (e) {
        console.error('[EnvironmentalHaSync] INSERT failed:', e.message);
        return { ok: false, reason: 'insert_failed' };
    }
}

module.exports = {
    syncEnvironmentalFromHaForRoom,
    getMinSyncIntervalMs,
};
