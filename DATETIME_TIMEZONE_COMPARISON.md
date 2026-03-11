# เปรียบเทียบการจัดการ Datetime และ Timezone: โปรเจคเก่า vs โปรเจคใหม่

## 📋 สรุปความแตกต่าง

### โปรเจคเก่า (Laravel/PHP + MySQL)

#### 1. **Timezone Configuration**
- **Laravel Config**: `config/app.php` → `'timezone' => 'Asia/Bangkok'`
- **Carbon Library**: ใช้ `Carbon` ที่รองรับ timezone โดยอัตโนมัติ
- **Database**: MySQL `DATETIME` type (ไม่มี timezone info)

#### 2. **การสร้าง Booking (INSERT)**
```php
// BookingRequestController.php (บรรทัด 124-125)
$startDateTime = Carbon::parse($request->bookingDate . ' ' . $request->startTime);
$endDateTime = Carbon::parse($request->bookingDate . ' ' . $request->endTime);

// บันทึกเป็น string โดยตรง (ไม่มี timezone adjustment)
'start' => $startDateTime->toDateTimeString(),  // "2026-01-26 11:00:00"
'end' => $endDateTime->toDateTimeString(),      // "2026-01-26 11:30:00"
```

**ลักษณะการทำงาน:**
- ✅ Carbon parse datetime string ใน timezone `Asia/Bangkok` (UTC+7)
- ✅ `toDateTimeString()` แปลงเป็น "YYYY-MM-DD HH:mm:ss" โดยไม่มีการแปลง timezone
- ✅ MySQL เก็บค่า datetime string ตามที่ส่งมา (ไม่มี timezone conversion)
- ✅ เมื่อ query กลับมาได้ค่าเดิม (11:00:00)

#### 3. **การ Query Booking (SELECT)**
```php
// BookingRequestController.php (บรรทัด 74-80)
$startDate = Carbon::parse($request->input('start_date'))->startOfDay();
$endDate = Carbon::parse($request->input('end_date'))->endOfDay();

$query = BookingRequest::whereBetween('start', [$startDate, $endDate]);
```

**ลักษณะการทำงาน:**
- ✅ Carbon parse date range ใน timezone `Asia/Bangkok`
- ✅ MySQL query เปรียบเทียบ datetime string โดยตรง (ไม่มี timezone conversion)
- ✅ ผลลัพธ์ที่ได้ตรงกับที่เก็บไว้

#### 4. **การจัดการ Timezone ในบางกรณี**
```php
// BookingRequestController.php (บรรทัด 1392-1393)
$startDateTime = Carbon::createFromFormat('Y-m-d H:i', "$date $startTime", 'Asia/Bangkok');
$endDateTime = Carbon::createFromFormat('Y-m-d H:i', "$date $endTime", 'Asia/Bangkok');
```

**ใช้เมื่อ:**
- ✅ ต้องระบุ timezone อย่างชัดเจน (เช่น เมื่อส่งไปยัง Microsoft Graph API)
- ✅ ใช้ `'Asia/Bangkok'` timezone ในการ parse

---

### โปรเจคใหม่ (Node.js + SQL Server)

#### 1. **Timezone Configuration**
- **Node.js**: ไม่มี global timezone config (ใช้ system timezone)
- **Database**: SQL Server `DATETIME` type (ไม่มี timezone info แต่มี implicit conversion)

#### 2. **การสร้าง Booking (INSERT) - ปัญหาที่พบ**
```javascript
// Booking.js (บรรทัด 447-470)
if (DB_CONNECTION === 'sqlsrv') {
    // ปัญหา: SQL Server แปลง datetime string เป็น UTC
    // วิธีแก้: ลบ 7 ชั่วโมงก่อน INSERT
    original_start: '2026-01-26 11:00:00'
    adjusted_start: '2026-01-26 04:00:00'  // ลบ 7 ชั่วโมง
}
```

**ลักษณะการทำงาน:**
- ❌ SQL Server แปลง datetime string เป็น UTC โดยอัตโนมัติ
- ✅ ต้องลบ 7 ชั่วโมงก่อน INSERT เพื่อ compensate
- ✅ เก็บค่า `04:00:00` ใน database (แต่ควรเป็น `11:00:00`)

#### 3. **การ Query Booking (SELECT) - แก้ไขแล้ว**
```javascript
// Booking.js (บรรทัด 169-183)
if (typeof startDatetime === 'string') {
    if (DB_CONNECTION === 'sqlsrv') {
        // บวก 7 ชั่วโมงกลับเมื่อ query
        const dt = new Date(startDatetime.replace(' ', 'T') + ':00');
        dt.setHours(dt.getHours() + 7);
        startDatetime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}
```

**ลักษณะการทำงาน:**
- ✅ Query ได้ `04:00:00` จาก database
- ✅ บวก 7 ชั่วโมงกลับ → `11:00:00`
- ✅ ส่งไป frontend เป็น `11:00:00` (ถูกต้อง)

