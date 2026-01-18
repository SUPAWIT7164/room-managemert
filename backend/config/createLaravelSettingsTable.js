const { pool } = require('./database');

async function createLaravelSettingsTable() {
    try {
        // Check if table has Laravel structure
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'settings' 
            AND COLUMN_NAME IN ('slug', 'module_id')
        `);

        if (columns.length === 2) {
            console.log('✅ Settings table already has Laravel structure');
            return;
        }

        console.log('⚠️  Settings table does not have Laravel structure. Creating new table...');

        // Drop old settings table if exists
        await pool.query('DROP TABLE IF EXISTS settings_old');
        await pool.query('CREATE TABLE settings_old AS SELECT * FROM settings');
        await pool.query('DROP TABLE IF EXISTS settings');

        // Create new settings table with Laravel structure
        await pool.query(`
            CREATE TABLE settings (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NULL,
                name_en VARCHAR(255) NULL,
                slug VARCHAR(255) NULL,
                value TEXT NULL,
                unit VARCHAR(255) NULL,
                unit_en VARCHAR(255) NULL,
                is_default TINYINT(1) DEFAULT 0,
                disable TINYINT(1) DEFAULT 0,
                type_id BIGINT UNSIGNED NULL,
                module_id BIGINT UNSIGNED NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                INDEX idx_module_id (module_id),
                INDEX idx_slug (slug),
                INDEX idx_disable (disable)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Insert default booking quota settings
        const bookingQuotaSettings = [
            {
                slug: 'booking-per-week',
                name: 'จำนวนครั้งการจองใน 1 อาทิตย์',
                name_en: 'Number of bookings per week',
                value: '3',
                unit: 'ครั้ง/อาทิตย์',
                unit_en: 'count/week',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'booking-per-day',
                name: 'จำนวนครั้งการจองใน 1 วัน',
                name_en: 'Number of bookings per day',
                value: '2',
                unit: 'ครั้ง/วัน',
                unit_en: 'count/day',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'booking-ahead-day',
                name: 'จำนวนวันในการจองล่วงหน้า',
                name_en: 'Number of days to book ahead',
                value: '3',
                unit: 'วัน',
                unit_en: 'day',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'booking-hour-max',
                name: 'ชั่วโมงการจองสูงสุด',
                name_en: 'Maximum booking hours',
                value: '3',
                unit: 'ชั่วโมง',
                unit_en: 'hour',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'booking-hour-min',
                name: 'ชั่วโมงการจองขั้นต่ำ',
                name_en: 'Minimum booking hours',
                value: '0.5',
                unit: 'ชั่วโมง',
                unit_en: 'hour',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'before-start',
                name: 'สามารถเข้าห้องได้ก่อนเวลา',
                name_en: 'Can enter room before time',
                value: '30',
                unit: 'นาที',
                unit_en: 'minute',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'after-end',
                name: 'สามารถเข้าห้องได้หลังจบการจอง',
                name_en: 'Can enter room after booking ends',
                value: '30',
                unit: 'นาที',
                unit_en: 'minute',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'after-start',
                name: 'ยกเลิกตารางหากผู้จองไม่มาใช้งานภายใน',
                name_en: 'Cancel booking if user does not use within',
                value: '10',
                unit: 'นาที',
                unit_en: 'minute',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'booking-start',
                name: 'เวลาเริ่มต้นการแสดงตาราง',
                name_en: 'Booking start time',
                value: '08:00',
                unit: 'เวลา',
                unit_en: 'time',
                module_id: 1,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'booking-end',
                name: 'เวลาสิ้นสุดการแสดงตาราง',
                name_en: 'Booking end time',
                value: '20:00',
                unit: 'เวลา',
                unit_en: 'time',
                module_id: 1,
                is_default: 1,
                disable: 0
            }
        ];

        for (const setting of bookingQuotaSettings) {
            await pool.query(`
                INSERT INTO settings (slug, name, name_en, value, unit, unit_en, module_id, is_default, disable, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                setting.slug,
                setting.name,
                setting.name_en,
                setting.value,
                setting.unit,
                setting.unit_en,
                setting.module_id,
                setting.is_default,
                setting.disable
            ]);
        }

        console.log('✅ Laravel settings table created successfully with', bookingQuotaSettings.length, 'default settings');
    } catch (error) {
        console.error('❌ Error creating Laravel settings table:', error.message);
        throw error;
    }
}

module.exports = { createLaravelSettingsTable };










