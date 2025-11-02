import {
  buildShareText,
  buildShortShareText,
  buildInstagramCaption,
  buildInstagramLinkStickerTooltip,
  buildSessionDescription,
  formatRatingAsStars,
} from '@/lib/share/share-text-builder';
import type { SessionWithDetails } from '@/types/database';

const mockSession: SessionWithDetails = {
  id: 'session-123',
  user_id: 'user-123',
  beach_id: 'beach-123',
  scheduled_at: '2024-01-15T08:00:00Z',
  rating: 4,
  notes: 'Great session! 4-6 ft, 5-10 mph offshore',
  is_public: true,
  created_at: '2024-01-15T08:00:00Z',
  updated_at: '2024-01-15T08:00:00Z',
  beaches: {
    id: 'beach-123',
    name: 'Malibu Point',
    slug: 'malibu-point',
    latitude: 34.0,
    longitude: -118.5,
    country: 'USA',
  },
  wave_height_min: 4,
  wave_height_max: 6,
  wind_speed: 8,
};

describe('share-text-builder', () => {
  describe('buildShareText', () => {
    it('should include beach name', () => {
      const text = buildShareText(mockSession);
      expect(text).toContain('Malibu Point');
    });

    it('should include date', () => {
      const text = buildShareText(mockSession);
      // Should contain some date representation
      expect(text).toMatch(/\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    });

    it('should include rating when available', () => {
      const text = buildShareText(mockSession);
      expect(text).toContain('4' || '⭐');
    });

    it('should include app branding', () => {
      const text = buildShareText(mockSession);
      expect(text.toLowerCase()).toContain('quiver' || 'quiversurf');
    });

    it('should handle session without beach name', () => {
      const sessionWithoutBeach = {
        ...mockSession,
        beaches: null,
      };

      const text = buildShareText(sessionWithoutBeach as any);
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    });

    it('should handle session without rating', () => {
      const sessionWithoutRating = {
        ...mockSession,
        rating: null,
      };

      const text = buildShareText(sessionWithoutRating);
      expect(text).toBeTruthy();
    });
  });

  describe('buildShortShareText', () => {
    it('should be shorter than full share text', () => {
      const fullText = buildShareText(mockSession);
      const shortText = buildShortShareText(mockSession);

      expect(shortText.length).toBeLessThanOrEqual(fullText.length);
    });

    it('should be suitable for Twitter (under 280 chars with URL)', () => {
      const shortText = buildShortShareText(mockSession);
      const urlLength = 23; // Twitter's t.co length
      const totalLength = shortText.length + urlLength + 1; // +1 for space

      expect(totalLength).toBeLessThanOrEqual(280);
    });

    it('should include beach name', () => {
      const text = buildShortShareText(mockSession);
      expect(text).toContain('Malibu Point');
    });

    it('should include rating', () => {
      const text = buildShortShareText(mockSession);
      expect(text).toMatch(/\d|⭐/);
    });
  });

  describe('buildInstagramCaption', () => {
    it('should include hashtags', () => {
      const caption = buildInstagramCaption(mockSession);
      expect(caption).toMatch(/#\w+/);
    });

    it('should include beach information', () => {
      const caption = buildInstagramCaption(mockSession);
      expect(caption).toContain('Malibu Point' || 'malibu');
    });

    it('should include surf-related hashtags', () => {
      const caption = buildInstagramCaption(mockSession);
      const lowerCaption = caption.toLowerCase();

      expect(
        lowerCaption.includes('#surf') ||
        lowerCaption.includes('#surfing') ||
        lowerCaption.includes('#waves')
      ).toBe(true);
    });

    it('should include app hashtag', () => {
      const caption = buildInstagramCaption(mockSession);
      expect(caption.toLowerCase()).toContain('#quiver' || 'quiversurf');
    });
  });

  describe('buildInstagramLinkStickerTooltip', () => {
    it('should include session ID in URL', () => {
      const tooltip = buildInstagramLinkStickerTooltip('session-123');
      expect(tooltip).toContain('session-123' || '/s/session-123');
    });

    it('should include instructions for link sticker', () => {
      const tooltip = buildInstagramLinkStickerTooltip('session-123');
      expect(tooltip.toLowerCase()).toContain('link sticker' || 'add link');
    });

    it('should return a string', () => {
      const tooltip = buildInstagramLinkStickerTooltip('session-123');
      expect(typeof tooltip).toBe('string');
      expect(tooltip.length).toBeGreaterThan(0);
    });
  });

  describe('buildSessionDescription', () => {
    it('should create meta description for SEO', () => {
      const description = buildSessionDescription(mockSession);
      expect(description).toBeTruthy();
      expect(typeof description).toBe('string');
    });

    it('should include beach name', () => {
      const description = buildSessionDescription(mockSession);
      expect(description).toContain('Malibu Point');
    });

    it('should be suitable for meta description (under 160 chars)', () => {
      const description = buildSessionDescription(mockSession);
      expect(description.length).toBeLessThanOrEqual(160);
    });

    it('should include session details', () => {
      const description = buildSessionDescription(mockSession);
      const hasDetails =
        description.includes('surf') ||
        description.includes('session') ||
        description.includes('waves');

      expect(hasDetails).toBe(true);
    });
  });

  describe('formatRatingAsStars', () => {
    it('should convert rating to star emojis', () => {
      const stars = formatRatingAsStars(4);
      expect(stars).toContain('⭐' || '★');
    });

    it('should return correct number of stars', () => {
      const stars = formatRatingAsStars(3);
      const starCount = (stars.match(/⭐|★/g) || []).length;
      expect(starCount).toBe(3);
    });

    it('should handle rating of 5', () => {
      const stars = formatRatingAsStars(5);
      const starCount = (stars.match(/⭐|★/g) || []).length;
      expect(starCount).toBe(5);
    });

    it('should handle rating of 1', () => {
      const stars = formatRatingAsStars(1);
      const starCount = (stars.match(/⭐|★/g) || []).length;
      expect(starCount).toBe(1);
    });

    it('should handle fractional ratings by rounding', () => {
      const stars = formatRatingAsStars(3.7);
      const starCount = (stars.match(/⭐|★/g) || []).length;
      expect([3, 4]).toContain(starCount); // Could round up or down
    });

    it('should handle rating of 0', () => {
      const stars = formatRatingAsStars(0);
      expect(stars).toBeDefined();
    });

    it('should handle null or undefined rating', () => {
      const stars = formatRatingAsStars(null as any);
      expect(typeof stars).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle session with minimal data', () => {
      const minimalSession = {
        id: 'test-123',
        user_id: 'user-123',
        beach_id: null,
        scheduled_at: null,
        rating: null,
        notes: null,
        is_public: true,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
        beaches: null,
      };

      expect(() => {
        buildShareText(minimalSession as any);
        buildShortShareText(minimalSession as any);
        buildInstagramCaption(minimalSession as any);
        buildSessionDescription(minimalSession as any);
      }).not.toThrow();
    });

    it('should handle very long beach names', () => {
      const sessionWithLongName = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: 'Very Long Beach Name With Multiple Words And Descriptors',
        },
      };

      const text = buildShortShareText(sessionWithLongName);
      expect(text.length).toBeLessThan(300);
    });

    it('should handle special characters in beach name', () => {
      const sessionWithSpecialChars = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: "O'Hare's Beach & Point",
        },
      };

      const text = buildShareText(sessionWithSpecialChars);
      expect(text).toContain("O'Hare");
    });

    it('should handle session without scheduled_at', () => {
      const sessionWithoutDate = {
        ...mockSession,
        scheduled_at: null,
      };

      const text = buildShareText(sessionWithoutDate);
      expect(text).toBeTruthy();
    });

    it('should handle different date formats', () => {
      const sessions = [
        { ...mockSession, scheduled_at: '2024-01-15T08:00:00Z' },
        { ...mockSession, scheduled_at: '2024-01-15T08:00:00.000Z' },
        { ...mockSession, scheduled_at: '2024-01-15' },
      ];

      sessions.forEach(session => {
        const text = buildShareText(session);
        expect(text).toBeTruthy();
      });
    });
  });

  describe('Content Quality', () => {
    it('should not contain placeholder text', () => {
      const text = buildShareText(mockSession);
      expect(text.toLowerCase()).not.toContain('todo');
      expect(text.toLowerCase()).not.toContain('placeholder');
      expect(text.toLowerCase()).not.toContain('undefined');
      expect(text.toLowerCase()).not.toContain('null');
    });

    it('should have proper spacing and formatting', () => {
      const text = buildShareText(mockSession);
      expect(text).not.toMatch(/\s{2,}/); // No double spaces
      expect(text.trim()).toBe(text); // No leading/trailing whitespace
    });

    it('should be grammatically sound', () => {
      const text = buildShareText(mockSession);
      // Should not end with dangling punctuation
      expect(text).not.toMatch(/[,;]\s*$/);
    });
  });
});
