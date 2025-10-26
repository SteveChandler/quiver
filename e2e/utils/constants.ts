/**
 * E2E Test Constants
 *
 * Centralized constants for consistent test configuration across the suite.
 */

// ============================================================================
// Timeouts
// ============================================================================

/**
 * Standardized timeout values for different test scenarios.
 * Use these instead of hardcoded values for consistency.
 */
export const TIMEOUTS = {
  /** Quick UI interactions (button clicks, input focus) */
  SHORT: 5_000,

  /** Standard waits (element visibility, DOM updates) */
  DEFAULT: 10_000,

  /** Page navigations and route changes */
  NAVIGATION: 15_000,

  /** Network requests and API calls */
  NETWORK: 20_000,

  /** Authentication flows (login, signup, logout) */
  AUTH: 30_000,

  /** Extended operations (data loading, complex renders) */
  EXTENDED: 45_000,
} as const;

// ============================================================================
// Viewports
// ============================================================================

/**
 * Standard viewport sizes for responsive testing.
 * Based on common device dimensions and Tailwind breakpoints.
 */
export const VIEWPORTS = {
  /** iPhone SE (375×667) - Smallest modern mobile */
  MOBILE_SMALL: { width: 375, height: 667 },

  /** iPhone 12/13/14 (390×844) - Common modern mobile */
  MOBILE: { width: 390, height: 844 },

  /** iPhone 14 Pro Max (430×932) - Large mobile */
  MOBILE_LARGE: { width: 430, height: 932 },

  /** iPad (768×1024) - Tablet portrait */
  TABLET: { width: 768, height: 1024 },

  /** iPad Pro (1024×1366) - Large tablet */
  TABLET_LARGE: { width: 1024, height: 1366 },

  /** Standard laptop (1280×800) */
  DESKTOP: { width: 1280, height: 800 },

  /** Large desktop (1920×1080) - Full HD */
  DESKTOP_LARGE: { width: 1920, height: 1080 },

  /** Ultra-wide desktop (2560×1440) - 1440p */
  DESKTOP_XL: { width: 2560, height: 1440 },
} as const;

/**
 * Tailwind CSS breakpoints for responsive testing.
 * These should match the breakpoints in tailwind.config.js
 */
export const BREAKPOINTS = {
  sm: 640,   // Small devices
  md: 768,   // Medium devices
  lg: 1024,  // Large devices (desktop navigation appears)
  xl: 1280,  // Extra large devices
  '2xl': 1536, // 2X large devices
} as const;

// ============================================================================
// Test Data
// ============================================================================

/**
 * Standard test beach ID for E2E tests.
 * This beach is documented in the SDET agent guide and has:
 * - Reliable forecast data
 * - Photos and camera
 * - Reviews and intel
 * - Known location in San Diego (Windansea Beach, La Jolla)
 */
export const TEST_BEACH_ID = '33ee7a3a-0753-4f6c-84e9-0beaa0c6549e';

/**
 * Fallback beach ID for backward compatibility with existing tests.
 * @deprecated Use TEST_BEACH_ID instead
 */
export const LEGACY_TEST_BEACH_ID = '15c7337e-5258-4339-9dc3-c435c666926b';

/**
 * Test beach coordinates (San Diego area).
 */
export const TEST_BEACH_COORDS = {
  lat: 32.7503,
  lon: -117.2534,
} as const;

// ============================================================================
// UI Element Selectors
// ============================================================================

/**
 * Common test IDs used across the application.
 */
