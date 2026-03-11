# การ Deploy บน IIS (Internet Information Services)

คู่มือนี้ใช้สำหรับ deploy **Backend (Node.js/Express)** และ **Frontend (Vue/Vite)** บน Windows IIS

---

## สิ่งที่ต้องติดตั้งก่อน

1. **Node.js** (LTS) – [https://nodejs.org](https://nodejs.org)  
   - ตรวจสอบ: `node -v`

2. **iisnode** – โมดูล IIS สำหรับรัน Node.js  
   - [iisnode – GitHub](https://github.com/Azure/iisnode/releases)  
   - หรือ: `webpi` / Chocolatey

3. **URL Rewrite Module** – สำหรับ rewrite rules ใน `web.config`  
   - [Download URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)

---

## โครงสร้างการ Deploy

แนะนำให้ใช้ **2 Applications** ภายใต้ Site เดียว:

| Path | โฟลเดอร์ (Physical Path) | หน้าที่ |
|------|---------------------------|---------|
| `/` (root) | `frontend\dist` | เสิร์ฟ Frontend (SPA) |
| `/api` | `backend` | รัน Backend ผ่าน iisnode |

หรือแยกเป็น **2 Sites** (เช่น พอร์ต 80 สำหรับ frontend, พอร์ต 5000 หรือ host อื่นสำหรับ api) ก็ได้

---

## ขั้นตอนที่ 1: Build Frontend

```powershell
cd frontend
npm ci
npm run build
```

ผลลัพธ์อยู่ที่ `frontend\dist` (รวม `web.config` จาก `public\web.config`)

- ใช้ **same origin** (`/api`): ไฟล์ `.env.production` ควรมี  
  `VITE_API_BASE_URL=/api`  
  (หรือ build ตามที่อธิบายด้านล่าง)
- ถ้า API อยู่คนละ host:  
  `VITE_API_BASE_URL=https://your-api-host/api`  
  แล้ว build:  
  `npm run build`

---

## ขั้นตอนที่ 2: เตรียม Backend

1. คัดลอกโฟลเดอร์ `backend` ไปยังที่ที่ IIS ชี้ (เช่น `C:\inetpub\wwwroot\room-portal\api`)

2. ในโฟลเดอร์ backend ให้มีครบ:
   - `server.js`
   - `web.config`
   - `package.json`
   - `node_modules` (รัน `npm ci --production` ในโฟลเดอร์นั้น)
   - `.env` (คัดลอกจากต้นทางและแก้ค่าให้ตรงกับ server จริง)

3. สร้างโฟลเดอร์ให้ backend เขียนได้ (ถ้าต้องการ):
   - `public\uploads`
   - `storage\processed_images`
   - `iisnode` (สำหรับ log ของ iisnode)

4. รันติดตั้ง dependencies (ในโฟลเดอร์ backend ที่ deploy):

   ```powershell
   npm ci --production
   ```

---

## ขั้นตอนที่ 3: ตั้งค่า IIS

### 3.1 สร้าง Site (หรือใช้ Default Web Site)

1. เปิด **IIS Manager** → Sites
2. Add Website หรือใช้ Site เดิม
3. ตั้งค่า:
   - **Site name:** เช่น `RoomPortal`
   - **Physical path:** ชี้ไปที่ `frontend\dist`
   - **Binding:** เช่น `http`, พอร์ต 80, host name ตามต้องการ

### 3.2 เพิ่ม Application สำหรับ API

1. คลิกขวาที่ Site → **Add Application**
2. ตั้งค่า:
   - **Alias:** `api`
   - **Physical path:** โฟลเดอร์ `backend` (ที่มี `server.js`, `web.config`, `node_modules`)

### 3.3 สิทธิ์และ Application Pool

1. **Application Pool** ของ Application `api`:
   - .NET CLR = **No Managed Code**
   - (Optional) Identity: ใช้ account ที่มีสิทธิ์อ่านโฟลเดอร์ backend และเขียน `uploads`, `storage`, `iisnode`

2. **สิทธิ์โฟลเดอร์**  
   - ให้ IIS AppPool และ IUSR อ่านได้ที่ทั้ง `frontend\dist` และ `backend`  
   - ให้ backend เขียนได้ที่ `public\uploads`, `storage\processed_images`, `iisnode` (ถ้ามี)

---

## โครงสร้างโฟลเดอร์บนเครื่อง Deploy (ตัวอย่าง)

```
C:\inetpub\wwwroot\room-portal\
├── (root = frontend\dist)
│   ├── index.html
│   ├── assets\
│   ├── web.config
│   └── ...
└── api\                    ← Application /api
    ├── server.js
    ├── web.config
    ├── package.json
    ├── .env
    ├── node_modules\
    ├── public\uploads\
    ├── storage\processed_images\
    └── ...
```

---

## การตั้งค่า `VITE_API_BASE_URL` ตอน Build

- **Frontend กับ API อยู่ host เดียวกัน และ API อยู่ที่ `/api`**

  สร้างหรือแก้ `frontend\.env.production`:

  ```
  VITE_API_BASE_URL=/api
  ```

  จากนั้น:

  ```powershell
  cd frontend
  npm run build
  ```

- **API อยู่คนละ host (เช่น `https://api.example.com`)**

  ใช้:

  ```
  VITE_API_BASE_URL=https://api.example.com/api
  ```

  แล้วค่อย `npm run build`

---

## ตรวจสอบและแก้ปัญหา

### 1) เปิด / ดู log ของ iisnode

- ใน `backend\web.config` กำหนด `logDirectory="iisnode"` ไว้แล้ว
- ดูไฟล์ใน `backend\iisnode\` (ถ้า IIS มีสิทธิ์เขียน)

### 2) 502 / 503 จาก Application `/api`

- ตรวจสอบว่าได้รัน `npm ci --production` ในโฟลเดอร์ `backend` ที่ deploy
- ตรวจ path ของ `node` ใน `web.config`:  
  `nodeProcessCommandLine="C:\Program Files\nodejs\node.exe"`  
  ถ้าติดตั้ง Node ไว้ที่อื่น ให้แก้ path ให้ตรง
- ตรวจว่ามีไฟล์ `.env` และค่าสำคัญ (เช่น DB, JWT) ถูกต้อง
- ดู log ใน `iisnode` และ Event Viewer (Windows Logs → Application)

### 3) 404 ตอนรีเฟรชหรือเข้า direct URL ใน Frontend

- ตรวจว่ามี **URL Rewrite** ใน `frontend\dist\web.config` (คัดลอกจาก `frontend\public\web.config`)
- ต้องติดตั้ง **IIS URL Rewrite** และ rule SPA ทำงาน (ส่ง non-file ไปที่ `/`)

### 4) CORS / คุกกี้ / session

- ใน backend ตั้ง `FRONTEND_URL` ใน `.env` ให้ตรงกับ URL ที่เปิด frontend (เช่น `https://your-site.com`)
- ตรวจ `cors` ใน `server.js` ว่ายินยอม origin ที่ใช้จริง (หรือใช้ `FRONTEND_URL` ใน config)

---

## สรุปไฟล์ที่เกี่ยวข้องกับ IIS

| ไฟล์ | หน้าที่ |
|------|---------|
| `backend\web.config` | กำหนด iisnode รัน `server.js` และ rewrite |
| `frontend\public\web.config` | SPA fallback สำหรับ Vue Router (ถูก copy ไป `dist\web.config` ตอน build) |
| `backend\server.js` | ใช้ `process.env.PORT` และ `trust proxy` เพื่อให้ทำงานหลัง IIS ได้ |
| `frontend\.env.production` | กำหนด `VITE_API_BASE_URL` สำหรับ production build |

---

## Deploy แบบ Backend แยก Site (เช่น แยกพอร์ตหรือแยกโดเมน)

ถ้าต้องการให้ API อยู่คนละ Site (เช่น `https://api.example.com` หรือพอร์ต 5000):

1. สร้าง Site ใหม่ใน IIS
2. **Physical path** ชี้ไปที่โฟลเดอร์ `backend` ทั้งหมด
3. ใช้ `backend\web.config` (มี iisnode อยู่แล้ว)
4. ติดตั้ง `node_modules` และ `.env` ในโฟลเดอร์นั้น
5. ที่ Frontend ใช้ `VITE_API_BASE_URL=https://api.example.com/api` (หรือ URL จริงที่เข้า API ได้) แล้ว build ใหม่

---

## อ้างอิง

- [iisnode](https://github.com/Azure/iisnode)
- [IIS URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
