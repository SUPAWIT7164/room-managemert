const { pool } = require('../config/database');
const DeviceState = require('../models/DeviceState');
const { getControllableDeviceTypes } = require('../config/deviceTypes');

class ControllableDeviceController {
  /**
   * GET /api/rooms/:roomId/controllable-devices
   * List controllable devices (light, ac, erv, vent_fan) for a room
   */
  async getByRoom(req, res) {
    try {
      const roomId = parseInt(req.params.roomId);
      if (!roomId) {
        return res.status(400).json({ success: false, message: 'roomId is required' });
      }

      const [rows] = await pool.query(
        `SELECT id, room_id, device_type, name, code, entity_id, x, y, created_at, updated_at
         FROM devices
         WHERE room_id = ? AND device_type IN ('light','ac','erv','vent_fan')
         ORDER BY device_type, id`,
        [roomId]
      );

      const deviceTypes = getControllableDeviceTypes();

      const devices = (rows || []).map(row => {
        const typeInfo = deviceTypes.find(t => t.key === row.device_type) || {};
        return {
          ...row,
          typeLabel: typeInfo.label || row.device_type,
          typeIcon: typeInfo.icon || 'tabler-device-unknown',
        };
      });

      res.json({ success: true, data: devices });
    } catch (error) {
      console.error('[ControllableDevice] getByRoom error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/rooms/:roomId/controllable-devices
   * Add a controllable device to a room
   * Body: { device_type, name, entity_id, x?, y? }
   */
  async addDevice(req, res) {
    try {
      const roomId = parseInt(req.params.roomId);
      if (!roomId) {
        return res.status(400).json({ success: false, message: 'roomId is required' });
      }

      const { device_type, name, entity_id, x, y } = req.body;

      const validTypes = ['light', 'ac', 'erv', 'vent_fan'];
      if (!validTypes.includes(device_type)) {
        return res.status(400).json({
          success: false,
          message: `device_type ต้องเป็น ${validTypes.join(', ')}`,
        });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'name is required' });
      }
      if (!entity_id || !entity_id.trim()) {
        return res.status(400).json({ success: false, message: 'entity_id is required' });
      }

      const code = `CTRL-${device_type.toUpperCase()}-${Date.now()}`;
      const xVal = x != null ? Number(x) : null;
      const yVal = y != null ? Number(y) : null;

      const [result] = await pool.query(
        `INSERT INTO devices (room_id, device_type, name, code, entity_id, x, y, device_category, status, disable, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'control', 'active', 0, GETDATE(), GETDATE())`,
        [roomId, device_type, name.trim(), code, entity_id.trim(), xVal, yVal]
      );

      const insertedId = result.insertId;

      await DeviceState.upsertRoomStateByDeviceId(roomId, insertedId, device_type, false, null);

      const [inserted] = await pool.query('SELECT * FROM devices WHERE id = ?', [insertedId]);

      const deviceTypes = getControllableDeviceTypes();
      const typeInfo = deviceTypes.find(t => t.key === device_type) || {};

      res.status(201).json({
        success: true,
        message: `เพิ่มอุปกรณ์ "${name}" สำเร็จ`,
        data: {
          ...(inserted[0] || {}),
          typeLabel: typeInfo.label || device_type,
          typeIcon: typeInfo.icon || 'tabler-device-unknown',
        },
      });
    } catch (error) {
      console.error('[ControllableDevice] addDevice error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/rooms/:roomId/controllable-devices/:deviceId
   * Update a controllable device
   * Body: { name?, entity_id?, x?, y? }
   */
  async updateDevice(req, res) {
    try {
      const roomId = parseInt(req.params.roomId);
      const deviceId = parseInt(req.params.deviceId);

      const [existing] = await pool.query(
        `SELECT * FROM devices WHERE id = ? AND room_id = ? AND device_type IN ('light','ac','erv','vent_fan')`,
        [deviceId, roomId]
      );
      if (!existing || existing.length === 0) {
        return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์' });
      }

      const { name, entity_id, x, y } = req.body;
      const updates = [];
      const params = [];

      if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
      if (entity_id !== undefined) { updates.push('entity_id = ?'); params.push(entity_id.trim()); }
      if (x !== undefined) { updates.push('x = ?'); params.push(x != null ? Number(x) : null); }
      if (y !== undefined) { updates.push('y = ?'); params.push(y != null ? Number(y) : null); }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่จะอัปเดต' });
      }

      updates.push('updated_at = GETDATE()');
      params.push(deviceId, roomId);

      await pool.query(
        `UPDATE devices SET ${updates.join(', ')} WHERE id = ? AND room_id = ?`,
        params
      );

      const [updated] = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);

      res.json({
        success: true,
        message: 'อัปเดตอุปกรณ์สำเร็จ',
        data: updated[0] || {},
      });
    } catch (error) {
      console.error('[ControllableDevice] updateDevice error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /api/rooms/:roomId/controllable-devices/:deviceId
   * Remove a controllable device
   */
  async removeDevice(req, res) {
    try {
      const roomId = parseInt(req.params.roomId);
      const deviceId = parseInt(req.params.deviceId);

      const [existing] = await pool.query(
        `SELECT * FROM devices WHERE id = ? AND room_id = ? AND device_type IN ('light','ac','erv','vent_fan')`,
        [deviceId, roomId]
      );
      if (!existing || existing.length === 0) {
        return res.status(404).json({ success: false, message: 'ไม่พบอุปกรณ์' });
      }

      const device = existing[0];

      await DeviceState.deleteStateByDeviceId(deviceId);
      await pool.query('DELETE FROM devices WHERE id = ?', [deviceId]);

      res.json({
        success: true,
        message: `ลบอุปกรณ์ "${device.name}" สำเร็จ`,
      });
    } catch (error) {
      console.error('[ControllableDevice] removeDevice error:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ControllableDeviceController();
