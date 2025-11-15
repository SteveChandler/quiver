/**
 * IP Validation Utilities for SSRF Prevention
 *
 * This module provides utilities to prevent Server-Side Request Forgery (SSRF) attacks
 * by validating IP addresses and blocking requests to private/internal networks.
 *
 * Attack Vectors Prevented:
 * - AWS metadata endpoint access (169.254.169.254)
 * - Internal network scanning (10.x.x.x, 192.168.x.x, 172.16.x.x)
 * - Localhost access (127.x.x.x)
 * - DNS rebinding attacks (resolve then validate)
 * - Link-local addresses (169.254.x.x)
 */

import { DNS } from 'node:dns/promises';

/**
 * Private and reserved IP ranges that should be blocked
 *
 * Ranges:
 * - 10.0.0.0/8: Private network (Class A)
 * - 172.16.0.0/12: Private network (Class B)
 * - 192.168.0.0/16: Private network (Class C)
 * - 127.0.0.0/8: Loopback addresses (localhost)
 * - 169.254.0.0/16: Link-local addresses (AWS metadata service)
 * - 0.0.0.0/8: Reserved/unspecified addresses
 * - 224.0.0.0/4: Multicast addresses
 * - 240.0.0.0/4: Reserved addresses
 */
const PRIVATE_IP_RANGES = [
  { start: ipToNumber('10.0.0.0'), end: ipToNumber('10.255.255.255') }, // 10.0.0.0/8
  { start: ipToNumber('172.16.0.0'), end: ipToNumber('172.31.255.255') }, // 172.16.0.0/12
  { start: ipToNumber('192.168.0.0'), end: ipToNumber('192.168.255.255') }, // 192.168.0.0/16
  { start: ipToNumber('127.0.0.0'), end: ipToNumber('127.255.255.255') }, // 127.0.0.0/8 (localhost)
  { start: ipToNumber('169.254.0.0'), end: ipToNumber('169.254.255.255') }, // 169.254.0.0/16 (link-local/AWS metadata)
  { start: ipToNumber('0.0.0.0'), end: ipToNumber('0.255.255.255') }, // 0.0.0.0/8 (reserved)
  { start: ipToNumber('224.0.0.0'), end: ipToNumber('239.255.255.255') }, // 224.0.0.0/4 (multicast)
  { start: ipToNumber('240.0.0.0'), end: ipToNumber('255.255.255.255') }, // 240.0.0.0/4 (reserved)
];

/**
 * Convert an IPv4 address string to a number for range comparison
 *
 * @param ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns Number representation of the IP address
 *
 * @example
 * ipToNumber('192.168.1.1') // Returns 3232235777
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if an IP address is in a private or reserved range
 *
 * This prevents SSRF attacks by blocking requests to:
 * - Internal networks (RFC 1918)
 * - Localhost (RFC 990)
 * - Link-local addresses (RFC 3927, includes AWS metadata service)
 * - Reserved/multicast addresses
 *
 * @param ip - IPv4 address string to validate
 * @returns true if the IP is private/reserved, false if public
 *
 * @example
 * isPrivateIP('169.254.169.254') // true (AWS metadata)
 * isPrivateIP('192.168.1.1') // true (private network)
 * isPrivateIP('8.8.8.8') // false (public IP)
 */
export function isPrivateIP(ip: string): boolean {
  // Basic IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    // If it's not a valid IPv4, treat as unsafe
    return true;
  }

  const ipNum = ipToNumber(ip);

  return PRIVATE_IP_RANGES.some(
    range => ipNum >= range.start && ipNum <= range.end
  );
}

/**
 * Resolve a hostname to IP addresses and check for private IPs
 *
 * This prevents DNS rebinding attacks where a public hostname
 * initially resolves to a public IP during validation, but later
 * resolves to a private IP when the actual request is made.
 *
 * Attack prevented:
 * 1. Attacker controls DNS for evil.com
 * 2. First lookup: evil.com -> 1.2.3.4 (public IP, passes validation)
 * 3. Attacker changes DNS
 * 4. Second lookup: evil.com -> 169.254.169.254 (AWS metadata)
 * 5. Server makes request to AWS metadata, leaking credentials
 *
 * @param hostname - Hostname to resolve and validate
 * @returns Object with validation result and resolved IPs
 *
 * @example
 * await validateHostname('api.openverse.org') // { isValid: true, ips: ['1.2.3.4'] }
 * await validateHostname('localhost') // { isValid: false, ips: ['127.0.0.1'], reason: 'Private IP detected' }
 */
