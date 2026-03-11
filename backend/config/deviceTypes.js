/**
 * รายการประเภทอุปกรณ์ที่สั่งงานได้ (สำหรับ API และหน้าเว็บ)
 *
 * เมื่อเพิ่มอุปกรณ์ใหม่:
 * 1. เพิ่ม object ใน CONTROLLABLE_DEVICE_TYPES ด้านล่าง (กำหนด key, label, icon, apiPath, order)
 * 2. เพิ่ม API สั่งงานใน routes/deviceRoutes.js และ controllers/deviceController.js
 * 3. หน้าเว็บจะดึงจาก GET /api/devices/types แล้วแสดง icon ตามที่กำหนดในแผงควบคุมอัตโนมัติ
 * 4. ใน frontend ต้องเพิ่มการจัดการใน toggleControl() และ logic ที่เกี่ยวข้อง (เช่น API path)
 *
 * Icon ใช้ชื่อจาก Tabler Icons (เช่น tabler-bulb, tabler-snowflake, tabler-wind)
 */
const CONTROLLABLE_DEVICE_TYPES = [
  {
    key: 'light',
    apiPath: 'light',           // prefix ใน URL: /api/devices/light/...
    label: 'ไฟ',
    labelEn: 'Light',
    icon: 'tabler-bulb',
    description: 'ควบคุมการเปิด-ปิดไฟ',
    actions: ['on', 'off'],
    hasStatus: true,
    syncPath: 'light',
    order: 1,
  },
  {
    key: 'ac',
    apiPath: 'air',             // URL ใช้ air: /api/devices/air/...
    label: 'แอร์',
    labelEn: 'Air Conditioner',
    icon: 'tabler-snowflake',
    description: 'ควบคุมแอร์และอุณหภูมิ',
    actions: ['on', 'off'],
    hasStatus: true,
    hasTemperature: true,
    hasMode: true,
    syncPath: 'air',
    order: 2,
  },
  {
    key: 'erv',
    apiPath: 'erv',             // /api/devices/erv/...
    label: 'ERV',
    labelEn: 'ERV (Ventilation)',
    icon: 'tabler-wind',
    description: 'ควบคุมระบบระบายอากาศ',
    actions: ['on', 'off'],
    hasStatus: true,
    hasMode: true,
    hasLevel: true,
    syncPath: 'erv',
    order: 3,
  },
];

/**
 * คืนรายการประเภทอุปกรณ์ที่สั่งงานได้ (เรียงตาม order)
 * ใช้ใน API GET /api/devices/types
 */
function getControllableDeviceTypes() {
  return [...CONTROLLABLE_DEVICE_TYPES].sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * หาประเภทอุปกรณ์จาก key (light, air, erv)
 */
function getDeviceTypeByKey(key) {
  return CONTROLLABLE_DEVICE_TYPES.find(t => t.key === key) || null;
}

module.exports = {
  CONTROLLABLE_DEVICE_TYPES,
  getControllableDeviceTypes,
  getDeviceTypeByKey,
};
