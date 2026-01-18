/**
 * Test Face Scanner Web Interface
 * ตรวจสอบ web interface ของเครื่องสแกนหน้า
 */

const axios = require('axios');

async function testWebInterface() {
    const baseUrl = 'http://192.168.22.53';
    const username = 'admin';
    const password = 'lannacom@1';

    console.log('='.repeat(60));
    console.log('Face Scanner Web Interface Test');
    console.log('='.repeat(60));
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Username: ${username}`);
    console.log('='.repeat(60));
    console.log('');

    const client = axios.create({
        baseURL: baseUrl,
        timeout: 10000,
        auth: {
            username,
            password
        },
        validateStatus: (status) => status < 500
    });

    // Test 1: Get root page
    console.log('Test 1: Getting root page...');
    try {
        const response = await client.get('/');
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        
        if (response.data && typeof response.data === 'string') {
            const html = response.data;
            console.log(`HTML Length: ${html.length} bytes`);
            
            // Extract title from HTML
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                console.log(`Page Title: ${titleMatch[1]}`);
            }
            
            // Look for API endpoints in HTML
            const apiMatches = html.match(/\/[a-zA-Z0-9\/_-]*[Aa][Pp][Ii][a-zA-Z0-9\/_-]*/g);
            if (apiMatches) {
                console.log('\nPossible API paths found in HTML:');
                [...new Set(apiMatches)].slice(0, 10).forEach(path => {
                    console.log(`  - ${path}`);
                });
            }
        }
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    console.log('');

    // Test 2: Try common web interface paths
    console.log('Test 2: Testing common web interface paths...');
    const commonPaths = [
        '/index.html',
        '/login',
        '/admin',
        '/api',
        '/api/v1',
        '/api/v2',
        '/web',
        '/interface',
        '/config',
        '/system',
        '/device',
        '/user',
        '/face'
    ];

    for (const path of commonPaths) {
        try {
            const response = await client.get(path, {
                validateStatus: (status) => status < 500
            });
            
            if (response.status === 200) {
                console.log(`✅ ${path} - Status: ${response.status}`);
                const contentType = response.headers['content-type'] || '';
                if (contentType.includes('json')) {
                    console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
                }
            } else if (response.status !== 404) {
                console.log(`⚠️  ${path} - Status: ${response.status}`);
            }
        } catch (error) {
            // Skip errors
        }
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
}

// Check if cheerio is available, if not, use simpler method
testWebInterface().catch(async (error) => {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('cheerio')) {
        console.log('Note: cheerio not installed, using simpler method...\n');
        
        // Simple version without cheerio
        const axios = require('axios');
        const baseUrl = 'http://192.168.22.53';
        const username = 'admin';
        const password = 'lannacom@1';

        try {
            const response = await axios.get(baseUrl, {
                auth: { username, password },
                timeout: 10000
            });
            
            console.log('Root page response:');
            console.log(`Status: ${response.status}`);
            console.log(`Content-Type: ${response.headers['content-type']}`);
            console.log(`\nFirst 500 characters of HTML:`);
            console.log(response.data.substring(0, 500));
            
            // Look for API patterns in HTML
            const html = response.data;
            const apiPatterns = [
                /\/api\/[a-zA-Z0-9\/_-]+/g,
                /\/user\/[a-zA-Z0-9\/_-]+/g,
                /\/face\/[a-zA-Z0-9\/_-]+/g,
                /"url"\s*:\s*"([^"]+)"/g,
                /href\s*=\s*"([^"]+)"/g
            ];
            
            console.log('\nPossible API endpoints found:');
            apiPatterns.forEach((pattern, index) => {
                const matches = html.match(pattern);
                if (matches) {
                    const unique = [...new Set(matches)].slice(0, 5);
                    unique.forEach(match => {
                        console.log(`  - ${match}`);
                    });
                }
            });
        } catch (err) {
            console.error('Error:', err.message);
        }
    } else {
        console.error('Fatal error:', error);
        process.exit(1);
    }
});

