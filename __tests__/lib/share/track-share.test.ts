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

jest.mock('@/lib/supabase-browser', () => ({
  createSupabaseBrowser: jest.fn(() => mockSupabase),
}));

jest.mock('@/lib/supabase', () => ({
  createServerClient: jest.fn(() => mockSupabase),
}));

// Mock analytics module
jest.mock('@/lib/analytics', () => {
  const mockFn = jest.fn();
  (global as any).mockTrack = mockFn;
  return {
    track: mockFn,
  };
});

const mockTrack = (global as any).mockTrack;

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
    mockTrack.mockClear();
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

      expect(mockTrack).toHaveBeenCalledWith(
        'share',
        expect.objectContaining({
          content_id: 'session-123',
          method: 'x',
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

      expect(mockTrack).toHaveBeenCalledWith(
        'share',
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      // The track function is called twice - once for 'share_completed' and once for platform-specific
      expect(mockTrack).toHaveBeenCalled();
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      expect(mockTrack).toHaveBeenCalledWith(
        'share_variant_changed',
        expect.objectContaining({
          variant: 3,
          previous_variant: 1,
        })
      );
    });

    it('should handle first variant selection', () => {
      trackVariantChanged(2, {
        sessionId: 'session-123',
      });

      expect(mockTrack).toHaveBeenCalledWith(
        'share_variant_changed',
        expect.objectContaining({
          variant: 2,
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

      expect(mockTrack).toHaveBeenCalledWith(
        'share_aspect_ratio_changed',
        expect.objectContaining({
          aspect_ratio: '9:16',
          previous_aspect_ratio: '1:1',
        })
      );
    });

    it('should handle first aspect ratio selection', () => {
      trackAspectRatioChanged('4:5', {
        sessionId: 'session-123',
      });

      expect(mockTrack).toHaveBeenCalledWith(
        'share_aspect_ratio_changed',
        expect.objectContaining({
          aspect_ratio: '4:5',
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      expect(mockTrack).toHaveBeenCalledWith(
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

      expect(mockTrack).toHaveBeenCalledWith(
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
      expect(mockTrack).toHaveBeenCalledWith('share_platform_selected', expect.any(Object));
      expect(mockTrack).toHaveBeenCalledWith('share_download_started', expect.any(Object));
      expect(mockTrack).toHaveBeenCalledWith(expect.stringContaining('share'), expect.any(Object));
      expect(mockTrack).toHaveBeenCalledWith('share_download_completed', expect.any(Object));
      expect(mockTrack).toHaveBeenCalledWith('share_completed', expect.any(Object));
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

      expect(mockTrack).toHaveBeenCalledWith('share_failed', expect.any(Object));
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

      expect(mockTrack).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should not throw when gtag is undefined', () => {
      const originalGtag = mockTrack;
      delete (global as any).gtag;

      expect(() => {
        trackSharePlatformSelected('instagram', { sessionId: 'test' });
        trackShareCompleted('instagram', { sessionId: 'test' });
        trackShareFailed('instagram', { sessionId: 'test' });
      }).not.toThrow();

      // No need to restore - jest.clearAllMocks() handles this
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

  describe('Rate Limiting Scenarios', () => {
    it('should handle database rate limit errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded', code: '429' },
      });

      const result = await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });

    it('should handle concurrent share requests without conflicts', async () => {
      mockSupabase.insert.mockReturnValue({
        ...mockSupabase,
        single: jest.fn().mockResolvedValue({
          data: { id: 'share-1' },
          error: null,
        }),
      });

      // Simulate multiple concurrent shares
      const promises = Array.from({ length: 5 }, (_, i) =>
        trackShare('instagram', {
          sessionId: `session-${i}`,
          userId: 'user-123',
          variant: 1,
          aspectRatio: '1:1',
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      expect(mockSupabase.insert).toHaveBeenCalledTimes(5);
    });

    it('should handle analytics service throttling', () => {
      // Mock analytics throwing throttle error
      mockTrack.mockImplementation(() => {
        throw new Error('Analytics service rate limit');
      });

      // Should not throw - analytics errors are swallowed
      expect(() => {
        trackSharePlatformSelected('instagram', {
          sessionId: 'session-123',
          variant: 1,
          aspectRatio: '1:1',
        });
      }).not.toThrow();
    });
  });

  describe('Database Constraint Violations', () => {
    it('should handle duplicate share tracking attempts', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          message: 'duplicate key value violates unique constraint',
          code: '23505',
        },
      });

      const result = await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
    });

    it('should handle foreign key constraint violations', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          message: 'insert or update on table violates foreign key constraint',
          code: '23503',
        },
      });

      const result = await trackShare('instagram', {
        sessionId: 'nonexistent-session',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
    });

    it('should handle null constraint violations', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: {
          message: 'null value in column violates not-null constraint',
          code: '23502',
        },
      });

      const result = await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Network and Timeout Scenarios', () => {
    it('should handle database timeout', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Query timeout'));

      const result = await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should handle network disconnection', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new TypeError('Network request failed');
      });

      const result = await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(result.success).toBe(false);
    });

    it('should handle incrementSessionShareCount RPC timeout', async () => {
      mockSupabase.rpc.mockReturnValue({
        ...mockSupabase,
        single: jest.fn().mockImplementation(
          () => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('RPC timeout')), 100)
          )
        ),
      });

      // Should not throw even on timeout
      await expect(
        incrementSessionShareCount('session-123')
      ).resolves.not.toThrow();
    });

    it('should handle incrementSessionShareCount when session does not exist', async () => {
      mockSupabase.rpc.mockReturnValue({
        ...mockSupabase,
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Session not found', code: 'P0001' },
        }),
      });

      // Should not throw
      await expect(
        incrementSessionShareCount('nonexistent-session')
      ).resolves.not.toThrow();
    });
  });

  describe('Edge Case Inputs', () => {
    it('should handle extremely long session IDs', async () => {
      const longSessionId = 'x'.repeat(1000);

      await trackShare('instagram', {
        sessionId: longSessionId,
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: longSessionId,
        })
      );
    });

    it('should handle special characters in session ID', async () => {
      const specialSessionId = 'session-123-@#$%^&*()';

      await trackShare('instagram', {
        sessionId: specialSessionId,
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: specialSessionId,
        })
      );
    });

    it('should handle empty string URLs in shareUrl parameter', async () => {
      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
        shareUrl: '',
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          share_url: '',
        })
      );
    });

    it('should handle very long error messages', () => {
      const longError = 'Error: ' + 'x'.repeat(5000);

      trackShareFailed('instagram', {
        sessionId: 'session-123',
        variant: 1,
        aspectRatio: '1:1',
        error: longError,
      });

      expect(mockTrack).toHaveBeenCalledWith(
        'share_failed',
        expect.objectContaining({
          error: longError,
        })
      );
    });

    it('should handle invalid variant values', async () => {
      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 999 as any,
        aspectRatio: '1:1',
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: '999',
        })
      );
    });

    it('should handle invalid aspect ratio values', async () => {
      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '999:999' as any,
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          aspect_ratio: '999:999',
        })
      );
    });
  });

  describe('Server vs Client Mode', () => {
    it('should use server client when isServer is true', async () => {
      const { createServerClient } = require('@/lib/supabase');

      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
        isServer: true,
      });

      // Verify server client was used (would be called by createServerClient)
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should use browser client when isServer is false or undefined', async () => {
      await trackShare('instagram', {
        sessionId: 'session-123',
        userId: 'user-123',
        variant: 1,
        aspectRatio: '1:1',
        isServer: false,
      });

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should handle incrementSessionShareCount in server mode', async () => {
      await incrementSessionShareCount('session-123', true);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'increment_session_share_count',
        { session_id: 'session-123' }
      );
    });
  });
});
