/**
 * SSRF Prevention Validation Script
 *
 * This script demonstrates that the security fixes prevent SSRF attacks.
 * Run with: npx ts-node scripts/test-ssrf-prevention.ts
 */

import { validateURL, isDomainAllowed, isPrivateIP } from '../lib/security/ip-validation';

const ALLOWED_DOMAINS = ['api.openverse.org', 'upload.wikimedia.org'];

async function testSSRFPrevention() {
  console.log('='.repeat(80));
  console.log('SSRF PREVENTION VALIDATION');
  console.log('='.repeat(80));
  console.log();

  // Test 1: Subdomain Bypass Attack
  console.log('TEST 1: Subdomain Bypass Attack Prevention');
  console.log('-'.repeat(80));

  const subdomainBypassTests = [
    { url: 'evilapi.openverse.org', shouldBlock: true, reason: 'No dot before api' },
    { url: 'api.openverse.org', shouldBlock: false, reason: 'Exact match' },
    { url: 'images.api.openverse.org', shouldBlock: false, reason: 'Valid subdomain' },
  ];

  for (const test of subdomainBypassTests) {
    const result = isDomainAllowed(test.url, ALLOWED_DOMAINS);
    const status = result === !test.shouldBlock ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.url} - ${test.reason}`);
    console.log(`   Expected: ${test.shouldBlock ? 'BLOCKED' : 'ALLOWED'}, Got: ${result ? 'ALLOWED' : 'BLOCKED'}`);
  }
  console.log();

  // Test 2: Private IP Blocking
  console.log('TEST 2: Private IP Blocking');
  console.log('-'.repeat(80));

  const privateIPTests = [
    { ip: '169.254.169.254', name: 'AWS Metadata Service' },
    { ip: '192.168.1.1', name: 'Private Class C Network' },
    { ip: '10.0.0.1', name: 'Private Class A Network' },
    { ip: '172.16.0.1', name: 'Private Class B Network' },
    { ip: '127.0.0.1', name: 'Localhost' },
    { ip: '8.8.8.8', name: 'Public IP (Google DNS) - SHOULD ALLOW' },
  ];

  for (const test of privateIPTests) {
    const isPrivate = isPrivateIP(test.ip);
    const expected = test.ip === '8.8.8.8' ? false : true;
    const status = isPrivate === expected ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.ip} - ${test.name}`);
    console.log(`   Expected: ${expected ? 'BLOCKED' : 'ALLOWED'}, Got: ${isPrivate ? 'BLOCKED' : 'ALLOWED'}`);
  }
  console.log();

  // Test 3: Full URL Validation
  console.log('TEST 3: Full URL Validation (includes DNS resolution)');
  console.log('-'.repeat(80));

  const urlTests = [
    { url: 'https://api.openverse.org/image.jpg', shouldAllow: true, reason: 'Exact domain match' },
    { url: 'https://evilapi.openverse.org/image.jpg', shouldAllow: false, reason: 'Subdomain bypass attempt' },
    { url: 'http://169.254.169.254/latest/meta-data/', shouldAllow: false, reason: 'AWS metadata endpoint' },
    { url: 'http://192.168.1.1/', shouldAllow: false, reason: 'Private network' },
    { url: 'file:///etc/passwd', shouldAllow: false, reason: 'File protocol' },
  ];

  for (const test of urlTests) {
    try {
      const result = await validateURL(test.url, ALLOWED_DOMAINS);
      const status = result.isValid === test.shouldAllow ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.url}`);
      console.log(`   Reason: ${test.reason}`);
      console.log(`   Expected: ${test.shouldAllow ? 'ALLOWED' : 'BLOCKED'}, Got: ${result.isValid ? 'ALLOWED' : 'BLOCKED'}`);
      if (!result.isValid) {
        console.log(`   Validation Error: ${result.reason}`);
      }
    } catch (error) {
      console.log(`❌ FAIL ${test.url}`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(80));
}

// Run the validation
testSSRFPrevention().catch(console.error);
