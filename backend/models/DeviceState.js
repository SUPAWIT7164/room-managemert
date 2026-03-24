const { pool } = require('../config/database');

/**
 * device_states: ใช้เฉพาะ device_id เป็นหลัก
 * คอลัมน์ device_index อาจยังอยู่ในตาราง (legacy) — เซ็ตเป็น NULL เสมอ ไม่อ่าน/ไม่พึ่งใน logic
 */
class DeviceState {
    /** Ordered devices.id per type for a room (matches getDevices / UI index). */
    static async listRoomDeviceIdsByType(roomId) {
        const [devRows] = await pool.query(
            `SELECT id,
                    LOWER(COALESCE(NULLIF(LTRIM(RTRIM(device_type)), ''), NULLIF(LTRIM(RTRIM(code)), ''))) AS t
             FROM devices
             WHERE room_id = ? AND (disable = 0 OR disable IS NULL)
               AND (
                    LOWER(COALESCE(NULLIF(LTRIM(RTRIM(device_type)), ''), NULLIF(LTRIM(RTRIM(code)), ''))) IN ('light','ac','erv','air','vent_fan','fan','exhaust_fan','ventilation_fan')
               )
             ORDER BY id`,
            [roomId]
        );
        const out = { light: [], ac: [], erv: [], vent_fan: [] };
        (devRows || []).forEach((r) => {
            let t = r.t;
            if (t === 'air') t = 'ac';
            if (t === 'fan' || t === 'exhaust_fan' || t === 'ventilation_fan') t = 'vent_fan';
            if (out[t]) out[t].push(r.id);
        });
        return out;
    }

    /** 0-based position of deviceId in room list for deviceType (external Control API only). */
    static async getRoomDeviceIndexForDeviceId(roomId, deviceType, deviceId) {
        const ids = (await this.listRoomDeviceIdsByType(roomId))[deviceType] || [];
        const idx = ids.indexOf(Number(deviceId));
        return idx >= 0 ? idx : null;
    }

    static async upsertRoomStateByDeviceId(roomId, deviceId, deviceType, status, settings = null) {
        const settingsJson = settings ? JSON.stringify(settings) : null;
        const statusValue = status ? 1 : 0;
        const [existing] = await pool.query(`SELECT id FROM device_states WHERE device_id = ?`, [deviceId]);
        if (existing.length > 0) {
            await pool.query(
                `UPDATE device_states
                 SET status = ?, settings = ?, updated_at = GETDATE(),
                     room_id = ?, area_id = NULL, device_type = ?, device_index = NULL
                 WHERE device_id = ?`,
                [statusValue, settingsJson, roomId, deviceType, deviceId]
            );
        } else {
            await pool.query(
                `INSERT INTO device_states (device_id, room_id, area_id, device_type, device_index, status, settings, created_at, updated_at)
                 VALUES (?, ?, NULL, ?, NULL, ?, ?, GETDATE(), GETDATE())`,
                [deviceId, roomId, deviceType, statusValue, settingsJson]
            );
        }
        return true;
    }

    static async listAreaDeviceIdsByType(areaId) {
        const [rows] = await pool.query(
            `SELECT d.id,
                    LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), NULLIF(LTRIM(RTRIM(d.code)), ''), NULLIF(LTRIM(RTRIM(dt.name)), ''))) AS t
             FROM devices d
             LEFT JOIN device_types dt ON d.device_type_id = dt.id
             WHERE d.area_id = ? AND d.room_id IS NULL
             AND (LOWER(COALESCE(NULLIF(LTRIM(RTRIM(d.device_type)), ''), d.code, dt.name)) IN ('light','ac','erv','air','vent_fan','fan','exhaust_fan','ventilation_fan'))
             AND (d.disable = 0 OR d.disable IS NULL)
             ORDER BY COALESCE(d.device_type, d.code, dt.name), d.id`,
            [areaId]
        );
        const out = { light: [], ac: [], erv: [], vent_fan: [] };
        (rows || []).forEach((r) => {
            let t = r.t;
            if (t === 'air') t = 'ac';
            if (t === 'fan' || t === 'exhaust_fan' || t === 'ventilation_fan') t = 'vent_fan';
            if (out[t]) out[t].push(r.id);
        });
        return out;
    }

    static async getAreaDeviceIndexForDeviceId(areaId, deviceType, deviceId) {
        const ids = (await this.listAreaDeviceIdsByType(areaId))[deviceType] || [];
        const idx = ids.indexOf(Number(deviceId));
        return idx >= 0 ? idx : null;
    }

    static async upsertAreaStateByDeviceId(areaId, deviceId, deviceType, status, settings = null) {
        const settingsJson = settings ? JSON.stringify(settings) : null;
        const statusValue = status ? 1 : 0;
        const [existing] = await pool.query(`SELECT id FROM device_states WHERE device_id = ?`, [deviceId]);
        if (existing.length > 0) {
            await pool.query(
                `UPDATE device_states
                 SET status = ?, settings = ?, updated_at = GETDATE(),
                     area_id = ?, room_id = NULL, device_type = ?, device_index = NULL
                 WHERE device_id = ?`,
                [statusValue, settingsJson, areaId, deviceType, deviceId]
            );
        } else {
            await pool.query(
                `INSERT INTO device_states (device_id, area_id, room_id, device_type, device_index, status, settings, created_at, updated_at)
                 VALUES (?, ?, NULL, ?, NULL, ?, ?, GETDATE(), GETDATE())`,
                [deviceId, areaId, deviceType, statusValue, settingsJson]
            );
        }
        return true;
    }

