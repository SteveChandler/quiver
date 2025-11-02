import {
  buildSharePageUrl,
  buildImageUrl,
  buildPreviewPageUrl,
  buildTwitterShareUrl,
  buildFacebookShareUrl,
  buildInstagramShareUrl,
  buildPlatformShareUrl,
  buildImageFilename,
  isWebShareAvailable,
  openShareUrl,
  downloadImage,
} from '@/lib/share/share-url-builder';
import type { SessionWithDetails } from '@/types/database';

// Mock environment
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  process.env.NEXT_PUBLIC_SITE_URL = 'https://test.quiversurf.app';
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const mockSession: SessionWithDetails = {
  id: 'session-123',
  user_id: 'user-123',
  beach_id: 'beach-123',
  scheduled_at: '2024-01-15T08:00:00Z',
  arrival_time: '2024-01-15T08:00:00Z',
  rating: 4,
  notes: 'Great session!',
  is_public: true,
  created_at: '2024-01-15T08:00:00Z',
  updated_at: '2024-01-15T08:00:00Z',
  beaches: {
    id: 'beach-123',
    name: 'Test Beach',
    slug: 'test-beach',
    lat: 33.0,
    lng: -117.0,
    country: 'USA',
  } as any,
  wave_height_min: 4,
  wave_height_max: 6,
} as any;

