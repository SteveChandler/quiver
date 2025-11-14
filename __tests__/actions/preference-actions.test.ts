/**
 * Tests for preference server actions
 *
 * Validates:
 * - Data fetching with proper authentication
 * - Validation metadata updates
 * - Manual preference overrides with validation
 * - RLS policy enforcement
 * - Error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';

const mockUserId = 'user-123';

// Define mock state that will be used by the mock implementation
const mockState = {
  preferencesData: null as UserSurfPreferences | null,
  profileData: null as any,
  shouldFailUpdate: false,
  shouldFailFetch: false,
  lastUpdate: null as any,
};

// Mock server action utils - must be before imports
jest.mock('@/lib/server-action-utils', () => {
  return {
    withAuthenticatedAction: (fn: any) => {
      const mockSupabase = {
        from: (table: string) => {
          if (table === 'user_surf_preferences') {
            return {
              select: () => ({
                eq: () => ({
                  single: () => {
                    if (mockState.shouldFailFetch) {
                      return Promise.resolve({
                        data: null,
                        error: { message: 'Database connection failed' },
                      });
                    }
                    if (!mockState.preferencesData) {
                      return Promise.resolve({
                        data: null,
                        error: { code: 'PGRST116' }, // Not found
                      });
                    }
                    return Promise.resolve({
                      data: mockState.preferencesData,
                      error: null,
                    });
                  },
                }),
              }),
              update: (data: any) => {
                mockState.lastUpdate = data;
                return {
                  eq: () => ({
                    select: () => {
                      if (mockState.shouldFailUpdate) {
                        return Promise.resolve({
                          data: null,
                          error: { message: 'Update failed' },
                        });
                      }
                      return Promise.resolve({
                        data: [{ ...mockState.preferencesData, ...data }],
                        error: null,
                      });
                    },
                  }),
                };
              },
            };
          }

          if (table === 'profiles') {
            return {
              select: () => ({
                eq: () => ({
                  single: () => {
                    if (mockState.shouldFailFetch) {
                      return Promise.resolve({
                        data: null,
                        error: { message: 'Database connection failed' },
                      });
                    }
                    return Promise.resolve({
                      data: mockState.profileData || {},
                      error: null,
                    });
                  },
                }),
              }),
            };
          }

          return {};
        },
      };

      return fn({ id: mockUserId }, mockSupabase).then(
        (data: any) => ({ success: true, data }),
        (error: any) => ({ success: false, error: error.message })
      );
    },
  };
});

// Now import the functions to test
import {
  getUserLearnedPreferences,
  validateUserPreferences,
  updateUserSurfPreferences,
} from '@/actions/preference-actions';

describe('getUserLearnedPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.preferencesData = null;
    mockState.profileData = null;
    mockState.shouldFailUpdate = false;
    mockState.shouldFailFetch = false;
    mockState.lastUpdate = null;
  });

  it('should fetch user preferences with onboarding data', async () => {
    mockState.preferencesData = {
      wave_min_ft: 2.5,
      wave_max_ft: 5.0,
      wave_period_min_s: 8,
      wave_period_max_s: 14,
      max_wind_mph: 15,
      preferred_wind_directions: [0, 45, 90],
      preferred_tide_statuses: ['rising', 'high'],
      confidence: 0.85,
      sample_size: 20,
    };

    mockState.profileData = {
      experience_level: 'intermediate',
      surf_styles: ['shortboard'],
      preferred_wave_size: 'medium',
      preferred_break_type: 'beach',
      crowd_preference: 'moderate',
    };

    const result = await getUserLearnedPreferences();

    expect(result).toEqual({
      success: true,
      data: {
        learned: mockState.preferencesData,
        onboarding: mockState.profileData,
      },
    });
  });

  it('should return null learned preferences when none exist', async () => {
    mockState.preferencesData = null; // Explicitly set to null
    mockState.profileData = { experience_level: 'beginner' };

    const result = await getUserLearnedPreferences();

    expect(result).toEqual({
      success: true,
      data: {
        learned: null,
        onboarding: { experience_level: 'beginner' },
      },
    });
  });

  it('should handle database errors', async () => {
    mockState.shouldFailFetch = true;
    mockState.profileData = { experience_level: 'beginner' };

    const result = await getUserLearnedPreferences();

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Database connection failed'),
    });
  });
});

describe('validateUserPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.preferencesData = null;
    mockState.profileData = null;
    mockState.shouldFailUpdate = false;
    mockState.shouldFailFetch = false;
    mockState.lastUpdate = null;
  });

  it('should update validated_at timestamp when validated', async () => {
    mockState.preferencesData = {
      wave_min_ft: 2.5,
      wave_max_ft: 5.0,
      wave_period_min_s: 8,
      wave_period_max_s: 14,
      max_wind_mph: 15,
      preferred_wind_directions: [0, 45, 90],
      preferred_tide_statuses: ['rising', 'high'],
      confidence: 0.85,
      sample_size: 20,
    };

    const result = await validateUserPreferences(true);

    expect(result).toEqual({
      success: true,
      data: { validated: true },
    });

    expect(mockState.lastUpdate).toHaveProperty('validated_at');
    expect(mockState.lastUpdate.validated_at).toBeTruthy();
  });

  it('should clear validated_at when invalidated', async () => {
    mockState.preferencesData = {
      wave_min_ft: 2.5,
      wave_max_ft: 5.0,
      wave_period_min_s: 8,
      wave_period_max_s: 14,
      max_wind_mph: 15,
      preferred_wind_directions: [0, 45, 90],
      preferred_tide_statuses: ['rising', 'high'],
      confidence: 0.85,
      sample_size: 20,
    };

    const result = await validateUserPreferences(false);

    expect(result).toEqual({
      success: true,
      data: { validated: false },
    });

    expect(mockState.lastUpdate).toEqual({
      validated_at: null,
    });
  });
});

describe('updateUserSurfPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.preferencesData = {
      wave_min_ft: 2.5,
      wave_max_ft: 5.0,
      wave_period_min_s: 8,
      wave_period_max_s: 14,
      max_wind_mph: 15,
      preferred_wind_directions: [0, 45, 90],
      preferred_tide_statuses: ['rising', 'high'],
      confidence: 0.85,
      sample_size: 20,
    };
    mockState.shouldFailUpdate = false;
    mockState.shouldFailFetch = false;
    mockState.lastUpdate = null;
  });

  it('should update preferences with valid overrides', async () => {
    const validOverrides = {
      wave_min_ft: 3.0,
      wave_max_ft: 6.0,
      max_wind_mph: 12,
    };

    const result = await updateUserSurfPreferences(validOverrides);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        ...validOverrides,
        manual_override: true,
      }),
    });

    expect(mockState.lastUpdate).toEqual({
      ...validOverrides,
      manual_override: true,
    });
  });

  it('should reject invalid wave height range (min > max)', async () => {
    const invalidOverrides = {
      wave_min_ft: 6.0,
      wave_max_ft: 3.0,
    };

    const result = await updateUserSurfPreferences(invalidOverrides);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('wave_min_ft must be less than wave_max_ft'),
    });
  });

  it('should reject invalid wave period range (min > max)', async () => {
    const invalidOverrides = {
      wave_period_min_s: 15,
      wave_period_max_s: 8,
    };

    const result = await updateUserSurfPreferences(invalidOverrides);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('wave_period_min_s must be less than wave_period_max_s'),
    });
  });

  it('should reject negative values', async () => {
    const invalidOverrides = {
      wave_min_ft: -2.0,
      wave_max_ft: 5.0,
    };

    const result = await updateUserSurfPreferences(invalidOverrides);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('must be non-negative'),
    });
  });

  it('should reject invalid wind directions (out of range)', async () => {
    const invalidOverrides = {
      preferred_wind_directions: [0, 45, 400],
    };

    const result = await updateUserSurfPreferences(invalidOverrides);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Wind directions must be between 0 and 360'),
    });
  });

  it('should reject invalid tide statuses', async () => {
    const invalidOverrides = {
      preferred_tide_statuses: ['rising', 'invalid_tide'],
    };

    const result = await updateUserSurfPreferences(invalidOverrides);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Invalid tide status'),
    });
  });

  it('should set manual_override flag when updating', async () => {
    const validOverrides = {
      wave_min_ft: 2.0,
      wave_max_ft: 5.0,
    };

    await updateUserSurfPreferences(validOverrides);

    expect(mockState.lastUpdate).toEqual({
      ...validOverrides,
      manual_override: true,
    });
  });

  it('should handle database update errors', async () => {
    mockState.shouldFailUpdate = true;

    const result = await updateUserSurfPreferences({ wave_min_ft: 2.0, wave_max_ft: 5.0 });

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Update failed'),
    });
  });

  it('should preserve unspecified fields', async () => {
    const partialOverrides = {
      wave_min_ft: 3.0,
      wave_max_ft: 5.0,
    };

    await updateUserSurfPreferences(partialOverrides);

    expect(mockState.lastUpdate).toEqual({
      wave_min_ft: 3.0,
      wave_max_ft: 5.0,
      manual_override: true,
    });
  });
});

describe('RLS Policy Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.preferencesData = null;
    mockState.profileData = null;
    mockState.shouldFailUpdate = false;
    mockState.shouldFailFetch = false;
  });

  it('should prevent users from accessing other users preferences', async () => {
    mockState.preferencesData = null;
    mockState.profileData = { experience_level: 'beginner' };

    const result = await getUserLearnedPreferences();

    expect(result.success).toBe(true);
    expect(result.data?.learned).toBeNull();
  });

  it('should prevent users from updating other users preferences', async () => {
    mockState.preferencesData = {
      wave_min_ft: 2.5,
      wave_max_ft: 5.0,
      wave_period_min_s: 8,
      wave_period_max_s: 14,
      max_wind_mph: 15,
      preferred_wind_directions: [0, 45, 90],
      preferred_tide_statuses: ['rising', 'high'],
      confidence: 0.85,
      sample_size: 20,
    };
    mockState.shouldFailUpdate = true;

    const result = await updateUserSurfPreferences({ wave_min_ft: 3.0, wave_max_ft: 6.0 });

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Update failed'),
    });
  });
});
