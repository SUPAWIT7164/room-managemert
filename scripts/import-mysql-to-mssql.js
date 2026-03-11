/**
 * แปลง INSERT จากไฟล์ MySQL (smart_room_booking (1).sql) เป็น T-SQL สำหรับ SQL Server
 * รัน: node scripts/import-mysql-to-mssql.js [path-to-mysql.sql]
 * สร้าง: scripts/insert_smart_room_booking_data_mssql.sql
 */

const fs = require('fs');
const path = require('path');

const MYSQL_PATH = process.argv[2] || 'C:\\inetpub\\wwwroot\\Final-Booking\\Final-Booking\\smart_room_booking (1).sql';
const OUT_PATH = path.join(__dirname, 'insert_smart_room_booking_data_mssql.sql');

const IDENTITY_TABLES = new Set([
  'area_types', 'areas', 'booking_requests', 'buildings', 'building_types',
  'devices', 'device_positions', 'device_states', 'device_types', 'energy_data',
  'environmental_data', 'faces', 'migrations', 'permissions', 'roles',
  'rooms', 'room_types', 'settings', 'usage_quotas', 'users', 'user_preferences', 'visitors'
]);

function convertValue(val) {
  let s = val;
  // \N (MySQL NULL) -> NULL
  s = s.replace(/([,(])\s*\\N\s*([\s]*)([,)])/g, '$1NULL$2$3');
  //  inside strings: \' -> '', \" -> ", \\ -> \ (order matters)
  //  We only touch contents of quoted strings - do a simple global that’s safe:
  //  \' -> '' (escaped quote in MySQL)
  s = s.replace(/\\'/g, "''");
  s = s.replace(/\\"/g, '"');
  s = s.replace(/\\\\/g, '\\');
  return s;
}

function convertInsert(match, table, cols, values) {
  const t = table.trim().toLowerCase();
  const colsStr = cols.replace(/`/g, ']').replace(/,/g, '],[').replace(/^/, '[');
  if (colsStr.startsWith('[') && !colsStr.startsWith('[[')) {
    // already have [ at start from the replace - the first ` became ], so we got ]name
    // We want [name]. So: `a`,`b` -> [a],[b]. Replace `(\w+)` with [$1]
    // Simpler: replace each `x` with [x]
  }
  const colsFixed = cols.split(',').map(c => '[' + c.trim().replace(/^`|`$/g, '') + ']').join(',');
  let vals = convertValue(values);
  const insertLine = `INSERT INTO [dbo].[${table.trim()}] (${colsFixed}) VALUES ${vals};`;
  const useIdentity = IDENTITY_TABLES.has(t);
  const lines = [];
  if (useIdentity) {
    lines.push(`SET IDENTITY_INSERT [dbo].[${table.trim()}] ON;`);
  }
  lines.push(insertLine);
  if (useIdentity) {
    lines.push(`SET IDENTITY_INSERT [dbo].[${table.trim()}] OFF;`);
  }
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(MYSQL_PATH)) {
    console.error('ไม่พบไฟล์:', MYSQL_PATH);
    process.exit(1);
  }
  let sql = fs.readFileSync(MYSQL_PATH, 'utf8');

  // ลบ MySQL-specific blocks
  sql = sql.replace(/\/\*![\s\S]*?\*\//g, '');
  sql = sql.replace(/SET [^;]+;/g, '');
  sql = sql.replace(/START TRANSACTION;|COMMIT;|SET time_zone[^;]+;/g, '');
  sql = sql.replace(/ENGINE=\w+[^;]*;/gi, '');

  const inserts = [];
  const headRe = /INSERT INTO `([^`]+)`\s*\(([^)]+)\)\s*VALUES\s*/gi;
  let m;
  while ((m = headRe.exec(sql)) !== null) {
    const valuesStart = m.index + m[0].length;
    const nextInsert = sql.indexOf('INSERT INTO `', valuesStart);
    const nextCreate = sql.indexOf('CREATE TABLE `', valuesStart);
    const nextIndexes = sql.indexOf('-- Indexes for dumped tables', valuesStart);
    const nextAlter = sql.indexOf('ALTER TABLE `', valuesStart);
    let blockEnd = sql.length;
    if (nextInsert >= 0) blockEnd = Math.min(blockEnd, nextInsert);
    if (nextCreate >= 0) blockEnd = Math.min(blockEnd, nextCreate);
    if (nextIndexes >= 0) blockEnd = Math.min(blockEnd, nextIndexes);
    if (nextAlter >= 0) blockEnd = Math.min(blockEnd, nextAlter);
    const block = sql.substring(valuesStart, blockEnd);
    const endings = [...block.matchAll(/\)\s*;\s*(\r?\n|$)/g)];
    const last = endings.length ? endings[endings.length - 1] : null;
    const values = last ? block.substring(0, last.index + 1) : block.replace(/\s*;\s*$/, '');
    inserts.push({ table: m[1], cols: m[2], values });
  }

  const out = [];
  out.push('-- ============================================================');
  out.push('-- นำเข้าข้อมูลจาก smart_room_booking (MySQL) ไปยัง SQL Server');
  out.push('-- รันหลัง create_smart_room_booking_mssql.sql');
  out.push('-- Server: AZ-BMS-DEV, DB: smart_room_booking');
  out.push('-- ============================================================\n');
  out.push('USE [smart_room_booking];');
  out.push('GO\n');
  out.push("IF COL_LENGTH('dbo.faces','image_base64') IS NULL ALTER TABLE [dbo].[faces] ADD [image_base64] nvarchar(max) NULL;");
  out.push('GO\n');

  for (const i of inserts) {
    const t = i.table.trim().toLowerCase();
    const colsFixed = i.cols.split(',').map(c => '[' + c.trim().replace(/^`|`$/g, '') + ']').join(',');
    let vals = i.values;
    vals = vals.replace(/([,(])\s*\\N\s*([\s]*)([,)])/g, '$1NULL$2$3');
    vals = vals.replace(/\\'/g, "''").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    vals = vals.replace(/`/g, ''); // ลบ backtick ที่เหลือ (ไวยากรณ์ MySQL) เพื่อไม่ให้ error ใน T-SQL
    const insertLine = `INSERT INTO [dbo].[${i.table.trim()}] (${colsFixed}) VALUES ${vals};`;
    if (IDENTITY_TABLES.has(t)) {
      out.push(`SET IDENTITY_INSERT [dbo].[${i.table.trim()}] ON;`);
    }
    out.push(insertLine);
    if (IDENTITY_TABLES.has(t)) {
      out.push(`SET IDENTITY_INSERT [dbo].[${i.table.trim()}] OFF;`);
    }
    out.push('GO');
    out.push('');
  }

  fs.writeFileSync(OUT_PATH, out.join('\n'), 'utf8');
  console.log('สร้างไฟล์แล้ว:', OUT_PATH);
  console.log('จำนวน INSERT:', inserts.length);
}

main();
