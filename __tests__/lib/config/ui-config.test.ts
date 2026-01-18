import {
  UI_LIMITS,
  CARD_DISPLAY,
  PAGINATION,
} from '@/lib/config/ui-config';

describe('ui-config', () => {
  describe('UI_LIMITS', () => {
    it('should have PREVIEW_ITEMS defined as a positive number', () => {
      expect(UI_LIMITS.PREVIEW_ITEMS).toBeGreaterThan(0);
      expect(typeof UI_LIMITS.PREVIEW_ITEMS).toBe('number');
    });

    it('should have CAROUSEL_ITEMS defined as a positive number', () => {
      expect(UI_LIMITS.CAROUSEL_ITEMS).toBeGreaterThan(0);
      expect(typeof UI_LIMITS.CAROUSEL_ITEMS).toBe('number');
    });

    it('should have TOP_SPOTS_DISPLAY defined as a positive number', () => {
      expect(UI_LIMITS.TOP_SPOTS_DISPLAY).toBeGreaterThan(0);
      expect(typeof UI_LIMITS.TOP_SPOTS_DISPLAY).toBe('number');
    });

    it('should have SEARCH_RESULTS defined as a positive number', () => {
      expect(UI_LIMITS.SEARCH_RESULTS).toBeGreaterThan(0);
      expect(typeof UI_LIMITS.SEARCH_RESULTS).toBe('number');
    });

    it('should have RECENT_SESSIONS defined as a positive number', () => {
      expect(UI_LIMITS.RECENT_SESSIONS).toBeGreaterThan(0);
      expect(typeof UI_LIMITS.RECENT_SESSIONS).toBe('number');
    });

    it('should have INTEL_PAGE_SIZE defined as a positive number', () => {
      expect(UI_LIMITS.INTEL_PAGE_SIZE).toBeGreaterThan(0);
      expect(typeof UI_LIMITS.INTEL_PAGE_SIZE).toBe('number');
    });

    it('should have GALLERY_PREVIEW defined as a positive number', () => {
      expect(UI_LIMITS.GALLERY_PREVIEW).toBeGreaterThan(0);
      expect(typeof UI_LIMITS.GALLERY_PREVIEW).toBe('number');
    });

    it('should have PREVIEW_ITEMS <= CAROUSEL_ITEMS', () => {
      expect(UI_LIMITS.PREVIEW_ITEMS).toBeLessThanOrEqual(UI_LIMITS.CAROUSEL_ITEMS);
    });
  });

  describe('CARD_DISPLAY', () => {
    it('should have BADGES_MAX defined as a positive number', () => {
      expect(CARD_DISPLAY.BADGES_MAX).toBeGreaterThan(0);
      expect(typeof CARD_DISPLAY.BADGES_MAX).toBe('number');
    });

    it('should have INTEL_TAGS_MAX defined as a positive number', () => {
      expect(CARD_DISPLAY.INTEL_TAGS_MAX).toBeGreaterThan(0);
      expect(typeof CARD_DISPLAY.INTEL_TAGS_MAX).toBe('number');
    });

    it('should have DESCRIPTION_TRUNCATE defined as a positive number', () => {
      expect(CARD_DISPLAY.DESCRIPTION_TRUNCATE).toBeGreaterThan(0);
      expect(typeof CARD_DISPLAY.DESCRIPTION_TRUNCATE).toBe('number');
    });

    it('should have TITLE_TRUNCATE defined as a positive number', () => {
      expect(CARD_DISPLAY.TITLE_TRUNCATE).toBeGreaterThan(0);
      expect(typeof CARD_DISPLAY.TITLE_TRUNCATE).toBe('number');
    });

    it('should have TITLE_TRUNCATE < DESCRIPTION_TRUNCATE', () => {
      expect(CARD_DISPLAY.TITLE_TRUNCATE).toBeLessThan(CARD_DISPLAY.DESCRIPTION_TRUNCATE);
    });
  });

  describe('PAGINATION', () => {
    it('should have DEFAULT_PAGE_SIZE defined as a positive number', () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
      expect(typeof PAGINATION.DEFAULT_PAGE_SIZE).toBe('number');
    });

    it('should have MAX_PAGE_SIZE defined as a positive number', () => {
      expect(PAGINATION.MAX_PAGE_SIZE).toBeGreaterThan(0);
      expect(typeof PAGINATION.MAX_PAGE_SIZE).toBe('number');
    });

    it('should have VISIBLE_PAGES defined as a positive number', () => {
      expect(PAGINATION.VISIBLE_PAGES).toBeGreaterThan(0);
      expect(typeof PAGINATION.VISIBLE_PAGES).toBe('number');
    });

    it('should have DEFAULT_PAGE_SIZE <= MAX_PAGE_SIZE', () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(PAGINATION.MAX_PAGE_SIZE);
    });
  });
});
