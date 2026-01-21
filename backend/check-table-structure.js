const { pool } = require('./config/database');

async function checkTableStructures() {
    console.log('='.repeat(60));
    console.log('🔍 Checking Table Structures');
    console.log('='.repeat(60));
    
    try {
        // Check users table structure
        console.log('\n📋 Users Table Structure:');
        const [userColumns] = await pool.query('DESCRIBE users');
        userColumns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
        });
        
        // Check booking_requests table structure
        console.log('\n📋 Booking_requests Table Structure:');
        const [bookingColumns] = await pool.query('DESCRIBE booking_requests');
        bookingColumns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
        });
        
        // Get sample data from users
        console.log('\n👥 Sample Users Data:');
        const [users] = await pool.query('SELECT * FROM users LIMIT 3');
        users.forEach((user, index) => {
            console.log(`\n   User ${index + 1}:`);
            Object.keys(user).forEach(key => {
                console.log(`     ${key}: ${user[key]}`);
            });
        });
        
        // Get sample bookings with correct columns
        console.log('\n📅 Sample Bookings Data:');
        const [bookings] = await pool.query(`
            SELECT br.*, r.name as room_name
            FROM booking_requests br
            LEFT JOIN rooms r ON br.room_id = r.id
            ORDER BY br.start_datetime DESC
            LIMIT 3
        `);
        bookings.forEach((booking, index) => {
            console.log(`\n   Booking ${index + 1}:`);
            console.log(`     ID: ${booking.id}`);
            console.log(`     Title: ${booking.title}`);
            console.log(`     Room: ${booking.room_name || 'N/A'}`);
            console.log(`     Booker ID: ${booking.booker_id}`);
            console.log(`     Start: ${booking.start_datetime}`);
            console.log(`     End: ${booking.end_datetime}`);
            console.log(`     Status: ${booking.status}`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Table structure check completed!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

checkTableStructures();
















