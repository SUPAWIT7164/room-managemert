# แก้ 404 ตอน POST http://localhost/api/auth/login

เมื่อได้ **404 (Not Found)** จาก `POST http://localhost/api/auth/login` แปลว่า request ไปที่ `/api/*` ยังไม่ถูกส่งไปที่ Backend (Node.js)  
สาเหตุส่วนใหญ่คือ **ยังไม่ได้เพิ่ม Application ชื่อ `api` ใน IIS** หรือชี้ path ผิด

---

## ขั้นตอนแก้ไข (ทำตามทีละขั้น)

### ขั้นที่ 1: เปิด IIS Manager

- กด `Win + R` พิมพ์ `inetmgr` แล้วกด Enter  
- หรือค้นหา "IIS" ใน Start Menu แล้วเปิด **Internet Information Services (IIS) Manager**

### ขั้นที่ 2: เลือก Site ของคุณ

- ซ้ายมือ: ขยาย **Sites**
- คลิกที่ **ชื่อ Site** ที่คุณใช้ (ที่ชี้ไปโฟลเดอร์ `frontend\dist` หรือ project)

### ขั้นที่ 3: เพิ่ม Application ชื่อ `api`

1. **คลิกขวาที่ชื่อ Site** (ไม่ใช่ที่ "Default Web Site" หรือชื่ออื่น ถ้า Site คุณชื่ออื่นให้คลิกขวาที่ชื่อนั้น)
2. เลือก **Add Application...**
3. กรอก:

   | ชื่อช่อง       | ค่าที่ใส่ |
   |----------------|-----------|
   | **Alias**      | `api` (พิมพ์ตรงนี้ให้ตรงทุกตัวอักษร) |
   | **Application pool** | เลือกตัวเดียวกับ Site ของคุณ หรือกด **Select...** แล้วเลือก pool ที่มีอยู่ หรือสร้างใหม่ |
   | **Physical path** | `C:\Users\supawitn\Documents\GitHub\room-managemert-portal\backend` (หรือ path จริงของโฟลเดอร์ backend) |

4. กด **OK**

### ขั้นที่ 4: ตั้ง Application Pool ของ Application `api`

1. ซ้ายมือไปที่ **Application Pools**
2. หา pool ที่ใช้กับ Application `api` (มักจะใช้ pool เดียวกับ Site)
3. **คลิกขวาที่ชื่อ pool** → **Basic Settings**
4. ตั้ง **.NET CLR version** เป็น **No Managed Code**
5. กด **OK**
6. **คลิกขวาที่ pool อีกครั้ง** → **Recycle** (หรือ Start ถ้ายังไม่รัน)

### ขั้นที่ 5: ตรวจสอบโฟลเดอร์ backend

ในโฟลเดอร์ที่ใส่เป็น **Physical path** ของ Application `api` ต้องมีไฟล์/โฟลเดอร์เหล่านี้:

- `server.js`
- `web.config`
- `package.json`
- โฟลเดอร์ `node_modules`
- ไฟล์ `.env`

ถ้าไม่มี `node_modules` ให้เปิด Command Prompt หรือ PowerShell ไปที่โฟลเดอร์ backend แล้วรัน:

```bash
cd C:\Users\supawitn\Documents\GitHub\room-managemert-portal\backend
npm install
```

### ขั้นที่ 6: ติดตั้ง iisnode (ถ้ายังไม่มี)

Application `api` ต้องใช้ **iisnode** ถึงจะรัน Node.js ได้ใน IIS:

- ดาวน์โหลด: https://github.com/Azure/iisnode/releases  
- เลือกไฟล์ `.msi` ที่ตรงกับ Windows (เช่น x64)  
- ติดตั้งแล้วรีสตาร์ท IIS หรือ Recycle Application Pool ของ `api`

### ขั้นที่ 7: สิทธิ์โฟลเดอร์ backend

โฟลเดอร์ backend ต้องให้ identity ของ Application Pool **อ่านและเขียน** ได้ — iisnode ใช้เขียนไฟล์ log ใน `backend\iisnode`  
ถ้าสิทธิ์มีแค่อ่าน จะเกิด 500 subStatus 1002 และข้อความว่า "iisnode was unable to create a log file"

รัน PowerShell **แบบ Run as administrator** (ใช้ `-ForBackend` เพื่อให้สิทธิ์อ่าน+เขียนและสร้างโฟลเดอร์ iisnode)  
**ต้องใส่ path เต็ม** ของโฟลเดอร์ backend ใน `-SitePath` — ห้ามใช้ `…\backend` หรือ path แบบย่อ

```powershell
cd c:\Users\supawitn\Documents\GitHub\room-managemert-portal\scripts
.\fix-iis-permissions.ps1 -SitePath "C:\Users\supawitn\Documents\GitHub\room-managemert-portal\backend" -ForBackend
```

ถ้าโปรเจกต์อยู่คนละ drive/โฟลเดอร์ ให้แก้ path ใน `-SitePath` ให้เป็น path จริงของโฟลเดอร์ backend บนเครื่องคุณ

---

## วิธีตรวจสอบว่าแก้แล้ว

