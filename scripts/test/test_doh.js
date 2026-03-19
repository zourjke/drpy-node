/**
 * Test DNS over HTTPS (DoH) functionality
 * Run with: node scripts/test/test_doh.js
 */

import { resolveDoh, getSystemProxy } from '../../utils/dns_doh.js';
import { performance } from 'perf_hooks';

// Ensure ENV is loaded if needed, though dns_doh.js imports it.
// Mock ENV if running in isolation without full app context, 
// but here we assume utils/env.js handles defaults or .env loading.

async function testDohResolution(domain) {
    console.log(`\nTesting DoH resolution for: ${domain}`);
    const start = performance.now();
    try {
        const ip = await resolveDoh(domain);
        const end = performance.now();
        
        console.log(`Result: ${ip}`);
        console.log(`Time: ${(end - start).toFixed(2)}ms`);
        
        if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            console.log('✅ Success: Valid IPv4 address returned');
            return true;
        } else if (ip === domain) {
            console.log('⚠️  Warning: Returned original domain (DoH disabled or failed gracefully)');
            return false;
        } else {
            console.log('❌ Failed: Invalid result');
            return false;
        }
    } catch (error) {
        console.error('❌ Error during resolution:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('=== Starting DoH Test ===');
    
    // 1. Check System Proxy
    console.log('\nChecking System Proxy...');
    const proxy = await getSystemProxy();
    if (proxy) {
        console.log(`ℹ️  System Proxy detected: ${proxy}`);
    } else {
        console.log('ℹ️  No System Proxy detected');
    }

    // 2. Test common domains
    const domains = [
        'www.baidu.com',
        'www.google.com',
        'github.com'
    ];

    for (const domain of domains) {
        await testDohResolution(domain);
    }
    
    // 3. Test IP (should return as-is)
    await testDohResolution('8.8.8.8');

    console.log('\n=== Test Complete ===');
}

runTests().catch(err => console.error('Test runner error:', err));
