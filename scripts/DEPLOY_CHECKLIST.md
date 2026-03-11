# ✅ IIS Deployment Checklist

## ก่อน Deploy

### 1. ตรวจสอบซอฟต์แวร์ที่จำเป็น
- [ ] Node.js (LTS) ติดตั้งแล้ว
- [ ] iisnode ติดตั้งแล้ว ([ดาวน์โหลด](https://github.com/Azure/iisnode/releases))
- [ ] IIS URL Rewrite Module ติดตั้งแล้ว ([ดาวน์โหลด](https://www.iis.net/downloads/microsoft/url-rewrite))

### 2. ตรวจสอบไฟล์ Backend
- [ ] `backend/.env` มีอยู่และตั้งค่าถูกต้อง (DB, JWT, etc.)
- [ ] `backend/web.config` มีอยู่
- [ ] `backend/server.js` มีอยู่

### 3. ตรวจสอบไฟล์ Frontend
- [ ] `frontend/.env.production` มี `VITE_API_BASE_URL=/api`
- [ ] `frontend/public/web.config` มีอยู่

## ขั้นตอน Deploy

### วิธีที่ 1: ใช้สคริปต์ PowerShell (แนะนำ)

```powershell
# 1. เปิด PowerShell as Administrator
# 2. ไปที่โฟลเดอร์ scripts
cd scripts

# 3. รันสคริปต์ (แก้ไข path ตามต้องการ)
.\deploy-to-iis.ps1 -IISPath "C:\inetpub\wwwroot\room-portal" -SiteName "RoomPortal"

# หรือถ้าต้องการข้าม build (ถ้า build แล้ว)
.\deploy-to-iis.ps1 -IISPath "C:\inetpub\wwwroot\room-portal" -SkipBuild

# หรือถ้า Node.js อยู่ที่อื่น
.\deploy-to-iis.ps1 -NodePath "D:\NodeJS\node.exe"
```

### วิธีที่ 2: Deploy แบบ Manual

#### ขั้นตอนที่ 1: Build Frontend
```powershell
cd frontend
npm ci
npm run build
```

#### ขั้นตอนที่ 2: เตรียม Backend
```powershell
cd backend
npm ci --production
```

#### ขั้นตอนที่ 3: คัดลอกไฟล์
- คัดลอกทุกอย่างใน `frontend/dist` ไปยัง `C:\inetpub\wwwroot\room-portal\`
- คัดลอกทุกอย่างใน `backend` ไปยัง `C:\inetpub\wwwroot\room-portal\api\`
  - **ไม่ต้องคัดลอก**: `node_modules`, `.git`, `iisnode`

#### ขั้นตอนที่ 4: ติดตั้ง Backend Dependencies
```powershell
cd C:\inetpub\wwwroot\room-portal\api
npm ci --production
```

## ตั้งค่า IIS

### 1. สร้าง Site
- [ ] เปิด IIS Manager
- [ ] คลิกขวาที่ Sites → Add Website
- [ ] ตั้งค่า:
  - **Site name**: `RoomPortal` (หรือชื่อที่ต้องการ)
  - **Physical path**: `C:\inetpub\wwwroot\room-portal` (หรือ path ที่ deploy)
  - **Binding**: HTTP, Port 80, Host name (ถ้าต้องการ)

### 2. เพิ่ม Application สำหรับ API
- [ ] คลิกขวาที่ Site → Add Application
- [ ] ตั้งค่า:
  - **Alias**: `api`
  - **Physical path**: `C:\inetpub\wwwroot\room-portal\api` (หรือ path ที่ deploy backend)

### 3. ตั้งค่า Application Pool
- [ ] เลือก Application Pool ของ Application `/api`
- [ ] คลิกขวา → Basic Settings
- [ ] ตั้งค่า:
  - **.NET CLR Version**: `No Managed Code`
- [ ] (Optional) คลิกขวา → Advanced Settings → Identity
  - ใช้ account ที่มีสิทธิ์อ่าน/เขียนโฟลเดอร์ที่จำเป็น

### 4. ตั้งค่าสิทธิ์โฟลเดอร์

#### ให้ IIS AppPool และ IUSR อ่านได้:
- [ ] `C:\inetpub\wwwroot\room-portal` (root site)
- [ ] `C:\inetpub\wwwroot\room-portal\api` (backend)

#### ให้ Backend เขียนได้:
- [ ] `C:\inetpub\wwwroot\room-portal\api\public\uploads`
- [ ] `C:\inetpub\wwwroot\room-portal\api\storage\processed_images`
- [ ] `C:\inetpub\wwwroot\room-portal\api\iisnode` (สำหรับ log)

**วิธีตั้งสิทธิ์:**
1. คลิกขวาที่โฟลเดอร์ → Properties → Security
2. คลิก Edit → Add
3. พิมพ์ `IIS AppPool\RoomPortal` (หรือชื่อ AppPool ของคุณ)
4. เลือกสิทธิ์ที่ต้องการ (Read/Write)
5. ทำซ้ำกับ `IUSR` และ `IIS_IUSRS`

## ตรวจสอบหลัง Deploy

### 1. ตรวจสอบ Frontend
- [ ] เปิดเบราว์เซอร์ไปที่ `http://localhost` (หรือ URL ที่ตั้งค่า)
- [ ] หน้าเว็บโหลดได้
- [ ] ไม่มี error ใน Console (F12)

### 2. ตรวจสอบ Backend
- [ ] เปิดเบราว์เซอร์ไปที่ `http://localhost/api/health` (ถ้ามี endpoint นี้)
- [ ] ตรวจสอบ log ที่ `C:\inetpub\wwwroot\room-portal\api\iisnode\`
- [ ] ตรวจสอบ Event Viewer (Windows Logs → Application) ถ้ามี error

### 3. ตรวจสอบ API
- [ ] ทดสอบ login
- [ ] ทดสอบ API endpoints ต่างๆ
- [ ] ตรวจสอบ CORS (ถ้ามีปัญหา)

## แก้ปัญหา

### 502 Bad Gateway
- [ ] ตรวจสอบว่า iisnode ติดตั้งแล้ว
- [ ] ตรวจสอบ path ของ Node.js ใน `backend/web.config`
- [ ] ตรวจสอบว่า `npm ci --production` รันสำเร็จในโฟลเดอร์ backend ที่ deploy
- [ ] ดู log ที่ `api\iisnode\`

### 404 เมื่อรีเฟรชหน้า
- [ ] ตรวจสอบว่า IIS URL Rewrite Module ติดตั้งแล้ว
- [ ] ตรวจสอบว่า `frontend/dist/web.config` มีอยู่และมี SPA fallback rule

### CORS Error
- [ ] ตรวจสอบ `FRONTEND_URL` ใน `backend/.env`
- [ ] ตรวจสอบ CORS config ใน `backend/server.js`

### Permission Denied
- [ ] ตรวจสอบสิทธิ์โฟลเดอร์ (ดูขั้นตอนที่ 4 ด้านบน)
- [ ] ตรวจสอบว่า Application Pool Identity มีสิทธิ์เพียงพอ

## สรุป Physical Path

| Path | Physical Path | หน้าที่ |
|------|---------------|---------|
| `/` (root) | `C:\inetpub\wwwroot\room-portal\` | Frontend (SPA) |
| `/api` | `C:\inetpub\wwwroot\room-portal\api\` | Backend (Node.js) |

---

## อัปเดต bms-dev.lanna.co.th (หน้า /bookings/avaliable ฯลฯ)

เมื่อแก้โค้ด frontend/backend แล้ว ให้เว็บ https://bms-dev.lanna.co.th อัปเดต ทำดังนี้:

### 1. Build Frontend (ในเครื่องคุณ)

```powershell
# วิธีที่ 1: ใช้สคริปต์ (แนะนำ)
cd scripts
.\build-frontend.ps1

# วิธีที่ 2: รันเอง
cd frontend
npm install
npm run build
```

### 2. Deploy ไปเซิร์ฟเวอร์ bms-dev

- **ถ้าใช้สคริปต์ deploy:** แก้ `-IISPath` เป็น path จริงของ bms-dev แล้วรัน `.\deploy-to-iis.ps1 -IISPath " path ของเว็บ bms-dev "`
- **ถ้า deploy เอง:** คัดลอกเนื้อหาใน `frontend\dist` ไปยังโฟลเดอร์ที่เว็บ bms-dev ชี้ (แทนที่ไฟล์เก่า)

### 3. อัปเดต Backend (ถ้าแก้ server.js / controller)

- อัปเดตไฟล์ backend บนเซิร์ฟเวอร์ (เช่น server.js, controllers)
- Restart Application Pool ของ `/api` หรือ restart Node process

### 4. ล้าง Cache ในเบราว์เซอร์

- กด **Ctrl+Shift+R** (Hard refresh) หรือเปิด Incognito แล้วเข้า https://bms-dev.lanna.co.th/bookings/avaliable อีกครั้ง

---

**หมายเหตุ**: แก้ไข path ตามที่คุณ deploy จริง
