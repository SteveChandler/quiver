/**
 * User Profile Test Fixtures
 *
 * Provides test user profiles with different home beach configurations
 * for comprehensive testing of location-based features.
 */

import type { Database } from '@/types/database.generated';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * Test user profile configurations
 * Each represents a different home beach state for testing edge cases
 */
export const TEST_USER_PROFILES = {
  /**
   * User WITH a valid home beach set
   * Used for testing home beach fallback scenarios
   */
  withHomeBeach: {
    id: 'test-user-with-home-beach',
    full_name: 'Test User With Home Beach',
    email: process.env.TEST_USER_EMAIL || 'testuser@quiver.surf',
    home_beach_id: null, // Will be set to actual beach ID in test setup
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Partial<ProfileRow>,

  /**
   * User WITHOUT a home beach set (null)
   * Used for testing "no home beach" edge cases
   */
  withoutHomeBeach: {
    id: 'test-user-without-home-beach',
    full_name: 'Test User Without Home Beach',
    email: 'testuser-no-beach@quiver.surf',
    home_beach_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Partial<ProfileRow>,

  /**
   * User with an INVALID/non-existent home beach ID
   * Used for testing graceful handling of orphaned references
   */
  withInvalidHomeBeach: {
    id: 'test-user-invalid-home-beach',
    full_name: 'Test User Invalid Home Beach',
    email: 'testuser-invalid-beach@quiver.surf',
    home_beach_id: '00000000-0000-0000-0000-000000000000', // Non-existent UUID
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Partial<ProfileRow>,

  /**
   * Default test user (matches existing global setup)
   * Maintains compatibility with existing tests
   */
  default: {
    full_name: 'Test User',
    email: process.env.TEST_USER_EMAIL || 'testuser@quiver.surf',
    home_beach_id: null, // Can be configured per test
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Partial<ProfileRow>,
};

/**
 * Home beach test configurations
 * Use these beach names to set home beaches in tests
 * Names will be resolved to IDs at runtime via Supabase queries
 */
export const TEST_HOME_BEACHES = {
  /**
   * La Jolla Shores - Beginner-friendly beach
   * Good for testing with a well-known, safe beach
   */
  laJollaShores: 'La Jolla Shores',

  /**
   * Blacks Beach - Advanced beach
   * Good for testing with a more challenging spot
   */
  blacks: 'Blacks Beach',

  /**
   * Windansea Beach - Intermediate beach
   * Good for testing with a popular local spot
   */
  windansea: 'Windansea Beach',

  /**
   * Ocean Beach - Popular beach
   * Good for alternative test location
   */
  oceanBeach: 'Ocean Beach',
};

/**
 * Profile update helper types
 */
export interface TestUserProfileUpdate {
  home_beach_id?: string | null;
  experience_level?: string | null;
  preferred_wave_size?: string | null;
  preferred_break_type?: string | null;
}

/**
 * Test user scenarios for different testing needs
 */
export const TEST_USER_SCENARIOS = {
  /**
   * GPS Available, No Home Beach
   * Tests GPS-only mode when user hasn't set a home beach
   */
  gpsOnly: {
    name: 'GPS Only (No Home Beach)',
    profile: TEST_USER_PROFILES.withoutHomeBeach,
    gpsEnabled: true,
    expectedHeading: 'Best Conditions Near You',
    expectedLocationSource: 'gps',
  },

  /**
   * GPS Denied, Home Beach Set
   * Tests home beach fallback when GPS is unavailable
   */
  homeBeachFallback: {
    name: 'Home Beach Fallback (GPS Denied)',
    profile: TEST_USER_PROFILES.withHomeBeach,
    gpsEnabled: false,
    expectedHeading: (beachName: string) => `Best Conditions Near ${beachName}`,
    expectedLocationSource: 'home_beach',
  },

  /**
   * GPS Denied, No Home Beach
   * Tests complete failure scenario - no location available
   */
  noLocationAvailable: {
    name: 'No Location Available',
    profile: TEST_USER_PROFILES.withoutHomeBeach,
    gpsEnabled: false,
    expectedHeading: null, // Section should not display
    expectedLocationSource: null,
    shouldShowError: true,
  },

  /**
   * GPS Available, Home Beach Set
   * Tests GPS preference over home beach
   */
  gpsOverHomeBeach: {
    name: 'GPS Over Home Beach',
    profile: TEST_USER_PROFILES.withHomeBeach,
    gpsEnabled: true,
    expectedHeading: 'Best Conditions Near You',
    expectedLocationSource: 'gps',
  },

  /**
   * GPS Available, Invalid Home Beach
   * Tests graceful handling of orphaned home beach reference
   */
  invalidHomeBeach: {
    name: 'Invalid Home Beach Reference',
    profile: TEST_USER_PROFILES.withInvalidHomeBeach,
    gpsEnabled: false,
    expectedHeading: null,
    expectedLocationSource: null,
    shouldShowError: true,
  },
};

/**
 * Helper to create a profile update payload
 */
export function createProfileUpdate(
  updates: TestUserProfileUpdate
): ProfileUpdate {
  return {
    ...updates,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Helper to get expected heading text based on scenario
 */
export function getExpectedHeading(
  scenario: typeof TEST_USER_SCENARIOS[keyof typeof TEST_USER_SCENARIOS],
  beachName?: string
): string | null {
  if (typeof scenario.expectedHeading === 'function') {
    return beachName ? scenario.expectedHeading(beachName) : null;
  }
  return scenario.expectedHeading;
}
