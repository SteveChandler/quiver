import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createSuccessResponse,
  createValidationError,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { generateWeekScoutForecast } from '@/lib/services/discovery/week-scout';
import { parseSessionTime } from '@/lib/scoring/session-time-preference';
import {
  buildDriveRangeCandidatePool,
  buildWeekendScoutCandidatePool,
} from '@/lib/services/discovery/weekend-scout-candidate-pool';
import {
  getWeekScoutLocation,
  INTERACTIVE_LOCATION_MAX_AGE_MS,
  resolveWeekScoutScopeAnchor,
} from '@/lib/services/discovery/week-scout-scope';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';
import { driveRadiusMiles, MAX_DRIVE_RADIUS_MILES } from '@/lib/profile/drive-range';
import {
  isWeekScoutSwellsEnabled,
  isWeekScoutSwellsUserAllowed,
} from '@/lib/flags/week-scout-swells';
import {
  isWeekScoutNotesUser,
  liveWeekScoutNotes,
  loadWeekScoutNotesEdition,
} from '@/lib/services/discovery/week-scout-notes-serve';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { bindStory, isWeekScoutStoryEnabled, loadAndBindStory } from '@/lib/services/discovery/week-scout-story-serve';

export const dynamic = 'force-dynamic';

/**
 * Request-size and timeout budget.
 *
 * Measured 2026-07-29 against production data, after the Week Scout hot-path
 * fix removed the per-candidate Intl.DateTimeFormat cost:
 *
 *   candidates |  1     8      20     40
 *   before     |  633ms 2002ms 4295ms 8214ms   (~195ms marginal per beach)
 *   after      |  199ms  305ms  532ms  786ms   (~15ms marginal per beach)
 *
 * MAX_CANDIDATE_BEACHES matches WEEK_SCOUT_MAX_CANDIDATES in quiver-native, so
 * a well-behaved client is never rejected. At that ceiling the scoring work is
 * well under a second, which leaves maxDuration as pure headroom for cold
 * starts and slow upstream reads rather than a limit the happy path approaches.
 */
export const maxDuration = 30;

const MAX_LEGACY_CANDIDATE_BEACHES = 30;
const MAX_RADIUS_MILES = MAX_DRIVE_RADIUS_MILES;
const MAP_PREFILTER_MARGIN_RATIO = 0.006;
const MAP_PREFILTER_MARGIN_MIN_MILES = 0.01;
const LEGACY_LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WeekScoutFilterSchema = z.enum(['longboard', 'beginner', 'quiet', 'beach', 'reef', 'nearby']);
const CompleteRadiusScopeSchema = z.object({
  kind: z.literal('complete-radius'),
  filters: z.array(WeekScoutFilterSchema).optional(),
  mapBounds: z.object({
    minLat: z.number().finite().min(-90).max(90),
    maxLat: z.number().finite().min(-90).max(90),
    minLon: z.number().finite().min(-180).max(180),
    maxLon: z.number().finite().min(-180).max(180),
  }).refine((bounds) => bounds.minLat <= bounds.maxLat && bounds.minLon <= bounds.maxLon, 'Invalid map bounds').nullable().optional(),
  /** A searched town or beach that re-centres the drive-range scope instead of the phone. */
  origin: z.object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
  }).nullable().optional(),
});

function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
  );
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const WeekScoutRequestSchema = z.object({
  candidateBeachIds: z
    .array(z.string().uuid())
    .transform((ids) => Array.from(new Set(ids)))
    .refine(
      (ids) => ids.length <= MAX_LEGACY_CANDIDATE_BEACHES,
      `At most ${MAX_LEGACY_CANDIDATE_BEACHES} candidate beaches are allowed`,
    ).optional(),
  candidateScope: z.union([z.literal('complete-radius'), CompleteRadiusScopeSchema]).optional(),
  localTimezone: z.string().min(1).refine(isValidTimezone, 'Invalid IANA timezone'),
  startLocalDate: z.string().refine(isValidLocalDate, 'Invalid local date'),
  dayCount: z.union([z.literal(7), z.literal(10)]),
}).refine((value) => Boolean(value.candidateScope) || Boolean(value.candidateBeachIds?.length), {
  message: 'Candidate IDs or complete-radius scope is required',
});

