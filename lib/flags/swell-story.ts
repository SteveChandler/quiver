import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * Swell story switches: two `app_runtime_flags` rows, both shipped off. `swell_story_card` sends the
 * story sentence on the swell-events and big-swells routes; `swell_story_push` uses it in the swell push.
 * Off is today's text everywhere. A flip is a production write.
 */
const SWELL_STORY_CARD_FLAG = 'swell_story_card';
const SWELL_STORY_PUSH_FLAG = 'swell_story_push';
const KEYS = [SWELL_STORY_CARD_FLAG, SWELL_STORY_PUSH_FLAG] as const;
type SwellStoryKey = (typeof KEYS)[number];
type Switches = Record<SwellStoryKey, boolean>;

// The card routes are hot: one read of both rows per instance per minute at most.
const CACHE_TTL_MS = 60_000;

let cached: { value: Switches; expiresAt: number } | null = null;
let lastRead: Switches | null = null;
let inFlight: Promise<Switches> | null = null;

/** Throws on a failed read so the caller can tell an outage from a real off. A missing row reads as off. */
async function readSwitches(): Promise<Switches> {
  // Unconfigured environments (local, tests) read as off without the client's own fail-fast error.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { [SWELL_STORY_CARD_FLAG]: false, [SWELL_STORY_PUSH_FLAG]: false };
  }
  const { data, error } = await createSupabaseServiceRoleClient()
    .from('app_runtime_flags')
    .select('key, enabled')
    .in('key', [...KEYS]);
  if (error) throw new Error(error.message);
  const on = new Set((data ?? []).filter((row) => row.enabled === true).map((row) => row.key));
  return { [SWELL_STORY_CARD_FLAG]: on.has(SWELL_STORY_CARD_FLAG), [SWELL_STORY_PUSH_FLAG]: on.has(SWELL_STORY_PUSH_FLAG) };
}

function valueAfterFailedRead(error: unknown): Switches {
  const message = error instanceof Error ? error.message : error;
  if (lastRead === null) {
    console.warn('[swell-story] Switch read failed with no earlier read; treating as off:', message);
    return { [SWELL_STORY_CARD_FLAG]: false, [SWELL_STORY_PUSH_FLAG]: false };
  }
  console.warn('[swell-story] Switch read failed; keeping last read values:', message);
  return lastRead;
}

/**
 * Cached per instance for at most 60 s with one in-flight read, as founding access is. A failed read keeps
 * the last successful values and is cached too, so an outage never becomes a per-request read; with no
 * earlier success both switches read off.
 */
async function swellStorySwitches(): Promise<Switches> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (inFlight) return inFlight;
  inFlight = readSwitches()
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

export async function isSwellStoryCardEnabled(): Promise<boolean> {
  return (await swellStorySwitches())[SWELL_STORY_CARD_FLAG];
}

export async function isSwellStoryPushEnabled(): Promise<boolean> {
  return (await swellStorySwitches())[SWELL_STORY_PUSH_FLAG];
}
