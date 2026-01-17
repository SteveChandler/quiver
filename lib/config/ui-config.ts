/**
 * UI Display Configuration
 *
 * Centralized configuration for UI display limits and defaults.
 * Extracted from hard-coded .slice() calls throughout components.
 *
 * @example
 * // Before: topSpots.slice(0, 3)
 * // After: topSpots.slice(0, UI_LIMITS.TOP_SPOTS_DISPLAY)
 */

/**
 * List/collection display limits
 */
export const UI_LIMITS = {
  /** Preview items in collapsed views */
  PREVIEW_ITEMS: 3,
  /** Items in horizontal carousels */
  CAROUSEL_ITEMS: 5,
  /** Top spots shown on coach card */
  TOP_SPOTS_DISPLAY: 3,
  /** Beaches shown in search results */
  SEARCH_RESULTS: 10,
  /** Recent sessions on dashboard */
  RECENT_SESSIONS: 5,
  /** Intel posts per page */
  INTEL_PAGE_SIZE: 10,
  /** Photos in gallery preview */
  GALLERY_PREVIEW: 6,
} as const;

/**
 * Card component display settings
 */
export const CARD_DISPLAY = {
  /** Maximum condition badges shown */
  BADGES_MAX: 3,
  /** Maximum tags on intel posts */
  INTEL_TAGS_MAX: 3,
  /** Truncate description after N chars */
  DESCRIPTION_TRUNCATE: 150,
  /** Truncate title after N chars */
  TITLE_TRUNCATE: 50,
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  /** Default page size for paginated lists */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 100,
  /** Pages to show in pagination controls */
  VISIBLE_PAGES: 5,
} as const;

// Type exports for consumers
export type UILimits = typeof UI_LIMITS;
export type CardDisplay = typeof CARD_DISPLAY;
export type PaginationConfig = typeof PAGINATION;
