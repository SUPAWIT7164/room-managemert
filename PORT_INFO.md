# Port Configuration

## Current Port Usage

- **Backend API**: http://localhost:5000
- **Frontend (New Project)**: http://localhost:8083
- **Frontend (Old Project)**: http://localhost:8080

## How to Access

### New Project (Vuexy Template)
- Frontend: http://localhost:8083
- Backend API: http://localhost:5000/api

### Old Project
- Frontend: http://localhost:8080

## Restart Frontend

หากต้องการ restart frontend server ให้ทำตามขั้นตอน:

1. หยุด frontend server ที่รันอยู่ (Ctrl+C ใน terminal)
2. รันคำสั่ง:
   ```bash
   cd frontend
   npm run dev
   ```

Frontend จะรันที่ port 8083 แทน port 5173

## CORS Configuration

Backend ได้ตั้งค่า CORS ให้รองรับทั้ง port 8080 และ 8083 แล้ว















