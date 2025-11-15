/**
 * Security Tests: IP Validation and SSRF Prevention
 *
 * This test suite validates the comprehensive SSRF prevention measures
 * implemented in the IP validation utilities.
 *
 * Test Coverage:
 * - Private IP detection (AWS metadata, internal networks, localhost)
 * - Domain whitelist validation (prevents subdomain bypass)
 * - DNS resolution validation (prevents DNS rebinding)
 * - URL validation (comprehensive security checks)
 */

import {
  isPrivateIP,
  isDomainAllowed,
  validateHostname,
  validateURL,
} from '@/lib/security/ip-validation';

describe('IP Validation Security Tests', () => {
  describe('isPrivateIP', () => {
    describe('AWS Metadata Service (Critical SSRF Target)', () => {
      it('should block AWS metadata endpoint', () => {
        expect(isPrivateIP('169.254.169.254')).toBe(true);
      });

      it('should block all link-local addresses (169.254.0.0/16)', () => {
        expect(isPrivateIP('169.254.0.1')).toBe(true);
        expect(isPrivateIP('169.254.100.100')).toBe(true);
        expect(isPrivateIP('169.254.255.254')).toBe(true);
      });
    });

    describe('Private Networks (RFC 1918)', () => {
      it('should block Class A private network (10.0.0.0/8)', () => {
        expect(isPrivateIP('10.0.0.1')).toBe(true);
        expect(isPrivateIP('10.255.255.254')).toBe(true);
        expect(isPrivateIP('10.123.45.67')).toBe(true);
      });

      it('should block Class B private network (172.16.0.0/12)', () => {
        expect(isPrivateIP('172.16.0.1')).toBe(true);
        expect(isPrivateIP('172.31.255.254')).toBe(true);
        expect(isPrivateIP('172.20.10.1')).toBe(true);
      });

      it('should block Class C private network (192.168.0.0/16)', () => {
        expect(isPrivateIP('192.168.0.1')).toBe(true);
        expect(isPrivateIP('192.168.255.254')).toBe(true);
        expect(isPrivateIP('192.168.1.1')).toBe(true);
      });
    });

    describe('Localhost (RFC 990)', () => {
      it('should block localhost addresses (127.0.0.0/8)', () => {
        expect(isPrivateIP('127.0.0.1')).toBe(true);
        expect(isPrivateIP('127.0.0.2')).toBe(true);
        expect(isPrivateIP('127.255.255.254')).toBe(true);
      });
    });

    describe('Reserved and Special Addresses', () => {
      it('should block unspecified/reserved addresses (0.0.0.0/8)', () => {
        expect(isPrivateIP('0.0.0.0')).toBe(true);
        expect(isPrivateIP('0.255.255.254')).toBe(true);
      });

      it('should block multicast addresses (224.0.0.0/4)', () => {
        expect(isPrivateIP('224.0.0.1')).toBe(true);
        expect(isPrivateIP('239.255.255.254')).toBe(true);
      });

      it('should block reserved addresses (240.0.0.0/4)', () => {
        expect(isPrivateIP('240.0.0.1')).toBe(true);
        expect(isPrivateIP('255.255.255.254')).toBe(true);
      });
    });

    describe('Public IPs (Should NOT be blocked)', () => {
      it('should allow Google DNS', () => {
        expect(isPrivateIP('8.8.8.8')).toBe(false);
        expect(isPrivateIP('8.8.4.4')).toBe(false);
      });

      it('should allow Cloudflare DNS', () => {
        expect(isPrivateIP('1.1.1.1')).toBe(false);
        expect(isPrivateIP('1.0.0.1')).toBe(false);
      });

      it('should allow typical public IPs', () => {
        expect(isPrivateIP('54.239.28.85')).toBe(false); // Amazon
        expect(isPrivateIP('151.101.1.140')).toBe(false); // Fastly
      });
    });

    describe('Invalid IP Formats', () => {
      it('should treat invalid IPs as unsafe', () => {
        expect(isPrivateIP('not.an.ip')).toBe(true);
        expect(isPrivateIP('999.999.999.999')).toBe(true);
        expect(isPrivateIP('')).toBe(true);
        expect(isPrivateIP('192.168.1')).toBe(true);
      });
    });
  });

  describe('isDomainAllowed', () => {
    const allowedDomains = [
      'api.openverse.org',
      'upload.wikimedia.org',
      'example.com',
    ];

    describe('Exact Domain Matching', () => {
      it('should allow exact domain matches', () => {
        expect(isDomainAllowed('api.openverse.org', allowedDomains)).toBe(true);
        expect(isDomainAllowed('upload.wikimedia.org', allowedDomains)).toBe(true);
        expect(isDomainAllowed('example.com', allowedDomains)).toBe(true);
      });
    });

    describe('Legitimate Subdomain Matching', () => {
      it('should allow valid subdomains with dot prefix', () => {
        expect(isDomainAllowed('images.api.openverse.org', allowedDomains)).toBe(true);
        expect(isDomainAllowed('cdn.upload.wikimedia.org', allowedDomains)).toBe(true);
        expect(isDomainAllowed('www.example.com', allowedDomains)).toBe(true);
      });

      it('should allow multi-level subdomains', () => {
        expect(isDomainAllowed('deep.nested.api.openverse.org', allowedDomains)).toBe(true);
      });
    });

    describe('Subdomain Bypass Attacks (CRITICAL)', () => {
      it('should BLOCK subdomain bypass attempts WITHOUT dot separator', () => {
        // Attack: evilapi.openverse.org (no dot before 'api')
        // Vulnerable code: url.hostname.endsWith('api.openverse.org') returns true ❌
        // Secure code: requires exact match OR dot prefix, so this is blocked ✅
        expect(isDomainAllowed('evilapi.openverse.org', allowedDomains)).toBe(false);
        expect(isDomainAllowed('notapi.openverse.org', allowedDomains)).toBe(false);
        expect(isDomainAllowed('totally-different-domain.com', allowedDomains)).toBe(false);
      });

      it('should ALLOW legitimate subdomains WITH dot separator', () => {
        // Note: evil.api.openverse.org is technically a valid subdomain of api.openverse.org
        // The real vulnerability is 'evilapi.openverse.org' matching when it shouldn't
        // If you need to block ALL subdomains, only exact matches should be allowed
        expect(isDomainAllowed('evil.api.openverse.org', allowedDomains)).toBe(true);
        expect(isDomainAllowed('images.api.openverse.org', allowedDomains)).toBe(true);
      });

      it('should BLOCK partial domain matches without dot', () => {
        expect(isDomainAllowed('notapi.openverse.org', allowedDomains)).toBe(false);
        expect(isDomainAllowed('fakeupload.wikimedia.org', allowedDomains)).toBe(false);
      });

      it('should BLOCK completely different domains', () => {
        expect(isDomainAllowed('evil.com', allowedDomains)).toBe(false);
        expect(isDomainAllowed('attacker.net', allowedDomains)).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty domain list', () => {
        expect(isDomainAllowed('api.openverse.org', [])).toBe(false);
      });

      it('should be case-sensitive', () => {
        expect(isDomainAllowed('API.OPENVERSE.ORG', allowedDomains)).toBe(false);
      });
    });
  });

  describe('validateHostname', () => {
    describe('DNS Resolution (Prevents DNS Rebinding)', () => {
      it('should resolve legitimate public domains', async () => {
        const result = await validateHostname('google.com');
        expect(result.isValid).toBe(true);
        expect(result.ips).toBeDefined();
        expect(result.ips!.length).toBeGreaterThan(0);
      });

      it('should BLOCK localhost resolution', async () => {
        const result = await validateHostname('localhost');
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Private/reserved IP detected');
      });

      it('should handle DNS resolution failures', async () => {
        const result = await validateHostname('this-domain-does-not-exist-12345.invalid');
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('DNS resolution failed');
      });
    });

    describe('Private IP Detection After Resolution', () => {
      // Note: These tests depend on actual DNS resolution behavior
      // In production, an attacker might control DNS to return private IPs

      it('should block if DNS resolves to private IP', async () => {
        // localhost typically resolves to 127.0.0.1
        const result = await validateHostname('localhost');
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/Private.*IP detected.*127\.0\.0\.1/i);
      });
    });
  });

  describe('validateURL', () => {
    const allowedDomains = ['api.openverse.org', 'example.com'];

    describe('Valid URLs', () => {
      it('should validate legitimate URLs', async () => {
        const result = await validateURL('https://api.openverse.org/image.jpg', allowedDomains);
        expect(result.isValid).toBe(true);
        expect(result.url).toBeDefined();
        expect(result.resolvedIPs).toBeDefined();
      });

      it('should allow http protocol', async () => {
        const result = await validateURL('http://api.openverse.org/image.jpg', allowedDomains);
        expect(result.isValid).toBe(true);
      });
    });

    describe('SSRF Attack Prevention', () => {
      it('should BLOCK subdomain bypass attacks (without dot separator)', async () => {
        const result = await validateURL('https://evilapi.openverse.org/malicious', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Domain not allowed');
      });

      it('should BLOCK direct IP access to AWS metadata', async () => {
        const result = await validateURL('http://169.254.169.254/latest/meta-data/', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Domain not allowed');
      });

      it('should BLOCK private network access', async () => {
        const result = await validateURL('http://192.168.1.1/admin', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Domain not allowed');
      });

      it('should BLOCK localhost access', async () => {
        const result = await validateURL('http://localhost:8000/secret', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/Domain not allowed|Private.*IP detected/i);
      });
    });

    describe('Protocol Validation', () => {
      it('should BLOCK file:// protocol', async () => {
        const result = await validateURL('file:///etc/passwd', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Invalid protocol');
      });

      it('should BLOCK ftp:// protocol', async () => {
        const result = await validateURL('ftp://api.openverse.org/file', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Invalid protocol');
      });

      it('should BLOCK data:// URLs', async () => {
        const result = await validateURL('data:text/plain,hello', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Invalid protocol');
      });

      it('should BLOCK javascript:// URLs', async () => {
        const result = await validateURL('javascript:alert(1)', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Invalid protocol');
      });
    });

    describe('Invalid URL Formats', () => {
      it('should reject malformed URLs', async () => {
        const result = await validateURL('not a url', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Invalid URL format');
      });

      it('should reject empty URLs', async () => {
        const result = await validateURL('', allowedDomains);
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('Invalid URL format');
      });
    });
  });
});

/**
 * Integration Tests: Full Attack Scenario Validation
 */
describe('SSRF Attack Scenario Tests', () => {
  const allowedDomains = ['api.openverse.org'];

  describe('AWS Metadata Endpoint Attacks', () => {
    it('should prevent direct IP access', async () => {
      const attacks = [
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        'http://169.254.169.254/latest/user-data/',
      ];

      for (const url of attacks) {
        const result = await validateURL(url, allowedDomains);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe('Internal Network Scanning Attacks', () => {
    it('should prevent internal network access', async () => {
      const attacks = [
        'http://192.168.1.1/',
        'http://10.0.0.1/admin',
        'http://172.16.0.1/config',
      ];

      for (const url of attacks) {
        const result = await validateURL(url, allowedDomains);
        expect(result.isValid).toBe(false);
      }
    });
  });

  describe('Subdomain Bypass Attacks', () => {
    it('should prevent subdomain bypass variations without dot separator', async () => {
      const attacks = [
        'https://evilapi.openverse.org/', // No dot before 'api'
        'https://api.openverse.org.evil.com/', // Different domain
        'https://attacker.com/api.openverse.org', // Path, not subdomain
      ];

      for (const url of attacks) {
        const result = await validateURL(url, allowedDomains);
        expect(result.isValid).toBe(false);
      }
    });

    it('should allow legitimate subdomains with dot separator', async () => {
      // Note: Subdomains like cdn.api.openverse.org are valid
      // The real vulnerability is 'evilapi.openverse.org' matching when it shouldn't
      // Using a well-known domain that will resolve successfully
      const legitimateSubdomains = [
        'https://www.google.com/', // Well-known subdomain that will resolve
      ];

      for (const url of legitimateSubdomains) {
        const result = await validateURL(url, ['google.com']);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('Legitimate Requests (Should Pass)', () => {
    it('should allow legitimate image URLs', async () => {
      const legitimateUrls = [
        'https://api.openverse.org/v1/images/12345/thumb/',
        'https://api.openverse.org/static/image.jpg',
      ];

      for (const url of legitimateUrls) {
        const result = await validateURL(url, allowedDomains);
        expect(result.isValid).toBe(true);
      }
    });
  });
});