describe('share-url-builder', () => {
  describe('buildSharePageUrl', () => {
    it('should build public share page URL', () => {
      const url = buildSharePageUrl('session-123');
      expect(url).toBe('https://test.quiversurf.app/s/session-123');
    });

    it('should use NEXT_PUBLIC_SITE_URL from env', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://custom.domain.com';
      const url = buildSharePageUrl('test-id');
      expect(url).toContain('https://custom.domain.com');
    });
  });

  describe('buildImageUrl', () => {
    it('should build image API URL with variant and ratio', () => {
      const url = buildImageUrl('session-123', 1, '1:1');
      expect(url).toBe('https://test.quiversurf.app/api/sessions/session-123/share-image?variant=1&ratio=1%3A1');
    });

    it('should encode aspect ratio properly', () => {
      const url = buildImageUrl('session-123', 3, '9:16');
      expect(url).toContain('ratio=9%3A16');
    });

    it('should work with all variants', () => {
      for (let variant = 1; variant <= 6; variant++) {
        const url = buildImageUrl('session-123', variant as any, '1:1');
        expect(url).toContain(`variant=${variant}`);
      }
    });

    it('should work with all aspect ratios', () => {
      const ratios: Array<'1:1' | '4:5' | '9:16'> = ['1:1', '4:5', '9:16'];
      ratios.forEach(ratio => {
        const url = buildImageUrl('session-123', 1, ratio);
        expect(url).toContain('ratio=');
      });
    });
  });

  describe('buildPreviewPageUrl', () => {
    it('should build preview page URL', () => {
      const url = buildPreviewPageUrl('session-123', 1, '1:1');
      expect(url).toBe('https://test.quiversurf.app/share/session-123/1/1%3A1');
    });

    it('should encode aspect ratio in path', () => {
      const url = buildPreviewPageUrl('session-123', 3, '9:16');
      expect(url).toContain('/3/9%3A16');
    });
  });

  describe('buildTwitterShareUrl', () => {
    it('should build Twitter intent URL', () => {
      const result = buildTwitterShareUrl(mockSession, 'session-123');

      expect(result.url).toContain('https://twitter.com/intent/tweet');
      expect(result.url).toContain('text=');
      expect(result.url).toContain('url=');
      expect(result.text).toBeTruthy();
    });

    it('should include session details in text', () => {
      const result = buildTwitterShareUrl(mockSession, 'session-123');

      expect(result.text).toContain('Test Beach');
    });

    it('should URL encode share text and URL', () => {
      const result = buildTwitterShareUrl(mockSession, 'session-123');

      // Should not contain unencoded special characters
      const urlParams = result.url.split('?')[1];
      expect(urlParams).not.toContain(' ');
      expect(urlParams).not.toContain('#');
    });
  });

  describe('buildFacebookShareUrl', () => {
    it('should build Facebook share URL', () => {
      const result = buildFacebookShareUrl('session-123');

      expect(result.url).toContain('https://www.facebook.com/sharer');
      expect(result.url).toContain('u=');
    });

    it('should encode share page URL', () => {
      const result = buildFacebookShareUrl('session-123');

      expect(result.url).toContain('%2F'); // encoded slash
    });
  });

  describe('buildInstagramShareUrl', () => {
    it('should return download URL for Instagram', () => {
      const result = buildInstagramShareUrl('session-123', 1, '9:16');

      expect(result.url).toContain('/api/sessions/session-123/share-image');
      expect(result.tooltip).toBeTruthy();
      expect(result.text).toContain('Instagram');
    });

    it('should default to 9:16 aspect ratio', () => {
      const result = buildInstagramShareUrl('session-123', 1);

      expect(result.url).toContain('ratio=9%3A16');
    });

    it('should include link sticker instructions', () => {
      const result = buildInstagramShareUrl('session-123', 1, '9:16');

      expect(result.tooltip).toMatch(/link sticker|Link sticker/i);
    });
  });

  describe('buildPlatformShareUrl', () => {
    it('should build URL for Twitter platform', () => {
      const result = buildPlatformShareUrl('x', mockSession, 'session-123', 1, '1:1');

      expect(result.url).toContain('twitter.com/intent');
    });

    it('should build URL for Facebook platform', () => {
      const result = buildPlatformShareUrl('facebook', mockSession, 'session-123', 1, '1:1');

      expect(result.url).toContain('facebook.com/sharer');
    });

    it('should build download URL for Instagram', () => {
      const result = buildPlatformShareUrl('instagram', mockSession, 'session-123', 1, '9:16');

      expect(result.url).toContain('/api/sessions/');
      expect(result.tooltip).toBeTruthy();
    });

    it('should build download URL for download platform', () => {
      const result = buildPlatformShareUrl('download', mockSession, 'session-123', 1, '1:1');

      expect(result.url).toContain('/api/sessions/session-123/share-image');
    });

    it('should build share page URL for generic platform', () => {
      const result = buildPlatformShareUrl('generic', mockSession, 'session-123', 1, '1:1');

      expect(result.url).toContain('/s/session-123');
    });
  });

  describe('buildImageFilename', () => {
    it('should generate filename with session info', () => {
      const filename = buildImageFilename(mockSession, 1, '1:1');

      expect(filename).toContain('quiver');
      expect(filename).toContain('.png');
      expect(filename.toLowerCase()).toMatch(/test-beach|test_beach|testbeach/);
    });

    it('should include variant in filename', () => {
      const filename = buildImageFilename(mockSession, 3, '1:1');

      expect(filename).toMatch(/3|variant-3|variant_3/);
    });

    it('should include aspect ratio in filename', () => {
      const filename = buildImageFilename(mockSession, 1, '9:16');

      expect(filename).toMatch(/9x16|9-16|story/);
    });

    it('should have .png extension', () => {
      const filename = buildImageFilename(mockSession, 1, '1:1');

      expect(filename).toMatch(/\.png$/i);
    });

    it('should sanitize beach name for filename', () => {
      const sessionWithSpecialChars = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: 'Malibu / Point Dume',
        },
      };

      const filename = buildImageFilename(sessionWithSpecialChars, 1, '1:1');

      expect(filename).not.toContain('/');
      expect(filename).toMatch(/^[a-zA-Z0-9_\-\.]+$/);
    });
  });

  describe('isWebShareAvailable', () => {
    it('should return boolean', () => {
      const result = isWebShareAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('should return false in Node environment', () => {
      // In Jest/Node, navigator.share is not available
      const result = isWebShareAvailable();
      expect(result).toBe(false);
    });
  });

  describe('openShareUrl', () => {
    it('should be a function', () => {
      expect(typeof openShareUrl).toBe('function');
    });

    it('should not throw when called with valid URL', () => {
      // Mock window.open to avoid jsdom error
      const mockOpen = jest.fn();
      global.window.open = mockOpen;

      expect(() => {
        openShareUrl('https://twitter.com/intent/tweet');
      }).not.toThrow();

      expect(mockOpen).toHaveBeenCalled();
    });
  });

  describe('downloadImage', () => {
    beforeEach(() => {
      // Mock fetch
      global.fetch = jest.fn();

      // Mock Blob
      global.Blob = jest.fn().mockImplementation((parts, options) => ({
        parts,
        options,
        type: options?.type || '',
      })) as any;

      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      // Mock document.createElement
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any);
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return boolean', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['test'], { type: 'image/png' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(typeof result).toBe('boolean');
    });

    it('should return true on successful download', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        blob: async () => new Blob(['test'], { type: 'image/png' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(true);
    });

    it('should return false on fetch failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Session not found' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    it('should return false on 401 authentication error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Authentication required' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    it('should return false on 403 permission error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'You don\'t have access to this session' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    it('should return false on 429 rate limit error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded. Please try again later.' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    it('should return false on invalid content type', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        blob: async () => new Blob(['<html>error</html>'], { type: 'text/html' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    it('should use correct filename', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        blob: async () => new Blob(['test'], { type: 'image/png' }),
      });

      const mockAnchor = document.createElement('a');
      await downloadImage('https://example.com/image.png', 'my-custom-file.png');

      expect(mockAnchor.download).toBe('my-custom-file.png');
    });

    // Edge case: timeout handling
    it('should handle fetch timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    // Edge case: malformed JSON in error response
    it('should handle malformed JSON in error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => { throw new Error('Invalid JSON'); },
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    // Edge case: 500 server error
    it('should return false on 500 server error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error generating image' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    // Edge case: 503 service unavailable
    it('should return false on 503 service unavailable', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: 'Service temporarily unavailable' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    // Edge case: blob creation failure
    it('should handle blob creation errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        blob: async () => { throw new Error('Failed to create blob'); },
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    // Edge case: missing content-type header
    it('should handle missing content-type header', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({}),
        blob: async () => new Blob(['test'], { type: 'image/png' }),
      });

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      // Should succeed if blob is valid even without explicit content-type
      expect(result).toBe(true);
    });

    // Edge case: AbortError (user cancelled request)
    it('should handle AbortError when request is cancelled', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValue(abortError);

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });

    // Edge case: CORS error
    it('should handle CORS errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await downloadImage('https://example.com/image.png', 'test.png');
      expect(result).toBe(false);
    });
  });
});
