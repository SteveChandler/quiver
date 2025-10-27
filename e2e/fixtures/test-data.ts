/**
 * Test data fixtures for E2E tests
 * Provides consistent test data across all test files
 */

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@quiver.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  name: 'Test User',
};

export const TEST_BEACH_IDS = {
  // These should be real beach IDs from your database
  // Update these with actual IDs from your Supabase database
  blacks: '01330afc-00d3-461b-88f3-b173774766f4',
  oceanBeach: '15c7337e-5258-4339-9dc3-c435c666926b',
  huntingtonPier: '071db1df-b5ee-4af6-a022-ea8a09667cbe',
};

export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  large: { width: 1920, height: 1080 },
};

export const TIMEOUTS = {
  short: 5000,
  medium: 10000,
  long: 30000,
  veryLong: 60000,
};
