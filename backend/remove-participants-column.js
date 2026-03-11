const sql = require('mssql');

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

async function removeParticipantsColumn() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔧 กำลังลบ column participants จาก booking_requests');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        // Check if column exists
        const checkQuery = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'booking_requests' 
            AND COLUMN_NAME = 'participants'
        `;
        
        const checkResult = await pool.request().query(checkQuery);
        
        if (checkResult.recordset.length === 0) {
            console.log('⚠️  ไม่พบ column participants');
            await pool.close();
            process.exit(0);
            return;
        }
        
        console.log('✅ พบ column participants');
        
        // Check for constraints or indexes on this column
        const constraintQuery = `
            SELECT 
                tc.CONSTRAINT_NAME,
                tc.CONSTRAINT_TYPE
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            INNER JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
            WHERE tc.TABLE_NAME = 'booking_requests'
            AND ccu.COLUMN_NAME = 'participants'
        `;
        
        const constraintResult = await pool.request().query(constraintQuery);
        
        if (constraintResult.recordset.length > 0) {
            console.log('\n⚠️  พบ constraints ที่เกี่ยวข้อง:');
            constraintResult.recordset.forEach(constraint => {
                console.log(`   - ${constraint.CONSTRAINT_NAME} (${constraint.CONSTRAINT_TYPE})`);
            });
            console.log('\nกำลังลบ constraints...');
            
            // Drop constraints first
            for (const constraint of constraintResult.recordset) {
                try {
                    const dropConstraintQuery = `ALTER TABLE [dbo].[booking_requests] DROP CONSTRAINT [${constraint.CONSTRAINT_NAME}]`;
                    await pool.request().query(dropConstraintQuery);
                    console.log(`   ✅ ลบ constraint ${constraint.CONSTRAINT_NAME} เรียบร้อยแล้ว`);
                } catch (error) {
                    console.log(`   ⚠️  ไม่สามารถลบ constraint ${constraint.CONSTRAINT_NAME}: ${error.message}`);
                }
            }
        }
        
        // Check for indexes
        const indexQuery = `
            SELECT 
                i.name AS INDEX_NAME
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
            WHERE OBJECT_NAME(i.object_id) = 'booking_requests'
            AND c.name = 'participants'
            AND i.name IS NOT NULL
        `;
        
        const indexResult = await pool.request().query(indexQuery);
        
        if (indexResult.recordset.length > 0) {
            console.log('\n⚠️  พบ indexes ที่เกี่ยวข้อง:');
            indexResult.recordset.forEach(index => {
                console.log(`   - ${index.INDEX_NAME}`);
            });
            console.log('\nกำลังลบ indexes...');
            
            // Drop indexes first
            for (const index of indexResult.recordset) {
                try {
                    const dropIndexQuery = `DROP INDEX [${index.INDEX_NAME}] ON [dbo].[booking_requests]`;
                    await pool.request().query(dropIndexQuery);
                    console.log(`   ✅ ลบ index ${index.INDEX_NAME} เรียบร้อยแล้ว`);
                } catch (error) {
                    console.log(`   ⚠️  ไม่สามารถลบ index ${index.INDEX_NAME}: ${error.message}`);
                }
            }
        }
        
        // Now drop the column
        console.log('\nกำลังลบ column participants...');
        try {
            const dropColumnQuery = `ALTER TABLE [dbo].[booking_requests] DROP COLUMN [participants]`;
            await pool.request().query(dropColumnQuery);
            console.log('✅ ลบ column participants เรียบร้อยแล้ว');
        } catch (error) {
            console.error('❌ ไม่สามารถลบ column participants:', error.message);
            throw error;
        }
        
        // Verify
        const verifyQuery = `
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'booking_requests' 
            AND COLUMN_NAME = 'participants'
        `;
        
        const verifyResult = await pool.request().query(verifyQuery);
        
        if (verifyResult.recordset.length === 0) {
            console.log('\n✅ ยืนยัน: column participants ถูกลบออกแล้ว');
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
removeParticipantsColumn();

