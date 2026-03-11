# DateTime / Timezone Requirement และ Implementation

## 📋 Requirement

### 1. Timezone
- ✅ ตั้งค่า default timezone ของระบบเป็น **Asia/Bangkok** (UTC+7)
- ✅ ห้ามมี implicit หรือ automatic timezone conversion ทุกกรณี

### 2. INSERT (Write)
- ✅ รับค่า datetime จาก client เป็น string (เช่น `"2026-01-26 10:30:00"`)
- ✅ บันทึกลง database **"ตาม string ที่ส่งมา"**
- ✅ ห้ามแปลง timezone
- ✅ ห้าม parse เป็น UTC หรือ timezone อื่น

### 3. SELECT (Read)
- ✅ Query datetime ออกมาให้ได้ค่าเดิม 100% ตามที่ถูก insert
- ✅ ห้ามแปลง timezone ตอน query หรือ serialize response
- ✅ Response ต้องเป็น string เดิม (format เดิม)

### 4. Database
- ✅ ใช้ column type ที่ไม่ทำ timezone conversion อัตโนมัติ
  - SQL Server: `DATETIME` (ไม่ใช้ `DATETIMEOFFSET` หรือ `TIMESTAMP`)
- ✅ ห้ามใช้ timezone-aware column โดยไม่จำเป็น

### 5. Library / Framework
- ✅ ใช้ library ที่รองรับ timezone (Asia/Bangkok)
- ✅ Config ให้อยู่ในโหมด **"no conversion"**
- ✅ ใช้ datetime เป็น string เป็นหลัก
- ✅ หลีกเลี่ยง auto casting / auto serialize

### 6. Coding Guideline
- ✅ ทุก layer (API, Service, DB) ต้องถือว่า datetime เป็น **local time (Asia/Bangkok)**
- ✅ ห้ามแปลงเป็น UTC ภายในระบบ
- ✅ ห้ามใช้ `Date.now()`, `new Date()` ถ้าไม่ได้รับค่าจาก client

---

## 🔧 Implementation

### 1. Timezone Configuration

**File: `backend/server.js`**
```javascript
// Set default timezone to Asia/Bangkok (UTC+7)
// This ensures all datetime operations use Asia/Bangkok timezone
// No implicit or automatic timezone conversion will occur
process.env.TZ = 'Asia/Bangkok';
console.log('[Server] Timezone set to:', process.env.TZ);
```

**ผลลัพธ์:**
- Node.js process ใช้ timezone `Asia/Bangkok` เป็น default
- ทุก datetime operation ใช้ timezone นี้โดยอัตโนมัติ
- ไม่มีการแปลง timezone แบบ implicit

---

### 2. INSERT (Write) Implementation

**File: `backend/models/Booking.js`**

```javascript
// Map data fields to database columns
// IMPORTANT: No timezone conversion - store datetime string exactly as received from client
// System timezone is set to Asia/Bangkok (UTC+7) in server.js
// We store the datetime string directly without any adjustment

const columnMapping = {
    'start_datetime': data.start_time, // Store exactly as received (no timezone conversion)
    'end_datetime': data.end_time,     // Store exactly as received (no timezone conversion)
    // ... other fields
};

// For SQL Server, use CONVERT with style 120 to parse datetime string without timezone conversion
// Style 120: 'yyyy-mm-dd hh:mi:ss' - parses string directly as local time (Asia/Bangkok)
// No timezone conversion will occur - stores exactly as the string value
const placeholders = paramColumns.map((col, idx) => {
    if (col === 'start_datetime' || col === 'end_datetime') {
        // Use CONVERT with style 120 to parse "YYYY-MM-DD HH:mm:ss" string directly
        // This preserves the exact time without any timezone conversion
        return `CONVERT(DATETIME, ?, 120)`;
    }
    return '?';
});
```

**ตัวอย่าง:**
```javascript
// Client ส่งมา: "2026-01-26 10:30:00"
// INSERT: บันทึก "2026-01-26 10:30:00" ลง database โดยตรง
// ไม่มีการแปลง timezone
// Database เก็บ: "2026-01-26 10:30:00"
```

---

### 3. SELECT (Read) Implementation

**File: `backend/models/Booking.js`**

```sql
-- ใช้ FORMAT() เพื่อแปลง datetime เป็น string โดยไม่มีการแปลง timezone
-- FORMAT() returns the datetime as stored in the database without timezone conversion
SELECT 
    FORMAT(br.start_datetime, 'yyyy-MM-dd HH:mm:ss') as start_datetime,
    FORMAT(br.end_datetime, 'yyyy-MM-dd HH:mm:ss') as end_datetime
FROM booking_requests br
```

```javascript
// No timezone conversion - use datetime string exactly as returned from database
// FORMAT() returns the datetime as stored (no timezone conversion)
// If it's already a string, use it directly
if (typeof startDatetime === 'string') {
    // String from FORMAT() - use directly (no conversion)
    // Format is already "YYYY-MM-DD HH:mm:ss" from FORMAT()
    // No timezone adjustment needed
} else if (startDatetime instanceof Date) {
    // Date object (shouldn't happen with FORMAT(), but handle it)
    // Convert to string format "YYYY-MM-DD HH:mm:ss" without timezone conversion
    const year = startDatetime.getFullYear();
    const month = String(startDatetime.getMonth() + 1).padStart(2, '0');
    const day = String(startDatetime.getDate()).padStart(2, '0');
    const hours = String(startDatetime.getHours()).padStart(2, '0');
    const minutes = String(startDatetime.getMinutes()).padStart(2, '0');
    const seconds = String(startDatetime.getSeconds()).padStart(2, '0');
    startDatetime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
```

