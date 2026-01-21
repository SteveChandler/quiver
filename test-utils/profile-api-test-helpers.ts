/**
 * Profile API Test Helpers
 *
 * Consolidated mock setup for profile endpoint tests.
 * Reduces boilerplate and ensures consistent test patterns.
 *
 * @see /app/api/profile/[id]/route.ts
 * @see /app/api/profile/route.ts
 */

import { createMockProfile, type MockSupabaseClient } from './api-test-helpers';
import type { ProfileDTO } from '@/types/profile';

export interface ProfileTestData {
  profileData: Partial<ProfileDTO>;
  sessions?: Array<{ id: number; rating: number; status: string }>;
  homeBeach?: { id: string; name: string } | null;
}

/**
 * Sets up Supabase mock for profile API tests
 */
export function setupProfileApiMocks(
  mockClient: MockSupabaseClient,
  testData: ProfileTestData
): void {
  const { profileData, sessions = [], homeBeach = null } = testData;

  const createMockChain = (data: any) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data, error: null })),
  });

  (mockClient.from as jest.Mock).mockImplementation((tableName: string) => {
    switch (tableName) {
      case 'profiles':
        return createMockChain(profileData);

      case 'profiles_with_home_beach':
        return createMockChain({
          ...profileData,
          home_beach_name: homeBeach?.name ?? profileData.homeBeachName ?? null,
        });

      case 'sessions':
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          data: sessions,
          error: null,
        };

      case 'beaches':
        return createMockChain(homeBeach);

      case 'user_follows':
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        };

      default:
        return createMockChain(null);
    }
  });
}

/**
 * Creates mock profile with onboarding field defaulted
 */
export function createMockProfileWithOnboarding(
  overrides: Partial<ProfileDTO> = {}
): Partial<ProfileDTO> {
  return {
    ...createMockProfile(),
    onboarding_completed_at: null,
    experience_level: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    homeBeachName: null,
    home_beach: null,
    ...overrides,
  };
}

/**
 * Creates mock profile DTO matching the view output
 */
export function createMockProfileDTO(
  overrides: Partial<ProfileDTO> = {}
): ProfileDTO {
  return {
    id: 'test-user-123',
    full_name: 'Test User',
    home_beach_id: null,
    homeBeachName: null,
    home_beach: null,
    experience_level: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    onboarding_completed_at: null,
    ...overrides,
  } as ProfileDTO;
}

/**
 * Asserts onboarding_completed_at field in response
 */
export function expectOnboardingField(
  responseData: any,
  expectedValue: string | null
): void {
  expect(responseData).toHaveProperty('onboarding_completed_at');
  expect(responseData.onboarding_completed_at).toBe(expectedValue);
}

/**
 * Asserts profile has all required core fields
 */
export function expectCoreProfileFields(responseData: any): void {
  expect(responseData).toHaveProperty('id');
  expect(responseData).toHaveProperty('full_name');
  expect(responseData).toHaveProperty('home_beach_id');
  expect(responseData).toHaveProperty('experience_level');
  expect(responseData).toHaveProperty('created_at');
  expect(responseData).toHaveProperty('updated_at');
}
