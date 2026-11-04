import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * Founding surfer access: one DB switch (`founding_access_enabled()`) that
 * gives signed-in non-Pro users every Pro feature gate. Billing, trial and
 * subscription code must keep reading real Pro status, never this.
 */

// Hot paths (discover, surf call, scored) must not add a DB read per request.
const CACHE_TTL_MS = 60_000;

let cached: { value: boolean; expiresAt: number } | null = null;
let lastRead: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

/** Throws on a failed read so the caller can tell an outage from a real off. */
async function readSwitch(): Promise<boolean> {
  // Unconfigured environments (local, tests) read as off without the client's
  // own fail-fast error.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }
  // Generated types do not include this RPC until the migration is applied.
  const supabase = createSupabaseServiceRoleClient() as SupabaseClient;
  const { data, error } = await supabase.rpc('founding_access_enabled');
  if (error) throw new Error(error.message);
  return data === true;
}

function valueAfterFailedRead(error: unknown): boolean {
  const message = error instanceof Error ? error.message : error;
  if (lastRead === null) {
    console.warn('[founding-access] Switch read failed with no earlier read; treating as off:', message);
    return false;
  }
  console.warn(
    `[founding-access] Switch read failed; keeping last read value (${lastRead ? 'on' : 'off'}):`,
    message,
  );
  return lastRead;
}

/**
 * Cached per instance for at most 60 s with one in-flight read. A failed read
 * keeps the last successful value (a DB blip must not lock founding users out)
 * and is cached too, so an outage never becomes a per-request read. With no
 * earlier success it fails closed.
 */
export async function isFoundingAccessEnabled(): Promise<boolean> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inFlight) return inFlight;
  inFlight = readSwitch()
    .then(
      (value) => {
        lastRead = value;
        return value;
      },
      valueAfterFailedRead,
    )
    .then((value) => {
      cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export interface FeatureAccess {
  /** Real Pro/trial entitlement. Billing and paywall logic read only this. */
  isPro: boolean;
  /** Switch on, signed in, and not Pro. */
  foundingAccess: boolean;
  /** What every feature gate reads: `isPro || foundingAccess`. */
  hasFeatureAccess: boolean;
}

export interface FeatureAccessOptions {
  /** The user's entitlement row has `billing_issue` set. */
  billingIssue?: boolean;
}

export interface FeatureAccessInput {
  isPro: boolean;
  signedIn: boolean;
  billingIssue: boolean;
  switchOn: boolean;
}

/**
 * The one founding access rule: not Pro, signed in, no billing issue, switch
 * on. Billing-issue rows never get it: the DB match gates and personalization
 * eligibility lock them first, so every surface agrees.
 */
export function featureAccessFor({
  isPro,
  signedIn,
  billingIssue,
  switchOn,
}: FeatureAccessInput): FeatureAccess {
  if (isPro) return { isPro: true, foundingAccess: false, hasFeatureAccess: true };
  const foundingAccess = signedIn && !billingIssue && switchOn;
  return { isPro: false, foundingAccess, hasFeatureAccess: foundingAccess };
}

/** Reads the switch only when the user could get founding access. */
export async function resolveFeatureAccess(
  userId: string | null | undefined,
  isPro: boolean,
  options: FeatureAccessOptions = {},
): Promise<FeatureAccess> {
  const signedIn = Boolean(userId);
  const billingIssue = options.billingIssue === true;
  const switchOn = !isPro && signedIn && !billingIssue && (await isFoundingAccessEnabled());
  return featureAccessFor({ isPro, signedIn, billingIssue, switchOn });
}
