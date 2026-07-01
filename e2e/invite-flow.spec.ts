/**
 * Invite Flow E2E
 *
 * Covers deterministic web invite routing without exercising a real email
 * signup. Guest tests assert the pre-auth landing; auth tests inject the
 * invite cookie and verify canonical post-auth consumption.
 *
 * @project guest
 * @project auth
 */

import {
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { test, expect } from './fixtures/auth-fixture';
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from './utils/error-detection';
import {
  generateInviteToken,
  isEmailTokenTestingAvailable,
} from './utils/email-token-helpers';
import { createServiceClient } from './utils/test-data-cleanup';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const FALLBACK_INVITER_ID = '00000000-0000-0000-0000-000000000001';

type FollowPair = {
  followerId: string;
  followingId: string;
};

type ReferralAttribution = {
  refereeId: string;
  referrerId: string;
};

test.describe.configure({ mode: 'serial' });

test.describe('Invite landing flow', () => {
  let errorCapture: ErrorCapture;
  let allowedStatuses: number[] = [];
  const cleanupPairs: FollowPair[] = [];
  const cleanupReferrals: ReferralAttribution[] = [];

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    allowedStatuses = [];
  });

  test.afterEach(async ({ page }) => {
    await cleanupCreatedFollows(cleanupPairs);
    await cleanupCreatedReferralAttributions(cleanupReferrals);
    await assertNoErrors(page, errorCapture, {
      context: 'Invite landing flow',
      allowedStatuses,
    });
  });

  test('guest valid invite renders landing and web fallback reaches signup consume flow', async ({
    page,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'guest', 'Guest project only');
    skipWhen(!isEmailTokenTestingAvailable(), 'Requires EMAIL_TOKEN_SECRET');

    const token = await generateInviteToken(FALLBACK_INVITER_ID);

    await page.goto(`/invite/${token}`, { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /invited you to their surf crew/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('link', { name: /open app store/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /already have the app/i }),
    ).toBeVisible();

    await page.getByRole('link', { name: /continue on web/i }).click();
    await page.waitForURL(/\/auth\/sign-up/, { timeout: 15_000 });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe('/auth/sign-up');
    expect(finalUrl.searchParams.get('redirectTo')).toBe('/invite/consume');
    expect(finalUrl.searchParams.has('invite_token')).toBe(false);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('heading', { name: /sign up/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with email/i }),
    ).toBeVisible();
  });

  test('auth consume reads invite_token, follows, redirects, and clears cookie', async ({
    page,
    context,
    request,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'auth', 'Auth project only');
    skipWhen(!canRunDbInviteTests(), 'Requires invite E2E DB env');

    const supabase = createServiceClient();
    const inviteeId = await getAuthenticatedUserId(request);
    const inviterId = requireInviteCandidate(
      await resolveUnfollowedInviterId(supabase, inviteeId),
      'Requires an inviter profile not already followed',
    );
    recordReferralCleanup(
      cleanupReferrals,
      await canCleanupReferral(supabase, inviteeId),
      {
        refereeId: inviteeId,
        referrerId: inviterId,
      },
    );

    const token = await generateInviteToken(inviterId);
    await context.addCookies([buildInviteCookie(token)]);

    await page.goto('/invite/consume', { waitUntil: 'domcontentloaded' });
    await waitForInvitedProfile(page, inviterId);

    expect(await hasInviteCookie(context)).toBe(false);
    cleanupPairs.push({ followerId: inviteeId, followingId: inviterId });
  });

  test('auth direct invite link consumes and lands on inviter profile', async ({
    page,
    request,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'auth', 'Auth project only');
    skipWhen(!canRunDbInviteTests(), 'Requires invite E2E DB env');

    const supabase = createServiceClient();
    const inviteeId = await getAuthenticatedUserId(request);
    const inviterId = requireInviteCandidate(
      await resolveUnfollowedInviterId(supabase, inviteeId),
      'Requires an inviter profile not already followed',
    );
    recordReferralCleanup(
      cleanupReferrals,
      await canCleanupReferral(supabase, inviteeId),
      {
        refereeId: inviteeId,
        referrerId: inviterId,
      },
    );

    const token = await generateInviteToken(inviterId);

    await page.goto(`/invite/${token}`, { waitUntil: 'domcontentloaded' });
    await waitForInvitedProfile(page, inviterId);
    expect(new URL(page.url()).searchParams.get('invited')).toBe('1');

    cleanupPairs.push({ followerId: inviteeId, followingId: inviterId });
  });

  test('auth consume is idempotent when follow already exists', async ({
    page,
    context,
    request,
  }, testInfo) => {
    skipWhen(testInfo.project.name !== 'auth', 'Auth project only');
    skipWhen(!canRunDbInviteTests(), 'Requires invite E2E DB env');

    const supabase = createServiceClient();
    const inviteeId = await getAuthenticatedUserId(request);
    const inviterId = requireInviteCandidate(
      await resolveAnyInviterId(supabase, inviteeId),
      'Requires a second profile for invite E2E',
    );

    const createdFollow = await ensureFollow(supabase, inviteeId, inviterId);
    recordFollowCleanup(cleanupPairs, createdFollow, {
      followerId: inviteeId,
      followingId: inviterId,
    });
    recordReferralCleanup(
      cleanupReferrals,
      await canCleanupReferral(supabase, inviteeId),
      {
        refereeId: inviteeId,
        referrerId: inviterId,
      },
    );

    const token = await generateInviteToken(inviterId);
    await context.addCookies([buildInviteCookie(token)]);

    await page.goto('/invite/consume', { waitUntil: 'domcontentloaded' });
    await waitForInvitedProfile(page, inviterId);

    expect(await hasInviteCookie(context)).toBe(false);
  });

  test('guest invalid invite falls back cleanly', async ({ page }, testInfo) => {
    skipWhen(testInfo.project.name !== 'guest', 'Guest project only');

    await page.goto('/invite/not-a-valid-token', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(/invite_expired=1/, { timeout: 15_000 });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe('/');
    expect(finalUrl.searchParams.get('invite_expired')).toBe('1');
  });
});

