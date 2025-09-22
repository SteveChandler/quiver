/**
 * Standardized map image presets for consistent sizing across the application
 */
export const MAP_IMAGE_PRESETS = {
  /**
   * Large card format - for main beach cards in lists and nearby tabs
   */
  CARD_LARGE: {
    width: 300,
    height: 200,
    zoom: 15,
  },

  /**
   * Large card with lower zoom - for beach list with more context
   */
  CARD_LARGE_WIDE: {
    width: 300,
    height: 200,
    zoom: 10,
  },

  /**
   * Small card format - for compact scrollable lists
   */
  CARD_SMALL: {
    width: 200,
    height: 96,
    zoom: 11,
  },

  /**
   * Hero image format - for beach detail headers
   */
  HERO: {
    width: 800,
    height: 400,
    zoom: 14,
  },

  /**
   * Medium format - for session planning and other medium contexts
   */
  MEDIUM: {
    width: 400,
    height: 300,
    zoom: 15,
  },

  /**
   * Thumbnail format - for very small previews
   */
  THUMBNAIL: {
    width: 120,
    height: 80,
    zoom: 16,
  },

  /**
   * Square format - for profile or other square contexts
   */
  SQUARE: {
    width: 300,
    height: 300,
    zoom: 15,
  },

  /**
   * Full width format - for wide displays
   */
  FULL_WIDTH: {
    width: 1200,
    height: 400,
    zoom: 13,
  },
} as const;

/**
 * Type for map image preset keys
 */
type MapImagePreset = keyof typeof MAP_IMAGE_PRESETS;

/**
 * Type for map image options
 */
type MapImageOptions = {
  width?: number;
  height?: number;
  zoom?: number;
};

/**
 * Get map image options from preset or custom options
 */
export function getMapImageOptions(
  presetOrOptions: MapImagePreset | MapImageOptions
): MapImageOptions {
  if (typeof presetOrOptions === "string") {
    return MAP_IMAGE_PRESETS[presetOrOptions];
  }
  return presetOrOptions;
}

/**
 * Common preset combinations for specific use cases
 */
export const MAP_PRESET_USAGE = {
  // Beach cards in lists
  BEACH_CARD_LIST: MAP_IMAGE_PRESETS.CARD_LARGE_WIDE,

  // Beach cards in nearby tabs
  BEACH_CARD_NEARBY: MAP_IMAGE_PRESETS.CARD_LARGE,

  // Beach cards in scrollable areas
  BEACH_CARD_SCROLL: MAP_IMAGE_PRESETS.CARD_SMALL,

  // Beach detail hero images
  BEACH_HERO: MAP_IMAGE_PRESETS.HERO,

  // Session planning maps
  SESSION_PLANNING: MAP_IMAGE_PRESETS.MEDIUM,

  // Profile beach images
  PROFILE_BEACH: MAP_IMAGE_PRESETS.SQUARE,
} as const;
