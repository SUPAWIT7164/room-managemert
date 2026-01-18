const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // List of allowed origins
        const allowedOrigins = [
            'http://localhost:8080',
            'http://localhost:8083',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:8083'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins in development
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const buildingRoutes = require('./routes/buildingRoutes');
const areaRoutes = require('./routes/areaRoutes');
const roomRoutes = require('./routes/roomRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const approverRoutes = require('./routes/approverRoutes');
const reportRoutes = require('./routes/reportRoutes');
const quotaRoutes = require('./routes/quotaRoutes');
const faceRoutes = require('./routes/faceRoutes');
const cctvRoutes = require('./routes/cctvRoutes');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/approvers', approverRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/quotas', quotaRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/cctv', cctvRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const { testConnection } = require('./config/database');
    const dbStatus = await testConnection();
    
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        database: dbStatus ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

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

// Force port 5000 (override any environment variable)
const PORT = 5000;

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
            console.log('   💡 Tip: ตรวจสอบการตั้งค่าในไฟล์ .env และ MySQL service');
        }
    }).catch(error => {
        console.log('⚠️  Database connection error:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.log('   💡 Tip: ตรวจสอบว่า MySQL service กำลังทำงานอยู่');
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



