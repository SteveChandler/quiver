/**
 * Helper utilities for profile preferences E2E tests
 * Provides database setup/cleanup and user state management
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for test database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for tests');
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Test user states for preferences popup testing
 */
export enum UserState {
  /** New user - onboarding not completed */
  NEW_USER = 'new_user',
  /** Returning user - onboarding complete, hasn't seen preferences v2 popup */
  RETURNING_USER = 'returning_user',
  /** User who already saw popup - preferences_v2_shown_at is set */
  POPUP_SEEN = 'popup_seen',
}

/**
 * Test preference data matching the constants
 */
export const TEST_PREFERENCES = {
  experience_level: 'intermediate' as const,
  surf_styles: ['shortboard', 'longboard'] as string[],
  preferred_wave_size: 'medium' as const,
  preferred_break_type: 'beach' as const,
  crowd_preference: 'moderate' as const,
};

/**
 * Get the current authenticated user's profile.
 * Uses a direct SQL query via the service-role client to join auth.users with profiles,
 * so the lookup is reliable regardless of whether profiles.email is populated.
 */
export async function getCurrentUserProfile(userEmail: string) {
  // Use rpc to find the user's auth UUID by email, then fetch the profile by id.
  // supabaseAdmin has service-role access so it can read auth.users.
  const { data: rows, error: rpcError } = await supabaseAdmin.rpc(
    'get_user_id_by_email' as any,
    { p_email: userEmail }
  ) as any;

  let userId: string | undefined;

  if (rpcError || !rows?.length) {
    // Fallback: paginate through auth.admin.listUsers to find the user
    let page = 1;
    const perPage = 50;
    let found = false;

    while (!found) {
      const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        throw new Error(`Failed to list auth users (page ${page}) for ${userEmail}: ${listError.message}`);
      }

      const match = usersPage?.users?.find((u) => u.email === userEmail);
      if (match) {
        userId = match.id;
        found = true;
      } else if (!usersPage?.users?.length || usersPage.users.length < perPage) {
        // No more pages
        break;
      }

      page++;
    }

    if (!userId) {
      throw new Error(`No auth user found with email ${userEmail}`);
    }
  } else {
    userId = rows[0] as string;
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get profile for ${userEmail} (id=${userId}): ${error.message}`);
  }

  return profile;
}

/**
 * Set user state for testing preferences popup behavior
 */
export async function setUserState(
  userEmail: string,
  state: UserState
): Promise<void> {
  const now = new Date().toISOString();
  const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago

  let updateData: any = {};

  switch (state) {
    case UserState.NEW_USER:
      // New user: no onboarding completion
      updateData = {
        onboarding_completed_at: null,
        preferences_v2_shown_at: null,
      };
      break;

    case UserState.RETURNING_USER:
      // Returning user: onboarding done, hasn't seen popup
      updateData = {
        onboarding_completed_at: pastDate,
        preferences_v2_shown_at: null,
      };
      break;

    case UserState.POPUP_SEEN:
      // User who already saw popup
      updateData = {
        onboarding_completed_at: pastDate,
        preferences_v2_shown_at: now,
      };
      break;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('email', userEmail);

  if (error) {
    throw new Error(`Failed to set user state: ${error.message}`);
  }

  console.log(`[Test Setup] Set user ${userEmail} to state: ${state}`);
}

/**
 * Set user preferences to test values
 */
export async function setUserPreferences(
  userEmail: string,
  preferences: Partial<typeof TEST_PREFERENCES> = TEST_PREFERENCES
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(preferences)
    .eq('email', userEmail);

  if (error) {
    throw new Error(`Failed to set preferences: ${error.message}`);
  }

  console.log(`[Test Setup] Set preferences for user ${userEmail}`);
}

/**
 * Clear user preferences (set to null/empty)
 */
export async function clearUserPreferences(userEmail: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      experience_level: null,
      surf_styles: [],
      preferred_wave_size: null,
      preferred_break_type: null,
      crowd_preference: null,
    })
    .eq('email', userEmail);

  if (error) {
    throw new Error(`Failed to clear preferences: ${error.message}`);
  }

  console.log(`[Test Setup] Cleared preferences for user ${userEmail}`);
}

/**
 * Verify that preferences_v2_shown_at was updated in the database
 */
export async function verifyPopupDismissalRecorded(
  userEmail: string
): Promise<boolean> {
  const profile = await getCurrentUserProfile(userEmail);
  return profile.preferences_v2_shown_at !== null;
}

/**
 * Reset user to clean state (for test cleanup)
 */
export async function resetUserToCleanState(userEmail: string): Promise<void> {
  await setUserState(userEmail, UserState.RETURNING_USER);
  await clearUserPreferences(userEmail);
  console.log(`[Test Cleanup] Reset user ${userEmail} to clean state`);
}
