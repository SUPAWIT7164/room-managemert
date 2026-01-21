# Room Booking System - Final Booking

ระบบจองห้องประชุมออนไลน์ที่พัฒนาด้วย Vue.js 3 และ Vuexy Admin Template

## ✨ Features

### 🔐 Authentication & Authorization
- ระบบ Login/Register
- JWT Authentication
- Role-based access control (Super Admin, Admin, User)

### 🏠 Building Management
- จัดการอาคาร (CRUD)
- จัดการพื้นที่/ชั้น (Areas)

### 📅 Booking System
- จองห้องประชุมออนไลน์
- ปฏิทินแสดงการจอง (FullCalendar)
- ตรวจสอบการจองซ้ำซ้อนอัตโนมัติ
- ระบบอนุมัติ/ปฏิเสธการจอง
- Auto-approve สำหรับห้องที่กำหนด
- Auto-cancel feature

### 🏢 Room Management
- จัดการห้องประชุม (CRUD)
- กำหนดประเภทห้อง (Room Types)
- Room Permissions
- Room Schedules
- Room Image Upload
- Automation Status
- Control Door

### 👥 User Management
- จัดการผู้ใช้งาน
- กำหนด Role (Super Admin, Admin, User)
- เปิด/ปิดการใช้งานบัญชี

### 📱 Device Management
- จัดการอุปกรณ์
- ระบบยืม-คืนอุปกรณ์

### 🚶 Visitor Management
- ลงทะเบียนผู้เยี่ยมชม
- อนุมัติ/ปฏิเสธ

### 📊 Dashboard
- สถิติภาพรวม
- การจองวันนี้
- สถานะห้องประชุม

### 📈 Reports
- Booking Report
- Access Report
- Room Usage Summary

### 🎥 CCTV Integration
- ดูภาพจาก CCTV

### 👤 Face Recognition
- ลงทะเบียนใบหน้า
- ตรวจสอบใบหน้า

## 🛠️ Technology Stack

### Backend
- **Node.js** + **Express.js** - Web Framework
- **MySQL** - Database (smart_room_booking)
- **JWT** - Authentication
- **bcryptjs** - Password Hashing
- **MVC Architecture**

### Frontend
- **Vue.js 3** - Frontend Framework
- **Vue Router** - Routing (file-based routing with vue-router/auto)
- **Pinia** - State Management
- **Vuetify 3** - UI Component Framework
- **Vuexy Admin Template** - Admin Template
- **FullCalendar** - Calendar Component
- **Axios** - HTTP Client
- **Vite** - Build Tool

## 📁 Project Structure

```
Final-Booking/
├── backend/                 # Node.js Backend
│   ├── config/             # Database configuration
│   ├── controllers/        # Route controllers (MVC)
│   ├── middleware/         # Authentication middleware
│   ├── models/             # Database models (MVC)
│   ├── routes/             # API routes
│   └── server.js           # Entry point
│
└── frontend/               # Vue.js Frontend (Vuexy Template)
    ├── public/
    └── src/
        ├── @core/          # Core components and utilities
        ├── @layouts/       # Layout components
        ├── assets/         # Images and styles
        ├── components/     # Reusable components
        ├── composables/    # Composables
        ├── layouts/        # Layout templates
        ├── navigation/     # Navigation menu configuration
        ├── pages/          # Page components (file-based routing)
        ├── plugins/        # Plugins (router, pinia, vuetify, etc.)
        ├── stores/         # Pinia stores
        └── utils/          # Utility functions
```

## 🚀 Installation

### Prerequisites
- Node.js 18+
- MySQL 8+ (ใช้ database smart_room_booking)
- npm or pnpm

### Backend Setup

1. ไปยังโฟลเดอร์ backend:
```bash
cd backend
```

2. ติดตั้ง dependencies:
```bash
npm install
```

3. สร้างไฟล์ `.env` และตั้งค่า:
```
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=smart_room_booking
DB_USER=root
DB_PASSWORD=

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
```

4. รันเซิร์ฟเวอร์:
```bash
npm run dev
```

Backend จะรันที่ http://localhost:5000

### Frontend Setup

1. ไปยังโฟลเดอร์ frontend:
```bash
cd frontend
```

2. ติดตั้ง dependencies:
```bash
npm install
# or
pnpm install
```

3. สร้างไฟล์ `.env`:
```
VITE_API_BASE_URL=http://localhost:5000/api
```

4. รัน development server:
```bash
npm run dev
# or
pnpm dev
```

Frontend จะรันที่ http://localhost:5173 (หรือ port อื่นที่ Vite กำหนด)

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Get profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

### Buildings
- `GET /api/buildings` - Get all buildings
- `POST /api/buildings` - Create building
- `PUT /api/buildings/:id` - Update building
- `DELETE /api/buildings/:id` - Delete building

### Areas
- `GET /api/areas` - Get all areas
- `POST /api/areas` - Create area
- `PUT /api/areas/:id` - Update area
- `DELETE /api/areas/:id` - Delete area

### Rooms
- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room
- `GET /api/rooms/:id/permissions` - Get room permissions
- `POST /api/rooms/:id/permissions` - Add room permissions
- `GET /api/rooms/:id/schedules` - Get room schedules
- `POST /api/rooms/:id/schedules` - Create room schedule
- `POST /api/rooms/:id/control-door` - Control door
- `PUT /api/rooms/:id/automation` - Update automation status
- `POST /api/rooms/:id/upload-image` - Upload room image

### Bookings
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create booking
- `POST /api/bookings/:id/approve` - Approve booking
- `POST /api/bookings/:id/reject` - Reject booking
- `POST /api/bookings/:id/cancel` - Cancel booking
- `PUT /api/bookings/:id/auto-cancel` - Set auto-cancel
- `POST /api/bookings/upload` - Upload bookings

### Dashboard
- `GET /api/dashboard/stats` - Get statistics

### Reports
- `POST /api/reports/booking` - Booking report
- `POST /api/reports/access` - Access report
- `POST /api/reports/room-usage-summary` - Room usage summary

## 🎨 UI/UX Features

- 🌙 Dark Mode support (Vuetify theme)
- 📱 Responsive design
- 🎯 Modern Material Design 3
- ✨ Smooth animations
- 🔔 Toast notifications
- 📅 Interactive calendar

## 📄 License

MIT License

## 🔗 Related Projects

- Original Vue Room Booking: `C:\demo-room-booking\Final-Booking\vue-room-booking\vue-room-booking`
- Vuexy Template: `C:\demo-room-booking\Final-Booking\vuexy-admin-v10.11.1\vue-version\javascript-version\full-version`
















