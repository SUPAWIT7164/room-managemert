const { pool } = require('./config/database');

async function testDatabaseConnection() {
    console.log('='.repeat(60));
    console.log('🔍 Testing Database Connection');
    console.log('='.repeat(60));
    
    try {
        // Test 1: Basic Connection
        console.log('\n1️⃣ Testing basic connection...');
        const connection = await pool.getConnection();
        console.log('✅ Database connection successful!');
        connection.release();
        
        // Test 2: Check database exists
        console.log('\n2️⃣ Checking database...');
        const [databases] = await pool.query('SHOW DATABASES LIKE ?', ['smart_room_booking']);
        if (databases.length > 0) {
            console.log('✅ Database "smart_room_booking" exists');
        } else {
            console.log('❌ Database "smart_room_booking" not found');
        }
        
        // Test 3: List all tables
        console.log('\n3️⃣ Listing all tables...');
        const [tables] = await pool.query('SHOW TABLES');
        console.log(`✅ Found ${tables.length} tables:`);
        tables.forEach((table, index) => {
            const tableName = Object.values(table)[0];
            console.log(`   ${index + 1}. ${tableName}`);
        });
        
        // Test 4: Check users table
        console.log('\n4️⃣ Checking users table...');
        try {
            const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
            console.log(`✅ Users table exists with ${users[0].count} records`);
            
            // Get sample users
            const [sampleUsers] = await pool.query('SELECT id, username, email, role, status FROM users LIMIT 5');
            if (sampleUsers.length > 0) {
                console.log('\n   Sample users:');
                sampleUsers.forEach(user => {
                    console.log(`   - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}, Status: ${user.status}`);
                });
            }
        } catch (error) {
            console.log(`❌ Error accessing users table: ${error.message}`);
        }
        
        // Test 5: Check rooms table
        console.log('\n5️⃣ Checking rooms table...');
        try {
            const [rooms] = await pool.query('SELECT COUNT(*) as count FROM rooms');
            console.log(`✅ Rooms table exists with ${rooms[0].count} records`);
            
            const [sampleRooms] = await pool.query('SELECT id, name, building_id, area_id, capacity FROM rooms LIMIT 5');
            if (sampleRooms.length > 0) {
                console.log('\n   Sample rooms:');
                sampleRooms.forEach(room => {
                    console.log(`   - ID: ${room.id}, Name: ${room.name}, Building: ${room.building_id}, Area: ${room.area_id}, Capacity: ${room.capacity}`);
                });
            }
        } catch (error) {
            console.log(`❌ Error accessing rooms table: ${error.message}`);
        }
        
        // Test 6: Check bookings table
        console.log('\n6️⃣ Checking booking_requests table...');
        try {
            const [bookings] = await pool.query('SELECT COUNT(*) as count FROM booking_requests');
            console.log(`✅ Booking_requests table exists with ${bookings[0].count} records`);
            
            const [sampleBookings] = await pool.query(`
                SELECT br.id, br.title, br.start_datetime, br.end_datetime, br.status, 
                       u.username as booker_name, r.name as room_name
                FROM booking_requests br
                LEFT JOIN users u ON br.booker_id = u.id
                LEFT JOIN rooms r ON br.room_id = r.id
                ORDER BY br.start_datetime DESC
                LIMIT 5
            `);
            if (sampleBookings.length > 0) {
                console.log('\n   Recent bookings:');
                sampleBookings.forEach(booking => {
                    console.log(`   - ID: ${booking.id}, Title: ${booking.title}, Room: ${booking.room_name}, Booker: ${booking.booker_name}, Status: ${booking.status}, Start: ${booking.start_datetime}`);
                });
            }
        } catch (error) {
            console.log(`❌ Error accessing booking_requests table: ${error.message}`);
        }
        
        // Test 7: Check buildings table
        console.log('\n7️⃣ Checking buildings table...');
        try {
            const [buildings] = await pool.query('SELECT COUNT(*) as count FROM buildings');
            console.log(`✅ Buildings table exists with ${buildings[0].count} records`);
        } catch (error) {
            console.log(`❌ Error accessing buildings table: ${error.message}`);
        }
        
        // Test 8: Check areas table
        console.log('\n8️⃣ Checking areas table...');
        try {
            const [areas] = await pool.query('SELECT COUNT(*) as count FROM areas');
            console.log(`✅ Areas table exists with ${areas[0].count} records`);
        } catch (error) {
            console.log(`❌ Error accessing areas table: ${error.message}`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ All database tests completed!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Database connection failed:');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testDatabaseConnection();