export const TEST_IDS = {
  // Navigation
  MOBILE_MENU_BUTTON: 'mobile-menu-button',
  MOBILE_NAV_HOME: 'mobile-nav-home',
  MOBILE_NAV_MAP: 'mobile-nav-map',
  MOBILE_NAV_DISCOVER: 'mobile-nav-discover',
  MOBILE_NAV_SESSIONS: 'mobile-nav-sessions',
  MOBILE_NAV_PROFILE: 'mobile-nav-profile',
  MOBILE_NAV_NOTIFICATIONS: 'mobile-nav-notifications',
  MOBILE_NAV_LOGOUT: 'mobile-nav-logout',

  // Buttons
  SHARE_BUTTON: 'share-button',
  NOTIFICATION_BADGE: 'notification-badge',
  FOLLOW_BUTTON: 'follow-button',

  // Deprecated - bottom navigation removed in Phase 5
  /** @deprecated Bottom navigation has been removed */
  BOTTOM_NAVIGATION: 'bottom-navigation',
} as const;

// ============================================================================
// Color Values
// ============================================================================

/**
 * Brand colors for visual regression testing.
 * These should match the values in tailwind.config.js
 */
export const COLORS = {
  /** Primary ocean blue (#0077B6) - NOT AllTrails green */
  PRIMARY: 'rgb(0, 119, 182)',

  /** Destructive red for errors and alerts */
  DESTRUCTIVE: 'rgb(220, 38, 38)',

  /** AllTrails green (should NOT be used in Quiver) */
  ALLTRAILS_GREEN: 'rgb(66, 138, 19)',
} as const;

// ============================================================================
// Performance Thresholds
// ============================================================================

/**
 * Performance metric thresholds for validation.
 * Based on Core Web Vitals and Quiver requirements.
 */
export const PERFORMANCE = {
  /** Cumulative Layout Shift - Good: < 0.1 */
  MAX_CLS: 0.1,

  /** First Contentful Paint - Good: < 1.8s */
  MAX_FCP: 1800,

  /** Largest Contentful Paint - Good: < 2.5s */
  MAX_LCP: 2500,

  /** Time to Interactive - Good: < 3.8s */
  MAX_TTI: 3800,

  /** Frame rate for smooth animations */
  MIN_FPS: 55, // Allow slight variation from 60fps

  /** Header render time threshold */
  MAX_HEADER_RENDER: 100,
} as const;

// ============================================================================
// Accessibility
// ============================================================================

/**
 * Accessibility requirements for WCAG compliance.
 */
export const ACCESSIBILITY = {
  /** Minimum touch target size (WCAG 2.1 Level AA) */
  MIN_TOUCH_TARGET: 44,

  /** Minimum color contrast ratio (WCAG AA) */
  MIN_CONTRAST_RATIO: 4.5,

  /** Minimum color contrast ratio for large text (WCAG AA) */
  MIN_CONTRAST_RATIO_LARGE: 3.0,
} as const;

// ============================================================================
// Network
// ============================================================================

/**
 * Network-related constants for testing.
 */
export const NETWORK = {
  /** Network idle timeout for waitForNetworkIdle */
  IDLE_TIMEOUT: 10_000,

  /** Max time to wait for API response */
  API_TIMEOUT: 15_000,
} as const;

// ============================================================================
// Test Environment
// ============================================================================

/**
 * Helper to check if running against dev environment.
 */
export function isDevEnvironment(): boolean {
  return (process.env.BASE_URL || '').includes('dev.quiversurf.app');
}

/**
 * Helper to check if running in CI.
 */
export function isCIEnvironment(): boolean {
  return !!process.env.CI;
}

/**
 * Get the appropriate test user email based on environment.
 */
export function getTestUserEmail(): string {
  const isDevHost = isDevEnvironment();
  return (isDevHost ? process.env.TEST_USER_EMAIL : process.env.E2E_USER_EMAIL)
    || process.env.E2E_USER_EMAIL
    || process.env.TEST_USER_EMAIL
    || '';
}

/**
 * Get the appropriate test user password based on environment.
 */
export function getTestUserPassword(): string {
  const isDevHost = isDevEnvironment();
  return (isDevHost ? process.env.TEST_USER_PASSWORD : process.env.E2E_USER_PASSWORD)
    || process.env.E2E_USER_PASSWORD
    || process.env.TEST_USER_PASSWORD
    || '';
}
