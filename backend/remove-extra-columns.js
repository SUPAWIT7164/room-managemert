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

async function removeExtraColumns() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔧 กำลังลบ columns ที่ไม่ต้องการออกจาก booking_requests');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        // Columns ที่ต้องเก็บไว้
        const keepColumns = [
            'id', 'name', 'booker', 'room', 'start', 'end', 'hour', 'instructor',
            'attendees', 'description', 'calendar_id', 'icaluid', 'qrcode',
            'online_meeting', 'email_notify', 'status', 'cancel', 'reject',
            'reject_reason', 'objective', 'transaction_id', 'approve_by',
            'created_at', 'updated_at'
        ];
        
        // Get all columns
        const getColumnsQuery = `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'booking_requests'
            ORDER BY ORDINAL_POSITION
        `;
        
        const columnsResult = await pool.request().query(getColumnsQuery);
        const allColumns = columnsResult.recordset.map(row => row.COLUMN_NAME);
        
        // Find columns to remove
        const columnsToRemove = allColumns.filter(col => 
            !keepColumns.includes(col.toLowerCase())
        );
        
        console.log(`📊 พบ columns ทั้งหมด: ${allColumns.length} columns`);
        console.log(`📊 Columns ที่ต้องเก็บไว้: ${keepColumns.length} columns`);
        console.log(`📊 Columns ที่ต้องลบ: ${columnsToRemove.length} columns\n`);
        
        if (columnsToRemove.length === 0) {
            console.log('✅ ไม่มี columns ที่ต้องลบ');
            await pool.close();
            process.exit(0);
            return;
        }
        
        console.log('📋 Columns ที่จะลบ:');
        columnsToRemove.forEach((col, index) => {
            console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${col}`);
        });
        console.log('');
        
        // Before removing, ensure data is migrated
        console.log('📊 กำลังตรวจสอบและ migrate ข้อมูล...\n');
        
        // Migrate data if needed
        const migrations = [
            { from: 'start_datetime', to: 'start', transform: 'CAST([start_datetime] AS DATETIME)' },
            { from: 'end_datetime', to: 'end', transform: 'CAST([end_datetime] AS DATETIME)' }
        ];
        
        for (const migration of migrations) {
            if (allColumns.includes(migration.from) && allColumns.includes(migration.to)) {
                try {
                    const updateQuery = `
                        UPDATE [dbo].[booking_requests] 
                        SET [${migration.to}] = ${migration.transform}
                        WHERE [${migration.to}] IS NULL OR [${migration.to}] = CAST('1900-01-01' AS DATETIME)
                    `;
                    const result = await pool.request().query(updateQuery);
                    console.log(`✅ Migrate ${migration.from} -> ${migration.to} (${result.rowsAffected[0]} แถว)`);
                } catch (error) {
                    console.log(`⚠️  ไม่สามารถ migrate ${migration.from} -> ${migration.to}: ${error.message}`);
                }
            }
        }
        
        console.log('\n🔧 กำลังลบ columns...\n');
        
        // Remove columns one by one
        for (let i = 0; i < columnsToRemove.length; i++) {
            const columnName = columnsToRemove[i];
            
            try {
                // Check for constraints
                const checkConstraintsQuery = `
                    SELECT 
                        tc.CONSTRAINT_NAME,
                        tc.CONSTRAINT_TYPE
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    INNER JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                        ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
                    WHERE tc.TABLE_NAME = 'booking_requests'
                    AND ccu.COLUMN_NAME = @columnName
                `;
                
                const checkRequest = pool.request();
                checkRequest.input('columnName', sql.NVarChar(255), columnName);
                const constraintsResult = await checkRequest.query(checkConstraintsQuery);
                
                // Drop constraints first
                if (constraintsResult.recordset.length > 0) {
                    for (const constraint of constraintsResult.recordset) {
                        try {
                            const dropConstraintQuery = `
                                ALTER TABLE [dbo].[booking_requests] 
                                DROP CONSTRAINT [${constraint.CONSTRAINT_NAME}]
                            `;
                            await pool.request().query(dropConstraintQuery);
                            console.log(`   🔗 ลบ constraint ${constraint.CONSTRAINT_NAME} เรียบร้อยแล้ว`);
                        } catch (error) {
                            console.log(`   ⚠️  ไม่สามารถลบ constraint ${constraint.CONSTRAINT_NAME}: ${error.message}`);
                        }
                    }
                }
                
                // Check for indexes
                const checkIndexesQuery = `
                    SELECT 
                        i.name AS INDEX_NAME
                    FROM sys.indexes i
                    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                    WHERE OBJECT_NAME(i.object_id) = 'booking_requests'
                    AND c.name = @columnName
                    AND i.name IS NOT NULL
                    AND i.is_primary_key = 0
                `;
                
                const checkIndexRequest = pool.request();
                checkIndexRequest.input('columnName', sql.NVarChar(255), columnName);
                const indexesResult = await checkIndexRequest.query(checkIndexesQuery);
                
                // Drop indexes first
                if (indexesResult.recordset.length > 0) {
                    for (const index of indexesResult.recordset) {
                        try {
                            const dropIndexQuery = `
                                DROP INDEX [${index.INDEX_NAME}] ON [dbo].[booking_requests]
                            `;
                            await pool.request().query(dropIndexQuery);
                            console.log(`   📇 ลบ index ${index.INDEX_NAME} เรียบร้อยแล้ว`);
                        } catch (error) {
                            console.log(`   ⚠️  ไม่สามารถลบ index ${index.INDEX_NAME}: ${error.message}`);
                        }
                    }
                }
                
                // Drop the column
                const dropColumnQuery = `
                    ALTER TABLE [dbo].[booking_requests] 
                    DROP COLUMN [${columnName}]
                `;
                
                await pool.request().query(dropColumnQuery);
                console.log(`✅ ลบ column ${columnName} เรียบร้อยแล้ว (${i + 1}/${columnsToRemove.length})`);
                
            } catch (error) {
                console.error(`❌ ไม่สามารถลบ column ${columnName}: ${error.message}`);
                // Continue with next column
            }
        }
        
        // Verify final structure
        console.log('\n🔍 กำลังตรวจสอบโครงสร้างตาราง...');
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
        const finalColumns = verifyResult.recordset.map(row => row.COLUMN_NAME);
        
        console.log(`\n📋 โครงสร้างตาราง booking_requests (${finalColumns.length} columns):`);
        verifyResult.recordset.forEach((col, index) => {
            let type = col.DATA_TYPE.toUpperCase();
            if (col.CHARACTER_MAXIMUM_LENGTH) {
                if (col.CHARACTER_MAXIMUM_LENGTH === -1) {
                    type += '(MAX)';
                } else {
                    type += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
                }
            }
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const isRequired = keepColumns.includes(col.COLUMN_NAME.toLowerCase());
            const marker = isRequired ? '✅' : '❌';
            
            console.log(`${marker} ${(index + 1).toString().padStart(3, ' ')}. ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}`);
        });
        
        // Check if all required columns are present
        const missingColumns = keepColumns.filter(col => 
            !finalColumns.map(c => c.toLowerCase()).includes(col.toLowerCase())
        );
        
        const extraColumns = finalColumns.filter(col => 
            !keepColumns.map(c => c.toLowerCase()).includes(col.toLowerCase())
        );
        
        console.log('\n' + '='.repeat(70));
        console.log('📊 สรุปผล:');
        console.log('='.repeat(70));
        console.log(`   - จำนวน columns ทั้งหมด: ${finalColumns.length} columns`);
        console.log(`   - Columns ที่ต้องการ: ${keepColumns.length} columns`);
        console.log(`   - Columns ที่ขาด: ${missingColumns.length} columns`);
        console.log(`   - Columns เพิ่มเติม: ${extraColumns.length} columns`);
        
        if (missingColumns.length > 0) {
            console.log('\n❌ Columns ที่ขาดหายไป:');
            missingColumns.forEach(col => {
                console.log(`   - ${col}`);
            });
        }
        
        if (extraColumns.length > 0) {
            console.log('\n⚠️  Columns เพิ่มเติมที่ยังเหลืออยู่:');
            extraColumns.forEach(col => {
                console.log(`   - ${col}`);
            });
        }
        
        if (missingColumns.length === 0 && extraColumns.length === 0) {
            console.log('\n✅ ตารางมี columns ครบถ้วนตามที่ต้องการ!');
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
removeExtraColumns();