function skipWhen(condition: boolean, reason: string) {
  // eslint-disable-next-line playwright/no-skipped-test -- this spec is intentionally included in guest and auth projects, and data-backed cases need matching local E2E env.
  test.skip(condition, reason);
}

function requireInviteCandidate(
  inviterId: string | null,
  reason: string,
): string {
  if (!inviterId) {
    skipWhen(true, reason);
    throw new Error(reason);
  }
  return inviterId;
}

function recordFollowCleanup(
  cleanupPairs: FollowPair[],
  shouldCleanup: boolean,
  pair: FollowPair,
) {
  if (shouldCleanup) {
    cleanupPairs.push(pair);
  }
}

function recordReferralCleanup(
  cleanupReferrals: ReferralAttribution[],
  shouldCleanup: boolean,
  attribution: ReferralAttribution,
) {
  if (shouldCleanup) {
    cleanupReferrals.push(attribution);
  }
}

function canRunDbInviteTests(): boolean {
  return Boolean(
    isEmailTokenTestingAvailable() &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function getAuthenticatedUserId(
  request: APIRequestContext,
): Promise<string> {
  const response = await request.get('/api/auth/check-session');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    sessionData?: { userId?: string };
  };
  const userId = body.sessionData?.userId;
  if (!userId) {
    throw new Error('Authenticated test user id was not available');
  }
  return userId;
}

function buildInviteCookie(token: string) {
  return {
    name: 'invite_token',
    value: token,
    url: BASE_URL,
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: BASE_URL.startsWith('https://'),
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
}

async function hasInviteCookie(context: BrowserContext): Promise<boolean> {
  const cookies = await context.cookies(BASE_URL);
  return cookies.some((cookie) => cookie.name === 'invite_token');
}

async function waitForInvitedProfile(page: Page, inviterId: string) {
  await page.waitForURL(/\/profile\/[^?]+\?invited=1/, { timeout: 20_000 });
  const finalUrl = new URL(page.url());
  expect(finalUrl.pathname).toBe(`/profile/${inviterId}`);
  expect(finalUrl.searchParams.get('invited')).toBe('1');
}

async function resolveUnfollowedInviterId(
  supabase: ReturnType<typeof createServiceClient>,
  inviteeId: string,
): Promise<string | null> {
  const candidates = await listInviteCandidates(supabase, inviteeId);
  if (candidates.length === 0) return null;

  const { data: follows, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', inviteeId);

  if (error) {
    throw new Error(`Could not resolve existing follows: ${error.message}`);
  }

  const followedIds = new Set(
    (follows ?? []).map((follow) => follow.following_id),
  );
  return (
    candidates.find((candidate) => !followedIds.has(candidate.id))?.id ?? null
  );
}

async function resolveAnyInviterId(
  supabase: ReturnType<typeof createServiceClient>,
  inviteeId: string,
): Promise<string | null> {
  const candidates = await listInviteCandidates(supabase, inviteeId);
  return candidates[0]?.id ?? null;
}

async function listInviteCandidates(
  supabase: ReturnType<typeof createServiceClient>,
  inviteeId: string,
): Promise<Array<{ id: string }>> {
  if (process.env.INVITE_E2E_INVITER_ID) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', process.env.INVITE_E2E_INVITER_ID)
      .neq('id', inviteeId)
      .maybeSingle();

    if (error) {
      throw new Error(`Configured inviter lookup failed: ${error.message}`);
    }

    return data ? [data] : [];
  }

  const { data: mockProfiles, error: mockError } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_mock', true)
    .neq('id', inviteeId)
    .limit(20);

  if (mockError) {
    throw new Error(`Mock inviter lookup failed: ${mockError.message}`);
  }

  if (mockProfiles && mockProfiles.length > 0) {
    return mockProfiles;
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .neq('id', inviteeId)
    .limit(20);

  if (error) {
    throw new Error(`Inviter lookup failed: ${error.message}`);
  }

  return profiles ?? [];
}

async function ensureFollow(
  supabase: ReturnType<typeof createServiceClient>,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { data: existing, error: lookupError } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Follow lookup failed: ${lookupError.message}`);
  }

  if (existing) return false;

  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: followerId, following_id: followingId });

  if (error && error.code !== '23505') {
    throw new Error(`Follow seed failed: ${error.message}`);
  }

  return true;
}

async function canCleanupReferral(
  supabase: ReturnType<typeof createServiceClient>,
  refereeId: string,
): Promise<boolean> {
  const { data: existing, error } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_id', refereeId)
    .maybeSingle();

  if (error) {
    throw new Error(`Referral lookup failed: ${error.message}`);
  }

  return !existing;
}

async function cleanupCreatedFollows(pairs: FollowPair[]) {
  if (pairs.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = createServiceClient();
  while (pairs.length > 0) {
    const pair = pairs.pop();
    if (!pair) continue;

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', pair.followerId)
      .eq('following_id', pair.followingId);

    if (error) {
      throw new Error(`Follow cleanup failed: ${error.message}`);
    }
  }
}

async function cleanupCreatedReferralAttributions(
  attributions: ReferralAttribution[],
) {
  if (attributions.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const supabase = createServiceClient();
  while (attributions.length > 0) {
    const attribution = attributions.pop();
    if (!attribution) continue;

    const { error } = await supabase
      .from('referrals')
      .delete()
      .eq('referee_id', attribution.refereeId)
      .eq('referrer_id', attribution.referrerId)
      .eq('source', 'invite_token');

    if (error) {
      throw new Error(`Referral cleanup failed: ${error.message}`);
    }
  }
}
