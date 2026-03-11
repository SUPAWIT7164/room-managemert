const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

// Set default timezone to Asia/Bangkok (UTC+7)
// This ensures all datetime operations use Asia/Bangkok timezone
// No implicit or automatic timezone conversion will occur
process.env.TZ = 'Asia/Bangkok';
console.log('[Server] Timezone set to:', process.env.TZ);

const app = express();

// Trust proxy (เมื่อรัน behind IIS / reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // List of allowed origins
        const allowedOrigins = [
            'http://localhost',
            'http://localhost:80',
            'http://localhost:8080',
            'http://localhost:8083',
            'http://127.0.0.1',
            'http://127.0.0.1:80',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:8083',
            'https://bms-dev.lanna.co.th',
            'http://bms-dev.lanna.co.th'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Allow other origins (e.g. dev/staging)
        }
    },
    credentials: true
}));
// Set charset for all responses to support Thai characters (must be before express.json)
app.use((req, res, next) => {
    // Set charset for JSON responses
    res.charset = 'utf-8';
    // Override Content-Type only if not already set
    if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    next();
});

// Increase payload size limit for image uploads (50MB to handle base64-encoded images)
// Ensure express.json uses UTF-8 encoding
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Static files for snapshots (IP Camera capture)
app.use('/snapshots', express.static(path.join(__dirname, 'snapshots'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=60');
    }
}));

// Static files for processed images
app.use('/processed-images', express.static(path.join(__dirname, 'storage/processed_images'), {
    setHeaders: (res, filePath) => {
        // Set CORS headers for images
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
    }
}));

// --- Minimal health/ping BEFORE loading routes ---
// So that even if a route module fails to load, these return 200 and server can start under IIS.
app.get('/', (req, res) => res.status(200).json({ status: 'OK', message: 'Room Management API is running', timestamp: new Date().toISOString() }));
app.get('/api', (req, res) => res.status(200).json({ status: 'OK', message: 'Room Management API is running', timestamp: new Date().toISOString() }));
app.get('/api/ping', (req, res) => res.status(200).json({ status: 'OK', message: 'pong' }));
app.get('/ping', (req, res) => res.status(200).json({ status: 'OK', message: 'pong' }));
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Import Routes (try/catch so one failing module does not prevent server start)
const routeLoad = (name, fn) => {
    try {
        return fn();
    } catch (err) {
        console.error('[Server] Failed to load route:', name, err.message);
        return null;
    }
};
const authRoutes = routeLoad('authRoutes', () => require('./routes/authRoutes'));
const userRoutes = routeLoad('userRoutes', () => require('./routes/userRoutes'));
const buildingRoutes = routeLoad('buildingRoutes', () => require('./routes/buildingRoutes'));
const areaRoutes = routeLoad('areaRoutes', () => require('./routes/areaRoutes'));
const roomRoutes = routeLoad('roomRoutes', () => require('./routes/roomRoutes'));
const roomTypeRoutes = routeLoad('roomTypeRoutes', () => require('./routes/roomTypeRoutes'));
const bookingRoutes = routeLoad('bookingRoutes', () => require('./routes/bookingRoutes'));
const deviceRoutes = routeLoad('deviceRoutes', () => require('./routes/deviceRoutes'));
const visitorRoutes = routeLoad('visitorRoutes', () => require('./routes/visitorRoutes'));
const dashboardRoutes = routeLoad('dashboardRoutes', () => require('./routes/dashboardRoutes'));
const approverRoutes = routeLoad('approverRoutes', () => require('./routes/approverRoutes'));
const reportRoutes = routeLoad('reportRoutes', () => require('./routes/reportRoutes'));
const quotaRoutes = routeLoad('quotaRoutes', () => require('./routes/quotaRoutes'));
const faceRoutes = routeLoad('faceRoutes', () => require('./routes/faceRoutes'));
const cctvRoutes = routeLoad('cctvRoutes', () => require('./routes/cctvRoutes'));
const serviceUserRoutes = routeLoad('serviceUserRoutes', () => require('./routes/serviceUserRoutes'));
const environmentRoutes = routeLoad('environmentRoutes', () => require('./routes/environmentRoutes'));
const energyRoutes = routeLoad('energyRoutes', () => require('./routes/energyRoutes'));
const snapshotRoutes = routeLoad('snapshotRoutes', () => require('./routes/snapshotRoutes'));
const floorPlanRoutes = routeLoad('floorPlanRoutes', () => require('./routes/floorPlanRoutes'));

