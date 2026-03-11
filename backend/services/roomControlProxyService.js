const axios = require('axios');
const { pool } = require('../config/database');

const CONTROL_API_CONTROL_URL = process.env.CONTROL_API_CONTROL_URL || '';
const CONTROL_API_STATUS_URL = process.env.CONTROL_API_STATUS_URL || '';
const CONTROL_API_BEARER_TOKEN = process.env.CONTROL_API_BEARER_TOKEN || '';
const CONTROL_API_TIMEOUT_MS = Number(process.env.CONTROL_API_TIMEOUT_MS || 8000);

const http = axios.create({
  timeout: Number.isFinite(CONTROL_API_TIMEOUT_MS) ? CONTROL_API_TIMEOUT_MS : 8000,
});

function isControlEnabled() {
  return Boolean(String(CONTROL_API_CONTROL_URL).trim());
}

function isStatusEnabled() {
  return Boolean(String(CONTROL_API_STATUS_URL).trim());
}

function authHeaders() {
  if (!CONTROL_API_BEARER_TOKEN) return {};
  return { Authorization: `Bearer ${CONTROL_API_BEARER_TOKEN}` };
}

async function getRoomContext(roomId) {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        r.id AS room_id,
        r.name AS room_name,
        a.id AS area_id,
        a.name AS area_name,
        a.floor AS floor,
        b.id AS building_id,
        b.name AS building_name
      FROM rooms r
      LEFT JOIN areas a ON r.area_id = a.id
      LEFT JOIN buildings b ON a.building_id = b.id
      WHERE r.id = ?
      `,
      [roomId],
    );

    if (!rows || rows.length === 0) return { room_id: roomId };
    return rows[0];
  } catch (err) {
    // Don't block control just because context lookup failed
    return { room_id: roomId, context_error: err.message };
  }
}

/**
 * Forward a control command to the real control API (if configured).
 * The real API shape is intentionally configurable; we send a stable payload.
 */
async function controlDeviceByRoomId({ roomId, deviceType, deviceIndex, status, settings, requestedBy }) {
  if (!isControlEnabled()) {
    return { skipped: true, reason: 'CONTROL_API_CONTROL_URL not set' };
  }

  const context = await getRoomContext(roomId);
  
  // Convert boolean status to string action for API compatibility
  const action = status === true || status === 1 || status === 'on' || status === 'true' ? 'on' : 'off';
  
  const payload = {
    context,
    roomId,
    deviceType,
    // null means "all devices of this type"
    deviceIndex: deviceIndex === null || deviceIndex === undefined ? null : deviceIndex,
    status: status, // Keep original status for backward compatibility
    action: action, // Add action string for API compatibility
    settings: settings || null,
    requestedBy: requestedBy || null,
    timestamp: new Date().toISOString(),
  };

  console.log('[roomControlProxyService] Sending control command to real API:', {
    url: CONTROL_API_CONTROL_URL,
    payload: JSON.stringify(payload, null, 2),
  });

  try {
    const resp = await http.post(CONTROL_API_CONTROL_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
    });

    console.log('[roomControlProxyService] Control API response:', {
      status: resp.status,
      data: resp.data,
    });

    return resp.data;
  } catch (error) {
    console.error('[roomControlProxyService] Control API error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      payload: JSON.stringify(payload, null, 2),
    });
    throw error;
  }
}

/**
 * Fetch device states from the real control API (if configured).
 * Expected (preferred) shapes:
 *  - { success: true, data: { deviceStates: { light: [], ac: [], erv: [] } } }
 *  - { deviceStates: { ... } }
 *  - { light: [...], ac: [...], erv: [...] }  (will be wrapped)
 */
async function fetchDeviceStatesByRoomId({ roomId }) {
  if (!isStatusEnabled()) {
    return { skipped: true, reason: 'CONTROL_API_STATUS_URL not set' };
  }

  const context = await getRoomContext(roomId);

  const resp = await http.get(CONTROL_API_STATUS_URL, {
    params: {
      roomId,
      building: context.building_id,
      floor: context.floor,
      area: context.area_name,
      room: context.room_name || context.room_id,
    },
    headers: {
      ...authHeaders(),
    },
  });

  const data = resp.data;
  const deviceStates =
    data?.data?.deviceStates
    || data?.deviceStates
    || (data?.light || data?.ac || data?.erv ? { light: data.light, ac: data.ac, erv: data.erv } : null);

  return {
    ...data,
    deviceStates,
  };
}

module.exports = {
  isControlEnabled,
  isStatusEnabled,
  controlDeviceByRoomId,
  fetchDeviceStatesByRoomId,
};

