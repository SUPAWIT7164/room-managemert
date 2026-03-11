const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Database configuration for smart_room_booking
const config = {
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

async function runSQLScript() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔧 กำลังรัน SQL script: sync-booking-requests-table.sql');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        // Read SQL script
        const sqlFilePath = path.join(__dirname, 'sync-booking-requests-table.sql');
        
        if (!fs.existsSync(sqlFilePath)) {
            console.error(`❌ ไม่พบไฟล์: ${sqlFilePath}`);
            process.exit(1);
        }
        
        const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
        console.log(`📝 อ่านไฟล์ SQL script สำเร็จ (${sqlScript.length} characters)\n`);
        
        // Split script by GO statements (case insensitive)
        // GO must be on its own line or at the end of a line
        const batches = sqlScript
            .split(/\n\s*GO\s*\n/gi)
            .map(batch => batch.trim())
            .filter(batch => {
                // Remove empty batches and comment-only batches
                const content = batch.replace(/--.*$/gm, '').trim();
                return content.length > 0 && !content.match(/^USE\s+/i);
            });
        
        console.log(`📊 พบ ${batches.length} batches ที่จะรัน\n`);
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            
            // Skip USE statements (already connected to database)
            if (batch.match(/^USE\s+/i)) {
                console.log(`⏭️  Batch ${i + 1}: ข้าม USE statement`);
                skipCount++;
                continue;
            }
            
            // Skip PRINT-only batches (they don't execute queries)
            if (batch.match(/^PRINT\s+/i) && !batch.match(/ALTER\s+TABLE|CREATE\s+|DROP\s+|UPDATE\s+|INSERT\s+|DELETE\s+/i)) {
                // PRINT statements will be executed but won't show output in Node.js
                // We'll still execute them but won't log
            }
            
            try {
                console.log(`🔄 Batch ${i + 1}/${batches.length}: กำลังรัน...`);
                
                // Execute the batch
                const result = await pool.request().query(batch);
                
                // Check if there are any messages (PRINT statements)
                if (result.recordset && result.recordset.length > 0) {
                    result.recordset.forEach(row => {
                        const message = Object.values(row)[0];
                        if (message) {
                            console.log(`   📢 ${message}`);
                        }
                    });
                }
                
                successCount++;
                console.log(`   ✅ Batch ${i + 1} สำเร็จ\n`);
                
            } catch (error) {
                // Check if this is an expected error
                const errorMsg = error.message.toLowerCase();
                const isExpectedError = 
                    errorMsg.includes('already exists') ||
                    errorMsg.includes('มีอยู่แล้ว') ||
                    errorMsg.includes('already an object') ||
                    errorMsg.includes('does not exist') ||
                    errorMsg.includes('ไม่พบ') ||
                    errorMsg.includes('cannot drop') ||
                    errorMsg.includes('ambiguous column name');
                
                if (isExpectedError) {
                    console.log(`   ⚠️  Batch ${i + 1}: ${error.message.substring(0, 100)}`);
                    skipCount++;
                } else {
                    console.error(`   ❌ Batch ${i + 1} เกิดข้อผิดพลาด:`);
                    console.error(`      ${error.message}`);
                    console.error(`      Code: ${error.code}, Number: ${error.number}`);
                    errorCount++;
                    
                    // Continue with next batch instead of stopping
                    // Uncomment the next line if you want to stop on error
                    // throw error;
                }
                console.log('');
            }
        }
        
        console.log('='.repeat(70));
        console.log('📊 สรุปผลการรัน:');
        console.log('='.repeat(70));
        console.log(`   ✅ สำเร็จ: ${successCount} batches`);
        console.log(`   ⏭️  ข้าม: ${skipCount} batches`);
        console.log(`   ❌ ผิดพลาด: ${errorCount} batches`);
        console.log('');
        
        // Verify final structure
        console.log('🔍 กำลังตรวจสอบโครงสร้างตาราง...');
        const verifyQuery = `
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'booking_requests'
            ORDER BY ORDINAL_POSITION
        `;
        
        const verifyResult = await pool.request().query(verifyQuery);
        console.log(`\n📋 โครงสร้างตาราง booking_requests (${verifyResult.recordset.length} columns):`);
        
        // Show only first 10 and last 10 columns
        const totalCols = verifyResult.recordset.length;
        const showCols = verifyResult.recordset.slice(0, 10);
        showCols.forEach(col => {
            let type = col.DATA_TYPE.toUpperCase();
            if (col.CHARACTER_MAXIMUM_LENGTH) {
                if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                    type += '(MAX)';
                } else {
                    type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                }
            }
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}`);
        });
        
        if (totalCols > 20) {
            console.log(`   ... (${totalCols - 20} columns อื่นๆ) ...`);
            const lastCols = verifyResult.recordset.slice(-10);
            lastCols.forEach(col => {
                let type = col.DATA_TYPE.toUpperCase();
                if (col.CHARACTER_MAXIMUM_LENGTH) {
                    if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                        type += '(MAX)';
                    } else {
                        type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                    }
                }
                const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
                console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}`);
            });
        }
        
        // Check if participants column was removed
        const checkParticipants = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'booking_requests' AND COLUMN_NAME = 'participants'
        `);
        
        if (checkParticipants.recordset.length === 0) {
            console.log('\n✅ column participants ถูกลบออกแล้ว');
        } else {
            console.log('\n⚠️  column participants ยังมีอยู่');
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ เสร็จสิ้น');
        console.log('='.repeat(70));
        
        await pool.close();
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
        
        if (pool && pool.connected) {
            await pool.close();
        }
        
        process.exit(1);
    }
}

// Run the function
runSQLScript();


