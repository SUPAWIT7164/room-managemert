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

async function removeRemainingColumns() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔧 กำลังลบ columns ที่เหลือ: auto_cancelled, send_notification');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log('');
        
        // Connect to database
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');
        
        const columnsToRemove = ['auto_cancelled', 'send_notification'];
        
        for (const columnName of columnsToRemove) {
            console.log(`🔍 กำลังตรวจสอบ column: ${columnName}\n`);
            
            // Check for computed columns
            const checkComputedQuery = `
                SELECT 
                    c.name AS COLUMN_NAME,
                    c.is_computed,
                    OBJECT_DEFINITION(c.object_id) AS DEFINITION
                FROM sys.columns c
                INNER JOIN sys.tables t ON c.object_id = t.object_id
                WHERE t.name = 'booking_requests'
                AND c.name = @columnName
                AND c.is_computed = 1
            `;
            
            const checkComputedRequest = pool.request();
            checkComputedRequest.input('columnName', sql.NVarChar(255), columnName);
            const computedResult = await checkComputedRequest.query(checkComputedQuery);
            
            if (computedResult.recordset.length > 0) {
                console.log(`   ⚠️  ${columnName} เป็น computed column`);
                // Computed columns need to be dropped differently
                try {
                    const dropComputedQuery = `
                        ALTER TABLE [dbo].[booking_requests] 
                        DROP COLUMN [${columnName}]
                    `;
                    await pool.request().query(dropComputedQuery);
                    console.log(`   ✅ ลบ computed column ${columnName} เรียบร้อยแล้ว`);
                    continue;
                } catch (error) {
                    console.log(`   ❌ ไม่สามารถลบ computed column: ${error.message}`);
                }
            }
            
            // Check for default constraints
            const checkDefaultsQuery = `
                SELECT 
                    dc.name AS CONSTRAINT_NAME
                FROM sys.default_constraints dc
                INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                INNER JOIN sys.tables t ON c.object_id = t.object_id
                WHERE t.name = 'booking_requests'
                AND c.name = @columnName
            `;
            
            const checkDefaultsRequest = pool.request();
            checkDefaultsRequest.input('columnName', sql.NVarChar(255), columnName);
            const defaultsResult = await checkDefaultsRequest.query(checkDefaultsQuery);
            
            if (defaultsResult.recordset.length > 0) {
                for (const constraint of defaultsResult.recordset) {
                    try {
                        const dropDefaultQuery = `
                            ALTER TABLE [dbo].[booking_requests] 
                            DROP CONSTRAINT [${constraint.CONSTRAINT_NAME}]
                        `;
                        await pool.request().query(dropDefaultQuery);
                        console.log(`   ✅ ลบ default constraint ${constraint.CONSTRAINT_NAME} เรียบร้อยแล้ว`);
                    } catch (error) {
                        console.log(`   ⚠️  ไม่สามารถลบ default constraint: ${error.message}`);
                    }
                }
            }
            
            // Check for check constraints
            const checkChecksQuery = `
                SELECT 
                    cc.name AS CONSTRAINT_NAME
                FROM sys.check_constraints cc
                INNER JOIN sys.columns c ON cc.parent_object_id = c.object_id
                INNER JOIN sys.tables t ON c.object_id = t.object_id
                WHERE t.name = 'booking_requests'
                AND c.name = @columnName
            `;
            
            const checkChecksRequest = pool.request();
            checkChecksRequest.input('columnName', sql.NVarChar(255), columnName);
            const checksResult = await checkChecksRequest.query(checkChecksQuery);
            
            if (checksResult.recordset.length > 0) {
                for (const constraint of checksResult.recordset) {
                    try {
                        const dropCheckQuery = `
                            ALTER TABLE [dbo].[booking_requests] 
                            DROP CONSTRAINT [${constraint.CONSTRAINT_NAME}]
                        `;
                        await pool.request().query(dropCheckQuery);
                        console.log(`   ✅ ลบ check constraint ${constraint.CONSTRAINT_NAME} เรียบร้อยแล้ว`);
                    } catch (error) {
                        console.log(`   ⚠️  ไม่สามารถลบ check constraint: ${error.message}`);
                    }
                }
            }
            
            // Check for foreign keys
            const checkFKQuery = `
                SELECT 
                    fk.name AS CONSTRAINT_NAME
                FROM sys.foreign_keys fk
                INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                INNER JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
                INNER JOIN sys.tables t ON c.object_id = t.object_id
                WHERE t.name = 'booking_requests'
                AND c.name = @columnName
            `;
            
            const checkFKRequest = pool.request();
            checkFKRequest.input('columnName', sql.NVarChar(255), columnName);
            const fkResult = await checkFKRequest.query(checkFKQuery);
            
            if (fkResult.recordset.length > 0) {
                for (const constraint of fkResult.recordset) {
                    try {
                        const dropFKQuery = `
                            ALTER TABLE [dbo].[booking_requests] 
                            DROP CONSTRAINT [${constraint.CONSTRAINT_NAME}]
                        `;
                        await pool.request().query(dropFKQuery);
                        console.log(`   ✅ ลบ foreign key ${constraint.CONSTRAINT_NAME} เรียบร้อยแล้ว`);
                    } catch (error) {
                        console.log(`   ⚠️  ไม่สามารถลบ foreign key: ${error.message}`);
                    }
                }
            }
            
            // Check for indexes
            const checkIndexesQuery = `
                SELECT DISTINCT
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
            
            if (indexesResult.recordset.length > 0) {
                for (const index of indexesResult.recordset) {
                    try {
                        const dropIndexQuery = `
                            DROP INDEX [${index.INDEX_NAME}] ON [dbo].[booking_requests]
                        `;
                        await pool.request().query(dropIndexQuery);
                        console.log(`   ✅ ลบ index ${index.INDEX_NAME} เรียบร้อยแล้ว`);
                    } catch (error) {
                        console.log(`   ⚠️  ไม่สามารถลบ index: ${error.message}`);
                    }
                }
            }
            
            // Check for views that reference this column
            const checkViewsQuery = `
                SELECT 
                    OBJECT_NAME(object_id) AS VIEW_NAME
                FROM sys.sql_modules
                WHERE definition LIKE '%' + @columnName + '%'
                AND OBJECT_NAME(object_id) IS NOT NULL
            `;
            
            const checkViewsRequest = pool.request();
            checkViewsRequest.input('columnName', sql.NVarChar(255), columnName);
            const viewsResult = await checkViewsRequest.query(checkViewsQuery);
            
            if (viewsResult.recordset.length > 0) {
                console.log(`   ⚠️  พบ views ที่อ้างอิง column นี้:`);
                viewsResult.recordset.forEach(view => {
                    console.log(`      - ${view.VIEW_NAME}`);
                });
                console.log(`   ⚠️  ต้องลบหรือแก้ไข views เหล่านี้ก่อน`);
            }
            
            // Try to drop the column
            try {
                const dropColumnQuery = `
                    ALTER TABLE [dbo].[booking_requests] 
                    DROP COLUMN [${columnName}]
                `;
                
                await pool.request().query(dropColumnQuery);
                console.log(`   ✅ ลบ column ${columnName} เรียบร้อยแล้ว\n`);
                
            } catch (error) {
                console.error(`   ❌ ไม่สามารถลบ column ${columnName}: ${error.message}`);
                console.error(`   💡 ข้อแนะนำ: ตรวจสอบ triggers, views, หรือ stored procedures ที่อาจอ้างอิง column นี้\n`);
            }
        }
        
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
            console.log(`   ${(index + 1).toString().padStart(3, ' ')}. ${col.COLUMN_NAME.padEnd(30)} ${type.padEnd(20)} ${nullable}`);
        });
        
        const keepColumns = [
            'id', 'name', 'booker', 'room', 'start', 'end', 'hour', 'instructor',
            'attendees', 'description', 'calendar_id', 'icaluid', 'qrcode',
            'online_meeting', 'email_notify', 'status', 'cancel', 'reject',
            'reject_reason', 'objective', 'transaction_id', 'approve_by',
            'created_at', 'updated_at'
        ];
        
        const extraColumns = finalColumns.filter(col => 
            !keepColumns.map(c => c.toLowerCase()).includes(col.toLowerCase())
        );
        
        console.log('\n' + '='.repeat(70));
        console.log('📊 สรุปผล:');
        console.log('='.repeat(70));
        console.log(`   - จำนวน columns ทั้งหมด: ${finalColumns.length} columns`);
        console.log(`   - Columns ที่ต้องการ: ${keepColumns.length} columns`);
        console.log(`   - Columns เพิ่มเติม: ${extraColumns.length} columns`);
        
        if (extraColumns.length > 0) {
            console.log('\n⚠️  Columns เพิ่มเติมที่ยังเหลืออยู่:');
            extraColumns.forEach(col => {
                console.log(`   - ${col}`);
            });
        } else {
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
removeRemainingColumns();


