const { pool } = require('./config/database');
const bcrypt = require('bcrypt');

async function testLogin() {
    console.log('='.repeat(60));
    console.log('🔍 Testing Login Credentials');
    console.log('='.repeat(60));
    
    try {
        // Check if user exists
        console.log('\n1️⃣ Checking user "admin"...');
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR name = ? OR employee_id = ?',
            ['admin', 'admin', 'admin']
        );
        
        if (users.length === 0) {
            console.log('❌ User "admin" not found');
            console.log('\n📋 Available users:');
            const [allUsers] = await pool.query('SELECT id, name, email, employee_id, role FROM users LIMIT 10');
            allUsers.forEach(u => {
                console.log(`   - ID: ${u.id}, Name: ${u.name}, Email: ${u.email}, Employee ID: ${u.employee_id}, Role: ${u.role}`);
            });
            process.exit(1);
        }
        
        const user = users[0];
        console.log('✅ User found:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Employee ID: ${user.employee_id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Is Active: ${user.is_active}`);
        console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);
        
        // Test password
        console.log('\n2️⃣ Testing password "Lannacom@1"...');
        const passwordMatch = await bcrypt.compare('Lannacom@1', user.password);
        
        if (passwordMatch) {
            console.log('✅ Password is correct!');
        } else {
            console.log('❌ Password is incorrect!');
            console.log('\n💡 Try these common passwords:');
            console.log('   - password');
            console.log('   - admin');
            console.log('   - 123456');
        }
        
        // Check what field is used for login
        console.log('\n3️⃣ Login field check:');
        console.log('   The login endpoint accepts:');
        console.log('   - email');
        console.log('   - username (which maps to email/name/employee_id)');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Login test completed!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

testLogin();
















