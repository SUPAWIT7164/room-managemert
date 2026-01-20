const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

async function testLoginAPI() {
    console.log('='.repeat(60));
    console.log('🔍 Testing Login API');
    console.log('='.repeat(60));
    
    try {
        console.log('\n1️⃣ Testing login with username: "admin", password: "Lannacom@1"...');
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'Lannacom@1'
        });
        
        console.log('✅ Login successful!');
        console.log('   Token:', response.data.data?.token ? 'Received' : 'Not received');
        console.log('   User:', response.data.data?.user?.name || 'N/A');
        console.log('   Email:', response.data.data?.user?.email || 'N/A');
        console.log('   Role:', response.data.data?.user?.role || 'N/A');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Login API test completed!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Login failed:');
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Message:', error.response.data?.message || 'Unknown error');
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('   Error:', error.message);
        }
        process.exit(1);
    }
}

testLoginAPI();















