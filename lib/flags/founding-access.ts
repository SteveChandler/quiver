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
let inFlight: Promise<boolean> | null = null;

async function readSwitch(): Promise<boolean> {
  // Unconfigured environments (local, tests) read as off without the client's
  // own fail-fast error.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }
  try {
    // Generated types do not include this RPC until the migration is applied.
    const supabase = createSupabaseServiceRoleClient() as SupabaseClient;
    const { data, error } = await supabase.rpc('founding_access_enabled');
    if (error) throw new Error(error.message);
    return data === true;
  } catch (error) {
    console.warn(
      '[founding-access] Switch read failed; treating as off:',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Cached per instance for at most 60 s with one in-flight read. Errors resolve
 * to off and are cached too, so an outage never becomes a per-request read.
 */
export async function isFoundingAccessEnabled(): Promise<boolean> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inFlight) return inFlight;
  inFlight = readSwitch()
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

export async function resolveFeatureAccess(
  userId: string | null | undefined,
  isPro: boolean,
): Promise<FeatureAccess> {
  if (isPro) return { isPro: true, foundingAccess: false, hasFeatureAccess: true };
  if (!userId) return { isPro: false, foundingAccess: false, hasFeatureAccess: false };
  const foundingAccess = await isFoundingAccessEnabled();
  return { isPro: false, foundingAccess, hasFeatureAccess: foundingAccess };
}
