const axios = require('axios');

/**
 * Home Assistant Service
 * สำหรับควบคุมอุปกรณ์ผ่าน Home Assistant API
 */
class HomeAssistantService {
    constructor() {
        // อ่าน config จาก environment variables
        this.baseUrl = process.env.HOME_ASSISTANT_URL || process.env.HA_URL || '';
        this.accessToken = process.env.HOME_ASSISTANT_TOKEN || process.env.HA_TOKEN || process.env.HA_LONG_LIVED_TOKEN || '';
        this.timeout = Number(process.env.HOME_ASSISTANT_TIMEOUT || 10000);

        // สร้าง axios instance
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * ตรวจสอบว่า Home Assistant พร้อมใช้งานหรือไม่
     */
    isEnabled() {
        return Boolean(this.baseUrl && this.accessToken);
    }

    /**
     * เปิด/ปิดแอร์ (Climate Control)
     * @param {string} entityId - Entity ID เช่น "climate.air_02"
     * @param {string} action - "on" หรือ "off"
     * @param {object} options - ตัวเลือกเพิ่มเติม เช่น { temperature: 25, hvac_mode: "cool" }
     * @returns {Promise<object>}
     */
    async controlClimate(entityId, action, options = {}) {
        if (!this.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า (HOME_ASSISTANT_URL หรือ HOME_ASSISTANT_TOKEN ไม่มี)');
        }

        try {
            const service = action === 'on' ? 'turn_on' : 'turn_off';
            const domain = entityId.split('.')[0]; // เช่น "climate" จาก "climate.air_02"

            // สำหรับ turn_on: ส่งแค่ entity_id ก่อน (บาง device ไม่รองรับ temperature/hvac_mode ใน turn_on)
            let payload = {
                entity_id: entityId
            };

            console.log(`[HomeAssistant] เรียก API: POST /api/services/${domain}/${service}`, payload);

            // เปิด/ปิดแอร์
            const response = await this.client.post(
                `/api/services/${domain}/${service}`,
                payload
            );

            // ถ้าเปิดแอร์และมี options ให้ตั้งค่า temperature และ hvac_mode แยก
            if (action === 'on' && options) {
                // ตั้งค่า hvac_mode ก่อน (ถ้ามี)
                if (options.hvac_mode) {
                    try {
                        await this.client.post('/api/services/climate/set_hvac_mode', {
                            entity_id: entityId,
                            hvac_mode: options.hvac_mode
                        });
                        console.log(`[HomeAssistant] ตั้งค่า HVAC mode เป็น ${options.hvac_mode} สำเร็จ`);
                    } catch (err) {
                        console.warn(`[HomeAssistant] ตั้งค่า HVAC mode ล้มเหลว:`, err.message);
                    }
                }

                // ตั้งค่าอุณหภูมิ (ถ้ามี)
                if (options.temperature !== undefined && options.temperature !== null) {
                    try {
                        await this.client.post('/api/services/climate/set_temperature', {
                            entity_id: entityId,
                            temperature: options.temperature
                        });
                        console.log(`[HomeAssistant] ตั้งค่าอุณหภูมิเป็น ${options.temperature}°C สำเร็จ`);
                    } catch (err) {
                        console.warn(`[HomeAssistant] ตั้งค่าอุณหภูมิล้มเหลว:`, err.message);
                    }
                }
            }

            console.log(`[HomeAssistant] ${action === 'on' ? 'เปิด' : 'ปิด'}แอร์ ${entityId} สำเร็จ`);
            return {
                success: true,
                message: `${action === 'on' ? 'เปิด' : 'ปิด'}แอร์สำเร็จ`,
                entityId,
                action,
                response: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด';
            const errorDetails = error.response?.data || {};
            console.error(`[HomeAssistant] ควบคุมแอร์ ${entityId} ล้มเหลว:`, {
                message: errorMsg,
                status: error.response?.status,
                data: errorDetails,
                fullError: error
            });
            throw new Error(`ไม่สามารถ${action === 'on' ? 'เปิด' : 'ปิด'}แอร์ได้: ${errorMsg}`);
        }
    }

    /**
     * ตั้งค่าอุณหภูมิแอร์
     * @param {string} entityId - Entity ID เช่น "climate.air_02"
     * @param {number} temperature - อุณหภูมิที่ต้องการ
     * @returns {Promise<object>}
     */
    async setTemperature(entityId, temperature) {
        if (!this.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        try {
            const response = await this.client.post(
                `/api/services/climate/set_temperature`,
                {
                    entity_id: entityId,
                    temperature: temperature
                }
            );

            console.log(`[HomeAssistant] ตั้งอุณหภูมิแอร์ ${entityId} เป็น ${temperature}°C สำเร็จ`);
            return {
                success: true,
                message: `ตั้งอุณหภูมิเป็น ${temperature}°C สำเร็จ`,
                entityId,
                temperature,
                response: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'เกิดข้อผิดพลาด';
            console.error(`[HomeAssistant] ตั้งอุณหภูมิแอร์ ${entityId} ล้มเหลว:`, errorMsg);
            throw new Error(`ไม่สามารถตั้งอุณหภูมิได้: ${errorMsg}`);
        }
    }

    /**
     * ตั้งค่า HVAC mode (cool, heat, auto, off)
     * @param {string} entityId - Entity ID เช่น "climate.air_02"
     * @param {string} hvacMode - "cool", "heat", "auto", "off"
     * @returns {Promise<object>}
     */
    async setHvacMode(entityId, hvacMode) {
        if (!this.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        try {
            const response = await this.client.post(
                `/api/services/climate/set_hvac_mode`,
                {
                    entity_id: entityId,
                    hvac_mode: hvacMode
                }
            );

            console.log(`[HomeAssistant] ตั้งค่า HVAC mode ของ ${entityId} เป็น ${hvacMode} สำเร็จ`);
            return {
                success: true,
                message: `ตั้งค่าโหมดเป็น ${hvacMode} สำเร็จ`,
                entityId,
                hvacMode,
                response: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'เกิดข้อผิดพลาด';
            console.error(`[HomeAssistant] ตั้งค่า HVAC mode ของ ${entityId} ล้มเหลว:`, errorMsg);
            throw new Error(`ไม่สามารถตั้งค่าโหมดได้: ${errorMsg}`);
        }
    }

    /**
     * ดึงสถานะของ entity
     * @param {string} entityId - Entity ID เช่น "climate.air_02"
     * @returns {Promise<object>}
     */
    async getState(entityId) {
        if (!this.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        try {
            const response = await this.client.get(`/api/states/${entityId}`);
            return {
                success: true,
                entityId,
                state: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'เกิดข้อผิดพลาด';
            console.error(`[HomeAssistant] ดึงสถานะ ${entityId} ล้มเหลว:`, errorMsg);
            throw new Error(`ไม่สามารถดึงสถานะได้: ${errorMsg}`);
        }
    }

    /**
     * เปิด/ปิด Switch
     * @param {string} entityId - Entity ID เช่น "switch.erv_u1_power"
     * @param {string} action - "on" หรือ "off"
     * @returns {Promise<object>}
     */
    async controlSwitch(entityId, action) {
        if (!this.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        try {
            const service = action === 'on' ? 'turn_on' : 'turn_off';
            const domain = entityId.split('.')[0]; // เช่น "switch" จาก "switch.erv_u1_power"

            const payload = {
                entity_id: entityId
            };

            console.log(`[HomeAssistant] เรียก API: POST /api/services/${domain}/${service}`, payload);

            const response = await this.client.post(
                `/api/services/${domain}/${service}`,
                payload
            );

            console.log(`[HomeAssistant] ${action === 'on' ? 'เปิด' : 'ปิด'} ${entityId} สำเร็จ`);
            return {
                success: true,
                message: `${action === 'on' ? 'เปิด' : 'ปิด'}สำเร็จ`,
                entityId,
                action,
                response: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด';
            const errorDetails = error.response?.data || {};
            console.error(`[HomeAssistant] ควบคุม ${entityId} ล้มเหลว:`, {
                message: errorMsg,
                status: error.response?.status,
                data: errorDetails
            });
            throw new Error(`ไม่สามารถ${action === 'on' ? 'เปิด' : 'ปิด'}ได้: ${errorMsg}`);
        }
    }

    /**
     * เรียก Script
     * @param {string} entityId - Entity ID เช่น "script.erv_u1_mode_heat"
     * @returns {Promise<object>}
     */
    async callScript(entityId) {
        if (!this.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        try {
            const payload = {
                entity_id: entityId
            };

            console.log(`[HomeAssistant] เรียก API: POST /api/services/script/turn_on`, payload);

            const response = await this.client.post(
                `/api/services/script/turn_on`,
                payload
            );

            console.log(`[HomeAssistant] เรียก script ${entityId} สำเร็จ`);
            return {
                success: true,
                message: 'เรียก script สำเร็จ',
                entityId,
                response: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด';
            const errorDetails = error.response?.data || {};
            console.error(`[HomeAssistant] เรียก script ${entityId} ล้มเหลว:`, {
                message: errorMsg,
                status: error.response?.status,
                data: errorDetails
            });
            throw new Error(`ไม่สามารถเรียก script ได้: ${errorMsg}`);
        }
    }

    /**
     * ดึงข้อมูล Sensor หลายตัวพร้อมกัน
     * @param {Array<string>} entityIds - Array ของ Entity IDs เช่น ["sensor.am319_am319_co2", "sensor.am319_am319_temperature"]
     * @returns {Promise<object>}
     */
    async getMultipleStates(entityIds) {
        if (!this.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        try {
            const results = {};
            const promises = entityIds.map(async (entityId) => {
                try {
                    const response = await this.client.get(`/api/states/${entityId}`);
                    return { entityId, state: response.data, success: true };
                } catch (error) {
                    console.warn(`[HomeAssistant] ไม่สามารถดึงสถานะ ${entityId}:`, error.message);
                    return { entityId, state: null, success: false, error: error.message };
                }
            });

            const responses = await Promise.all(promises);
            
            responses.forEach(({ entityId, state, success, error }) => {
                results[entityId] = {
                    success,
                    state,
                    error: error || null
                };
            });

            console.log(`[HomeAssistant] ดึงสถานะ ${entityIds.length} sensors สำเร็จ`);
            return {
                success: true,
                data: results,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'เกิดข้อผิดพลาด';
            console.error(`[HomeAssistant] ดึงสถานะ sensors ล้มเหลว:`, errorMsg);
            throw new Error(`ไม่สามารถดึงสถานะ sensors ได้: ${errorMsg}`);
        }
    }
}

module.exports = new HomeAssistantService();

