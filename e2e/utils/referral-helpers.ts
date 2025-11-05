/**
 * Referral Testing Utilities
 *
 * Helper functions for testing the referral system in E2E tests.
 * Provides database utilities, test data creation, and validation helpers.
 */

import { createClient } from '@supabase/supabase-js';
import { Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Types for referral testing
 */
export interface ReferralRecord {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code: string;
  status: 'pending' | 'completed' | 'expired';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralTestUser {
  id: string;
  email: string;
  referral_code: string | null;
}

/**
 * Get Supabase admin client for database operations
 * Uses service role key for full database access (bypasses RLS)
 */
export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase credentials. Required:\n' +
      '  - NEXT_PUBLIC_SUPABASE_URL\n' +
      '  - SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Generate a random referral code for testing
 * Format: 6-character alphanumeric (uppercase)
 */
export function generateTestReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a test user with a referral code
 *
 * @param email - User email
 * @param referralCode - Optional custom referral code (auto-generated if not provided)
 * @returns User ID and referral code
 */
export async function createTestUserWithReferralCode(
  email: string,
  referralCode?: string
): Promise<{ userId: string; referralCode: string }> {
  const supabase = getSupabaseAdminClient();

  // Generate code if not provided
  const code = referralCode || generateTestReferralCode();

  // Check if user already exists
  const { data: users } = await supabase.auth.admin.listUsers();
  const existingUser = users?.users?.find((u) => u.email === email);

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    console.log(`Using existing user: ${email} (${userId})`);
  } else {
    // Create new user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: 'testpassword123',
      email_confirm: true,
    });

    if (createError || !newUser.user) {
      throw new Error(`Failed to create test user: ${createError?.message}`);
    }

    userId = newUser.user.id;
    console.log(`Created new user: ${email} (${userId})`);
  }

  // Update profile with referral code
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', userId);

  if (updateError) {
    // Check if error is due to missing column (migration not run)
    if (updateError.message.includes('referral_code') && updateError.message.includes('schema cache')) {
      throw new Error(
        `Migration not applied: The 'referral_code' column does not exist in the profiles table.\n` +
        `Please run: supabase db push\n` +
        `Or apply migration: 20251104120000_create_referrals_infrastructure.sql`
      );
    }
    throw new Error(`Failed to set referral code: ${updateError.message}`);
  }

  return { userId, referralCode: code };
}

/**
 * Get referral code for a user by email
 */
export async function getReferralCodeForUser(email: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // Get referral code from profile
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', user.id)
    .single();

  if (error) {
    throw new Error(`Failed to get referral code: ${error.message}`);
  }

  return data?.referral_code || null;
}

/**
 * Create a referral record in the database
 * Used for testing referral completion scenarios
 */
export async function createReferralRecord(
  referrerEmail: string,
  refereeEmail: string,
  status: 'pending' | 'completed' | 'expired' = 'pending'
): Promise<ReferralRecord> {
  const supabase = getSupabaseAdminClient();

  // Get user IDs
  const { data: users } = await supabase.auth.admin.listUsers();
  const referrer = users?.users?.find((u) => u.email === referrerEmail);
  const referee = users?.users?.find((u) => u.email === refereeEmail);

  if (!referrer || !referee) {
    throw new Error('Referrer or referee not found');
  }

  // Get referrer's code
  const { data: referrerProfile } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', referrer.id)
    .single();

  if (!referrerProfile?.referral_code) {
    throw new Error('Referrer has no referral code');
  }

  // Create referral record
  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referee_id: referee.id,
      referral_code: referrerProfile.referral_code,
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create referral: ${error.message}`);
  }

  return data;
}

/**
 * Get all referrals for a user (as referrer)
 */
export async function getReferralsForUser(email: string): Promise<ReferralRecord[]> {
  const supabase = getSupabaseAdminClient();

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // Get referrals
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get referrals: ${error.message}`);
  }

  return data || [];
}

/**
 * Check if a user has been referred
 */
export async function isUserReferred(email: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    return false;
  }

  // Check for referral record
  const { data, error } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error checking referral:', error);
    return false;
  }

  return !!data;
}

/**
 * Delete all referral records for a user (as referrer or referee)
 * Used for cleanup in tests
 */
export async function deleteReferralsForUser(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  // Get user ID
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users?.find((u) => u.email === email);

  if (!user) {
    console.log(`User not found: ${email} (nothing to clean up)`);
    return;
  }

  // Delete as referrer
  await supabase.from('referrals').delete().eq('referrer_id', user.id);

  // Delete as referee
  await supabase.from('referrals').delete().eq('referee_id', user.id);

  console.log(`Deleted referral records for user: ${email}`);
}

/**
 * Validate a referral code via the API endpoint
 * Simulates the actual validation flow used in the UI
 */
