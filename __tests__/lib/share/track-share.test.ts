import {
  trackShare,
  trackSharePlatformSelected,
  trackShareCompleted,
  trackShareFailed,
  trackVariantChanged,
  trackAspectRatioChanged,
  trackDownloadStarted,
  trackDownloadCompleted,
  incrementSessionShareCount,
} from '@/lib/share/track-share';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  rpc: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  single: jest.fn(() => ({ data: null, error: null })),
};

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock Google Analytics
global.gtag = jest.fn() as any;

// Mock window.navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Test User Agent',
  },
  writable: true,
});

describe('track-share analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.rpc.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.single.mockResolvedValue({ data: null, error: null });
  });

  describe('trackShare', () => {
    it('should track share to database', async () => {
      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
        shareUrl: 'https://example.com/share',
        surface: 'session_detail',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('session_shares');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-123',
          user_id: 'user-123',
          platform: 'instagram',
        })
      );
    });

    it('should track share to Google Analytics', async () => {
      await trackShare('x', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 2,
        aspectRatio: '9:16',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        expect.stringContaining('share'),
        expect.objectContaining({
          session_id: 'session-123',
          platform: 'x',
        })
      );
    });

    it('should include variant in tracking data', async () => {
      await trackShare('facebook', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 3,
        aspectRatio: '1:1',
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: '3',
        })
      );
    });

    it('should include aspect ratio in tracking data', async () => {
      await trackShare('download', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '4:5',
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          aspect_ratio: '4:5',
        })
      );
    });

    it('should include surface context', async () => {
      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
        surface: 'preview_page',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        expect.any(String),
        expect.objectContaining({
          surface: 'preview_page',
        })
      );
    });

    it('should handle tracking errors gracefully', async () => {
      mockSupabase.insert.mockReturnValue({
        ...mockSupabase,
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      });

      // Should not throw
      await expect(
        trackShare('instagram', {
          sessionId: 'session-123',
          userId: 'user-123',
          variant: 1,
          aspectRatio: '1:1',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackSharePlatformSelected', () => {
    it('should track platform selection to GA', () => {
      trackSharePlatformSelected('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_platform_selected',
        expect.objectContaining({
          platform: 'instagram',
        })
      );
    });

    it('should include variant and aspect ratio', () => {
      trackSharePlatformSelected('x', {
        sessionId: 'session-123',
        variant: 3,
        aspectRatio: '9:16',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_platform_selected',
        expect.objectContaining({
          variant: 3,
          aspect_ratio: '9:16',
        })
      );
    });
  });

  describe('trackShareCompleted', () => {
    it('should track successful share', () => {
      trackShareCompleted('facebook', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_completed',
        expect.objectContaining({
          platform: 'facebook',
        })
      );
    });

    it('should track platform-specific completion event', () => {
      trackShareCompleted('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        expect.stringMatching(/share.*instagram|instagram.*share/i),
        expect.any(Object)
      );
    });
  });

  describe('trackShareFailed', () => {
    it('should track share failure', () => {
      trackShareFailed('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
        error: 'Network error',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_failed',
        expect.objectContaining({
          platform: 'instagram',
        })
      );
    });

    it('should include error message', () => {
      trackShareFailed('download', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
        error: 'Failed to download',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_failed',
        expect.objectContaining({
          error: 'Failed to download',
        })
      );
    });
  });

  describe('trackVariantChanged', () => {
    it('should track variant selection', () => {
      trackVariantChanged(3, {
        sessionId: 'session-123',
        previousVariant: 1,
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_variant_changed',
        expect.objectContaining({
          new_variant: 3,
          previous_variant: 1,
        })
      );
    });

    it('should handle first variant selection', () => {
      trackVariantChanged(2, {
        sessionId: 'session-123',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_variant_changed',
        expect.objectContaining({
          new_variant: 2,
        })
      );
    });
  });

  describe('trackAspectRatioChanged', () => {
    it('should track aspect ratio selection', () => {
      trackAspectRatioChanged('9:16', {
        sessionId: 'session-123',
        previousAspectRatio: '1:1',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_aspect_ratio_changed',
        expect.objectContaining({
          new_aspect_ratio: '9:16',
          previous_aspect_ratio: '1:1',
        })
      );
    });

    it('should handle first aspect ratio selection', () => {
      trackAspectRatioChanged('4:5', {
        sessionId: 'session-123',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_aspect_ratio_changed',
        expect.objectContaining({
          new_aspect_ratio: '4:5',
        })
      );
    });
  });

  describe('trackDownloadStarted', () => {
    it('should track download initiation', () => {
      trackDownloadStarted({
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_download_started',
        expect.objectContaining({
          session_id: 'session-123',
          variant: 1,
          aspect_ratio: '1:1',
        })
      );
    });

    it('should include surface context', () => {
      trackDownloadStarted({
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
        surface: 'preview_page',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_download_started',
        expect.objectContaining({
          surface: 'preview_page',
        })
      );
    });
  });

  describe('trackDownloadCompleted', () => {
    it('should track successful download', () => {
      trackDownloadCompleted({
        sessionId: 'session-123',
        variant: 2,
        aspectRatio: '4:5',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_download_completed',
        expect.objectContaining({
          session_id: 'session-123',
        })
      );
    });

    it('should include variant and aspect ratio', () => {
      trackDownloadCompleted({
        sessionId: 'session-123',
        variant: 3,
        aspectRatio: '9:16',
      });

      expect(global.gtag).toHaveBeenCalledWith(
        'event',
        'share_download_completed',
        expect.objectContaining({
          variant: 3,
          aspect_ratio: '9:16',
        })
      );
    });
  });

  describe('incrementSessionShareCount', () => {
    it('should call database RPC function', async () => {
      await incrementSessionShareCount('session-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'increment_session_share_count',
        expect.objectContaining({
          session_id: 'session-123',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.rpc.mockReturnValue({
        ...mockSupabase,
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('RPC error') }),
      });

      // Should not throw
      await expect(
        incrementSessionShareCount('session-123')
      ).resolves.not.toThrow();
    });

    it('should return successfully when database update succeeds', async () => {
      mockSupabase.rpc.mockReturnValue({
        ...mockSupabase,
        single: jest.fn().mockResolvedValue({ data: { share_count: 1 }, error: null }),
      });

      await expect(
        incrementSessionShareCount('session-123')
      ).resolves.not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should track complete share flow', async () => {
      // Platform selected
      trackSharePlatformSelected('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '9:16',
      });

      // Download started
      trackDownloadStarted({
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '9:16',
      });

      // Share tracked
      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '9:16',
      });

      // Download completed
      trackDownloadCompleted({
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '9:16',
      });

      // Share count incremented
      await incrementSessionShareCount('session-123');

      // Share completed
      trackShareCompleted('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '9:16',
      });

      // Verify all tracking calls were made
      expect(global.gtag).toHaveBeenCalledWith('event', 'share_platform_selected', expect.any(Object));
      expect(global.gtag).toHaveBeenCalledWith('event', 'share_download_started', expect.any(Object));
      expect(global.gtag).toHaveBeenCalledWith('event', expect.stringContaining('share'), expect.any(Object));
      expect(global.gtag).toHaveBeenCalledWith('event', 'share_download_completed', expect.any(Object));
      expect(global.gtag).toHaveBeenCalledWith('event', 'share_completed', expect.any(Object));
      expect(mockSupabase.from).toHaveBeenCalled();
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should track failed share flow', async () => {
      trackSharePlatformSelected('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      trackDownloadStarted({
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      trackShareFailed('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
        error: 'Download failed',
      });

      expect(global.gtag).toHaveBeenCalledWith('event', 'share_failed', expect.any(Object));
    });

    it('should track variant and aspect ratio changes', () => {
      // Change variant
      trackVariantChanged(2, {
        sessionId: 'session-123',
        previousVariant: 1,
      });

      // Change aspect ratio
      trackAspectRatioChanged('9:16', {
        sessionId: 'session-123',
        previousAspectRatio: '1:1',
      });

      // Change variant again
      trackVariantChanged(3, {
        sessionId: 'session-123',
        previousVariant: 2,
      });

      expect(global.gtag).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should not throw when gtag is undefined', () => {
      const originalGtag = global.gtag;
      delete (global as any).gtag;

      expect(() => {
        trackSharePlatformSelected('instagram', { sessionId: 'test' });
        trackShareCompleted('instagram', { sessionId: 'test' });
        trackShareFailed('instagram', { sessionId: 'test' });
      }).not.toThrow();

      global.gtag = originalGtag;
    });

    it('should handle database connection errors', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection error');
      });

      await expect(
        trackShare('instagram', {
          sessionId: 'session-123',
          userId: 'user-123',
          variant: 1,
          aspectRatio: '1:1',
        })
      ).resolves.not.toThrow();
    });
  });
});
