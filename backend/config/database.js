require('dotenv').config();

// This project uses SQL Server only
// DB_CONNECTION=sqlsrv indicates SQL Server
const DB_CONNECTION = (process.env.DB_CONNECTION || '').toLowerCase();
const DB_TYPE = 'mssql'; // Always SQL Server
let pool = null;
let dbDriver = null;

console.log('[DB] Database type detection:', {
    'DB_CONNECTION env': process.env.DB_CONNECTION,
    'Detected DB_TYPE': DB_TYPE
});

// SQL Server configuration
const sql = require('mssql');

const config = {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || 1433),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_room_booking',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // Use encryption for Azure SQL
        trustServerCertificate: process.env.DB_TRUST_CERT !== 'false', // Trust self-signed certificates (default: true)
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

// Create connection pool
pool = new sql.ConnectionPool(config);

// Connect to the database
pool.connect()
    .then(() => {
        console.log('✅ SQL Server connection pool created');
    })
    .catch(err => {
        console.error('❌ SQL Server connection pool creation failed:', err.message);
    });

dbDriver = sql;

// Convert MySQL-style functions to T-SQL for SQL Server
function convertMySqlFunctionsForMssql(sql) {
    
    const originalSql = sql;
    
    // DATE(column) -> CAST(column AS DATE)
    // รองรับทั้ง DATE(column) และ DATE (column) (มี space)
    sql = sql.replace(/DATE\s*\(\s*([^)]+)\s*\)/gi, 'CAST($1 AS DATE)');
    
    // CURDATE() -> CAST(GETDATE() AS DATE)
    sql = sql.replace(/CURDATE\s*\(\)/gi, 'CAST(GETDATE() AS DATE)');
    
    // NOW() -> GETDATE()
    sql = sql.replace(/\bNOW\s*\(\)/gi, 'GETDATE()');
    
    // DATABASE() -> DB_NAME() (SQL Server)
    sql = sql.replace(/\bDATABASE\s*\(\s*\)/gi, 'DB_NAME()');
    // INFORMATION_SCHEMA: MySQL TABLE_SCHEMA = DATABASE() -> SQL Server TABLE_CATALOG = DB_NAME()
    sql = sql.replace(/TABLE_SCHEMA\s*=\s*DB_NAME\s*\(\s*\)/gi, 'TABLE_CATALOG = DB_NAME()');
    
    if (originalSql !== sql) {
        console.log('[DB] MySQL function conversion:');
        console.log('[DB]   Original:', originalSql.substring(0, 200));
        console.log('[DB]   Converted:', sql.substring(0, 200));
    }
    
    return sql;
}