export async function validateReferralCodeViaAPI(
  page: Page,
  code: string
): Promise<{ valid: boolean; message?: string }> {
  const baseURL = page.context()._options.baseURL || 'http://localhost:3000';
  const url = `${baseURL}/api/referrals/validate?code=${encodeURIComponent(code)}`;

  try {
    const response = await page.request.get(url);
    const json = await response.json();
    return json;
  } catch (error) {
    console.error('API validation error:', error);
    return { valid: false, message: 'API request failed' };
  }
}

/**
 * Wait for referral validation to complete in the UI
 * Accounts for the 500ms debounce delay
 */
export async function waitForReferralValidation(page: Page, timeout = 1000): Promise<void> {
  // Wait for debounce (500ms) + validation request + UI update
  await page.waitForTimeout(timeout);
}

/**
 * Get the referral validation status icon from the UI
 * Returns 'valid', 'invalid', 'loading', or null
 */
export async function getReferralValidationStatus(
  page: Page
): Promise<'valid' | 'invalid' | 'loading' | null> {
  // Check for loading indicator
  const loadingIcon = page.locator('[class*="animate-spin"]');
  if (await loadingIcon.isVisible().catch(() => false)) {
    return 'loading';
  }

  // Check for success icon
  const successIcon = page.locator('svg').filter({ hasText: /checkCircle/i });
  if (await successIcon.isVisible().catch(() => false)) {
    return 'valid';
  }

  // Check for error icon
  const errorIcon = page.locator('svg').filter({ hasText: /xCircle/i });
  if (await errorIcon.isVisible().catch(() => false)) {
    return 'invalid';
  }

  return null;
}

/**
 * Complete onboarding with a referral code
 * Helper function for testing the full referral flow
 */
export async function completeOnboardingWithReferral(
  page: Page,
  referralCode: string,
  userData: {
    fullName?: string;
    displayName?: string;
  } = {}
): Promise<void> {
  const {
    fullName = 'Test Referee',
    displayName = 'test_referee',
  } = userData;

  // Navigate to home (should trigger onboarding if not completed)
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check for onboarding modal
  const modal = page.getByRole('dialog', { name: /onboarding|welcome|get started/i });
  const hasModal = await modal.isVisible({ timeout: 3000 }).catch(() => false);

  if (!hasModal) {
    throw new Error('Onboarding modal not visible');
  }

  // Fill full name
  const fullNameInput = page.getByLabel(/full name|name/i);
  if (await fullNameInput.isVisible().catch(() => false)) {
    await fullNameInput.fill(fullName);
    await page.getByRole('button', { name: /next|continue/i }).click();
    await page.waitForTimeout(500);
  }

  // Fill display name
  const displayNameInput = page.getByLabel(/display name|username/i);
  if (await displayNameInput.isVisible().catch(() => false)) {
    await displayNameInput.fill(displayName);
    await page.getByRole('button', { name: /next|continue/i }).click();
    await page.waitForTimeout(500);
  }

  // Skip to referral step
  let attempts = 0;
  while (attempts < 10) {
    const referralInput = page.getByLabel(/referral.*code/i);
    if (await referralInput.isVisible().catch(() => false)) {
      break;
    }

    const skipButton = page.getByRole('button', { name: /skip|next|continue/i }).first();
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click();
      await page.waitForTimeout(500);
    }

    attempts++;
  }

  // Enter referral code
  const referralInput = page.getByLabel(/referral.*code/i);
  if (await referralInput.isVisible().catch(() => false)) {
    await referralInput.fill(referralCode);

    // Wait for validation
    await waitForReferralValidation(page);

    // Continue
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(500);
  }

  // Complete remaining steps
  attempts = 0;
  while (attempts < 10) {
    const completeButton = page.getByRole('button', { name: /complete|finish|get started/i }).first();
    if (!await completeButton.isVisible().catch(() => false)) {
      break;
    }
    await completeButton.click();
    await page.waitForTimeout(500);
    attempts++;
  }

  // Wait for onboarding to complete
  await page.waitForTimeout(2000);
}

/**
 * Verify XP was awarded for referral completion
 */
export async function verifyReferralXPAwarded(
  referrerEmail: string,
  refereeEmail: string
): Promise<{ referrerXP: boolean; refereeXP: boolean }> {
  const supabase = getSupabaseAdminClient();

  // Get user IDs
  const { data: users } = await supabase.auth.admin.listUsers();
  const referrer = users?.users?.find((u) => u.email === referrerEmail);
  const referee = users?.users?.find((u) => u.email === refereeEmail);

  if (!referrer || !referee) {
    throw new Error('Users not found');
  }

  // Check for XP events (if gamification is implemented)
  // This would check the xp_events table for referral-related XP awards
  // For now, return placeholder - implement when XP system is in place
  console.log('XP verification not yet implemented');

  return {
    referrerXP: false,
    refereeXP: false,
  };
}

/**
 * Clean up all test referral data
 * Use this in afterAll or afterEach hooks
 */
export async function cleanupReferralTestData(testEmails: string[]): Promise<void> {
  console.log('Cleaning up referral test data...');

  for (const email of testEmails) {
    await deleteReferralsForUser(email);
  }

  console.log('Referral test data cleaned up');
}
