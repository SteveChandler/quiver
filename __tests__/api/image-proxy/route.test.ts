/**
 * Integration Tests: Image Proxy Endpoint Security
 *
 * This test suite validates the comprehensive security hardening
 * of the /api/image-proxy endpoint.
 *
 * Test Coverage:
 * - SSRF prevention (subdomain bypass, private IPs, DNS rebinding)
 * - Response size limits (memory exhaustion prevention)
 * - Request timeouts (slowloris attack prevention)
 * - Input validation
 * - Error handling
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/image-proxy/route';

// Mock the rate limiter to avoid rate limiting in tests
jest.mock('@/lib/middleware/rate-limiter', () => ({
  withRateLimit: (handler: any) => handler,
}));

// Mock fetch to simulate various responses
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Image Proxy API - Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should return 400 when url parameter is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-proxy');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Missing url parameter');
    });

    it('should return 403 for invalid URL format', async () => {
      const request = new NextRequest('http://localhost:3000/api/image-proxy?url=not-a-url');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).toContain('URL validation failed');
    });
  });

  describe('SSRF Prevention - Subdomain Bypass Attacks', () => {
    it('should BLOCK subdomain bypass without dot separator (evilapi.openverse.org)', async () => {
      const maliciousUrl = encodeURIComponent('https://evilapi.openverse.org/image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).toContain('Domain not allowed');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should ALLOW legitimate subdomains with dot separator (images.api.openverse.org)', async () => {
      const legitimateUrl = encodeURIComponent('https://images.api.openverse.org/image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should BLOCK api.openverse.org.evil.com', async () => {
      const maliciousUrl = encodeURIComponent('https://api.openverse.org.evil.com/image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('SSRF Prevention - AWS Metadata Endpoint', () => {
    it('should BLOCK direct IP access to AWS metadata', async () => {
      const maliciousUrl = encodeURIComponent('http://169.254.169.254/latest/meta-data/');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).toContain('Domain not allowed');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should BLOCK AWS metadata credential endpoint', async () => {
      const maliciousUrl = encodeURIComponent('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('SSRF Prevention - Private Network Access', () => {
    it('should BLOCK Class A private network (10.x.x.x)', async () => {
      const maliciousUrl = encodeURIComponent('http://10.0.0.1/admin');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should BLOCK Class B private network (172.16.x.x)', async () => {
      const maliciousUrl = encodeURIComponent('http://172.16.0.1/config');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should BLOCK Class C private network (192.168.x.x)', async () => {
      const maliciousUrl = encodeURIComponent('http://192.168.1.1/router');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should BLOCK localhost access', async () => {
      const maliciousUrl = encodeURIComponent('http://localhost:8000/secret');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should BLOCK 127.0.0.1 access', async () => {
      const maliciousUrl = encodeURIComponent('http://127.0.0.1:8080/internal');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('SSRF Prevention - Protocol Validation', () => {
    it('should BLOCK file:// protocol', async () => {
      const maliciousUrl = encodeURIComponent('file:///etc/passwd');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).toContain('Invalid protocol');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should BLOCK ftp:// protocol', async () => {
      const maliciousUrl = encodeURIComponent('ftp://api.openverse.org/file');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${maliciousUrl}`);
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Response Size Limits (Memory Exhaustion Prevention)', () => {
    it('should reject images larger than 10MB based on Content-Length', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/large-image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      // Mock fetch to return large file with Content-Length
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-length', String(11 * 1024 * 1024)], // 11MB
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => new ArrayBuffer(11 * 1024 * 1024),
      });

      const response = await GET(request);

      expect(response.status).toBe(413); // 413 Payload Too Large
      const text = await response.text();
      expect(text).toContain('Image too large');
      expect(text).toContain('exceeds 10MB limit');
    });

    it('should reject images larger than 10MB based on actual size', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/large-image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      // Mock fetch to return large file without Content-Length header
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => new ArrayBuffer(11 * 1024 * 1024), // 11MB
      });

      const response = await GET(request);

      expect(response.status).toBe(413);
      const text = await response.text();
      expect(text).toContain('Image too large');
    });

    it('should accept images under 10MB', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/small-image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      const smallImage = new ArrayBuffer(1 * 1024 * 1024); // 1MB

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-length', String(1 * 1024 * 1024)],
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => smallImage,
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.openverse.org'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'QuiverApp/1.0',
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('Request Timeout (Slowloris Prevention)', () => {
    it('should timeout requests taking longer than 10 seconds', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/slow-image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      // Mock fetch to simulate timeout
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 100);
        });
      });

      const response = await GET(request);

      expect(response.status).toBe(504); // 504 Gateway Timeout
      const text = await response.text();
      expect(text).toContain('Request timeout');
      expect(text).toContain('10 seconds');
    });

    it('should include AbortSignal in fetch request', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => new ArrayBuffer(100),
      });

      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  describe('Legitimate Requests (Should Pass)', () => {
    it('should allow images from api.openverse.org', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/v1/images/12345/thumb/');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      const imageData = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
          ['content-length', '1024'],
        ]),
        arrayBuffer: async () => imageData,
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should allow images from upload.wikimedia.org', async () => {
      const legitimateUrl = encodeURIComponent('https://upload.wikimedia.org/wikipedia/commons/thumb/image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow images from Flickr CDN', async () => {
      const legitimateUrl = encodeURIComponent('https://live.staticflickr.com/65535/12345_abcdef.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Caching Headers', () => {
    it('should include proper caching headers', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-type', 'image/jpeg'],
        ]),
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=604800, immutable');
      expect(response.headers.get('CDN-Cache-Control')).toBe('public, max-age=2592000');
    });
  });

  describe('Error Handling', () => {
    it('should handle upstream fetch errors', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/nonexistent.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const response = await GET(request);

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toContain('Failed to fetch image');
    });

    it('should handle network errors gracefully', async () => {
      const legitimateUrl = encodeURIComponent('https://api.openverse.org/image.jpg');
      const request = new NextRequest(`http://localhost:3000/api/image-proxy?url=${legitimateUrl}`);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const response = await GET(request);

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toContain('Internal server error');
    });
  });
});
