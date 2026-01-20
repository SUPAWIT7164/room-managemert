require('dotenv').config();

// Database type: 'mysql' or 'mssql'
const DB_TYPE = (process.env.DB_TYPE || 'mysql').toLowerCase();
let pool = null;
let dbDriver = null;

// Initialize database connection based on DB_TYPE
if (DB_TYPE === 'mssql' || DB_TYPE === 'sqlserver') {
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
} else {
    // MySQL configuration (default)
    const mysql = require('mysql2/promise');
    
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'smart_room_booking',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000, // 10 seconds connection timeout
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    });

    dbDriver = mysql;
}

// Unified query interface that works with both MySQL and SQL Server
const query = async (sqlQuery, params = []) => {
    try {
        if (DB_TYPE === 'mssql' || DB_TYPE === 'sqlserver') {
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
                        sqlType = dbDriver.NVarChar;
                    }
                    
                    request.input(paramName, sqlType, param);
                    // Replace first occurrence of ? with @paramName
                    modifiedQuery = modifiedQuery.replace('?', `@${paramName}`);
                    paramIndex++;
                });
                
                sqlQuery = modifiedQuery;
            }
            
            const result = await request.query(sqlQuery);
            
            // Return in MySQL-compatible format: [rows, fields]
            return [result.recordset || [], []];
        } else {
            // MySQL query execution
            const [rows, fields] = await pool.query(sqlQuery, params);
            return [rows, fields];
        }
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Unified execute interface for INSERT/UPDATE/DELETE
const execute = async (sqlQuery, params = []) => {
    try {
        if (DB_TYPE === 'mssql' || DB_TYPE === 'sqlserver') {
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
                        sqlType = dbDriver.NVarChar;
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
            
            // Extract insertId from result if it's an INSERT
            let insertId = null;
            if (isInsert && result.recordset && result.recordset.length > 0) {
                const lastRecord = result.recordset[result.recordset.length - 1];
                insertId = lastRecord.insertId || lastRecord[Object.keys(lastRecord)[0]];
            }
            
            // Return MySQL-compatible result object
            return {
                insertId: insertId,
                affectedRows: result.rowsAffected ? result.rowsAffected[0] : 0,
                recordset: result.recordset || []
            };
        } else {
            // MySQL execution
            const [result] = await pool.query(sqlQuery, params);
            return result;
        }
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
        if (DB_TYPE === 'mssql' || DB_TYPE === 'sqlserver') {
            // For SQL Server, return the pool itself
            return pool;
        } else {
            // For MySQL, get a connection from the pool
            return await pool.getConnection();
        }
    }
};

// Test connection
const testConnection = async () => {
    try {
        if (DB_TYPE === 'mssql' || DB_TYPE === 'sqlserver') {
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
        } else {
            // Test MySQL connection
            const connection = await pool.getConnection();
            await connection.query('SELECT 1 as test');
            connection.release();
            console.log(`✅ MySQL connected successfully to ${process.env.DB_NAME || 'smart_room_booking'}`);
            return true;
        }
    } catch (error) {
        console.error(`❌ Database connection failed (${DB_TYPE}):`, error.message);
        return false;
    }
};

module.exports = { 
    pool: poolWrapper, 
    testConnection,
    DB_TYPE,
    dbDriver
};
