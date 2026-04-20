/**
 * Refresh intervals สำหรับหน้า control — ค่าทั้งหมดอ่านจาก .env
 *
 * Env vars (มิลลิวินาที):
 *   REFRESH_SENSOR_INTERVAL_MS        — AQI / environmental sensor overlay          (default 10000)
 *   REFRESH_DEVICE_STATE_INTERVAL_MS  — icon สถานะอุปกรณ์ light/ac/erv/vent_fan      (default 10000)
 *   REFRESH_PEOPLE_COUNT_INTERVAL_MS  — peoplecount overlay                          (default 10000)
 *   REFRESH_FLOOR_PLAN_INTERVAL_MS    — สถานะอุปกรณ์บน floor plan (area view)         (default 10000)
 */

function safeInt(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1000 ? n : fallback;
}

function getRefreshIntervals() {
    return {
        sensorIntervalMs:      safeInt(process.env.REFRESH_SENSOR_INTERVAL_MS, 10000),
        deviceStateIntervalMs: safeInt(process.env.REFRESH_DEVICE_STATE_INTERVAL_MS, 10000),
        peopleCountIntervalMs: safeInt(process.env.REFRESH_PEOPLE_COUNT_INTERVAL_MS, 10000),
        floorPlanIntervalMs:   safeInt(process.env.REFRESH_FLOOR_PLAN_INTERVAL_MS, 10000),
    };
}

module.exports = { getRefreshIntervals };