**ตัวอย่าง:**
```javascript
// Database เก็บ: "2026-01-26 10:30:00"
// SELECT: Query ได้ "2026-01-26 10:30:00" (ค่าเดิม 100%)
// Response: ส่ง "2026-01-26 10:30:00" ไปยัง client
// ไม่มีการแปลง timezone
```

---

### 4. Database Configuration

**File: `backend/config/database.js`**

```javascript
const config = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || 1433),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_room_booking',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
        enableArithAbort: true,
        connectionTimeout: 10000,
        requestTimeout: 30000,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};
```

**Column Type:**
- ใช้ `DATETIME` type ใน SQL Server
- ไม่ใช้ `DATETIMEOFFSET` (timezone-aware)
- ไม่ใช้ `TIMESTAMP` (auto-update)

---

### 5. Best Practices

#### ✅ DO:
1. **ใช้ string format `"YYYY-MM-DD HH:mm:ss"`** สำหรับ datetime
2. **ใช้ `FORMAT()` ใน SELECT** เพื่อป้องกัน driver-level conversion
3. **ใช้ `CONVERT(DATETIME, ?, 120)` ใน INSERT** เพื่อ parse string โดยตรง
4. **ตั้งค่า `process.env.TZ = 'Asia/Bangkok'`** ใน server.js
5. **ถือว่า datetime เป็น local time (Asia/Bangkok) เสมอ**

#### ❌ DON'T:
1. **ห้ามใช้ `Date.now()` หรือ `new Date()`** ถ้าไม่ได้รับค่าจาก client
2. **ห้ามแปลง datetime เป็น UTC** ภายในระบบ
3. **ห้ามใช้ timezone-aware column types** (`DATETIMEOFFSET`, `TIMESTAMP`)
4. **ห้ามทำ timezone adjustment** (ลบ/บวก 7 ชั่วโมง)
5. **ห้ามใช้ auto casting/auto serialize** ที่อาจแปลง timezone

---

### 6. Example Flow

#### INSERT Flow:
```
Client → API: "2026-01-26 10:30:00"
  ↓
Booking.create() → รับ string โดยตรง
  ↓
SQL: INSERT ... VALUES (CONVERT(DATETIME, '2026-01-26 10:30:00', 120))
  ↓
Database: เก็บ "2026-01-26 10:30:00" (ค่าเดิม 100%)
```

#### SELECT Flow:
```
Database: เก็บ "2026-01-26 10:30:00"
  ↓
SQL: SELECT FORMAT(start_datetime, 'yyyy-MM-dd HH:mm:ss') as start_datetime
  ↓
Query Result: "2026-01-26 10:30:00" (ค่าเดิม 100%)
  ↓
Response: ส่ง "2026-01-26 10:30:00" ไปยัง client
```

---

## ⚠️ ข้อควรระวัง

1. **SQL Server Driver:**
   - SQL Server driver (`mssql`) อาจทำ timezone conversion อัตโนมัติ
   - **แก้ไข:** ใช้ `FORMAT()` ใน SELECT เพื่อป้องกัน driver conversion
   - **แก้ไข:** ใช้ `CONVERT(DATETIME, ?, 120)` ใน INSERT เพื่อ parse string โดยตรง

2. **Node.js Date Object:**
   - `new Date()` อาจแปลง timezone อัตโนมัติ
   - **แก้ไข:** หลีกเลี่ยงการใช้ Date object ถ้าไม่จำเป็น
   - **แก้ไข:** ใช้ string format `"YYYY-MM-DD HH:mm:ss"` เป็นหลัก

3. **JSON Serialization:**
   - JSON.stringify() อาจแปลง Date object เป็น ISO string (มี timezone)
   - **แก้ไข:** ใช้ string format `"YYYY-MM-DD HH:mm:ss"` แทน Date object

4. **Database Column Type:**
   - `DATETIMEOFFSET` และ `TIMESTAMP` มี timezone behavior
   - **แก้ไข:** ใช้ `DATETIME` type เท่านั้น

---

## 📝 Summary

- ✅ **Timezone:** Asia/Bangkok (UTC+7) - ตั้งค่าใน `server.js`
- ✅ **INSERT:** บันทึก string โดยตรง - ใช้ `CONVERT(DATETIME, ?, 120)`
- ✅ **SELECT:** Query ได้ค่าเดิม 100% - ใช้ `FORMAT()` เพื่อป้องกัน conversion
- ✅ **Database:** ใช้ `DATETIME` type (ไม่ใช้ timezone-aware types)
- ✅ **No Conversion:** ห้ามแปลง timezone ทุกกรณี
- ✅ **String Format:** ใช้ `"YYYY-MM-DD HH:mm:ss"` เป็นหลัก
