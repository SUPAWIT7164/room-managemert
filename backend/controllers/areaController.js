const { Area, Building, Room } = require('../models');

exports.getAll = async (req, res) => {
    try {
        console.log('Fetching areas...');
        const areas = await Area.findAll();
        console.log('Areas fetched successfully:', areas ? areas.length : 0);
        
        res.json({
            success: true,
            data: areas || []
        });
    } catch (error) {
        console.error('Error in getAll:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        
        // Return empty array instead of error if table doesn't exist
        if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42S02') {
            console.warn('Areas table does not exist, returning empty array');
            return res.json({
                success: true,
                data: []
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findById(id);
        
        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.getWithRooms = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findWithRooms(id);
        
        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area with rooms:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.create = async (req, res) => {
    try {
        const { name, building_id, floor, description } = req.body;

        if (!name || !building_id) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อและอาคาร'
            });
        }

        const newArea = await Area.create({
            name,
            building_id,
            floor,
            description
        });

        res.status(201).json({
            success: true,
            message: 'สร้างพื้นที่สำเร็จ',
            data: newArea
        });
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างพื้นที่',
            error: error.message
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updated = await Area.update(id, updateData);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการอัปเดต'
            });
        }

        res.json({
            success: true,
            message: 'อัปเดตพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error updating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตพื้นที่',
            error: error.message
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Area.delete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบพื้นที่',
            error: error.message
        });
    }
};

exports.getAll = async (req, res) => {
    try {
        console.log('Fetching areas...');
        const areas = await Area.findAll();
        console.log('Areas fetched successfully:', areas ? areas.length : 0);
        
        res.json({
            success: true,
            data: areas || []
        });
    } catch (error) {
        console.error('Error in getAll:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        
        // Return empty array instead of error if table doesn't exist
        if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42S02') {
            console.warn('Areas table does not exist, returning empty array');
            return res.json({
                success: true,
                data: []
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findById(id);
        
        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.getWithRooms = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findWithRooms(id);
        
        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ระบุ'
            });
        }

        res.json({
            success: true,
            data: area
        });
    } catch (error) {
        console.error('Error fetching area with rooms:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        });
    }
};

exports.create = async (req, res) => {
    try {
        const { name, building_id, floor, description } = req.body;

        if (!name || !building_id) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุชื่อและอาคาร'
            });
        }

        const newArea = await Area.create({
            name,
            building_id,
            floor,
            description
        });

        res.status(201).json({
            success: true,
            message: 'สร้างพื้นที่สำเร็จ',
            data: newArea
        });
    } catch (error) {
        console.error('Error creating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสร้างพื้นที่',
            error: error.message
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updated = await Area.update(id, updateData);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการอัปเดต'
            });
        }

        res.json({
            success: true,
            message: 'อัปเดตพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error updating area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการอัปเดตพื้นที่',
            error: error.message
        });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Area.delete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบพื้นที่ที่ต้องการลบ'
            });
        }

        res.json({
            success: true,
            message: 'ลบพื้นที่สำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting area:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการลบพื้นที่',
            error: error.message
        });
    }
};
