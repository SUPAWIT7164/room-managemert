/**
 * Home Assistant entities สำหรับ AM319 — ใช้ร่วมกันระหว่าง API sensor และ sync เข้า environmental_data
 * Override: ตั้ง env HA_AM319_ENTITY_IDS เป็น comma-separated entity id
 */

const DEFAULT_ENTITY_IDS = [
    'sensor.am319_am319_co2',
    'sensor.am319_am319_hcho',
    'sensor.am319_am319_humidity',
    'binary_sensor.am319_am319_motion',
    'sensor.am319_am319_pm2_5',
    'sensor.am319_am319_pm10',
    'sensor.am319_am319_pressure',
    'sensor.am319_am319_temperature',
    'sensor.am319_am319_tvoc',
];

function getAm319EntityIds() {
    const raw = process.env.HA_AM319_ENTITY_IDS;
    if (raw && String(raw).trim()) {
        return String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [...DEFAULT_ENTITY_IDS];
}

function _readState(haData, entityId) {
    const entry = haData && haData[entityId];
    if (!entry?.success || entry.state == null) return null;
    const v = entry.state.state;
    if (v === undefined || v === null || v === '') return null;
    return v;
}

function _num(v, roundInt = false) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return roundInt ? Math.round(n) : n;
}

/** อนุมานชนิดค่าจาก entity_id (รองรับ HA_AM319_ENTITY_IDS แบบกำหนดเอง) */
function inferMetricKey(entityId) {
    const s = String(entityId || '').toLowerCase();
    if (s.includes('motion')) return 'motion';
    if (s.includes('tvoc')) return 'tvoc';
    if (s.includes('humidity')) return 'humidity';
    if (s.includes('hcho') || s.includes('formaldehyde')) return 'hcho';
    if (s.includes('pm10')) return 'pm10';
    if (s.includes('pm2') || s.includes('pm_2')) return 'pm2_5';
    if (s.includes('pressure')) return 'pressure';
    if (s.includes('temperature') || s.includes('_temp')) return 'temperature';
    if (s.includes('co2')) return 'co2';
    return null;
}

/**
 * แปลงผล getMultipleStates().data เป็นรูปแบบ formatted ของ GET /devices/sensor/am319
 */
function formatAm319HaDataForApi(haData) {
    const out = {
        co2: null,
        hcho: null,
        humidity: null,
        motion: null,
        pm2_5: null,
        pm10: null,
        pressure: null,
        temperature: null,
        tvoc: null,
    };
    const ids = getAm319EntityIds();
    for (const id of ids) {
        const key = inferMetricKey(id);
        if (!key) continue;
        const raw = _readState(haData, id);
        if (key === 'motion') {
            out.motion = raw;
            continue;
        }
        if (key === 'co2' || key === 'pm2_5' || key === 'pm10') {
            out[key] = _num(raw, true);
        } else {
            out[key] = _num(raw);
        }
    }
    return out;
}

/**
 * แปลงผล HA เป็นคอลัมน์ environmental_data (ชื่อฟิลด์ตรงกับตาราง)
 */
function haStatesToEnvironmentalFields(haData) {
    const api = formatAm319HaDataForApi(haData);
    return {
        temperature: api.temperature,
        humidity: api.humidity,
        co2: api.co2,
        tvoc: api.tvoc,
        pressure: api.pressure,
        pm25: api.pm2_5,
        pm10: api.pm10,
        hcho: api.hcho,
        noise: null,
    };
}

module.exports = {
    getAm319EntityIds,
    formatAm319HaDataForApi,
    haStatesToEnvironmentalFields,
    DEFAULT_ENTITY_IDS,
};