1. เปิดเบราว์เซอร์ไปที่  
   **http://localhost/api/health**  
   หรือ  
   **http://localhost/health**

2. **ถ้าเห็น JSON ประมาณนี้:**  
   `{"status":"OK","message":"Server is running",...}`  
   แปลว่า request ไปถึง Backend แล้ว → ลองกด Login ในระบบอีกครั้ง

3. **ถ้ายังได้ 404 หรือหน้าเปล่า:**  
   - เช็คอีกครั้งว่าเพิ่ม Application **alias ชื่อ `api`** ภายใต้ Site ที่คุณใช้เปิด localhost  
   - เช็คว่า Physical path ของ Application `api` ชี้ไปโฟลเดอร์ backend ที่มี `server.js` และ `web.config`  
   - ดู log ในโฟลเดอร์ `backend\iisnode\` (ถ้ามี) และใน Event Viewer (Windows Logs → Application) ถ้ามี error จาก iisnode

---

## ใช้สคริปต์ตรวจสอบ Backend (check-backend-status.ps1)

รันจากโฟลเดอร์ `scripts` (ต้องใส่ `.\` นำหน้าชื่อสคริปต์ เพราะ PowerShell ไม่รันไฟล์ในโฟลเดอร์ปัจจุบันโดยอัตโนมัติ):

```powershell
cd c:\Users\supawitn\Documents\GitHub\room-managemert-portal\scripts
.\check-backend-status.ps1
```

สคริปต์จะตรวจ 4 อย่างและแสดงผลเป็นภาษาไทย:

| ขั้น | ความหมาย |
|------|----------|
| **[1] รันตรงด้วย Node** | ทดสอบ `http://localhost:5000/api/ping` — ถ้า OK แปลว่า backend รันได้เมื่อใช้ `node server.js` |
| **[2] ผ่าน IIS** | ทดสอบ `http://localhost/api/ping` — ถ้า OK แปลว่าเข้า Backend ผ่าน IIS ได้ |
| **[3] Path ของ Node.js** | ตรวจว่าเจอ `node.exe` ตรงกับที่ใช้ใน `web.config` หรือไม่ |
| **[4] Log ของ iisnode** | แสดงเมื่อ [2] ไม่ผ่าน — อ่านไฟล์ล่าสุดใน `backend\iisnode\` หรือแจ้งว่ายังไม่มี log |

**แปลผล:**

- **ถ้า [1] OK แต่ [2] 500** = ปัญหาอยู่ที่ iisnode หรือ Application Pool (ไม่ใช่โค้ด backend) ให้ทำตามส่วน "แก้ 500 subStatus 1002" ด้านล่าง และดู [4] ว่ามี log ไหม
- **ถ้า [4] ขึ้น "ยังไม่มีไฟล์ log"** = process ล้มก่อน Node สตาร์ท (เช่น HRESULT 0x2) มักเป็นสิทธิ์โฟลเดอร์หรือการตั้ง Application Pool
- ขั้นถัดไปที่สคริปต์แนะนำ: เปิด `http://localhost/api/ping` ในเบราว์เซอร์ (อาจเห็น error เต็ม) หรือรัน `.\fix-iis-500-substatus-1002.ps1`

---

## สรุปโครงสร้างที่ต้องได้ใน IIS

```
Sites
 └── [ชื่อ Site ของคุณ]  (Physical path = ...\frontend\dist)
      └── api            (Application, Physical path = ...\backend)
```

เมื่อมีแบบนี้ request ไปที่ `http://localhost/api/auth/login` จะถูกส่งไปที่โฟลเดอร์ backend และรันด้วย `server.js` ผ่าน iisnode

---

## แก้ 500 subStatus 1002 (iisnode HRESULT 0x2)

เมื่อได้ข้อความประมาณ “iisnode encountered an error” พร้อม **HRESULT: 0x2** และ **HTTP subStatus: 1002** มักเป็นเรื่องสิทธิ์หรือ path ของ Node

**ก่อนแก้:** รัน `.\check-backend-status.ps1` จากโฟลเดอร์ `scripts` เพื่อดู [1]–[4] และข้อความใน [4] (log iisnode หรือคำแนะนำขั้นถัดไป)

ทำตามลำดับ:

### 1) ตั้ง Application Pool ให้เป็น 64-bit

- IIS Manager → **Application Pools** → เลือก pool ของ Application `api`
- คลิกขวา → **Advanced Settings**
- หา **Enable 32-Bit Applications** → ตั้งเป็น **False**
- กด **OK** แล้ว **Recycle** pool

### 2) ให้สิทธิ์โฟลเดอร์ backend (อ่าน+เขียน + traverse โฟลเดอร์พ่อ)

ข้อความ "iisnode was unable to create a log file" เกิดจาก identity ของ Application Pool ไม่มีสิทธิ์**เขียน**ในโฟลเดอร์ backend  

