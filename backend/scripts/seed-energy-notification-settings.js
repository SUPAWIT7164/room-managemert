const { pool } = require('../config/database');

async function seedEnergyNotificationSettings() {
    try {
        console.log('🌱 Starting to seed energy notification settings...');

        // Check if settings already exist for module_id = 3
        const [existing] = await pool.query(
            'SELECT COUNT(*) as count FROM settings WHERE module_id = 3 AND disable = 0'
        );

        if (existing[0].count > 0) {
            console.log(`✅ Energy notification settings already exist (${existing[0].count} settings)`);
            return;
        }

        // Energy notification settings for module_id = 3
        // These settings match the room-management-portal project
        const energyNotificationSettings = [
            {
                slug: 'day-notify',
                name: 'เวลาแจ้งเตือน (วัน)',
                name_en: 'Notification time (Day)',
                value: '8',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'month-notify',
                name: 'เวลาแจ้งเตือน (เดือน)',
                name_en: 'Notification time (Month)',
                value: '1',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'volt-below',
                name: 'ไฟตก แรงดัน (Volt) ต่ำกว่า',
                name_en: 'Voltage drop, voltage (Volt) is lower',
                value: '200',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'volt-upper',
                name: 'ไฟเกิน แรงดัน (Volt) สูงกว่า',
                name_en: 'Volt overload, voltage (Volt) is higher',
                value: '250',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'current-upper',
                name: 'กระแสไฟฟ้า (Amp) สูงกว่า',
                name_en: 'Higher current (Amp)',
                value: '50',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'power-off',
                name: 'ไฟดับ',
                name_en: 'Power cut',
                value: '0',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'weekly-summary-notify',
                name: 'แจ้งเตือนสรุปรายสัปดาห์',
                name_en: 'Weekly summary notification',
                value: '1',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'monthly-summary-notify',
                name: 'แจ้งเตือนสรุปรายเดือน',
                name_en: 'Monthly summary notification',
                value: '1',
                unit: null,
                unit_en: null,
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'tou-peak-price',
                name: 'ราคา TOU ช่วง Peak',
                name_en: 'TOU Peak Price',
                value: '5',
                unit: 'บาท/หน่วย',
                unit_en: 'THB/unit',
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'tou-midpeak-price',
                name: 'ราคา TOU ช่วง Mid-Peak',
                name_en: 'TOU Mid-Peak Price',
                value: '3.5',
                unit: 'บาท/หน่วย',
                unit_en: 'THB/unit',
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'tou-offpeak-price',
                name: 'ราคา TOU ช่วง Off-Peak',
                name_en: 'TOU Off-Peak Price',
                value: '2',
                unit: 'บาท/หน่วย',
                unit_en: 'THB/unit',
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'flat-rate-price',
                name: 'ราคา Flat Rate',
                name_en: 'Flat Rate Price',
                value: '3',
                unit: 'บาท/หน่วย',
                unit_en: 'THB/unit',
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'tou-peak-period',
                name: 'ช่วงเวลา Peak',
                name_en: 'Peak Period',
                value: '09:00-12:00,18:00-21:00',
                unit: 'เวลา',
                unit_en: 'Time',
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'tou-midpeak-period',
                name: 'ช่วงเวลา Mid-Peak',
                name_en: 'Mid-Peak Period',
                value: '12:00-18:00',
                unit: 'เวลา',
                unit_en: 'Time',
                module_id: 3,
                is_default: 1,
                disable: 0
            },
            {
                slug: 'tou-offpeak-period',
                name: 'ช่วงเวลา Off-Peak',
                name_en: 'Off-Peak Period',
                value: '21:00-09:00',
                unit: 'เวลา',
                unit_en: 'Time',
                module_id: 3,
                is_default: 1,
                disable: 0
            }
        ];

        // Insert settings
        for (const setting of energyNotificationSettings) {
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

        console.log(`✅ Successfully seeded ${energyNotificationSettings.length} energy notification settings`);
    } catch (error) {
        console.error('❌ Error seeding energy notification settings:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the seed function
if (require.main === module) {
    seedEnergyNotificationSettings()
        .then(() => {
            console.log('✅ Seeding completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        });
}

module.exports = { seedEnergyNotificationSettings };
