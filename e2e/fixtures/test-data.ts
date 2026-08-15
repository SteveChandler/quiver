/**
 * Test data fixtures for E2E tests
 * Provides consistent test data across all test files
 */

export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'testuser@quivertest.local',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',
  name: 'Test User',
};

// Environment-specific beach identifiers
// Local: uses slugs from local Supabase database
// Dev: uses UUIDs from dev.quiversurf.app production database
export const isDevEnvironment =
  process.env.BASE_URL?.includes('dev.quiversurf.app') || process.env.TEST_ENV === 'dev';

export const TEST_BEACH_IDS = isDevEnvironment ? {
  // Dev environment: Using actual beach IDs from dev.quiversurf.app database
  // Verified 2025-11-12 via API query
  blacks: '01330afc-00d3-461b-88f3-b173774766f4', // Blacks Beach, La Jolla
  birdrock: 'ca2b1d6f-2428-4273-ab02-7555eeec4323', // Birdrock, La Jolla
  beacons: '22536002-c7d2-48ab-a676-9b489fd79874', // Beacons, Encinitas
} : {
  // Local environment: using slugs from local database
  blacks: 'blacks',
  birdrock: 'bird-rock',
  beacons: 'beacons',
};

// Full beach objects for hierarchical URL generation
// These can be used with the navigateToBeach helper for new URL format
export const TEST_BEACHES = isDevEnvironment ? {
  // Dev environment: Full beach data from dev.quiversurf.app
  // URLs verified: https://dev.quiversurf.app/california/san-diego/blacks
  blacks: {
    id: '01330afc-00d3-461b-88f3-b173774766f4',
    slug: 'blacks',
    city: 'San Diego',
    state: 'CA',
    name: 'Blacks Beach'
  },
  birdrock: {
    id: 'ca2b1d6f-2428-4273-ab02-7555eeec4323',
    slug: 'birdrock',
    city: 'La Jolla',
    state: 'CA',
    name: 'Birdrock'
  },
  beacons: {
    id: '22536002-c7d2-48ab-a676-9b489fd79874',
    slug: 'beacons',
    city: 'Encinitas',
    state: 'CA',
    name: 'Beacons'
  },
} : {
  // Local environment: Full beach data from local database
  blacks: {
    id: 'blacks',
    slug: 'blacks',
    city: 'San Diego',
    state: 'CA',
    name: 'Blacks Beach'
  },
  birdrock: {
    id: 'bird-rock',
    slug: 'bird-rock',
    city: 'La Jolla',
    state: 'CA',
    name: 'Bird Rock'
  },
  beacons: {
    id: 'beacons',
    slug: 'beacons',
    city: 'Encinitas',
    state: 'CA',
    name: 'Beacons'
  },
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