ถ้าเห็น **"EPERM: operation not permitted, lstat 'C:\Users\...\Documents'"** แปลว่า App Pool ผ่านโฟลเดอร์พ่อของ backend ไม่ได้ — Node ใช้ path แบบนี้ตอน resolve module จึงต้องให้สิทธิ์ **traverse (Read & Execute)** บนโซ่โฟลเดอร์จาก backend ขึ้นไปจนถึง drive ด้วย  

รัน PowerShell **แบบ Run as administrator** และใส่ **-ForBackend** — สคริปต์จะให้สิทธิ์ Modify ที่ backend และ `backend\iisnode` และให้สิทธิ์ traverse ที่โฟลเดอร์พ่อทุกชั้น (เช่น ...\room-managemert-portal, ...\GitHub, ...\Documents, ...\supawitn ฯลฯ)  
**ต้องใส่ path เต็ม** ใน `-SitePath` (เช่น `"C:\Users\supawitn\Documents\GitHub\room-managemert-portal\backend"`) — ห้ามใช้ `…\backend` หรือ path แบบย่อ

```powershell
cd c:\Users\supawitn\Documents\GitHub\room-managemert-portal\scripts
.\fix-iis-permissions.ps1 -SitePath "C:\Users\supawitn\Documents\GitHub\room-managemert-portal\backend" -ForBackend
```

หรือรันสคริปต์รวม: `.\fix-iis-500-substatus-1002.ps1` (จะเรียก fix-iis-permissions -ForBackend ให้เอง) — **ต้องใส่ `.\` นำหน้า** เวลารันจากโฟลเดอร์ scripts

ถ้ายังขึ้น 500 อยู่ ลองให้สิทธิ์ที่โฟลเดอร์พ่อของ backend ด้วย (เช่น โฟลเดอร์โปรเจกต์):

- คลิกขวาโฟลเดอร์ `room-managemert-portal` → Properties → Security
- Add → `IIS_IUSRS`, `IUSR` → Read & execute, List folder, Read

### 3) ล้าง npm cache

ในโฟลเดอร์ backend รัน:

```powershell
cd C:\Users\supawitn\Documents\GitHub\room-managemert-portal\backend
npm cache clear --force
```

### 4) ตรวจสอบ path ของ Node ใน web.config

ใน `backend\web.config` ค่า `nodeProcessCommandLine` ควรใช้ path ที่มี **เครื่องหมาย quote** ถ้า path มีช่องว่าง (เช่น `C:\Program Files\...`):

```xml
nodeProcessCommandLine="&quot;C:\Program Files\nodejs\node.exe&quot;"
```

ถ้า Node อยู่ที่อื่น ให้แก้ path ให้ตรงกับเครื่องคุณ

### 5) Recycle Application Pool

หลังจากแก้ข้างบนแล้ว ให้ Recycle Application Pool ของ `api` อีกครั้ง แล้วลองเปิด `http://localhost/api/ping` ใหม่

---

## แก้ ERR_HTTP2_PROTOCOL_ERROR / Network Error สำหรับ /api (POST count-people ฯลฯ)

เมื่อได้ **ERR_HTTP2_PROTOCOL_ERROR** หรือ **Network Error** กับ `POST https://bms-dev.lanna.co.th/api/cctv/count-people` (หรือ API อื่น) มักเป็นเพราะ IIS ใช้ HTTP/2 แล้ว connection ถูก reset ตอน proxy ไป iisnode

ทำตามลำดับ:

### 1) เพิ่ม executionTimeout ใน backend (ทำแล้วใน web.config)

ใน `backend\web.config` ภายในแท็ก `<iisnode ...>` ให้มี `executionTimeout="120"` (หน่วยเป็นวินาที) เพื่อให้ request ที่ใช้เวลานาน (เช่น ดึงภาพกล้อง + นับคน) ไม่ถูกตัดกลางทาง

### 2) ปิด HTTP/2 สำหรับ Site (แนะนำ)

- เปิด **IIS Manager** → เลือก **Site** ของคุณ (เช่น bms-dev.lanna.co.th)
- ดับเบิลคลิก **Bindings...**
- เลือก binding ที่เป็น **https** แล้วกด **Edit...**
- ถ้ามีตัวเลือกเกี่ยวกับ **Protocol** หรือ **HTTP/2** ให้ปิดหรือเอาเครื่องหมายออก แล้วกด **OK**
- หรือใช้ PowerShell (รันแบบ Administrator):

```powershell
# ดูชื่อ Site ก่อน (ใน IIS Manager ใต้ Sites)
Import-Module WebAdministration
Get-Website | Select-Object Name, Id, State

# ปิด HTTP/2 สำหรับ Site ชื่อ "YourSiteName" (ใส่ชื่อจริง)
Set-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/protocol" -Name "h2" -Value "false" -Location "YourSiteName"
```

จากนั้น **Restart Site** หรือ **Recycle Application Pool** ของ Site นั้น

### 3) ตรวจสอบว่า /api ทำงาน

เปิดเบราว์เซอร์ไปที่ `https://bms-dev.lanna.co.th/api/health` — ถ้าได้ JSON แปลว่า backend ยังรับ request ได้ หลังจากปิด HTTP/2 แล้วลองเปิดหน้า CCTV และกดนับคนอีกครั้ง