async function weekScoutHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
): Promise<NextResponse> {
  // Installed native clients need a stable canonical contract. Keep the flag
  // as an emergency kill switch, but default the endpoint on so an omitted
  // preview/production env value cannot turn every mobile forecast into a 404.
  if (process.env.WEEK_SCOUT_ENDPOINT_ENABLED === 'false') {
    return NextResponse.json(
      { success: false, error: 'Week Scout endpoint is not enabled' },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createValidationError('Invalid JSON body');
  }

  const parsed = WeekScoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationError('Invalid Week Scout request', parsed.error.flatten());
  }
  const completeRadiusScope = parsed.data.candidateScope === 'complete-radius'
    ? { kind: 'complete-radius' as const }
    : parsed.data.candidateScope;

  // The profile and the location snapshot are independent reads; run them together.
  const [profileRead, snapshotRead] = await Promise.all([
    readWeekScoutProfile(supabase, user.id),
    readLocationSnapshot(supabase, user.id),
  ]);
  const { profile, error: profileError } = profileRead;
  // Without a profile the legacy ranking stands: no session-time narrowing and
  // distance friction from 10 miles.
  const surferDriveRadiusMiles = profileError === null
    ? driveRadiusMiles(profile?.max_drive_minutes)
    : undefined;

  const userLocation = getWeekScoutLocation(snapshotRead, Date.now(),
    completeRadiusScope?.kind === 'complete-radius'
      ? INTERACTIVE_LOCATION_MAX_AGE_MS
      : LEGACY_LOCATION_MAX_AGE_MS);

  let candidateBeachIds = parsed.data.candidateBeachIds ?? [];
  let scopeRadiusMiles: number | null = null;
  let scopeCandidateCounts: { enumerated: number; hydrated: number; filteredOut: number; capped?: number } | null = null;
  let scopeAnchor: 'origin' | 'location' | 'home' | null = null;
  let scopeCoveredMiles: number | null = null;
  let scopeWidenedFromMiles: number | null = null;
  let scopeNearestBeach: { id: string; name: string; slug: string; lat: number; lon: number; distanceMiles: number } | null = null;
  let rankingLocation = userLocation;
  let candidateBeaches: Array<{ beachId: string; beachName: string; beachSlugOrRef: string; distanceMiles: number | null; timezone: string | null; lat: number; lon: number }> | undefined;
  if (completeRadiusScope?.kind === 'complete-radius' && !completeRadiusScope.mapBounds) {
    if (profileError !== null) throw new Error(`Failed to load Week Scout profile: ${profileError}`);
    const homeBeachId = profile?.home_beach_id ?? null;
    // A searched origin when the surfer picked one; otherwise where the phone is
    // when it synced in the last 15 minutes, else the home break, the same
    // anchor Home seeds from while it locates.
    const resolvedAnchor = await resolveWeekScoutScopeAnchor(supabase, completeRadiusScope.origin ?? null, userLocation, homeBeachId);
    if (!resolvedAnchor) return createValidationError('A current location or map scope is required for complete-radius Week Scout');
    const { anchor } = resolvedAnchor;
    scopeAnchor = resolvedAnchor.source;
    rankingLocation = anchor;
    scopeRadiusMiles = Math.min(Math.max(0.5, driveRadiusMiles(profile?.max_drive_minutes)), MAX_RADIUS_MILES);
    const pool = await buildDriveRangeCandidatePool(user.id, {
      anchor,
      homeBeachId,
      maxDriveMinutes: profile?.max_drive_minutes ?? null,
      experienceLevel: profile?.experience_level ?? null,
      filters: completeRadiusScope.filters,
    });
    candidateBeachIds = pool.candidates.map((candidate) => candidate.beach.id);
    if (pool.widenedFromMiles !== undefined) {
      scopeWidenedFromMiles = pool.widenedFromMiles;
      scopeRadiusMiles = MAX_RADIUS_MILES;
    }
    scopeNearestBeach = pool.nearestBeach ?? null;
    scopeCandidateCounts = {
      enumerated: pool.enumeratedCount,
      hydrated: pool.enumeratedCount,
      filteredOut: pool.filteredOutCount,
      capped: pool.cappedCount,
    };
    // Past the nearby cap the scout covers less than the whole range;
    // report the distance it actually reached so "within N miles" stays true.
    scopeCoveredMiles = typeof pool.farthestNearbyMiles === 'number' && Number.isFinite(pool.farthestNearbyMiles)
      ? Math.min(scopeRadiusMiles, pool.farthestNearbyMiles)
      : scopeRadiusMiles;
    candidateBeaches = pool.candidates.map((candidate) => ({
      beachId: candidate.beach.id,
      beachName: candidate.beach.name,
      beachSlugOrRef: candidate.beach.slug ?? candidate.beach.id,
      distanceMiles: candidate.distanceMiles,
      timezone: candidate.beach.timezone ?? null,
      lat: candidate.beach.lat,
      lon: candidate.beach.lon,
    }));
  } else if (completeRadiusScope?.kind === 'complete-radius') {
    const mapBounds = completeRadiusScope.mapBounds!;
    if (!userLocation && completeRadiusScope.filters?.includes('nearby')) {
      return createValidationError('A current location is required for the nearby filter');
    }
    const candidateOrigin = {
      lat: (mapBounds.minLat + mapBounds.maxLat) / 2,
      lon: (mapBounds.minLon + mapBounds.maxLon) / 2,
    };
    const radiusMiles = Math.max(
      calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.minLat, lon: mapBounds.minLon }),
      calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.minLat, lon: mapBounds.maxLon }),
      calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.maxLat, lon: mapBounds.minLon }),
      calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.maxLat, lon: mapBounds.maxLon }),
    );
    const mapPrefilterMargin = radiusMiles * MAP_PREFILTER_MARGIN_RATIO + MAP_PREFILTER_MARGIN_MIN_MILES;
    if (radiusMiles + mapPrefilterMargin > MAX_RADIUS_MILES) {
      return createValidationError('Map scope exceeds the supported 100-mile extent');
    }
    const boundedRadiusMiles = Math.min(radiusMiles, MAX_RADIUS_MILES);
    scopeRadiusMiles = boundedRadiusMiles;
    const pool = await buildWeekendScoutCandidatePool(user.id, {
      userLocation: candidateOrigin,
      // The RPC uses a different geodesic implementation than the client
      // corner calculation. Expand only the prefilter; map bounds remain the
      // exact final inclusion check in the candidate pool.
      radiusMiles: boundedRadiusMiles + mapPrefilterMargin,
      requirePagedCoverage: true,
      filters: completeRadiusScope.filters,
      mapBounds,
      nearbyLocation: userLocation ?? null,
    });
    if (pool.incomplete) {
      return NextResponse.json({ success: false, error: 'Week Scout candidate coverage is incomplete' }, { status: 503 });
    }
    candidateBeachIds = pool.candidates.map((candidate) => candidate.beach.id);
    scopeCandidateCounts = {
      enumerated: pool.enumeratedCount ?? 0,
      hydrated: pool.hydratedCount ?? 0,
      filteredOut: pool.filteredOutCount ?? 0,
    };
    candidateBeaches = pool.candidates.map((candidate) => ({
      beachId: candidate.beach.id,
      beachName: candidate.beach.name,
      beachSlugOrRef: candidate.beach.slug ?? candidate.beach.id,
      // Map-centered enumeration is not a user travel distance.
      distanceMiles: userLocation
        ? calculateDistanceInMiles(userLocation, { lat: candidate.beach.lat, lon: candidate.beach.lon })
        : null,
      timezone: candidate.beach.timezone ?? null,
      lat: candidate.beach.lat,
      lon: candidate.beach.lon,
    }));
  } else if (profileError === null) {
    try {
      const homeBeachId = profile?.home_beach_id ?? null;
      const resolvedAnchor = await resolveWeekScoutScopeAnchor(supabase, null, userLocation, homeBeachId);
      if (resolvedAnchor) {
        const { anchor } = resolvedAnchor;
        const pool = await buildDriveRangeCandidatePool(user.id, {
          anchor,
          homeBeachId,
          maxDriveMinutes: profile?.max_drive_minutes ?? null,
          experienceLevel: profile?.experience_level ?? null,
          filters: undefined,
          widenEmptyRange: false,
        });
        const poolIds = pool.candidates.map((candidate) => candidate.beach.id);
        const allowedIds = new Set(poolIds);
        const submittedInRange = candidateBeachIds.filter((id) => allowedIds.has(id));
        if (poolIds.length > 0) {
          candidateBeachIds = submittedInRange.length > 0 ? submittedInRange : poolIds;
        }
        rankingLocation = anchor;
      }
    } catch (error) {
      console.error('Failed to bound legacy Week Scout candidates', error);
    }
  }
  // The preference only narrows the pick; if it can't be read, rank every window.
  const sessionTime = profileError === null ? parseSessionTime(profile?.preferred_session_time) : null;
  const swellsEnabled = isWeekScoutSwellsEnabled() && isWeekScoutSwellsUserAllowed(user.id);
  const storyEnabled = isWeekScoutStoryEnabled();
  // The saved edition does not depend on the ranking, so it loads alongside it.
  // Never rejects: any failure is a Week Scout without notes.
  const pendingNotes = isWeekScoutNotesUser(user.id)
    ? Promise.resolve()
      .then(() => loadWeekScoutNotesEdition({ client: createSupabaseServiceRoleClient(), userId: user.id, now: new Date() }))
      .catch(() => null)
    : null;
  const forecast = await generateWeekScoutForecast(user.id, {
    candidateBeachIds,
    ...(sessionTime ? { sessionTime } : {}),
    localTimezone: parsed.data.localTimezone,
    startLocalDate: parsed.data.startLocalDate,
    dayCount: parsed.data.dayCount,
    ...(rankingLocation ? { userLocation: rankingLocation } : {}),
    ...(surferDriveRadiusMiles !== undefined ? { driveRadiusMiles: surferDriveRadiusMiles } : {}),
    ...(completeRadiusScope?.kind === 'complete-radius'
      ? { requirePerRowFreshness: true }
      : {}),
    ...(swellsEnabled || storyEnabled ? { includeSwells: true } : {}),
  });
  const { coverage: forecastCoverage, swells, ...forecastPayload } = forecast;
  const notesEdition = pendingNotes ? await pendingNotes : null;
  let weekScoutNotes: ReturnType<typeof liveWeekScoutNotes> = null;
  try {
    weekScoutNotes = notesEdition ? liveWeekScoutNotes(notesEdition, forecast) : null;
  } catch (error) {
    console.warn('Week Scout notes failed; omitting notes', error);
  }
  const story = storyEnabled
    ? await loadAndBindStory({
      client: createSupabaseServiceRoleClient(),
      homeBeachId: profileError === null ? profile?.home_beach_id ?? null : null,
      live: forecast,
      startLocalDate: parsed.data.startLocalDate,
      now: new Date(),
    }).catch(() => bindStory({ region: null, availability: 'unavailable', input: null, selections: null, live: forecast }))
    : null;
  const coverage = completeRadiusScope?.kind === 'complete-radius'
    ? {
        scope: {
          kind: 'complete-radius' as const,
          radiusMiles: scopeRadiusMiles,
          mapBounded: completeRadiusScope.mapBounds !== null && completeRadiusScope.mapBounds !== undefined,
          ...(scopeAnchor ? { anchor: scopeAnchor } : {}),
          ...(scopeCoveredMiles !== null ? { coveredMiles: scopeCoveredMiles } : {}),
          ...(scopeWidenedFromMiles !== null ? { widenedFromMiles: scopeWidenedFromMiles } : {}),
          ...(scopeNearestBeach ? { nearestBeach: scopeNearestBeach } : {}),
          candidates: scopeCandidateCounts ?? { enumerated: 0, hydrated: 0, filteredOut: 0 },
        },
        freshness: { state: 'unknown' as const },
        expiresAt: forecastCoverage?.expiresAt ?? forecast.generatedAt,
        days: forecastCoverage?.days ?? [],
      }
    : undefined;
  return createSuccessResponse({
    ...forecastPayload,
    ...(candidateBeaches ? { candidateBeaches } : {}),
    ...(coverage ? { coverage } : {}),
    ...(swellsEnabled && swells ? { swells } : {}),
    // Pilot-only and additive: each field is present only when a gated note survived.
    ...(weekScoutNotes?.headline ? { headline: weekScoutNotes.headline } : {}),
    ...(weekScoutNotes?.notes ? { notes: weekScoutNotes.notes } : {}),
    ...(story ? { story } : {}),
  });
}