// แปลง MySQL LIMIT/OFFSET เป็น T-SQL สำหรับ SQL Server
function convertLimitOffsetForMssql(sql, params = []) {
    // LIMIT 1 (literal) -> SELECT TOP 1 (ถ้าไม่มี ORDER BY)
    let m = sql.match(/^(\s*SELECT)(\s+)([\s\S]*?)\s+LIMIT\s+1\s*$/i);
    if (m && !/ORDER\s+BY/i.test(m[3])) {
        return { sql: m[1] + ' TOP 1' + m[2] + m[3], params };
    }
    
    // LIMIT ? OFFSET ? (parameterized) -> ORDER BY ... OFFSET x ROWS FETCH NEXT y ROWS ONLY
    // รองรับ GROUP BY ... ORDER BY ... LIMIT ? OFFSET ?
    // หมายเหตุ: ใน MySQL query: "LIMIT ? OFFSET ?" 
    // และใน params array: [..., limit_value, offset_value]
    // ดังนั้น params[length-2] = limit, params[length-1] = offset
    m = sql.match(/([\s\S]*?)\s+ORDER\s+BY\s+([\s\S]*?)\s+LIMIT\s+\?\s+OFFSET\s+\?\s*$/i);
    if (m && params.length >= 2) {
        // ใน MySQL: "LIMIT ? OFFSET ?" และ params: [..., limit_value, offset_value]
        // ตัวอย่าง: [..., 10, 0] หมายถึง LIMIT 10 OFFSET 0
        // ดังนั้น params[length-2] = limit, params[length-1] = offset
        const limitValue = params[params.length - 2];  // LIMIT ? = params[length-2]
        const offsetValue = params[params.length - 1];   // OFFSET ? = params[length-1]
        console.log('[DB] LIMIT/OFFSET conversion: limit=', limitValue, 'offset=', offsetValue, 'from params:', params.slice(-2));
        if (limitValue <= 0) {
            console.warn('[DB] WARNING: LIMIT value is <= 0, using OFFSET only');
            return {
                sql: m[1] + ' ORDER BY ' + m[2] + ` OFFSET ${offsetValue} ROWS`,
                params: params.slice(0, -2)
            };
        }
        return {
            sql: m[1] + ' ORDER BY ' + m[2] + ` OFFSET ${offsetValue} ROWS FETCH NEXT ${limitValue} ROWS ONLY`,
            params: params.slice(0, -2)
        };
    }
    
    // LIMIT ? (parameterized) -> ORDER BY ... OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
    // รองรับ GROUP BY ... ORDER BY ... LIMIT ?
    m = sql.match(/([\s\S]*?)\s+ORDER\s+BY\s+([\s\S]*?)\s+LIMIT\s+\?\s*$/i);
    if (m && params.length >= 1) {
        const limit = params[params.length - 1];
        return {
            sql: m[1] + ' ORDER BY ' + m[2] + ` OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`,
            params: params.slice(0, -1)
        };
    }
    
    // LIMIT ? (parameterized, ไม่มี ORDER BY) -> ORDER BY (SELECT 1) OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
    m = sql.match(/^([\s\S]+?)\s+LIMIT\s+\?\s*$/i);
    if (m && params.length >= 1 && !/ORDER\s+BY/i.test(m[1])) {
        const limit = params[params.length - 1];
        return {
            sql: m[1] + ' ORDER BY (SELECT 1) OFFSET 0 ROWS FETCH NEXT ' + limit + ' ROWS ONLY',
            params: params.slice(0, -1)
        };
    }
    
    // LIMIT n OFFSET m (literal) -> ORDER BY ... OFFSET m ROWS FETCH NEXT n ROWS ONLY
    m = sql.match(/^([\s\S]*?)\s+ORDER\s+BY\s+([\s\S]*)\s+LIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$/i);
    if (m) {
        return {
            sql: m[1] + ' ORDER BY ' + m[2] + ` OFFSET ${m[4]} ROWS FETCH NEXT ${m[3]} ROWS ONLY`,
            params
        };
    }
    
    // LIMIT n (literal) -> ORDER BY ... OFFSET 0 ROWS FETCH NEXT n ROWS ONLY
    m = sql.match(/^([\s\S]*?)\s+ORDER\s+BY\s+([\s\S]*)\s+LIMIT\s+(\d+)\s*$/i);
    if (m) {
        return {
            sql: m[1] + ' ORDER BY ' + m[2] + ` OFFSET 0 ROWS FETCH NEXT ${m[3]} ROWS ONLY`,
            params
        };
    }
    
    return { sql, params };
}

