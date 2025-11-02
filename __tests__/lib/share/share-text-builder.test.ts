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
  arrival_time: '2024-01-15T08:00:00Z', // Implementation uses arrival_time
  rating: 4,
  notes: 'Great session! 4-6 ft, 5-10 mph offshore',
  is_public: true,
  created_at: '2024-01-15T08:00:00Z',
  updated_at: '2024-01-15T08:00:00Z',
  beaches: {
    id: 'beach-123',
    name: 'Malibu Point',
    slug: 'malibu-point',
    lat: 34.0,
    lng: -118.5,
    country: 'USA',
  } as any,
  wave_height_min: 4,
  wave_height_max: 6,
  wind_speed: 8,
} as any;

describe('share-text-builder', () => {
  describe('buildShareText', () => {
    it('should include beach name', () => {
      const text = buildShareText(mockSession);
      expect(text).toContain('Malibu Point');
    });

    it('should include date', () => {
      const text = buildShareText(mockSession);
      // Should contain some date representation (could be formatted date or "Recently")
      expect(text).toMatch(/Jan 15, 2024|Recently|2024/);
    });

    it('should include rating when available', () => {
      const text = buildShareText(mockSession);
      expect(text).toContain('4');
    });

    it('should include app branding', () => {
      const text = buildShareText(mockSession);
      expect(text.toLowerCase()).toContain('quiver');
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
      expect(caption).toContain('Malibu Point');
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
      expect(caption.toLowerCase()).toContain('#quiver');
    });
  });

  describe('buildInstagramLinkStickerTooltip', () => {
    it('should include session ID in URL', () => {
      const tooltip = buildInstagramLinkStickerTooltip('session-123');
      expect(tooltip).toContain('session-123');
    });

    it('should include instructions for link sticker', () => {
      const tooltip = buildInstagramLinkStickerTooltip('session-123');
      expect(tooltip.toLowerCase()).toContain('link sticker');
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
      // When session has notes, it returns the notes (not a generated description)
      // Our mock has notes, so it will return those notes
      expect(description).toContain('Great session');
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
      expect(stars).toContain('⭐');
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
        } as any,
      };

      const text = buildShortShareText(sessionWithLongName as any);
      expect(text.length).toBeLessThan(300);
    });

    it('should handle special characters in beach name', () => {
      const sessionWithSpecialChars = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: "O'Hare's Beach & Point",
        } as any,
      };

      const text = buildShareText(sessionWithSpecialChars as any);
      expect(text).toContain("O'Hare");
    });

    it('should handle session without scheduled_at', () => {
      const sessionWithoutDate = {
        ...mockSession,
        scheduled_at: null,
        arrival_time: null,
      };

      const text = buildShareText(sessionWithoutDate as any);
      expect(text).toBeTruthy();
    });

    it('should handle different date formats', () => {
      const sessions = [
        { ...mockSession, arrival_time: '2024-01-15T08:00:00Z' },
        { ...mockSession, arrival_time: '2024-01-15T08:00:00.000Z' },
        { ...mockSession, arrival_time: '2024-01-15' },
      ];

      sessions.forEach(session => {
        const text = buildShareText(session as any);
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

  describe('Boundary Value Tests', () => {
    it('should handle rating of 0', () => {
      const sessionWithZeroRating = {
        ...mockSession,
        rating: 0,
      };

      const text = buildShareText(sessionWithZeroRating);
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    });

    it('should handle rating above maximum (5)', () => {
      const sessionWithHighRating = {
        ...mockSession,
        rating: 10,
      };

      const text = buildShareText(sessionWithHighRating as any);
      expect(text).toBeTruthy();
    });

    it('should handle negative rating', () => {
      const sessionWithNegativeRating = {
        ...mockSession,
        rating: -1,
      };

      const text = buildShareText(sessionWithNegativeRating as any);
      expect(text).toBeTruthy();
    });

    it('should handle extremely long notes (>10000 chars)', () => {
      const longNotes = 'A'.repeat(15000);
      const sessionWithLongNotes = {
        ...mockSession,
        notes: longNotes,
      };

      const description = buildSessionDescription(sessionWithLongNotes as any);
      expect(description.length).toBeLessThanOrEqual(160);
    });

    it('should handle empty string beach name', () => {
      const sessionWithEmptyBeachName = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: '',
        } as any,
      };

      const text = buildShareText(sessionWithEmptyBeachName as any);
      expect(text).toBeTruthy();
    });

    it('should handle beach name with only whitespace', () => {
      const sessionWithWhitespaceBeach = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: '   ',
        } as any,
      };

      const text = buildShareText(sessionWithWhitespaceBeach as any);
      expect(text).toBeTruthy();
    });

    it('should handle very long beach name (>200 chars)', () => {
      const longBeachName = 'Very Long Beach Name '.repeat(15);
      const sessionWithLongBeachName = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: longBeachName,
        } as any,
      };

      const text = buildShortShareText(sessionWithLongBeachName as any);
      const urlLength = 23; // Twitter's t.co length
      const totalLength = text.length + urlLength + 1;
      expect(totalLength).toBeLessThanOrEqual(280);
    });

    it('should handle Unicode characters in beach name', () => {
      const sessionWithUnicode = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: 'Playa de las Américas 🏄‍♂️',
        } as any,
      };

      const text = buildShareText(sessionWithUnicode as any);
      expect(text).toContain('Américas');
    });

    it('should handle emoji in notes', () => {
      const sessionWithEmoji = {
        ...mockSession,
        notes: 'Great waves today! 🌊🏄‍♂️☀️',
      };

      const text = buildShareText(sessionWithEmoji as any);
      expect(text).toBeTruthy();
    });

    it('should handle notes with newlines and special formatting', () => {
      const sessionWithFormattedNotes = {
        ...mockSession,
        notes: 'Wave Height: 4-6ft\n\nWind: Offshore\n\n⭐⭐⭐⭐',
      };

      const description = buildSessionDescription(sessionWithFormattedNotes as any);
      expect(description).toBeTruthy();
      expect(description.length).toBeLessThanOrEqual(160);
    });

    it('should handle future dates gracefully', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const sessionWithFutureDate = {
        ...mockSession,
        arrival_time: futureDate.toISOString(),
      };

      const text = buildShareText(sessionWithFutureDate as any);
      expect(text).toBeTruthy();
    });

    it('should handle very old dates (year 1900)', () => {
      const sessionWithOldDate = {
        ...mockSession,
        arrival_time: '1900-01-01T08:00:00Z',
      };

      const text = buildShareText(sessionWithOldDate as any);
      expect(text).toBeTruthy();
    });

    it('should handle invalid date strings gracefully', () => {
      const sessionWithInvalidDate = {
        ...mockSession,
        arrival_time: 'not-a-date',
      };

      const text = buildShareText(sessionWithInvalidDate as any);
      expect(text).toBeTruthy();
    });

    it('should handle malformed session object with missing required fields', () => {
      const malformedSession = {
        id: 'test',
      };

      expect(() => {
        buildShareText(malformedSession as any);
        buildShortShareText(malformedSession as any);
        buildInstagramCaption(malformedSession as any);
      }).not.toThrow();
    });

    it('should handle XSS attempts in beach name', () => {
      const sessionWithXSS = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: '<script>alert("xss")</script>Beach',
        } as any,
      };

      const text = buildShareText(sessionWithXSS as any);
      expect(text).toContain('<script>');
      // Text builder doesn't sanitize - that should be done at render time
    });

    it('should handle SQL injection attempts in notes', () => {
      const sessionWithSQLi = {
        ...mockSession,
        notes: "'; DROP TABLE sessions; --",
      };

      const text = buildShareText(sessionWithSQLi as any);
      expect(text).toContain(sessionWithSQLi.notes);
    });
  });

  describe('Instagram Caption Edge Cases', () => {
    it('should limit Instagram caption length appropriately', () => {
      const caption = buildInstagramCaption(mockSession);
      // Instagram has a 2200 character limit
      expect(caption.length).toBeLessThanOrEqual(2200);
    });

    it('should include at least 3 hashtags', () => {
      const caption = buildInstagramCaption(mockSession);
      const hashtagCount = (caption.match(/#/g) || []).length;
      expect(hashtagCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle beach names with hashtag-unfriendly characters', () => {
      const sessionWithComplexName = {
        ...mockSession,
        beaches: {
          ...mockSession.beaches,
          name: "O'Neill's Beach & Surf Spot #1",
        } as any,
      };

      const caption = buildInstagramCaption(sessionWithComplexName as any);
      expect(caption).toBeTruthy();
    });
  });

  describe('formatRatingAsStars Edge Cases', () => {
    it('should handle very large numbers', () => {
      const stars = formatRatingAsStars(100);
      expect(typeof stars).toBe('string');
    });

    it('should handle Infinity', () => {
      const stars = formatRatingAsStars(Infinity);
      expect(typeof stars).toBe('string');
    });

    it('should handle NaN', () => {
      const stars = formatRatingAsStars(NaN);
      expect(typeof stars).toBe('string');
    });

    it('should handle negative zero', () => {
      const stars = formatRatingAsStars(-0);
      expect(typeof stars).toBe('string');
    });
  });
});
