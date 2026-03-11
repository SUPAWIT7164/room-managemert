# Database Setup Guide

โปรเจคนี้ใช้ **SQL Server เท่านั้น**

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

### 3. การตั้งค่าสำหรับ SQL Server

แก้ไขไฟล์ `.env`:

```env
DB_CONNECTION=sqlsrv
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_sqlserver_password
DB_NAME=smart_room_booking
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

**หมายเหตุ:**
- `DB_CONNECTION=sqlsrv` ระบุว่าใช้ SQL Server
- `DB_ENCRYPT=false` ปิดการเข้ารหัส (สำหรับ local development)
- `DB_TRUST_CERT=true` ไว้ใจ self-signed certificates

### 4. ตรวจสอบการเชื่อมต่อ

รัน backend server:

```bash
npm run dev
```

ตรวจสอบ console logs:
- `✅ SQL Server connection pool created` - เชื่อมต่อสำเร็จ
- `✅ SQL Server connected successfully` - ทดสอบ connection สำเร็จ

## SQL Server Syntax

โปรเจคนี้ใช้ SQL Server syntax โดยตรง:

- **Date Functions**: `GETDATE()` แทน `NOW()`
- **Date Casting**: `CAST(column AS DATE)` แทน `DATE(column)`
- **LIMIT/OFFSET**: `OFFSET x ROWS FETCH NEXT y ROWS ONLY` แทน `LIMIT y OFFSET x`
- **String Functions**: `FORMAT(datetime, 'yyyy-MM-dd HH:mm:ss')` สำหรับ datetime formatting

## Timezone Handling

โปรเจคนี้จัดการ timezone สำหรับ SQL Server:

1. **INSERT**: ลบ 7 ชั่วโมงก่อน INSERT เพื่อ compensate SQL Server UTC conversion
2. **SELECT**: บวก 7 ชั่วโมงกลับเมื่อ query เพื่อแสดงเวลาที่ถูกต้อง
3. **FORMAT()**: ใช้ `FORMAT()` ใน SELECT เพื่อป้องกัน driver-level timezone conversion

ดูรายละเอียดเพิ่มเติมใน `DATETIME_TIMEZONE_COMPARISON.md`

## Troubleshooting

### Connection Issues

1. **ตรวจสอบว่า SQL Server service กำลังทำงานอยู่**
   - Windows: Services → SQL Server (MSSQLSERVER)
   - หรือใช้ SQL Server Configuration Manager

2. **ตรวจสอบ DB_HOST และ DB_PORT**
   - Default port: 1433
   - สำหรับ Azure SQL: ใช้ server name จาก Azure portal

3. **ตรวจสอบ Authentication**
   - SQL Server Authentication: ใช้ `sa` user และ password
   - Windows Authentication: ต้องตั้งค่า connection string ต่างกัน

4. **ตรวจสอบ Firewall**
   - เปิด port 1433 ใน Windows Firewall
   - สำหรับ Azure SQL: เปิด firewall rules ใน Azure portal

### Common Errors

- **ETIMEDOUT**: SQL Server service ไม่ทำงาน หรือ network issue
- **ECONNREFUSED**: DB_HOST หรือ DB_PORT ไม่ถูกต้อง
- **Login failed**: DB_USER หรือ DB_PASSWORD ไม่ถูกต้อง
- **Cannot open database**: DB_NAME ไม่มีใน SQL Server
