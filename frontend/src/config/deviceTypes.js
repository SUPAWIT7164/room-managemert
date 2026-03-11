/**
 * ประเภทอุปกรณ์ที่สั่งงานได้ (ใช้แสดง icon และ label บนหน้าเว็บ)
 * ดึงจาก API GET /api/devices/types ได้ หรือใช้ค่า default ด้านล่าง
 * เมื่อเพิ่มอุปกรณ์ใหม่ใน backend config/deviceTypes.js และเพิ่ม icon ที่นี่ หน้าเว็บจะแสดงอัตโนมัติ
 */

/** ค่า default (ตรงกับ backend) - ใช้เมื่อยังไม่โหลดจาก API */
export const DEFAULT_DEVICE_TYPES = [
  {
    key: 'light',
    apiPath: 'light',
    label: 'ไฟ',
    labelEn: 'Light',
    icon: 'tabler-bulb',
    description: 'ควบคุมการเปิด-ปิดไฟ',
    order: 1,
  },
  {
    key: 'ac',
    apiPath: 'air',
    label: 'แอร์',
    labelEn: 'Air Conditioner',
    icon: 'tabler-snowflake',
    description: 'ควบคุมแอร์และอุณหภูมิ',
    order: 2,
  },
  {
    key: 'erv',
    apiPath: 'erv',
    label: 'ERV',
    labelEn: 'ERV (Ventilation)',
    icon: 'tabler-wind',
    description: 'ควบคุมระบบระบายอากาศ',
    order: 3,
  },
]

/**
 * หาประเภทอุปกรณ์จาก key
 */
export function getDeviceTypeByKey(types, key) {
  return (types || DEFAULT_DEVICE_TYPES).find(t => t.key === key) || null
}

/**
 * หา icon ของประเภทอุปกรณ์ (สำหรับแสดงในหน้า control)
 */
export function getDeviceTypeIcon(types, key) {
  const t = getDeviceTypeByKey(types || DEFAULT_DEVICE_TYPES, key)
  return t ? t.icon : 'tabler-device-unknown'
}

/**
 * หา label ของประเภทอุปกรณ์
 */
export function getDeviceTypeLabel(types, key) {
  const t = getDeviceTypeByKey(types || DEFAULT_DEVICE_TYPES, key)
  return t ? t.label : key
}
