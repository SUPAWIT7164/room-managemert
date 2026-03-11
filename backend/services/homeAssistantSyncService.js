const homeAssistantService = require('./homeAssistantService');
const DeviceState = require('../models/DeviceState');

/**
 * Home Assistant Sync Service
 * สำหรับดึงสถานะอุปกรณ์จาก Home Assistant และบันทึกลงในฐานข้อมูล
 */
class HomeAssistantSyncService {
    constructor() {
        // Mapping ของ device IDs กับ room_id และ device_index
        // สามารถขยายได้ในอนาคต
        this.deviceMappings = {
            // Air Conditioner
            'CC3F1D03BAE3': {
                roomId: 28, // Room ID สำหรับ Mercury room
                deviceType: 'ac',
                deviceIndex: 1, // AC index 1 (air_02)
                entityId: 'climate.air_02'
            },
            // ERV
            'ERV_U1': {
                roomId: 28, // Room ID สำหรับ Mercury room
                deviceType: 'erv',
                deviceIndex: 0, // ERV index 0
                entityId: 'switch.erv_u1_power'
            },
            // Light
            'LIGHTS_17': {
                roomId: 28, // Room ID สำหรับ Mercury room
                deviceType: 'light',
                deviceIndex: 0, // Light index 0
                entityId: 'light.lights_17'
            }
        };
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

            // บันทึกลง DB
            await DeviceState.setDeviceState(
                mapping.roomId,
                mapping.deviceType,
                mapping.deviceIndex,
                isOn,
                settings
            );

            console.log(`[HomeAssistantSync] Synced AC ${deviceId} (${mapping.entityId}): ${isOn ? 'ON' : 'OFF'}, mode=${settings.mode}, temp=${settings.temperature}`);

            return {
                success: true,
                deviceId,
                roomId: mapping.roomId,
                deviceType: mapping.deviceType,
                deviceIndex: mapping.deviceIndex,
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

            // แปลงสถานะจาก Home Assistant
            const isOn = haState.state === 'on';

            // ดึงสถานะโหมดและระดับจาก sensor entities และ script states
            const sensorEntityIds = [
                'sensor.erv_u1_mode',
                'sensor.erv_u1_air'
            ];
            const scriptEntityIds = [
                'script.erv_u1_mode_heat',
                'script.erv_u1_mode_normal'
            ];

            const sensorStatesResult = await homeAssistantService.getMultipleStates(sensorEntityIds);
            const sensorStates = sensorStatesResult.data;
            
            const scriptStatesResult = await homeAssistantService.getMultipleStates(scriptEntityIds);
            const scriptStates = scriptStatesResult.data;

            // ตรวจสอบโหมดจาก sensor.erv_u1_mode และ script last_triggered
            // ใช้ last_triggered ของ script เพื่อระบุโหมดปัจจุบัน (เพราะ script state จะเป็น 'off' เสมอ)
            let mode = 'normal'; // Default
            
            // ตรวจสอบจาก sensor.erv_u1_mode ก่อน
            const modeSensor = sensorStates['sensor.erv_u1_mode'];
            if (modeSensor?.success && modeSensor?.state?.state !== undefined) {
                const modeValue = parseInt(modeSensor.state.state) || 0;
                // ถ้า modeValue เป็น 1 หรือค่าที่ไม่ใช่ 0 ให้เป็น heat mode
                mode = modeValue === 0 ? 'normal' : 'heat';
            }
            
            // ตรวจสอบจาก script last_triggered เพื่อยืนยัน (ถ้า script ถูกเรียกล่าสุด)
            const heatScript = scriptStates['script.erv_u1_mode_heat'];
            const normalScript = scriptStates['script.erv_u1_mode_normal'];
            
            if (heatScript?.success && normalScript?.success) {
                const heatLastTriggered = heatScript.state?.attributes?.last_triggered;
                const normalLastTriggered = normalScript.state?.attributes?.last_triggered;
                
                // ถ้ามี last_triggered ให้เปรียบเทียบว่า script ไหนถูกเรียกล่าสุด
                if (heatLastTriggered && normalLastTriggered) {
                    const heatTime = new Date(heatLastTriggered).getTime();
                    const normalTime = new Date(normalLastTriggered).getTime();
                    // ใช้ script ที่ถูกเรียกล่าสุด
                    mode = heatTime > normalTime ? 'heat' : 'normal';
                } else if (heatLastTriggered && !normalLastTriggered) {
                    mode = 'heat';
                } else if (normalLastTriggered && !heatLastTriggered) {
                    mode = 'normal';
                }
            }

            // ตรวจสอบระดับจาก sensor.erv_u1_air
            // 1 = low, 2 = medium, 3 = high (หรือค่าอื่นตามที่ตั้งค่า)
            // แต่ API รองรับแค่ 'low' และ 'high' เท่านั้น
            let speed = 'low'; // Default
            const airSensor = sensorStates['sensor.erv_u1_air'];
            if (airSensor?.success && airSensor?.state?.state !== undefined) {
                const airValue = parseInt(airSensor.state.state) || 1;
                // แปลงค่า: 1 = low, 2 หรือ 3 = high (API รองรับแค่ low/high)
                speed = airValue >= 2 ? 'high' : 'low';
            }

            const settings = {
                mode: mode,
                speed: speed
            };

            // Log สำหรับ debug
            console.log(`[HomeAssistantSync] ERV ${deviceId} (${mapping.entityId}) state:`, {
                power: haState.state,
                isOn: isOn,
                mode: mode,
                speed: speed,
                sensorStates: {
                    mode: modeSensor?.state?.state,
                    air: airSensor?.state?.state
                },
                scriptLastTriggered: {
                    heat: heatScript?.state?.attributes?.last_triggered,
                    normal: normalScript?.state?.attributes?.last_triggered
                }
            });

            // บันทึกลง DB
            await DeviceState.setDeviceState(
                mapping.roomId,
                mapping.deviceType,
                mapping.deviceIndex,
                isOn,
                settings
            );

            console.log(`[HomeAssistantSync] Synced ERV ${deviceId} (${mapping.entityId}): ${isOn ? 'ON' : 'OFF'}, mode=${mode}, speed=${speed}`);

            return {
                success: true,
                deviceId,
                roomId: mapping.roomId,
                deviceType: mapping.deviceType,
                deviceIndex: mapping.deviceIndex,
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

            // บันทึกลง DB
            await DeviceState.setDeviceState(
                mapping.roomId,
                mapping.deviceType,
                mapping.deviceIndex,
                isOn,
                settings
            );

            console.log(`[HomeAssistantSync] Synced Light ${deviceId} (${mapping.entityId}): ${isOn ? 'ON' : 'OFF'}`);

            return {
                success: true,
                deviceId,
                roomId: mapping.roomId,
                deviceType: mapping.deviceType,
                deviceIndex: mapping.deviceIndex,
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