// Query interface for SQL Server
const query = async (sqlQuery, params = []) => {
    try {
        // Convert MySQL-style functions (DATE, CURDATE, NOW) to T-SQL
        const originalQuery = sqlQuery;
        sqlQuery = convertMySqlFunctionsForMssql(sqlQuery);
        if (originalQuery !== sqlQuery) {
            console.log('[DB] Converted MySQL functions:', originalQuery.substring(0, 100), '->', sqlQuery.substring(0, 100));
        }
        
        // Convert LIMIT/OFFSET to SQL Server syntax
        const beforeLimit = { sql: sqlQuery, params: [...params] };
        const converted = convertLimitOffsetForMssql(sqlQuery, params);
        sqlQuery = converted.sql;
        params = converted.params;
        if (beforeLimit.sql !== converted.sql || beforeLimit.params.length !== converted.params.length) {
            console.log('[DB] Converted LIMIT/OFFSET');
            console.log('[DB]   Original SQL (last 100 chars):', beforeLimit.sql.substring(Math.max(0, beforeLimit.sql.length - 100)));
            console.log('[DB]   Converted SQL (last 100 chars):', converted.sql.substring(Math.max(0, converted.sql.length - 100)));
            console.log('[DB]   Params:', beforeLimit.params.length, '->', converted.params.length);
        } else {
            // Log if LIMIT/OFFSET was not converted (for debugging)
            if (/LIMIT\s+\?/i.test(beforeLimit.sql) || /OFFSET\s+\?/i.test(beforeLimit.sql)) {
                console.warn('[DB] WARNING: LIMIT/OFFSET pattern not converted!');
                console.warn('[DB]   SQL (last 100 chars):', beforeLimit.sql.substring(Math.max(0, beforeLimit.sql.length - 100)));
                console.warn('[DB]   Params:', beforeLimit.params);
            }
        }

        // SQL Server query execution
        // Ensure pool is connected
        try {
            if (!pool.connected) {
                await pool.connect();
            }
        } catch (connectError) {
            // If already connected, ignore the error
            if (connectError.code !== 'EALREADYCONNECTED') {
                throw connectError;
            }
        }
        
        const request = pool.request();
        
        // Add parameters if provided
        if (params && params.length > 0) {
            // Create a copy of the query to modify
            let modifiedQuery = sqlQuery;
            let paramIndex = 0;
            
            // Replace ? with @param0, @param1, etc. and bind parameters
            params.forEach((param) => {
                const paramName = `param${paramIndex}`;
                // Determine SQL type
                let sqlType = null;
                if (typeof param === 'number') {
                    if (Number.isInteger(param)) {
                        sqlType = dbDriver.Int;
                    } else {
                        sqlType = dbDriver.Float;
                    }
                } else if (typeof param === 'boolean') {
                    sqlType = dbDriver.Bit;
                } else if (param instanceof Date) {
                    sqlType = dbDriver.DateTime;
                } else {
                    // Use NVarChar(MAX) for Unicode support (Thai characters)
                    // For mssql, use sql.MAX constant for unlimited length
                    sqlType = sql.NVarChar(sql.MAX);
                }
                
                request.input(paramName, sqlType, param);
                // Replace first occurrence of ? with @paramName
                modifiedQuery = modifiedQuery.replace('?', `@${paramName}`);
                paramIndex++;
            });
            
            sqlQuery = modifiedQuery;
        }
        
        console.log('[DB] Executing SQL Server query (first 200 chars):', sqlQuery.substring(0, 200));
        console.log('[DB] SQL Server query params:', params);
        
        const result = await request.query(sqlQuery);
        
        // Return in format: [rows, fields]
        return [result.recordset || [], []];
    } catch (error) {
        console.error('[DB] Database query error:', error);
        console.error('[DB] Error message:', error.message);
        console.error('[DB] Error code:', error.code);
        console.error('[DB] Error number:', error.number);
        console.error('[DB] Error stack:', error.stack);
        console.error('[DB] SQL Server error details:', {
            message: error.message,
            code: error.code,
            number: error.number,
            state: error.state,
            class: error.class,
            serverName: error.serverName,
            procedure: error.procedure,
            lineNumber: error.lineNumber
        });
        throw error;
    }
};

