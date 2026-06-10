/**
 * Server Actions for User Surf Preferences
 *
 * Provides authenticated access to:
 * - Fetching learned preferences from session analysis
 * - Validating learned preferences
 * - Manually overriding preference values
 *
 * All actions use withAuthenticatedAction wrapper for security.
 *
 * @see lib/services/preference-learning-service.ts for preference computation logic
 * @see supabase/migrations/20251103000003_user_surf_preferences.sql
 */

'use server';

import { withAuthenticatedAction } from '@/lib/server-action-utils';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';
import type { Database, Json } from '@/types/database';

/**
 * Valid tide status values
 */
const VALID_TIDE_STATUSES = ['rising', 'high', 'falling', 'low'];

/**
 * Combined user preferences (learned + onboarding)
 */
export interface UserPreferencesData {
  learned: UserSurfPreferences | null;
  onboarding: {
    experience_level?: string;
    surf_styles?: string[];
  };
}

/**
 * Get user's learned surf preferences and onboarding preferences
 *
 * @returns Combined view of learned preferences from sessions and onboarding data
 */
export async function getUserLearnedPreferences() {
  return withAuthenticatedAction<UserPreferencesData>(async (user, supabase: any) => {
    // Fetch learned preferences from user_surf_preferences table
    const { data: learnedPrefs, error: prefsError } = await supabase
      .from('user_surf_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Not found is OK (user might not have enough sessions yet)
    if (prefsError && prefsError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch learned preferences: ${prefsError.message}`);
    }

    // Fetch onboarding preferences from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('experience_level, surf_styles')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch onboarding preferences: ${profileError.message}`);
    }

    return {
      learned: learnedPrefs || null,
      onboarding: profile || {},
    };
  });
}

/**
 * Validate or invalidate user's learned preferences
 *
 * Sets validated_at timestamp if validated=true, clears it if validated=false
 *
 * @param validated - Whether user confirms preferences match their style
 */
export async function validateUserPreferences(validated: boolean) {
  return withAuthenticatedAction(async (user, supabase) => {
    const updateData = {
      validated_at: validated ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('user_surf_preferences')
      .update(updateData)
      .eq('user_id', user.id)
      .select();

    if (error) {
      throw new Error(`Failed to update validation status: ${error.message}`);
    }

    return { validated };
  });
}

/**
 * Validation result for preference overrides
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate preference override values
 */
function validatePreferenceOverrides(
  overrides: Partial<UserSurfPreferences>
): ValidationResult {
  // Validate wave height range
  if (
    overrides.wave_min_ft != null &&
    overrides.wave_max_ft != null
  ) {
    if (overrides.wave_min_ft < 0 || overrides.wave_max_ft < 0) {
      return {
        isValid: false,
        error: 'Wave height values must be non-negative',
      };
    }
    if (overrides.wave_min_ft >= overrides.wave_max_ft) {
      return {
        isValid: false,
        error: 'wave_min_ft must be less than wave_max_ft',
      };
    }
  }

  // Validate wave period range
  if (
    overrides.wave_period_min_s != null &&
    overrides.wave_period_max_s != null
  ) {
    if (overrides.wave_period_min_s < 0 || overrides.wave_period_max_s < 0) {
      return {
        isValid: false,
        error: 'Wave period values must be non-negative',
      };
    }
    if (overrides.wave_period_min_s >= overrides.wave_period_max_s) {
      return {
        isValid: false,
        error: 'wave_period_min_s must be less than wave_period_max_s',
      };
    }
  }

  // Validate wind speed
  if (overrides.max_wind_mph != null) {
    if (overrides.max_wind_mph < 0) {
      return {
        isValid: false,
        error: 'Wind speed must be non-negative',
      };
    }
  }

  // Validate wind directions (must be 0-360)
  if (overrides.preferred_wind_directions) {
    const invalidDirections = overrides.preferred_wind_directions.filter(
      (dir) => dir < 0 || dir > 360
    );
    if (invalidDirections.length > 0) {
      return {
        isValid: false,
        error: 'Wind directions must be between 0 and 360 degrees',
      };
    }
  }

  // Validate tide statuses
  if (overrides.preferred_tide_statuses) {
    const invalidStatuses = overrides.preferred_tide_statuses.filter(
      (status) => !VALID_TIDE_STATUSES.includes(status)
    );
    if (invalidStatuses.length > 0) {
      return {
        isValid: false,
        error: `Invalid tide status: ${invalidStatuses.join(', ')}. Must be one of: ${VALID_TIDE_STATUSES.join(', ')}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Update user's surf preferences with manual overrides
 *
 * Validates input ranges and sets manual_override flag.
 *
 * @param overrides - Partial preference updates
 * @returns Updated preferences
 */
export async function updateUserSurfPreferences(
  overrides: Partial<UserSurfPreferences>
) {
  // Validate inputs before database operation
  const validation = validatePreferenceOverrides(overrides);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  return withAuthenticatedAction(async (user, supabase) => {
    // Add manual_override flag to indicate user has customized preferences
    const updateData: Database['public']['Tables']['user_surf_preferences']['Update'] = {
      ...overrides,
      avoidance_by_beach:
        overrides.avoidance_by_beach === undefined
          ? undefined
          : (overrides.avoidance_by_beach as unknown as Json),
      manual_override: true,
    };

    const { data, error } = await supabase
      .from('user_surf_preferences')
      .update(updateData)
      .eq('user_id', user.id)
      .select();

    if (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No preferences found to update');
    }

    return data[0];
  });
}
