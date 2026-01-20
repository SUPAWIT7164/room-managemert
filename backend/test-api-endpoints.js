const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

async function testAPIEndpoints() {
    console.log('='.repeat(60));
    console.log('🔍 Testing API Endpoints');
    console.log('='.repeat(60));
    
    try {
        // Test 1: Health Check
        console.log('\n1️⃣ Testing Health Check...');
        const healthResponse = await axios.get(`${API_BASE_URL}/health`);
        console.log('✅ Health Check:', healthResponse.data);
        
        // Test 2: Get Buildings
        console.log('\n2️⃣ Testing GET /api/buildings...');
        try {
            const buildingsResponse = await axios.get(`${API_BASE_URL}/buildings`);
            console.log(`✅ Buildings: Found ${buildingsResponse.data.data?.length || 0} buildings`);
            if (buildingsResponse.data.data && buildingsResponse.data.data.length > 0) {
                console.log('   Sample:', buildingsResponse.data.data[0]);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        
        // Test 3: Get Areas
        console.log('\n3️⃣ Testing GET /api/areas...');
        try {
            const areasResponse = await axios.get(`${API_BASE_URL}/areas`);
            console.log(`✅ Areas: Found ${areasResponse.data.data?.length || 0} areas`);
        } catch (error) {
            console.log(`❌ Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        
        // Test 4: Get Rooms
        console.log('\n4️⃣ Testing GET /api/rooms...');
        try {
            const roomsResponse = await axios.get(`${API_BASE_URL}/rooms`);
            console.log(`✅ Rooms: Found ${roomsResponse.data.data?.length || 0} rooms`);
            if (roomsResponse.data.data && roomsResponse.data.data.length > 0) {
                console.log('   Sample:', {
                    id: roomsResponse.data.data[0].id,
                    name: roomsResponse.data.data[0].name,
                    capacity: roomsResponse.data.data[0].capacity
                });
            }
        } catch (error) {
            console.log(`❌ Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        
        // Test 5: Get Bookings (without auth - should fail)
        console.log('\n5️⃣ Testing GET /api/bookings (without auth)...');
        try {
            const bookingsResponse = await axios.get(`${API_BASE_URL}/bookings`);
            console.log(`✅ Bookings: Found ${bookingsResponse.data.data?.length || 0} bookings`);
        } catch (error) {
            console.log(`⚠️  Expected: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        
        // Test 6: Get Dashboard Stats (without auth - should fail)
        console.log('\n6️⃣ Testing GET /api/dashboard/stats (without auth)...');
        try {
            const dashboardResponse = await axios.get(`${API_BASE_URL}/dashboard/stats`);
            console.log('✅ Dashboard Stats:', dashboardResponse.data);
        } catch (error) {
            console.log(`⚠️  Expected: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        
        // Test 7: Login Test
        console.log('\n7️⃣ Testing POST /api/auth/login...');
        try {
            const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
                username: 'admin@example.com', // Using email as username
                password: 'password' // This might not work, but testing the endpoint
            });
            console.log('✅ Login successful!');
            console.log('   Token:', loginResponse.data.data?.token ? 'Received' : 'Not received');
            console.log('   User:', loginResponse.data.data?.user?.name || 'N/A');
        } catch (error) {
            console.log(`⚠️  Login test: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            console.log('   (This is expected if credentials are incorrect)');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ API endpoint tests completed!');
        console.log('='.repeat(60));
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        process.exit(1);
    }
}

testAPIEndpoints();















