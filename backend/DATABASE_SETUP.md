# Database Setup Guide

โปรเจคนี้รองรับการเชื่อมต่อกับทั้ง MySQL และ SQL Server (SSMS)

## การตั้งค่า

### 1. ติดตั้ง Dependencies

```bash
cd backend
npm install
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `backend` โดยคัดลอกจาก `.env.example`:

```bash
cp .env.example .env
```

### 3. การตั้งค่าสำหรับ MySQL (ค่าเริ่มต้น)

แก้ไขไฟล์ `.env`:

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_room_booking
```

### 4. การตั้งค่าสำหรับ SQL Server

แก้ไขไฟล์ `.env`:

```env
DB_TYPE=mssql
# หรือ
# DB_TYPE=sqlserver

DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_sqlserver_password
DB_NAME=smart_room_booking
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

#### หมายเหตุสำหรับ SQL Server:

- **DB_HOST**: ชื่อเซิร์ฟเวอร์ SQL Server หรือ IP address
- **DB_PORT**: พอร์ตของ SQL Server (ค่าเริ่มต้นคือ 1433)
- **DB_USER**: ชื่อผู้ใช้ SQL Server (เช่น sa หรือ username ที่มีสิทธิ์)
- **DB_PASSWORD**: รหัสผ่าน SQL Server
- **DB_NAME**: ชื่อฐานข้อมูล
- **DB_ENCRYPT**: ตั้งค่าเป็น `true` สำหรับ Azure SQL Database, `false` สำหรับ SQL Server ทั่วไป
- **DB_TRUST_CERT**: ตั้งค่าเป็น `true` เพื่อยอมรับ self-signed certificates

### 5. สร้างฐานข้อมูล

#### สำหรับ MySQL:
```sql
CREATE DATABASE smart_room_booking;
```

#### สำหรับ SQL Server:
```sql
CREATE DATABASE smart_room_booking;
```

### 6. ทดสอบการเชื่อมต่อ

รันเซิร์ฟเวอร์:

```bash
npm run dev
```

หรือ

```bash
npm start
```

ตรวจสอบการเชื่อมต่อที่: `http://localhost:5000/api/health`

## ความแตกต่างระหว่าง MySQL และ SQL Server

โปรเจคนี้ใช้ abstraction layer เพื่อรองรับทั้งสองฐานข้อมูล แต่มีข้อควรระวังบางประการ:

### SQL Syntax

- **Backticks vs Brackets**: MySQL ใช้ backticks (`` ` ``) สำหรับ identifiers, SQL Server ใช้ brackets (`[]`)
- **LIMIT**: MySQL ใช้ `LIMIT`, SQL Server ใช้ `TOP` หรือ `OFFSET...FETCH`
- **String Concatenation**: MySQL ใช้ `CONCAT()`, SQL Server ใช้ `+` หรือ `CONCAT()`

### Auto-increment

- MySQL: `AUTO_INCREMENT`
- SQL Server: `IDENTITY(1,1)`

### Date Functions

- MySQL: `NOW()`, `DATE()`, `DATE_FORMAT()`
- SQL Server: `GETDATE()`, `CAST()`, `FORMAT()`

## การแก้ไขปัญหา

### SQL Server Connection Issues

1. **ตรวจสอบว่า SQL Server กำลังทำงานอยู่**
   - เปิด SQL Server Configuration Manager
   - ตรวจสอบว่า SQL Server service กำลังทำงาน

2. **ตรวจสอบ TCP/IP Protocol**
   - เปิด SQL Server Configuration Manager
   - ไปที่ SQL Server Network Configuration > Protocols for [Instance Name]
   - เปิดใช้งาน TCP/IP
   - ตั้งค่า TCP Port เป็น 1433 (หรือพอร์ตที่คุณใช้)

3. **ตรวจสอบ Firewall**
   - อนุญาตพอร์ต 1433 (หรือพอร์ตที่คุณใช้) ผ่าน Windows Firewall

4. **ตรวจสอบ Authentication**
   - ตรวจสอบว่าใช้ SQL Server Authentication หรือ Windows Authentication
   - สำหรับ SQL Server Authentication ต้องตั้งค่า `DB_USER` และ `DB_PASSWORD`

### MySQL Connection Issues

1. **ตรวจสอบว่า MySQL service กำลังทำงานอยู่**
2. **ตรวจสอบ username และ password**
3. **ตรวจสอบว่า database ถูกสร้างแล้ว**

## หมายเหตุ

- โค้ดที่มีอยู่จะทำงานกับทั้ง MySQL และ SQL Server ผ่าน abstraction layer
- หากคุณต้องการใช้ SQL syntax เฉพาะของฐานข้อมูลใดฐานข้อมูลหนึ่ง คุณอาจต้องแก้ไขโค้ดใน models และ controllers
- สำหรับ production environment แนะนำให้ใช้ connection pooling และตั้งค่า timeout ที่เหมาะสม

