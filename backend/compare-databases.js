const sql = require('mssql');

// Database configurations
const config1 = {
    server: '10.3.2.10',
    port: 1433,
    user: 'devadmin',
    password: 'Lannacom@Dev@2025',
    database: 'smart_room_booking',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 10000,
        requestTimeout: 30000,
    }
};

const config2 = {
    server: '10.3.2.10',
    port: 1433,
    user: 'devadmin',
    password: 'Lannacom@Dev@2025',
    database: 'room-management-portal',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 10000,
        requestTimeout: 30000,
    }
};

async function getTables(pool) {
    const query = `
        SELECT 
            TABLE_SCHEMA as schema_name,
            TABLE_NAME as table_name
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
    `;
    
    const result = await pool.request().query(query);
    return result.recordset.map(row => row.table_name.toLowerCase());
}

async function compareDatabases() {
    let pool1, pool2;
    
    try {
        console.log('='.repeat(70));
        console.log('🔍 กำลังเปรียบเทียบฐานข้อมูล...');
        console.log('='.repeat(70));
        console.log(`Database 1: ${config1.database} @ ${config1.server}`);
        console.log(`Database 2: ${config2.database} @ ${config2.server}`);
        console.log('');
        
        // Connect to first database
        console.log(`📊 กำลังเชื่อมต่อ ${config1.database}...`);
        pool1 = new sql.ConnectionPool(config1);
        await pool1.connect();
        console.log(`✅ เชื่อมต่อ ${config1.database} สำเร็จ`);
        
        const tables1 = await getTables(pool1);
        console.log(`   พบ ${tables1.length} ตาราง\n`);
        
        // Connect to second database
        console.log(`📊 กำลังเชื่อมต่อ ${config2.database}...`);
        pool2 = new sql.ConnectionPool(config2);
        await pool2.connect();
        console.log(`✅ เชื่อมต่อ ${config2.database} สำเร็จ`);
        
        const tables2 = await getTables(pool2);
        console.log(`   พบ ${tables2.length} ตาราง\n`);
        
        // Compare tables
        console.log('='.repeat(70));
        console.log('📋 ผลการเปรียบเทียบ');
        console.log('='.repeat(70));
        console.log('');
        
        // Tables in room-management-portal but not in smart_room_booking
        const missingInSmartRoomBooking = tables2.filter(table => !tables1.includes(table));
        
        // Tables in smart_room_booking but not in room-management-portal
        const missingInRoomManagementPortal = tables1.filter(table => !tables2.includes(table));
        
        // Common tables
        const commonTables = tables1.filter(table => tables2.includes(table));
        
        console.log(`📊 สรุป:`);
        console.log(`   - ${config1.database}: ${tables1.length} ตาราง`);
        console.log(`   - ${config2.database}: ${tables2.length} ตาราง`);
        console.log(`   - ตารางที่เหมือนกัน: ${commonTables.length} ตาราง`);
        console.log(`   - ตารางที่ ${config1.database} ขาด: ${missingInSmartRoomBooking.length} ตาราง`);
        console.log(`   - ตารางที่ ${config2.database} ขาด: ${missingInRoomManagementPortal.length} ตาราง`);
        console.log('');
        
        // Show missing tables in smart_room_booking
        if (missingInSmartRoomBooking.length > 0) {
            console.log('='.repeat(70));
            console.log(`❌ ตารางที่ ${config1.database} ขาด (มีใน ${config2.database} แต่ไม่มีใน ${config1.database}):`);
            console.log('='.repeat(70));
            console.log('');
            missingInSmartRoomBooking.forEach((table, index) => {
                console.log(`   ${(index + 1).toString().padStart(3, ' ')}. ${table}`);
            });
            console.log('');
        } else {
            console.log(`✅ ${config1.database} มีตารางครบทุกตารางที่ ${config2.database} มี`);
            console.log('');
        }
        
        // Show missing tables in room-management-portal
        if (missingInRoomManagementPortal.length > 0) {
            console.log('='.repeat(70));
            console.log(`❌ ตารางที่ ${config2.database} ขาด (มีใน ${config1.database} แต่ไม่มีใน ${config2.database}):`);
            console.log('='.repeat(70));
            console.log('');
            missingInRoomManagementPortal.forEach((table, index) => {
                console.log(`   ${(index + 1).toString().padStart(3, ' ')}. ${table}`);
            });
            console.log('');
        } else {
            console.log(`✅ ${config2.database} มีตารางครบทุกตารางที่ ${config1.database} มี`);
            console.log('');
        }
        
        // Show common tables
        console.log('='.repeat(70));
        console.log(`✅ ตารางที่เหมือนกัน (${commonTables.length} ตาราง):`);
        console.log('='.repeat(70));
        console.log('');
        commonTables.forEach((table, index) => {
            console.log(`   ${(index + 1).toString().padStart(3, ' ')}. ${table}`);
        });
        console.log('');
        
        console.log('='.repeat(70));
        console.log('✅ เสร็จสิ้น');
        console.log('='.repeat(70));
        
        await pool1.close();
        await pool2.close();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ เกิดข้อผิดพลาด:');
        console.error('Error Message:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Number:', error.number);
        
        if (error.stack) {
            console.error('\nStack Trace:');
            console.error(error.stack);
        }
        
        if (pool1 && pool1.connected) {
            await pool1.close();
        }
        if (pool2 && pool2.connected) {
            await pool2.close();
        }
        
        process.exit(1);
    }
}

// Run the function
compareDatabases();


