# วิธีติดตั้ง @tensorflow/tfjs-node สำหรับประสิทธิภาพที่ดีขึ้น

## ข้อกำหนดเบื้องต้น

เพื่อติดตั้ง `@tensorflow/tfjs-node` จำเป็นต้องมี:

1. **Python 3.6-3.11** (ไม่รองรับ Python 3.12+)
2. **Visual Studio Build Tools** หรือ **Visual Studio Community** (พร้อม C++ build tools)

---

## ขั้นตอนการติดตั้ง

### 1. ติดตั้ง Python

#### วิธีที่ 1: ดาวน์โหลดจาก python.org (แนะนำ)

1. ไปที่ https://www.python.org/downloads/
2. ดาวน์โหลด Python 3.11 (เวอร์ชันล่าสุดที่รองรับ)
3. รัน installer และ **สำคัญ**: ติ๊กเลือก "Add Python to PATH"
4. เลือก "Install Now" หรือ "Customize installation"
5. รอให้ติดตั้งเสร็จ

#### วิธีที่ 2: ใช้ Microsoft Store

1. เปิด Microsoft Store
2. ค้นหา "Python 3.11"
3. คลิก "Install"

#### ตรวจสอบการติดตั้ง

```cmd
python --version
# ควรแสดง: Python 3.11.x

py --version
# ควรแสดง: Python 3.11.x
```

---

### 2. ติดตั้ง Visual Studio Build Tools

#### วิธีที่ 1: ดาวน์โหลด Visual Studio Build Tools (แนะนำ - ขนาดเล็กกว่า)

1. ไปที่ https://visualstudio.microsoft.com/downloads/
2. เลื่อนลงไปหา "Tools for Visual Studio" → "Build Tools for Visual Studio 2022"
3. ดาวน์โหลดและรัน installer
4. เลือก "Desktop development with C++" workload
5. คลิก "Install"

#### วิธีที่ 2: ติดตั้ง Visual Studio Community (ถ้าต้องการ IDE)

1. ไปที่ https://visualstudio.microsoft.com/downloads/
2. ดาวน์โหลด "Visual Studio Community 2022"
3. รัน installer
4. เลือก "Desktop development with C++" workload
5. คลิก "Install"

#### ตรวจสอบการติดตั้ง

```cmd
where cl
# ควรแสดง path ไปยัง Visual Studio compiler
```

---

### 3. ตั้งค่า npm ให้ใช้ Python

หลังจากติดตั้ง Python แล้ว ให้ตั้งค่า npm:

```cmd
cd C:\inetpub\wwwroot\room-managemert-portal\backend

# ตรวจสอบ path ของ Python
where python
# หรือ
where py

# ตั้งค่า npm ให้ใช้ Python (ใช้ path ที่ได้จากคำสั่ง above)
npm config set python "C:\Python311\python.exe"
# หรือถ้าใช้ py launcher:
npm config set python "C:\Windows\py.exe"
```

---

### 4. ติดตั้ง @tensorflow/tfjs-node

หลังจากติดตั้ง Python และ Build Tools แล้ว:

```cmd
cd C:\inetpub\wwwroot\room-managemert-portal\backend

# ลบ node_modules/@tensorflow ถ้ามี (เพื่อติดตั้งใหม่)
rmdir /s /q node_modules\@tensorflow 2>nul

# ติดตั้ง @tensorflow/tfjs-node
npm install @tensorflow/tfjs-node@^4.22.0 --save-optional
```

**หมายเหตุ**: การติดตั้งอาจใช้เวลานาน (5-15 นาที) เพราะต้อง compile native bindings

---

## ทางเลือกอื่น: ใช้ Node.js เวอร์ชันที่รองรับ pre-built binaries

ถ้าไม่ต้องการติดตั้ง Python และ Build Tools สามารถใช้ Node.js เวอร์ชันที่รองรับ pre-built binaries:

- **Node.js 18.x LTS** (แนะนำ)
- **Node.js 20.x LTS**

### วิธีเปลี่ยน Node.js version

#### ใช้ nvm-windows (แนะนำ)

1. ดาวน์โหลด nvm-windows: https://github.com/coreybutler/nvm-windows/releases
2. ติดตั้ง nvm-windows
3. เปิด Command Prompt/PowerShell **ใหม่** (Run as Administrator)
4. รันคำสั่ง:

```cmd
nvm install 18.20.4
nvm use 18.20.4
node --version
# ควรแสดง: v18.20.4
```

5. ติดตั้ง packages ใหม่:

```cmd
cd C:\inetpub\wwwroot\room-managemert-portal\backend
rmdir /s /q node_modules
npm install
```

---

## ตรวจสอบว่าติดตั้งสำเร็จ

หลังจากติดตั้งเสร็จ ให้ทดสอบ:

```cmd
cd C:\inetpub\wwwroot\room-managemert-portal\backend
node -e "require('@tensorflow/tfjs-node'); console.log('✅ @tensorflow/tfjs-node loaded successfully!')"
```

ถ้าแสดง `✅ @tensorflow/tfjs-node loaded successfully!` แสดงว่าติดตั้งสำเร็จ

---

## ข้อผิดพลาดที่พบบ่อย

### Error: Python not found
- **แก้ไข**: ตรวจสอบว่า Python ติดตั้งแล้วและอยู่ใน PATH
- รัน: `python --version` เพื่อตรวจสอบ

### Error: node-gyp rebuild failed
- **แก้ไข**: ตรวจสอบว่า Visual Studio Build Tools ติดตั้งแล้ว
- ตรวจสอบว่า "Desktop development with C++" workload ถูกเลือก

### Error: Pre-built binaries not found
- **แก้ไข**: ใช้ Node.js 18.x หรือ 20.x แทน Node.js 24.x
- หรือติดตั้ง Python และ Build Tools เพื่อ compile จาก source

---

## สรุป

**วิธีที่ง่ายที่สุด**: ใช้ Node.js 18.x LTS (ไม่ต้องติดตั้ง Python/Build Tools)

**วิธีที่ให้ประสิทธิภาพดีที่สุด**: ติดตั้ง Python 3.11 + Visual Studio Build Tools + ใช้ Node.js 24.x

---

## หลังจากติดตั้งเสร็จ

รีสตาร์ท backend เพื่อให้ระบบใช้ TensorFlow backend:

```cmd
cd C:\inetpub\wwwroot\room-managemert-portal\backend
npm start
```

ระบบจะใช้ TensorFlow backend แทน CPU backend ซึ่งจะให้ประสิทธิภาพดีขึ้นมาก












