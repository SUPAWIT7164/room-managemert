const { pool } = require('../config/database');

let _lastSyncedLogId = 0;

/**
 * Find peoplecount device_id for a given camera_id.
 * Mapping: image_processing_logs.camera_id → cctv_cameras.id → devices (device_type='peoplecount') in same room/area
 * Fallback: first device with device_type='peoplecount'
 */
async function _resolveDeviceId(cameraId) {
    if (!cameraId) return null;

    const [rows] = await pool.query(
        `SELECT TOP 1 d.id
         FROM devices d
         WHERE (d.device_type = 'peoplecount' OR d.device_type_id IN (15,16))
         ORDER BY d.id`,
    );
    return rows?.[0]?.id ?? null;
}

/**
 * Sync new records from image_processing_logs → people_count table.
 * Only inserts records with id > lastSyncedLogId to avoid duplicates.
 */
async function syncFromImageProcessingLogs() {
    try {
        if (_lastSyncedLogId === 0) {
            const [maxRows] = await pool.query(
                `SELECT ISNULL(MAX(source_log_id), 0) AS last_id FROM people_count`
            );
            _lastSyncedLogId = Number(maxRows?.[0]?.last_id) || 0;
        }

        const [logs] = await pool.query(
            `SELECT id, camera_id, people_count, faces_count, confidence, created_at
             FROM image_processing_logs
             WHERE id > ? AND status = 'success'
             ORDER BY id ASC`,
            [_lastSyncedLogId]
        );

        if (!logs || logs.length === 0) return { inserted: 0 };

        // Resolve device_id once per unique camera_id (cache in memory)
        const deviceIdCache = {};
        const uniqueCameras = [...new Set(logs.map(l => l.camera_id))];
        for (const camId of uniqueCameras) {
            deviceIdCache[camId] = await _resolveDeviceId(camId);
        }

        let inserted = 0;
        for (const log of logs) {
            const deviceId = deviceIdCache[log.camera_id];
            if (!deviceId) {
                console.warn(`[PeopleCountSync] No peoplecount device for camera_id=${log.camera_id}, skip log id=${log.id}`);
                _lastSyncedLogId = Number(log.id);
                continue;
            }

            await pool.execute(
                `INSERT INTO people_count (device_id, people_count, faces_count, confidence, source_log_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, SYSDATETIME())`,
                [
                    deviceId,
                    log.people_count ?? 0,
                    log.faces_count ?? 0,
                    log.confidence ?? null,
                    Number(log.id),
                    log.created_at || new Date()
                ]
            );
            inserted++;
            _lastSyncedLogId = Number(log.id);
        }

        if (inserted > 0) {
            console.log(`[PeopleCountSync] Synced ${inserted} records (last log id: ${_lastSyncedLogId})`);
        }
        return { inserted, lastLogId: _lastSyncedLogId };
    } catch (err) {
        console.error('[PeopleCountSync] sync error:', err.message);
        return { inserted: 0, error: err.message };
    }
}

/**
 * Get latest people_count for a given device_id
 */
async function getLatestByDeviceId(deviceId) {
    const [rows] = await pool.query(
        `SELECT TOP 1 pc.people_count, pc.faces_count, pc.confidence, pc.created_at
         FROM people_count pc
         WHERE pc.device_id = ?
         ORDER BY pc.id DESC`,
        [deviceId]
    );
    if (!rows || rows.length === 0) return null;
    return {
        people_count: Number(rows[0].people_count),
        faces_count: Number(rows[0].faces_count),
        confidence: rows[0].confidence != null ? Number(rows[0].confidence) : null,
        recorded_at: rows[0].created_at,
    };
}

/**
 * Get latest people_count for a given room_id (via devices table)
 */
async function getLatestByRoomId(roomId) {
    const [rows] = await pool.query(
        `SELECT TOP 1 pc.people_count, pc.faces_count, pc.confidence, pc.created_at, d.id as device_id
         FROM people_count pc
         INNER JOIN devices d ON pc.device_id = d.id
         WHERE d.room_id = ?
           AND (d.device_type = 'peoplecount' OR d.device_type_id IN (15,16))
         ORDER BY pc.id DESC`,
        [roomId]
    );
    if (!rows || rows.length === 0) return null;
    return {
        people_count: Number(rows[0].people_count),
        faces_count: Number(rows[0].faces_count),
        confidence: rows[0].confidence != null ? Number(rows[0].confidence) : null,
        recorded_at: rows[0].created_at,
        device_id: rows[0].device_id,
    };
}

/**
 * Get latest people_count globally (most recent record)
 */
async function getLatestGlobal() {
    const [rows] = await pool.query(
        `SELECT TOP 1 pc.people_count, pc.faces_count, pc.confidence, pc.created_at, pc.device_id
         FROM people_count pc
         ORDER BY pc.id DESC`
    );
    if (!rows || rows.length === 0) return null;
    return {
        people_count: Number(rows[0].people_count),
        faces_count: Number(rows[0].faces_count),
        confidence: rows[0].confidence != null ? Number(rows[0].confidence) : null,
        recorded_at: rows[0].created_at,
        device_id: rows[0].device_id,
    };
}

module.exports = {
    syncFromImageProcessingLogs,
    getLatestByDeviceId,
    getLatestByRoomId,
    getLatestGlobal,
};