    static _rowToStateEntry(row, fallbackDeviceId = null) {
        let statusValue = false;
        const raw = row.status;
        if (raw === 1 || raw === true || raw === '1' || raw === 'true') {
            statusValue = true;
        } else if (raw === 0 || raw === false || raw === '0' || raw === 'false') {
            statusValue = false;
        } else if (raw != null) {
            const n = Buffer.isBuffer(raw) ? raw[0] : Number(raw);
            statusValue = !Number.isNaN(n) && n !== 0;
        }
        return {
            device_id: row.device_id != null ? row.device_id : fallbackDeviceId,
            status: statusValue,
            settings: row.settings ? JSON.parse(row.settings) : null,
            updated_at: row.updated_at
        };
    }

    /** Single row from device_states by devices.id */
    static async getStateByDeviceId(deviceId) {
        const [rows] = await pool.query('SELECT * FROM device_states WHERE device_id = ?', [deviceId]);
        if (!rows || rows.length === 0) return null;
        return this._rowToStateEntry(rows[0], deviceId);
    }

    // Get all device states for a room (arrays aligned to ORDER BY devices.id per type)
    static async getByRoom(roomId) {
        const idsByType = await this.listRoomDeviceIdsByType(roomId);
        const [rows] = await pool.query(
            'SELECT * FROM device_states WHERE room_id = ? AND device_id IS NOT NULL',
            [roomId]
        );

        const byDeviceId = new Map();
        (rows || []).forEach((row) => {
            if (row.device_id != null) byDeviceId.set(Number(row.device_id), row);
        });

        const build = (type, ids) =>
            (ids || []).map((id) => {
                const row = byDeviceId.get(Number(id));
                if (!row) {
                    return {
                        device_id: id,
                        status: false,
                        settings: null,
                        updated_at: null
                    };
                }
                return this._rowToStateEntry(row, id);
            });

        const grouped = {
            light: build('light', idsByType.light),
            ac: build('ac', idsByType.ac),
            erv: build('erv', idsByType.erv),
            vent_fan: build('vent_fan', idsByType.vent_fan)
        };

        console.log(`[BACKEND DEBUG] getByRoom: roomId=${roomId}, devices light/ac/erv/vent_fan counts=${grouped.light.length}/${grouped.ac.length}/${grouped.erv.length}/${grouped.vent_fan.length}`);
        return grouped;
    }

    // Set multiple device states at once (aligned to devices.id order for type)
    static async setMultipleStates(roomId, deviceType, states) {
        console.log(`[BACKEND DEBUG] setMultipleStates: roomId=${roomId}, type=${deviceType}, states count=${states.length}`);
        const ids = (await this.listRoomDeviceIdsByType(roomId))[deviceType] || [];
        try {
            for (let i = 0; i < states.length; i++) {
                const deviceId = ids[i];
                if (deviceId == null) {
                    console.warn(`[DeviceState] setMultipleStates: no device id for ${deviceType} index ${i}, skip`);
                    continue;
                }
                await this.upsertRoomStateByDeviceId(roomId, deviceId, deviceType, states[i].status, states[i].settings);
            }
            return true;
        } catch (error) {
            console.error(`[BACKEND DEBUG] Error in setMultipleStates:`, error);
            throw error;
        }
    }

    static async deleteStateByDeviceId(deviceId) {
        const [result] = await pool.query('DELETE FROM device_states WHERE device_id = ?', [deviceId]);
        return result.affectedRows > 0;
    }

    static async deleteByRoom(roomId) {
        const [result] = await pool.query('DELETE FROM device_states WHERE room_id = ?', [roomId]);
        return result.affectedRows;
    }

    // ==================== Area ====================

    static async getByArea(areaId) {
        const idsByType = await this.listAreaDeviceIdsByType(areaId);
        const [rows] = await pool.query(
            'SELECT * FROM device_states WHERE area_id = ? AND device_id IS NOT NULL',
            [areaId]
        );

        const byDeviceId = new Map();
        (rows || []).forEach((row) => {
            if (row.device_id != null) byDeviceId.set(Number(row.device_id), row);
        });

        const build = (type, ids) =>
            (ids || []).map((id) => {
                const row = byDeviceId.get(Number(id));
                if (!row) {
                    return { device_id: id, status: false, settings: null, updated_at: null };
                }
                return this._rowToStateEntry(row, id);
            });

        return {
            light: build('light', idsByType.light),
            ac: build('ac', idsByType.ac),
            erv: build('erv', idsByType.erv),
            vent_fan: build('vent_fan', idsByType.vent_fan)
        };
    }

    static async setMultipleAreaStates(areaId, deviceType, states) {
        console.log(`[BACKEND DEBUG] setMultipleAreaStates: areaId=${areaId}, type=${deviceType}, states count=${states.length}`);
        const ids = (await this.listAreaDeviceIdsByType(areaId))[deviceType] || [];
        for (let i = 0; i < states.length; i++) {
            const deviceId = ids[i];
            if (deviceId == null) continue;
            await this.upsertAreaStateByDeviceId(areaId, deviceId, deviceType, states[i].status, states[i].settings);
        }
        return true;
    }

    static async deleteByArea(areaId) {
        const [result] = await pool.query('DELETE FROM device_states WHERE area_id = ?', [areaId]);
        return result.affectedRows;
    }
}

module.exports = DeviceState;
