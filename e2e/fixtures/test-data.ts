/**
 * Test data fixtures for E2E tests
 * Provides consistent test data across all test files
 */

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'testuser@quiver.surf',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  name: 'Test User',
};

// Environment-specific beach identifiers
// Local: uses slugs from local Supabase database
// Dev: uses UUIDs from dev.quiversurf.app production database
const isDevEnvironment = process.env.BASE_URL?.includes('dev.quiversurf.app') || process.env.TEST_ENV === 'dev';

export const TEST_BEACH_IDS = isDevEnvironment ? {
  // Dev environment: Using actual beach IDs from production dev database
  // These need to be updated to match beaches that exist in dev
  // TODO: Query these dynamically or seed test beaches in dev
  blacks: '208f0c7f-975d-438f-ac75-6c5934b67645', // Blacks Beach, La Jolla
  birdrock: '8451e66d-5bfe-45d9-a8bb-bb78dd09b7c5', // Birdrock, La Jolla
  beacons: '268facfd-de83-47d4-b28d-6db9e057f7b4', // Beacons, Encinitas
} : {
  // Local environment: using slugs from local database
  blacks: 'blacks',
  birdrock: 'birdrock',
  beacons: 'beacons',
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