// Use Routes (under /api for direct run and for proxies) — only mount if loaded
if (authRoutes) app.use('/api/auth', authRoutes);
if (userRoutes) app.use('/api/users', userRoutes);
if (buildingRoutes) app.use('/api/buildings', buildingRoutes);
if (areaRoutes) app.use('/api/areas', areaRoutes);
if (roomRoutes) app.use('/api/rooms', roomRoutes);
if (roomTypeRoutes) app.use('/api/room-types', roomTypeRoutes);
if (bookingRoutes) app.use('/api/bookings', bookingRoutes);
if (deviceRoutes) app.use('/api/devices', deviceRoutes);
if (visitorRoutes) app.use('/api/visitors', visitorRoutes);
if (dashboardRoutes) app.use('/api/dashboard', dashboardRoutes);
if (approverRoutes) app.use('/api/approvers', approverRoutes);
if (reportRoutes) app.use('/api/reports', reportRoutes);
if (quotaRoutes) app.use('/api/quotas', quotaRoutes);
app.get('/api/booking/quotas', (req, res) => res.json({ success: true, data: [] }));
if (faceRoutes) app.use('/api/face', faceRoutes);
if (cctvRoutes) app.use('/api/cctv', cctvRoutes);
if (serviceUserRoutes) app.use('/api/service-users', serviceUserRoutes);
if (environmentRoutes) app.use('/api/environment', environmentRoutes);
if (energyRoutes) app.use('/api/energy', energyRoutes);
if (snapshotRoutes) app.use('/api/snapshot', snapshotRoutes);
if (floorPlanRoutes) app.use('/api/floor-plan', floorPlanRoutes);

// When behind IIS Application "api", path is relative (e.g. /auth/login not /api/auth/login)
if (authRoutes) app.use('/auth', authRoutes);
if (userRoutes) app.use('/users', userRoutes);
if (buildingRoutes) app.use('/buildings', buildingRoutes);
if (areaRoutes) app.use('/areas', areaRoutes);
if (roomRoutes) app.use('/rooms', roomRoutes);
if (roomTypeRoutes) app.use('/room-types', roomTypeRoutes);
if (bookingRoutes) app.use('/bookings', bookingRoutes);
if (deviceRoutes) app.use('/devices', deviceRoutes);
if (visitorRoutes) app.use('/visitors', visitorRoutes);
if (dashboardRoutes) app.use('/dashboard', dashboardRoutes);
if (approverRoutes) app.use('/approvers', approverRoutes);
if (reportRoutes) app.use('/reports', reportRoutes);
if (quotaRoutes) app.use('/quotas', quotaRoutes);
app.get('/booking/quotas', (req, res) => res.json({ success: true, data: [] }));
if (faceRoutes) app.use('/face', faceRoutes);
if (cctvRoutes) app.use('/cctv', cctvRoutes);
if (serviceUserRoutes) app.use('/service-users', serviceUserRoutes);
if (environmentRoutes) app.use('/environment', environmentRoutes);
if (energyRoutes) app.use('/energy', energyRoutes);
if (snapshotRoutes) app.use('/snapshot', snapshotRoutes);
if (floorPlanRoutes) app.use('/floor-plan', floorPlanRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    
    // Check for database connection errors
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return res.status(503).json({ 
            success: false, 
            message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้งในภายหลัง',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
    
    // Default error response
    res.status(err.status || 500).json({ 
        success: false, 
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// รองรับทั้งการรันตรง (port 5000) และภายใต้ IIS/iisnode (process.env.PORT)
const PORT = process.env.PORT || 5000;

// Start server (database connection will be tested when needed)
const server = app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 API URL: http://localhost:${PORT}/api`);
    console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(50));
    
    // Test database connection asynchronously
    const { testConnection } = require('./config/database');
    testConnection().then(connected => {
        if (connected) {
            console.log('✅ Database connection successful');
        } else {
            console.log('⚠️  Database connection failed - some features may not work');
            console.log('   💡 Tip: ตรวจสอบการตั้งค่าในไฟล์ .env และ SQL Server service');
        }
    }).catch(error => {
        console.log('⚠️  Database connection error:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.log('   💡 Tip: ตรวจสอบว่า SQL Server service กำลังทำงานอยู่');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('   💡 Tip: ตรวจสอบ DB_HOST และ DB_PORT ในไฟล์ .env');
        }
    });
});

// Handle port already in use error
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error('💡 Please stop the other process or use a different port.');
        process.exit(1);
    } else {
        throw err;
    }
});

module.exports = app;



