const homeAssistantService = require('./homeAssistantService');
const DeviceState = require('../models/DeviceState');
const { pool } = require('../config/database');

/**
 * Home Assistant Sync Service
 * สำหรับดึงสถานะอุปกรณ์จาก Home Assistant และบันทึกลงในฐานข้อมูล
 */
class HomeAssistantSyncService {
    constructor() {
        // Mapping HA sync keys → room_id + entityId; DB row หาได้จาก entity_id ในตาราง devices
        this.deviceMappings = {
            'CC3F1D03BAE3': {
                roomId: 28,
                deviceType: 'ac',
                entityId: 'climate.air_02'
            },
            'ERV_U1': {
                roomId: 28,
                deviceType: 'erv',
                entityId: 'switch.erv_u1_power'
            },
            'LIGHTS_17': {
                roomId: 28,
                deviceType: 'light',
                entityId: 'light.lights_17'
            }
        };
    }

    /**
     * จาก entity ควบคุม ERV (เช่น switch.erv_u1_power) หา "stem" สำหรับ sensor/script คู่กัน
     * @param {string} powerEntityId
     * @returns {string|null} เช่น erv_u1
     */
    ervStemFromPowerEntityId(powerEntityId) {
        const trimmed = String(powerEntityId || '').trim();
        const dot = trimmed.indexOf('.');
        if (dot === -1) return null;
        let obj = trimmed.slice(dot + 1);
        if (!obj) return null;
        const lower = obj.toLowerCase();
        if (lower.endsWith('_power')) {
            obj = obj.slice(0, obj.length - 6);
        }
        return obj || null;
    }

    /**
     * ดึงโหมดและระดับลม ERV จาก HA (sensor + script) ให้ตรงกับ logic เดิมใน syncErv
     * @param {string} powerEntityId - entity เปิด/ปิด เช่น switch.erv_u1_power
     * @returns {Promise<{ mode: string, speed: string }>}
     */
    async fetchErvModeAndSpeedFromHomeAssistant(powerEntityId) {
        let mode = 'normal';
        let speed = 'low';

        const stem = this.ervStemFromPowerEntityId(powerEntityId);
        if (!stem) {
            return { mode, speed };
        }

        const sensorEntityIds = [
            `sensor.${stem}_mode`,
            `sensor.${stem}_air`
        ];
        const scriptEntityIds = [
            `script.${stem}_mode_heat`,
            `script.${stem}_mode_normal`
        ];

        try {
            const sensorStatesResult = await homeAssistantService.getMultipleStates(sensorEntityIds);
            const sensorStates = sensorStatesResult.data;

            const scriptStatesResult = await homeAssistantService.getMultipleStates(scriptEntityIds);
            const scriptStates = scriptStatesResult.data;

            const modeSensor = sensorStates[`sensor.${stem}_mode`];
            if (modeSensor?.success && modeSensor?.state?.state !== undefined) {
                const modeValue = parseInt(modeSensor.state.state, 10) || 0;
                mode = modeValue === 0 ? 'normal' : 'heat';
            }

            const heatScript = scriptStates[`script.${stem}_mode_heat`];
            const normalScript = scriptStates[`script.${stem}_mode_normal`];

            if (heatScript?.success && normalScript?.success) {
                const heatLastTriggered = heatScript.state?.attributes?.last_triggered;
                const normalLastTriggered = normalScript.state?.attributes?.last_triggered;

                if (heatLastTriggered && normalLastTriggered) {
                    const heatTime = new Date(heatLastTriggered).getTime();
                    const normalTime = new Date(normalLastTriggered).getTime();
                    mode = heatTime > normalTime ? 'heat' : 'normal';
                } else if (heatLastTriggered && !normalLastTriggered) {
                    mode = 'heat';
                } else if (normalLastTriggered && !heatLastTriggered) {
                    mode = 'normal';
                }
            }

            const airSensor = sensorStates[`sensor.${stem}_air`];
            if (airSensor?.success && airSensor?.state?.state !== undefined) {
                const airValue = parseInt(airSensor.state.state, 10) || 1;
                speed = airValue >= 2 ? 'high' : 'low';
            }

            console.log(`[HomeAssistantSync] ERV mode/speed from HA (${powerEntityId}, stem=${stem}): mode=${mode}, speed=${speed}`);
        } catch (error) {
            console.warn(`[HomeAssistantSync] fetchErvModeAndSpeedFromHomeAssistant failed for ${powerEntityId}:`, error.message);
        }

        return { mode, speed };
    }