#### 4. **การใช้ FORMAT() ใน SQL**
```sql
-- Booking.js (บรรทัด 25-26)
FORMAT(br.start_datetime, 'yyyy-MM-dd HH:mm:ss') as start_datetime
```

**เหตุผล:**
- ✅ ใช้ `FORMAT()` เพื่อแปลง datetime เป็น string โดยไม่มีการแปลง timezone
- ✅ ป้องกัน SQL Server driver แปลง datetime เป็น UTC

---

## 🔍 สรุปความแตกต่างหลัก

| หัวข้อ | โปรเจคเก่า (Laravel/MySQL) | โปรเจคใหม่ (Node.js/SQL Server) |
|--------|---------------------------|--------------------------------|
| **Timezone Config** | `Asia/Bangkok` ใน Laravel config | ไม่มี global config (ใช้ system timezone) |
| **Database Type** | MySQL `DATETIME` | SQL Server `DATETIME` |
| **INSERT Behavior** | เก็บค่า datetime string ตามที่ส่งมา (ไม่มี conversion) | SQL Server แปลงเป็น UTC → ต้องลบ 7 ชั่วโมง |
| **SELECT Behavior** | Query ได้ค่าเดิม (ไม่มี conversion) | Query ได้ค่า UTC → ต้องบวก 7 ชั่วโมงกลับ |
| **Library** | Carbon (รองรับ timezone) | moment.js / native Date (ต้องจัดการ timezone เอง) |
| **Complexity** | ✅ เรียบง่าย (ไม่มี timezone issue) | ❌ ซับซ้อน (ต้อง compensate timezone) |

---

## 🎯 สาเหตุของปัญหาในโปรเจคใหม่

### 1. **SQL Server Timezone Behavior**
- SQL Server `DATETIME` type ไม่มี timezone info
- แต่ SQL Server driver (mssql) แปลง datetime string เป็น UTC โดยอัตโนมัติ
- เมื่อ INSERT: `"2026-01-26 11:00:00"` → SQL Server แปลงเป็น UTC → เก็บ `04:00:00` (UTC)
- เมื่อ SELECT: Query ได้ `04:00:00` (UTC) → Driver แปลงเป็น local time → แสดง `11:00:00` (UTC+7)

### 2. **MySQL vs SQL Server**
- **MySQL**: เก็บ datetime string ตามที่ส่งมา (ไม่มี implicit conversion)
- **SQL Server**: แปลง datetime string เป็น UTC โดยอัตโนมัติ

---

## ✅ วิธีแก้ไขที่ใช้ในโปรเจคใหม่

### 1. **INSERT: ลบ 7 ชั่วโมง**
```javascript
// ส่ง: "2026-01-26 11:00:00"
// ลบ 7 ชั่วโมง: "2026-01-26 04:00:00"
// SQL Server แปลงเป็น UTC: เก็บ "04:00:00" (UTC)
```

### 2. **SELECT: บวก 7 ชั่วโมงกลับ**
```javascript
// Query ได้: "2026-01-26 04:00:00" (UTC)
// บวก 7 ชั่วโมง: "2026-01-26 11:00:00"
// ส่งไป frontend: "11:00:00" (ถูกต้อง)
```

### 3. **ใช้ FORMAT() ใน SQL**
```sql
FORMAT(br.start_datetime, 'yyyy-MM-dd HH:mm:ss') as start_datetime
```
- ป้องกัน driver-level timezone conversion

---

## 💡 คำแนะนำ

### สำหรับโปรเจคใหม่:
1. ✅ **ใช้ FORMAT() ใน SELECT** - ป้องกัน driver conversion
2. ✅ **ลบ 7 ชั่วโมงก่อน INSERT** - Compensate SQL Server UTC conversion
3. ✅ **บวก 7 ชั่วโมงเมื่อ SELECT** - แปลงกลับเป็น local time
4. ⚠️ **ระวัง**: Logic นี้จะทำงานได้เฉพาะเมื่อ SQL Server ตั้งค่า timezone เป็น UTC+7

### ทางเลือกที่ดีกว่า:
- ใช้ `DATETIMEOFFSET` type แทน `DATETIME` (รองรับ timezone)
- หรือใช้ `datetime2` type และจัดการ timezone ใน application layer
- หรือตั้งค่า SQL Server timezone ให้ตรงกับ application timezone

---

## 📝 หมายเหตุ

- โปรเจคเก่าใช้ MySQL ซึ่งไม่มี timezone conversion issue
- โปรเจคใหม่ใช้ SQL Server ซึ่งมี implicit UTC conversion
- การแก้ไขปัจจุบันใช้วิธี "compensate" โดยลบ/บวก 7 ชั่วโมง
- วิธีนี้ทำงานได้แต่ไม่ใช่ best practice (ควรใช้ timezone-aware types)
