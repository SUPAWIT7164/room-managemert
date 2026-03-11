const { pool } = require('../config/database');

class Building {
    static async findAll(options = {}) {
        let query = 'SELECT * FROM buildings';
        const params = [];
        const conditions = [];

        if (options.search) {
            conditions.push('(name LIKE ? OR name_en LIKE ?)');
            const searchTerm = `%${options.search}%`;
            params.push(searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY name ASC';

        const [rows] = await pool.query(query, params);
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM buildings WHERE id = ?', [id]);
        return rows[0];
    }

    static async findWithAreas(id) {
        const building = await this.findById(id);
        if (!building) return null;

        const [areas] = await pool.query('SELECT * FROM areas WHERE building_id = ? AND disable = 0 ORDER BY name', [id]);
        building.areas = areas;
        return building;
    }

    /**
     * ดึงอาคารจากตาราง buildings พร้อมรายการชั้น (floors) จากตาราง areas คอลัมน์ floor
     * และจำนวนห้อง (count) จาก rooms
     * ใช้สำหรับหน้า rooms/control แสดงรายการอาคาร > ชั้น > จำนวนห้อง
     */
    static async findAllWithFloorsAndRoomCount(options = {}) {
        const buildings = await this.findAll(options);
        if (!buildings || buildings.length === 0) return buildings;

        for (const building of buildings) {
            const [areas] = await pool.query(
                'SELECT id, floor FROM areas WHERE building_id = ? AND (disable = 0 OR disable IS NULL) ORDER BY COALESCE(floor, 0) ASC',
                [building.id]
            );
            const floorMap = {};
            for (const area of areas) {
                const floorNum = area.floor != null ? Number(area.floor) : 0;
                if (!floorMap[floorNum]) {
                    floorMap[floorNum] = { floor: floorNum, count: 0 };
                }
                const [countRows] = await pool.query(
                    'SELECT COUNT(*) as cnt FROM rooms WHERE area_id = ? AND (disable = 0 OR disable IS NULL)',
                    [area.id]
                );
                floorMap[floorNum].count += Number(countRows[0]?.cnt || 0);
            }
            building.floors = Object.values(floorMap).sort((a, b) => a.floor - b.floor);
        }
        return buildings;
    }

    static async create(data) {
        // Table has: name, code (NOT NULL) — no name_en. Use OUTPUT INSERTED.id to get id in one query.
        const name = data.name != null ? String(data.name).trim() : '';
        const codeRaw = data.code != null ? String(data.code).trim() : '';
        const code = codeRaw || name || 'BLD';
        let rows;
        try {
            [rows] = await pool.query(
                'INSERT INTO buildings (name, code) OUTPUT INSERTED.id VALUES (?, ?)',
                [name, code]
            );
        } catch (err) {
            throw err;
        }
        const row = rows && rows[0];
        const id = row && (row.id != null ? Number(row.id) : Number(row[Object.keys(row)[0]]));
        if (!id || Number.isNaN(id)) return { id: null, ...data };
        return this.findById(id);
    }

    static async update(id, data) {
        const updates = [];
        const params = [];

        const allowedFields = ['name', 'name_en', 'image'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(data[field]);
            }
        }

        if (updates.length === 0) return null;

        params.push(id);
        await pool.query(`UPDATE buildings SET ${updates.join(', ')} WHERE id = ?`, params);
        return this.findById(id);
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM buildings WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async count() {
        const [rows] = await pool.query('SELECT COUNT(*) as total FROM buildings');
        return rows[0].total;
    }
}

module.exports = Building;