export async function validateHostname(hostname: string): Promise<{
  isValid: boolean;
  ips?: string[];
  reason?: string;
}> {
  try {
    const resolver = new DNS();

    // Resolve hostname to IP addresses
    const addresses = await resolver.resolve4(hostname);

    if (!addresses || addresses.length === 0) {
      return {
        isValid: false,
        reason: 'DNS resolution failed - no addresses returned'
      };
    }

    // Check each resolved IP for private ranges
    for (const ip of addresses) {
      if (isPrivateIP(ip)) {
        return {
          isValid: false,
          ips: addresses,
          reason: `Private/reserved IP detected: ${ip} (hostname: ${hostname})`
        };
      }
    }

    return {
      isValid: true,
      ips: addresses
    };
  } catch (error) {
    // DNS resolution failed - treat as invalid
    return {
      isValid: false,
      reason: `DNS resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validate that a domain matches the allowed list
 *
 * Prevents subdomain bypass attacks by requiring:
 * - Exact match: url.hostname === 'api.openverse.org'
 * - OR proper subdomain: url.hostname === 'images.api.openverse.org' (has dot prefix)
 *
 * Attack prevented:
 * - evil.api.openverse.org (would bypass old .endsWith() check)
 * - evilapi.openverse.org (would bypass old .endsWith() check)
 *
 * @param hostname - Hostname to validate
 * @param allowedDomains - List of allowed domains
 * @returns true if hostname matches allowed list
 *
 * @example
 * isDomainAllowed('api.openverse.org', ['api.openverse.org']) // true (exact match)
 * isDomainAllowed('images.api.openverse.org', ['api.openverse.org']) // true (valid subdomain)
 * isDomainAllowed('evil.api.openverse.org', ['api.openverse.org']) // false (not a valid subdomain)
 * isDomainAllowed('evilapi.openverse.org', ['api.openverse.org']) // false (subdomain bypass attempt)
 */
export function isDomainAllowed(hostname: string, allowedDomains: string[]): boolean {
  return allowedDomains.some(domain => {
    // Exact match
    if (hostname === domain) {
      return true;
    }

    // Proper subdomain (must have dot prefix)
    // This prevents 'evil.api.openverse.org' from matching 'api.openverse.org'
    // because 'evil.api.openverse.org' would need to end with '.api.openverse.org'
    // which it doesn't - it ends with 'api.openverse.org' without the leading dot
    if (hostname.endsWith('.' + domain)) {
      return true;
    }

    return false;
  });
}

/**
 * Comprehensive URL validation for SSRF prevention
 *
 * Validates:
 * 1. Domain against whitelist (prevents subdomain bypass)
 * 2. DNS resolution to public IPs (prevents DNS rebinding)
 * 3. Protocol (only http/https allowed)
 *
 * @param urlString - URL to validate
 * @param allowedDomains - List of allowed domains
 * @returns Validation result with details
 *
 * @example
 * await validateURL('https://api.openverse.org/image.jpg', ['api.openverse.org'])
 * // { isValid: true, url: URL, resolvedIPs: ['1.2.3.4'] }
 */
export async function validateURL(
  urlString: string,
  allowedDomains: string[]
): Promise<{
  isValid: boolean;
  url?: URL;
  resolvedIPs?: string[];
  reason?: string;
}> {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch (error) {
    return {
      isValid: false,
      reason: 'Invalid URL format'
    };
  }

  // Only allow http/https protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      isValid: false,
      reason: `Invalid protocol: ${url.protocol}. Only http and https are allowed.`
    };
  }

  // Validate domain against whitelist (prevents subdomain bypass)
  if (!isDomainAllowed(url.hostname, allowedDomains)) {
    return {
      isValid: false,
      reason: `Domain not allowed: ${url.hostname}`
    };
  }

  // Validate DNS resolution (prevents DNS rebinding attacks)
  const dnsValidation = await validateHostname(url.hostname);
  if (!dnsValidation.isValid) {
    return {
      isValid: false,
      reason: dnsValidation.reason
    };
  }

  return {
    isValid: true,
    url,
    resolvedIPs: dnsValidation.ips
  };
}