    /**
     * คืน devices.id สำหรับแถวใน room ที่ entity_id ตรงกับ mapping
     */
    async resolveDevicesRowId(mapping) {
        const [rows] = await pool.query(
            `SELECT id FROM devices
             WHERE room_id = ? AND LTRIM(RTRIM(ISNULL(entity_id,''))) = ?
               AND (disable = 0 OR disable IS NULL)`,
            [mapping.roomId, String(mapping.entityId).trim()]
        );
        return rows && rows[0] ? rows[0].id : null;
    }

    /**
     * ดึงสถานะแอร์จาก Home Assistant และบันทึกลง DB
     * @param {string} deviceId - Device ID เช่น "CC3F1D03BAE3"
     * @returns {Promise<object>}
     */
    async syncAirConditioner(deviceId) {
        if (!homeAssistantService.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        const mapping = this.deviceMappings[deviceId];
        if (!mapping || mapping.deviceType !== 'ac') {
            throw new Error(`ไม่พบ mapping สำหรับ device ID: ${deviceId}`);    
        }

        try {
            // ดึงสถานะจาก Home Assistant
            const stateResult = await homeAssistantService.getState(mapping.entityId);
            const haState = stateResult.state;

            // ดึง settings จาก attributes
            // Home Assistant รองรับ: 'off', 'heat_cool', 'heat', 'dry', 'fan_only', 'cool'
            // แต่ UI แสดงแค่: 'off', 'dry', 'fan_only', 'cool'
            let hvacMode = haState.attributes?.hvac_mode || haState.state || 'off';
            
            // แปลง mode ให้ตรงกับ UI
            // 'heat_cool' และ 'heat' ไม่รองรับใน UI แล้ว แปลงเป็น 'cool'
            if (hvacMode === 'heat_cool' || hvacMode === 'heat' || hvacMode === 'auto') {
                hvacMode = 'cool';
            }
            // ตรวจสอบว่า mode อยู่ในรายการที่รองรับหรือไม่
            const supportedModes = ['off', 'cool', 'dry', 'fan_only'];
            if (!supportedModes.includes(hvacMode)) {
                hvacMode = 'off'; // Default to 'off' if mode is not supported
            }
            
            const settings = {
                mode: hvacMode,
                temperature: haState.attributes?.temperature || 25,
                current_temperature: haState.attributes?.current_temperature || null,
                fan_mode: haState.attributes?.fan_mode || null
            };

            // แปลงสถานะจาก Home Assistant เป็นรูปแบบที่ใช้ใน DB
            // สำหรับ climate entity:
            // - ถ้า state หรือ hvac_mode เป็น 'cool', 'dry', 'fan_only' = เปิดอยู่
            // - ถ้า state หรือ hvac_mode เป็น 'off' = ปิดอยู่
            // - แต่บางครั้ง state อาจเป็น 'off' แต่ hvac_mode ใน attributes อาจเป็น 'cool', 'dry', 'fan_only' (แอร์เปิดอยู่)
            // ดังนั้นเราต้องตรวจสอบทั้ง state และ hvac_mode
            const stateValue = haState.state?.toLowerCase() || 'off';
            const hvacModeValue = hvacMode?.toLowerCase() || 'off';
            
            // แอร์เปิดอยู่ถ้า:
            // 1. state หรือ hvac_mode เป็น 'cool', 'dry', 'fan_only'
            // 2. หรือ state เป็น 'on'
            // 3. หรือ hvac_mode เป็น 'heat_cool', 'heat', 'auto' (โหมดเก่าที่ไม่รองรับแล้ว แต่ยังถือว่าเปิดอยู่)
            const isOn = stateValue === 'cool' || 
                        stateValue === 'dry' || 
                        stateValue === 'fan_only' ||
                        stateValue === 'on' ||
                        hvacModeValue === 'cool' || 
                        hvacModeValue === 'dry' || 
                        hvacModeValue === 'fan_only' ||
                        hvacModeValue === 'heat_cool' ||
                        hvacModeValue === 'heat' || 
                        hvacModeValue === 'auto';

            // Log สำหรับ debug
            console.log(`[HomeAssistantSync] AC ${deviceId} (${mapping.entityId}) state:`, {
                state: haState.state,
                hvac_mode: hvacMode,
                isOn: isOn,
                temperature: settings.temperature,
                attributes: haState.attributes
            });

            const dbDeviceId = await this.resolveDevicesRowId(mapping);
            if (!dbDeviceId) {
                throw new Error(`ไม่พบ devices.id สำหรับ entity ${mapping.entityId} ในห้อง ${mapping.roomId}`);
            }
            await DeviceState.upsertRoomStateByDeviceId(
                mapping.roomId,
                dbDeviceId,
                mapping.deviceType,
                isOn,
                settings
            );

            console.log(`[HomeAssistantSync] Synced AC ${deviceId} (${mapping.entityId}): ${isOn ? 'ON' : 'OFF'}, mode=${settings.mode}, temp=${settings.temperature}`);

            return {
                success: true,
                deviceId,
                roomId: mapping.roomId,
                deviceType: mapping.deviceType,
                devicesRowId: dbDeviceId,
                status: isOn,
                settings,
                haState: haState.state,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`[HomeAssistantSync] Error syncing AC ${deviceId}:`, error.message);
            throw error;
        }
    }

    /**
     * ดึงสถานะ ERV จาก Home Assistant และบันทึกลง DB
     * @param {string} deviceId - Device ID เช่น "ERV_U1"
     * @returns {Promise<object>}
     */
    async syncErv(deviceId) {
        if (!homeAssistantService.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        const mapping = this.deviceMappings[deviceId];
        if (!mapping || mapping.deviceType !== 'erv') {
            throw new Error(`ไม่พบ mapping สำหรับ device ID: ${deviceId}`);
        }

        try {
            // ดึงสถานะจาก Home Assistant (power switch)
            const stateResult = await homeAssistantService.getState(mapping.entityId);
            const haState = stateResult.state;

            const stateStr = (haState.state || '').toString().toLowerCase();
            const isOn = stateStr === 'on';

            const { mode, speed } = await this.fetchErvModeAndSpeedFromHomeAssistant(mapping.entityId);
            const settings = { mode, speed };

            console.log(`[HomeAssistantSync] ERV ${deviceId} (${mapping.entityId}) state:`, {
                power: haState.state,
                isOn,
                mode,
                speed
            });

            const dbDeviceId = await this.resolveDevicesRowId(mapping);
            if (!dbDeviceId) {
                throw new Error(`ไม่พบ devices.id สำหรับ entity ${mapping.entityId} ในห้อง ${mapping.roomId}`);
            }
            await DeviceState.upsertRoomStateByDeviceId(
                mapping.roomId,
                dbDeviceId,
                mapping.deviceType,
                isOn,
                settings
            );

            console.log(`[HomeAssistantSync] Synced ERV ${deviceId} (${mapping.entityId}): ${isOn ? 'ON' : 'OFF'}, mode=${mode}, speed=${speed}`);

            return {
                success: true,
                deviceId,
                roomId: mapping.roomId,
                deviceType: mapping.deviceType,
                devicesRowId: dbDeviceId,
                status: isOn,
                settings,
                haState: haState.state,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`[HomeAssistantSync] Error syncing ERV ${deviceId}:`, error.message);
            throw error;
        }
    }

    /**
     * ดึงสถานะไฟจาก Home Assistant และบันทึกลง DB
     * @param {string} deviceId - Device ID เช่น "LIGHTS_17"
     * @returns {Promise<object>}
     */
    async syncLight(deviceId) {
        if (!homeAssistantService.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        const mapping = this.deviceMappings[deviceId];
        if (!mapping || mapping.deviceType !== 'light') {
            throw new Error(`ไม่พบ mapping สำหรับ device ID: ${deviceId}`);
        }

        try {
            // ดึงสถานะจาก Home Assistant
            const stateResult = await homeAssistantService.getState(mapping.entityId);
            const haState = stateResult.state;

            // แปลงสถานะจาก Home Assistant (รองรับทั้ง 'on'/'ON' และค่าจาก attributes)
            const stateStr = (haState.state || (haState.attributes && haState.attributes.state) || '').toString().toLowerCase();
            const isOn = stateStr === 'on';

            // สำหรับ light เราอาจเก็บ brightness และ color attributes
            const settings = {
                brightness: haState.attributes?.brightness || null,
                color_temp: haState.attributes?.color_temp || null,
                color_mode: haState.attributes?.color_mode || null
            };

            // Log สำหรับ debug
            console.log(`[HomeAssistantSync] Light ${deviceId} (${mapping.entityId}) state:`, {
                state: haState.state,
                isOn: isOn,
                brightness: settings.brightness,
                attributes: haState.attributes
            });

            const dbDeviceId = await this.resolveDevicesRowId(mapping);
            if (!dbDeviceId) {
                throw new Error(`ไม่พบ devices.id สำหรับ entity ${mapping.entityId} ในห้อง ${mapping.roomId}`);
            }
            await DeviceState.upsertRoomStateByDeviceId(
                mapping.roomId,
                dbDeviceId,
                mapping.deviceType,
                isOn,
                settings
            );

            console.log(`[HomeAssistantSync] Synced Light ${deviceId} (${mapping.entityId}): ${isOn ? 'ON' : 'OFF'}`);

            return {
                success: true,
                deviceId,
                roomId: mapping.roomId,
                deviceType: mapping.deviceType,
                devicesRowId: dbDeviceId,
                status: isOn,
                settings,
                haState: haState.state,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`[HomeAssistantSync] Error syncing Light ${deviceId}:`, error.message);
            throw error;
        }
    }

    /**
     * Sync ทุกอุปกรณ์ที่กำหนดไว้
     * @returns {Promise<object>}
     */
    async syncAll() {
        if (!homeAssistantService.isEnabled()) {
            throw new Error('Home Assistant ไม่ได้ตั้งค่า');
        }

        const results = {
            success: [],
            failed: []
        };

        for (const [deviceId, mapping] of Object.entries(this.deviceMappings)) {
            try {
                if (mapping.deviceType === 'ac') {
                    const result = await this.syncAirConditioner(deviceId);
                    results.success.push(result);
                } else if (mapping.deviceType === 'erv') {
                    const result = await this.syncErv(deviceId);
                    results.success.push(result);
                } else if (mapping.deviceType === 'light') {
                    const result = await this.syncLight(deviceId);
                    results.success.push(result);
                }
            } catch (error) {
                results.failed.push({
                    deviceId,
                    error: error.message
                });
            }
        }

        console.log(`[HomeAssistantSync] Sync completed: ${results.success.length} success, ${results.failed.length} failed`);

        return results;
    }

    /**
     * เพิ่ม device mapping ใหม่
     * @param {string} deviceId - Device ID
     * @param {object} mapping - Mapping configuration
     */
    addDeviceMapping(deviceId, mapping) {
        this.deviceMappings[deviceId] = mapping;
    }

    /**
     * ดึง device mapping
     * @param {string} deviceId - Device ID
     * @returns {object|null}
     */
    getDeviceMapping(deviceId) {
        return this.deviceMappings[deviceId] || null;
    }
}

module.exports = new HomeAssistantSyncService();

