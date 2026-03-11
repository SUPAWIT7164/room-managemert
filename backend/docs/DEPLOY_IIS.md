# Deploy Backend ขึ้น bms-dev (IIS + iisnode)

วิธีอัปโหลด/Deploy โค้ด backend ชุดล่าสุดขึ้นเซิร์ฟเวอร์ Windows ที่รัน IIS (iisnode)

---

## 1. นำโค้ดขึ้นเซิร์ฟเวอร์ bms-dev

เลือกวิธีใดวิธีหนึ่ง:

### วิธี A: อัปโหลดโฟลเดอร์ (Copy)

1. บนเครื่องคุณ: บีบอัดโฟลเดอร์ `backend` เป็น zip (ไม่ต้องรวม `node_modules` จะติดตั้งบนเซิร์ฟเวอร์ใหม่)
2. คัดลอก zip ขึ้นเซิร์ฟเวอร์ bms-dev (Remote Desktop, แชร์โฟลเดอร์, หรือ FTP)
3. บนเซิร์ฟเวอร์: แตก zip ไปยังโฟลเดอร์ที่ IIS ชี้ (เช่น `C:\inetpub\wwwroot\bms-api` หรือ path ที่ใช้อยู่)

### วิธี B: Git (ถ้าเซิร์ฟเวอร์มี Git)

1. บนเซิร์ฟเวอร์ ไปที่โฟลเดอร์ backend (path ที่ IIS ใช้)
2. รัน:
   ```cmd
   git pull origin main
   ```
   (หรือ branch ที่ใช้ เช่น `master`)

### วิธี C: Copy ทับไฟล์ที่เปลี่ยน

1. คัดลอกเฉพาะไฟล์/โฟลเดอร์ที่แก้ (เช่น `controllers\`, `server.js`, `web.config`, `package.json`, `package-lock.json`) ไปทับของเดิมบนเซิร์ฟเวอร์

---

## 2. บนเซิร์ฟเวอร์ bms-dev

### 2.1 ตรวจสอบโฟลเดอร์ backend

- เปิดโฟลเดอร์ที่ IIS ใช้เป็น **Physical Path** ของ Site/Application (เช่น `C:\...\bms-api` หรือ `C:\inetpub\wwwroot\api`)

### 2.2 ตรวจสอบไฟล์ .env

- ในโฟลเดอร์ backend บนเซิร์ฟเวอร์ **ต้องมีไฟล์ `.env`** (ค่าต่างๆ เช่น DB, CCTV_BASE_URL, JWT_SECRET)
- ถ้ายังไม่มี: คัดลอกจาก `.env.backup` หรือ `env.example.txt` แล้วแก้ค่าให้ตรงกับเซิร์ฟเวอร์
- **อย่าลืม:** `CCTV_BASE_URL=http://192.168.24.1` และ username/password กล้อง ต้องถูกต้อง

### 2.3 ติดตั้ง/อัปเดต dependencies

เปิด **Command Prompt** หรือ **PowerShell** แล้วไปที่โฟลเดอร์ backend:

```cmd
cd C:\path\to\backend
```

จากนั้นรัน:

```cmd
npm install
```

หรือถ้าใช้ lockfile แบบเข้มงวด:

```cmd
npm ci
```

- รอให้ติดตั้งเสร็จ (รวมถึง `digest-fetch`)
- ตรวจสอบว่ามีโฟลเดอร์ `node_modules` และมี `digest-fetch` ภายใน

### 2.4 ตรวจสอบ Node

```cmd
node -v
```

- แนะนำ Node 18 ขึ้นไป (เช่น v18.x, v20.x, v24.x)

---

## 3. IIS — Restart Application

หลังอัปเดตโค้ดและรัน `npm install` แล้ว ต้องให้ IIS โหลดโค้ดใหม่:

### 3.1 Recycle Application Pool

1. เปิด **IIS Manager** (Win + R → `inetmgr` → Enter)
2. คลิก **Application Pools**
3. เลือก Application Pool ที่ใช้กับ backend (เช่น `BmsApiAppPool` หรือชื่อที่ตั้งไว้)
4. คลิกขวา → **Recycle**

### 3.2 หรือ Restart Site

1. ใน IIS Manager ไปที่ **Sites**
2. เลือก Site ที่ใช้กับ bms-dev (หรือ Application ที่เป็น backend)
3. คลิกขวา → **Manage Website** → **Restart**

### 3.3 ตรวจสอบ Path และ web.config

- **Physical Path** ของ Application/Site ต้องชี้ไปที่โฟลเดอร์ที่มี `server.js` และ `web.config`
- ในโฟลเดอร์นั้นต้องมีไฟล์ `web.config` (ใช้ iisnode รัน `server.js`)

---

## 4. ตรวจสอบหลัง Deploy

1. เปิดเบราว์เซอร์หรือใช้ curl:
   - ตรวจสอบ health: `https://bms-dev.lanna.co.th/api/health` หรือ `https://bms-dev.lanna.co.th/api/ping`
   - ควรได้ 200 OK
2. เปิดหน้า CCTV: `https://bms-dev.lanna.co.th/cctv`
   - ลองกดนับคน — ถ้า DigestClient ใช้ได้ จะไม่ขึ้น 503 จาก "DigestClient is not a constructor"

---

## 5. ถ้า Backend อยู่คนละโฟลเดอร์กับ Frontend

- **Frontend** (Vue/build) มักชี้ไปที่โฟลเดอร์หนึ่ง (เช่น `C:\inetpub\wwwroot\bms-dev`)
- **Backend** (Node) ควรเป็น Application แยกภายใต้ Site เดิม หรือเป็น Site แยก
- ตัวอย่าง: Site ชื่อ `bms-dev.lanna.co.th` มี Application ชื่อ `api` ที่ path `/api` และ Physical Path ชี้ไปที่โฟลเดอร์ backend ที่มี `server.js` + `web.config`

---

## สรุปสั้น ๆ

| ขั้นตอน | คำสั่ง/การกระทำ |
|--------|------------------|
| 1. นำโค้ดขึ้นเซิร์ฟเวอร์ | Copy โฟลเดอร์ backend หรือ git pull (ไม่ต้องส่ง node_modules) |
| 2. มี .env บนเซิร์ฟเวอร์ | Copy/สร้างไฟล์ .env ในโฟลเดอร์ backend |
| 3. ติดตั้ง package | ในโฟลเดอร์ backend: `npm install` |
| 4. รีสตาร์ทแอป | IIS Manager → Application Pool → Recycle (หรือ Restart Site) |
| 5. ทดสอบ | เปิด /api/health และ /cctv |

ถ้า Node path ใน `web.config` ไม่ตรงกับที่ติดตั้งบนเซิร์ฟเวอร์ ให้แก้ `nodeProcessCommandLine` ใน `web.config` ให้ชี้ไปที่ `node.exe` จริง (เช่น `C:\Program Files\nodejs\node.exe`)