async function readWeekScoutProfile(
  supabase: AuthenticatedContext['supabase'],
  userId: string,
): Promise<{
  profile: { max_drive_minutes?: number | null; preferred_session_time?: string | null; home_beach_id?: string | null; experience_level?: string | null } | null;
  error: string | null;
}> {
  try {
    const result = await supabase
      .from('profiles')
      .select('max_drive_minutes, preferred_session_time, home_beach_id, experience_level')
      .eq('id', userId)
      .maybeSingle();
    return result.error ? { profile: null, error: result.error.message } : { profile: result.data, error: null };
  } catch (error) {
    return { profile: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Location is optional; a failed read preserves the legacy conditions-only ranking. */
async function readLocationSnapshot(
  supabase: AuthenticatedContext['supabase'],
  userId: string,
): Promise<{ lat?: unknown; lon?: unknown; captured_at?: unknown } | null> {
  try {
    const { data } = await supabase
      .from('user_location_snapshots')
      .select('lat, lon, captured_at')
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

const protectedPOST = withRateLimit(
  withAuth(weekScoutHandler, { errorMessage: 'Error generating Week Scout forecast' }),
  'surf-discovery',
);

export const POST = async (
  ...args: Parameters<typeof protectedPOST>
): Promise<NextResponse> => {
  const response = await protectedPOST(...args);
  response.headers.delete('ETag');
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate',
  );
  return response;
};
