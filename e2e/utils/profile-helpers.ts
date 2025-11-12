/**
 * Profile Management Helper Utilities for E2E Tests
 *
 * Provides utilities for setting up and managing test user profiles
 * with different home beach configurations during E2E tests.
 *
 * NOTE: These helpers create temporary test users via Supabase service role
 * and clean them up after tests complete. Each test user is isolated.
 */

import { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST_HOME_BEACHES, TestUserProfileUpdate, createProfileUpdate } from '../fixtures/user-profiles';

// Supabase admin client for user management
let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY required for test user management');
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

/**
 * Result of profile setup operations
 */
export interface ProfileSetupResult {
  success: boolean;
  error?: string;
  profileId?: string;
  home_beach_id?: string | null;
}

/**
 * Test user information
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Profile data
 */
interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  home_beach_id: string | null;
  home_beach_name: string | null;
}

/**
 * Create a temporary test user
 *
 * @param email - Email for the test user (defaults to timestamp-based unique email)
 * @param password - Password for the test user
 * @returns Promise<TestUser> - Created user information
 */
export async function createTestUser(
  email?: string,
  password: string = 'TestPassword123!'
): Promise<TestUser> {
  const admin = getAdminClient();
  const testEmail = email || `test-${Date.now()}@quiversurf.test`;

  console.log(`[Profile Helper] Creating test user: ${testEmail}`);

  // Create auth user
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password,
    email_confirm: true, // Auto-confirm email
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message || 'Unknown error'}`);
  }

  console.log(`[Profile Helper] Test user created: ${testEmail} (ID: ${data.user.id})`);

  // Create profile record (Supabase doesn't do this automatically with admin.createUser)
  console.log(`[Profile Helper] Creating profile record for user: ${data.user.id}`);
  const { error: profileError } = await admin
    .from('profiles')
    .insert({
      id: data.user.id,
      email: testEmail,
      full_name: 'Test User',
      is_mock: true, // Mark as mock/test user
    });

  if (profileError) {
    // If profile creation fails, delete the auth user to keep things clean
    console.error(`[Profile Helper] Failed to create profile: ${profileError.message}`);
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  console.log(`[Profile Helper] Profile created for user: ${data.user.id}`);

  return {
    id: data.user.id,
    email: testEmail,
    password,
  };
}

/**
 * Delete a test user
 *
 * @param userId - ID of the user to delete
 * @returns Promise<void>
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = getAdminClient();

  console.log(`[Profile Helper] Deleting test user: ${userId}`);

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error(`[Profile Helper] Failed to delete user ${userId}:`, error.message);
    throw new Error(`Failed to delete test user: ${error.message}`);
  }

  console.log(`[Profile Helper] Test user deleted: ${userId}`);
}

/**
 * Resolve beach ID from name by querying the database
 *
 * @param beachName - Beach name to resolve
 * @returns Promise<string | null> - Beach ID or null if not found
 */
async function resolveBeachId(beachName: string): Promise<string | null> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('beaches')
    .select('id')
    .eq('name', beachName)
    .single();

  if (error || !data) {
    console.error(`[Profile Helper] Failed to resolve beach "${beachName}":`, error);
    return null;
  }

  return data.id;
}

/**
 * Get a user's profile by user ID
 *
 * @param userId - User ID
 * @returns Promise<ProfileData | null> - Profile data or null if not found
 */
export async function getUserProfile(userId: string): Promise<ProfileData | null> {
  const admin = getAdminClient();

  try {
    const { data, error } = await admin
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        home_beach_id,
        beaches:beaches!profiles_home_beach_id_fkey (
          name
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('[Profile Helper] Failed to get profile:', error);
      return null;
    }

    const beaches = data.beaches as any;

    return {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      home_beach_id: data.home_beach_id,
      home_beach_name: beaches?.name || null,
    };
  } catch (error) {
    console.error('[Profile Helper] Failed to get user profile:', error);
    return null;
  }
}

/**
 * Update a user's profile with specified changes
 *
 * @param userId - User ID
 * @param updates - Profile fields to update
 * @returns Promise<ProfileSetupResult> - Result of the update operation
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<ProfileData>
): Promise<ProfileSetupResult> {
  const admin = getAdminClient();

  try {
    const { data, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, home_beach_id')
      .single();

    if (error) {
      console.error('[Profile Helper] Failed to update profile:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      profileId: data.id,
      home_beach_id: data.home_beach_id,
    };
  } catch (error) {
    console.error('[Profile Helper] Failed to update user profile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Set a user's home beach by beach name
 *
 * @param userId - User ID
 * @param beachName - Beach name to set as home beach (e.g., 'Windansea Beach', 'Blacks Beach')
 * @returns Promise<ProfileSetupResult> - Result of the operation
 */
export async function setHomeBeach(
  userId: string,
  beachName: string
): Promise<ProfileSetupResult> {
  try {
    console.log(`[Profile Helper] Setting home beach to: ${beachName}`);

    const beachId = await resolveBeachId(beachName);
    if (!beachId) {
      return {
        success: false,
        error: `Beach "${beachName}" not found`,
      };
    }

    const result = await updateUserProfile(userId, { home_beach_id: beachId });

    if (result.success) {
      console.log(`[Profile Helper] Successfully set home beach to: ${beachName}`);
    }

    return result;
  } catch (error) {
    console.error('[Profile Helper] Failed to set home beach:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clear a user's home beach (set to null)
 *
 * @param userId - User ID
 * @returns Promise<ProfileSetupResult> - Result of the operation
 */
export async function clearHomeBeach(userId: string): Promise<ProfileSetupResult> {
  try {
    console.log('[Profile Helper] Clearing home beach');

    const result = await updateUserProfile(userId, { home_beach_id: null });

    if (result.success) {
      console.log('[Profile Helper] Successfully cleared home beach');
    }

    return result;
  } catch (error) {
    console.error('[Profile Helper] Failed to clear home beach:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Set a user's home beach to an invalid ID
 * Useful for testing orphaned reference handling
 *
 * @param userId - User ID
 * @returns Promise<ProfileSetupResult> - Result of the operation
 */
export async function setInvalidHomeBeach(userId: string): Promise<ProfileSetupResult> {
  try {
    const invalidId = '00000000-0000-0000-0000-000000000000';
    console.log(`[Profile Helper] Setting invalid home beach ID: ${invalidId}`);

    const result = await updateUserProfile(userId, { home_beach_id: invalidId });

    if (result.success) {
      console.log('[Profile Helper] Successfully set invalid home beach');
    }

    return result;
  } catch (error) {
    console.error('[Profile Helper] Failed to set invalid home beach:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the home beach name for a user
 * Returns the beach name if set, null if not set
 *
 * @param userId - User ID
 * @returns Promise<string | null> - Beach name or null
 */
export async function getHomeBeachName(userId: string): Promise<string | null> {
  try {
    const profile = await getUserProfile(userId);
    return profile?.home_beach_name || null;
  } catch (error) {
    console.error('[Profile Helper] Failed to get home beach name:', error);
    return null;
  }
}

/**
 * Comprehensive profile setup utility
 * Sets up a test user's profile with the specified configuration
 *
 * @param userId - User ID
 * @param config - Configuration for the test user profile
 * @returns Promise<ProfileSetupResult> - Result of the setup operation
 */
export async function setupTestUserProfile(
  userId: string,
  config: {
    homeBeach?: string | null;
    invalidHomeBeach?: boolean;
  }
): Promise<ProfileSetupResult> {
  console.log('[Profile Helper] Setting up test user profile:', config);

  if (config.invalidHomeBeach) {
    return await setInvalidHomeBeach(userId);
  }

  if (config.homeBeach === null || config.homeBeach === undefined) {
    return await clearHomeBeach(userId);
  }

  return await setHomeBeach(userId, config.homeBeach);
}

/**
 * Debug utility to log the current state of a user's profile
 *
 * @param userId - User ID
 * @param label - Label for the log message (e.g., "Before Test", "After Setup")
 */
export async function logProfileState(userId: string, label: string = 'Profile State'): Promise<void> {
  try {
    const profile = await getUserProfile(userId);

    console.log(`[Profile State: ${label}]`, {
      userId: profile?.id,
      fullName: profile?.full_name,
      email: profile?.email,
      homeBeachId: profile?.home_beach_id,
      homeBeachName: profile?.home_beach_name,
    });
  } catch (error) {
    console.error(`[Profile State: ${label}] Failed to log profile state:`, error);
  }
}

/**
 * Reset test user profile to a specific state or clear it
 * Used for cleanup after tests to ensure test isolation
 *
 * @param userId - User ID
 * @param targetState - Target state to reset to (home beach name or null to clear)
 * @returns Promise<ProfileSetupResult> - Result of the reset operation
 */
export async function resetTestUserProfile(
  userId: string,
  targetState: string | null = null
): Promise<ProfileSetupResult> {
  console.log('[Profile Helper] Resetting test user profile to:', targetState || 'no home beach');

  if (targetState === null) {
    return await clearHomeBeach(userId);
  }

  return await setHomeBeach(userId, targetState);
}

/**
 * Sign in a test user programmatically via the browser
 * Navigates to login page, fills credentials, and submits
 *
 * @param page - Playwright page object
 * @param email - User email
 * @param password - User password
 * @returns Promise<void>
 */
export async function signInTestUser(
  page: any,
  email: string,
  password: string
): Promise<void> {
  console.log(`[Profile Helper] Signing in test user: ${email}`);

  // Navigate to login page
  await page.goto('/login');

  // Fill in credentials
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete (redirect after successful login)
  await page.waitForURL((url: any) => !url.pathname.includes('/login'), { timeout: 10000 });

  console.log('[Profile Helper] Test user signed in successfully');
}