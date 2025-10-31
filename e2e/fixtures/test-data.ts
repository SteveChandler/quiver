/**
 * Test data fixtures for E2E tests
 * Provides consistent test data across all test files
 */

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'testuser@quiver.surf',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  name: 'Test User',
};

export const TEST_BEACH_IDS = {
  // Updated with actual IDs from local Supabase database after db reset
  blacks: '94d0af9e-b90a-40e6-a133-f12c5f128bef',
  birdrock: '32ceda2f-cf09-42d8-84f3-a4bc65c2283f',
  beacons: '5b93dc38-dbb2-4de7-815b-e0fa994b18a4',
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
