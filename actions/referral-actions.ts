'use server';

import { withAuthenticatedAction } from '@/lib/server-action-utils';

type ReferralAttributionResult = {
  created?: boolean;
  existing?: boolean;
};

/**
 * Get or create the current user's referral code.
 * Calls the DB function generate_referral_code() if the profile doesn't have one yet.
 */
export async function getOrCreateReferralCode() {
  return withAuthenticatedAction(async (user, supabase) => {
    // 1. Check if user already has a referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    if (profile?.referral_code) {
      return { code: profile.referral_code };
    }

    // 2. Generate a new code using the DB function
    const { data: codeResult, error: codeError } = await supabase
      .rpc('generate_referral_code');

    if (codeError) throw new Error(codeError.message);

    // 3. Save it to the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referral_code: codeResult })
      .eq('id', user.id);

    if (updateError) throw new Error(updateError.message);

    return { code: codeResult as string };
  });
}

/**
 * Claim a referral code during onboarding.
 * Looks up the referrer by code, creates a row in the referrals table.
 */
export async function claimReferral(code: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Validate referral code format: 4-12 alphanumeric characters only
    // Prevents SQL wildcard injection (% and _ are treated as wildcards by ilike)
    if (!/^[A-Z0-9]{4,12}$/i.test(code)) {
      return { success: false, error: 'Invalid referral code' };
    }

    // 1. Look up the referrer by code (case-insensitive via uppercased eq)
    const { data: referrer, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', code.toUpperCase())
      .single();

    if (lookupError || !referrer) {
      return { success: false, error: 'Invalid referral code' };
    }

    // 2. Can't refer yourself
    if (referrer.id === user.id) {
      return { success: false, error: 'You cannot use your own referral code' };
    }

    // 3. Check if already referred
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referee_id', user.id)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'You have already used a referral code' };
    }

    // 4. Create referral attribution through the shared DB path
    const { data: attribution, error: attributionError } = await supabase
      .rpc('record_referral_attribution' as any, {
        referrer: referrer.id,
        referee: user.id,
        source: 'referral_code',
        referral_code: code.toUpperCase(),
      });

    if (attributionError) throw new Error(attributionError.message);

    const attributionResult = (attribution ?? {}) as ReferralAttributionResult;
    if (attributionResult.existing) {
      return { success: false, error: 'You have already used a referral code' };
    }

    return { success: true };
  });
}

/**
 * Get the current user's referral statistics.
 */
export async function getReferralStats() {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data, error } = await supabase
      .rpc('get_user_referral_stats', { user_id: user.id });

    if (error) throw new Error(error.message);

    return data?.[0] ?? {
      total_referrals: 0,
      completed_referrals: 0,
      pending_referrals: 0,
      expired_referrals: 0,
      referral_code: null,
    };
  });
}

/**
 * Leaderboard entry shape returned by the DB function.
 */
export interface ReferralLeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  referral_count: number;
  rank: number;
}

/**
 * Fetch the referral leaderboard (top referrers).
 * Uses the DB function `get_referral_leaderboard` (SECURITY DEFINER)
 * so it can aggregate across users despite RLS.
 */
export async function getReferralLeaderboard(limit = 10) {
  return withAuthenticatedAction(async (_user, supabase) => {
    const { data, error } = await supabase
      .rpc('get_referral_leaderboard' as any, { max_results: limit });

    if (error) {
      // Function may not exist yet if migration hasn't been applied
      console.warn('[referral-actions] Leaderboard query failed:', error.message);
      return [] as ReferralLeaderboardEntry[];
    }

    return (data ?? []) as ReferralLeaderboardEntry[];
  });
}
