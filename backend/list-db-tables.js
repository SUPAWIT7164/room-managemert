const sql = require('mssql');

// Database configuration
const config = {
    server: '10.3.2.10',
    port: 1433,
    user: 'devadmin',
    password: 'Lannacom@Dev@2025',
    database: 'room-management-portal',
    options: {
        encrypt: false, // Use false for local SQL Server
        trustServerCertificate: true, // Trust self-signed certificates
        enableArithAbort: true,
        connectionTimeout: 10000, // 10 seconds
        requestTimeout: 30000, // 30 seconds
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function listTables() {
    let pool;
    
    try {
        console.log('='.repeat(70));
        console.log('🔍 กำลังเชื่อมต่อฐานข้อมูล...');
        console.log('='.repeat(70));
        console.log(`Server: ${config.server}`);
        console.log(`Database: ${config.database}`);
        console.log(`User: ${config.user}`);
        console.log('');
        
        // Create connection pool
        pool = new sql.ConnectionPool(config);
        await pool.connect();
        
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ!\n');
        
        // Query to get all tables in SQL Server
        const query = `
            SELECT 
                TABLE_SCHEMA as schema_name,
                TABLE_NAME as table_name,
                TABLE_TYPE as table_type
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_SCHEMA, TABLE_NAME
        `;
        
        const result = await pool.request().query(query);
        const tables = result.recordset;
        
        console.log('='.repeat(70));
        console.log(`📊 พบตารางทั้งหมด: ${tables.length} ตาราง`);
        console.log('='.repeat(70));
        console.log('');
        
        if (tables.length === 0) {
            console.log('⚠️  ไม่พบตารางในฐานข้อมูล');
        } else {
            // Group by schema
            const tablesBySchema = {};
            tables.forEach(table => {
                const schema = table.schema_name || 'dbo';
                if (!tablesBySchema[schema]) {
                    tablesBySchema[schema] = [];
                }
                tablesBySchema[schema].push(table.table_name);
            });
            
            // Display tables grouped by schema
            let index = 1;
            Object.keys(tablesBySchema).sort().forEach(schema => {
                console.log(`📁 Schema: ${schema}`);
                tablesBySchema[schema].forEach(tableName => {
                    console.log(`   ${index.toString().padStart(3, ' ')}. ${tableName}`);
                    index++;
                });
                console.log('');
            });
            
            // Also get row counts for each table
            console.log('='.repeat(70));
            console.log('📈 จำนวนข้อมูลในแต่ละตาราง:');
            console.log('='.repeat(70));
            console.log('');
            
            for (const table of tables) {
                try {
                    const schema = table.schema_name || 'dbo';
                    const tableName = table.table_name;
                    const fullTableName = `[${schema}].[${tableName}]`;
                    
                    const countQuery = `SELECT COUNT(*) as count FROM ${fullTableName}`;
                    const countResult = await pool.request().query(countQuery);
                    const count = countResult.recordset[0].count;
                    
                    console.log(`   ${tableName.padEnd(40, ' ')} : ${count.toString().padStart(10, ' ')} แถว`);
                } catch (error) {
                    console.log(`   ${table.table_name.padEnd(40, ' ')} : ไม่สามารถนับได้ (${error.message})`);
                }
            }
        }
        
        console.log('');
        console.log('='.repeat(70));
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
listTables();