// Execute interface for INSERT/UPDATE/DELETE
const execute = async (sqlQuery, params = []) => {
    try {
        // SQL Server execution
        // Ensure pool is connected
        try {
            if (!pool.connected) {
                await pool.connect();
            }
        } catch (connectError) {
            // If already connected, ignore the error
            if (connectError.code !== 'EALREADYCONNECTED') {
                throw connectError;
            }
        }
        
        const request = pool.request();
        
        // Check if this is an INSERT statement and modify to get SCOPE_IDENTITY()
        const isInsert = /^\s*INSERT\s+INTO/i.test(sqlQuery.trim());
        let modifiedQuery = sqlQuery;
        
        // Add parameters if provided
        if (params && params.length > 0) {
            // Create a copy of the query to modify
            let queryCopy = sqlQuery;
            let paramIndex = 0;
            
            // Replace ? with @param0, @param1, etc. and bind parameters
            params.forEach((param) => {
                const paramName = `param${paramIndex}`;
                // Determine SQL type
                let sqlType = null;
                if (typeof param === 'number') {
                    if (Number.isInteger(param)) {
                        sqlType = dbDriver.Int;
                    } else {
                        sqlType = dbDriver.Float;
                    }
                } else if (typeof param === 'boolean') {
                    sqlType = dbDriver.Bit;
                } else if (param instanceof Date) {
                    sqlType = dbDriver.DateTime;
                } else {
                    // For strings (including datetime strings), use NVarChar(MAX) for Unicode support (Thai characters)
                    // The SQL query will use CONVERT() to parse datetime strings if needed
                    // For mssql, use sql.MAX constant for unlimited length
                    sqlType = sql.NVarChar(sql.MAX);
                }
                
                request.input(paramName, sqlType, param);
                // Replace first occurrence of ? with @paramName
                queryCopy = queryCopy.replace('?', `@${paramName}`);
                paramIndex++;
            });
            
            modifiedQuery = queryCopy;
        }
        
        // For INSERT statements, append SCOPE_IDENTITY() to get the last insert ID
        if (isInsert) {
            modifiedQuery += '; SELECT SCOPE_IDENTITY() as insertId';
        }
        
        const result = await request.query(modifiedQuery);
        
        // Extract insertId from result if it's an INSERT (batch: first set empty, second has SCOPE_IDENTITY())
        let insertId = null;
        if (isInsert) {
            const recordsets = result.recordsets || (result.recordset ? [result.recordset] : []);
            const lastSet = recordsets.length > 0 ? recordsets[recordsets.length - 1] : result.recordset;
            const rows = Array.isArray(lastSet) ? lastSet : (lastSet ? [lastSet] : []);
            if (rows.length > 0) {
                const lastRecord = rows[rows.length - 1];
                insertId = lastRecord.insertId != null ? lastRecord.insertId : lastRecord[Object.keys(lastRecord)[0]];
            }
        }
        
        // Return result object
        return {
            insertId: insertId,
            affectedRows: result.rowsAffected ? result.rowsAffected[0] : 0,
            recordset: result.recordset || []
        };
    } catch (error) {
        console.error('Database execute error:', error);
        throw error;
    }
};

// Create a pool-like object with query and execute methods
const poolWrapper = {
    query: query,
    execute: execute,
    getConnection: async () => {
        // For SQL Server, return the pool itself
        return pool;
    }
};

// Test connection
const testConnection = async () => {
    try {
        // Test SQL Server connection
        try {
            if (!pool.connected) {
                await pool.connect();
            }
        } catch (connectError) {
            // If already connected, ignore the error
            if (connectError.code !== 'EALREADYCONNECTED') {
                throw connectError;
            }
        }
        
        const request = pool.request();
        await request.query('SELECT 1 as test');
        console.log(`✅ SQL Server connected successfully to ${process.env.DB_NAME || 'smart_room_booking'}`);
        return true;
    } catch (error) {
        console.error(`❌ SQL Server connection failed:`, error.message);
        return false;
    }
};

module.exports = { 
    pool: poolWrapper, 
    testConnection,
    DB_TYPE,
    dbDriver
};
