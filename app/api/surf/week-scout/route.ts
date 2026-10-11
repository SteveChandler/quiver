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
  buildWeekendScoutCandidatePool,
  scopeAlertPoolCandidates,
  type WeekendScoutCandidatePool,
} from '@/lib/services/discovery/weekend-scout-candidate-pool';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';
import { driveRadiusMiles, MAX_DRIVE_RADIUS_MILES } from '@/lib/profile/drive-range';
import { resolveLocationAnchor, type LocationSnapshot } from '@/lib/alerts/location-freshness';
import { loadUserPool } from '@/lib/alerts/user-pool';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  isWeekScoutSwellsEnabled,
  isWeekScoutSwellsUserAllowed,
} from '@/lib/flags/week-scout-swells';

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
const INTERACTIVE_LOCATION_MAX_AGE_MS = 15 * 60 * 1000;
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
  // Additive: without map bounds, rank the beaches Daily Call and swell alerts use.
  pool: z.literal('alerts').optional(),
});
type WeekScoutFilter = z.infer<typeof WeekScoutFilterSchema>;

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
  dayCount: z.literal(7),
}).refine((value) => Boolean(value.candidateScope) || Boolean(value.candidateBeachIds?.length), {
  message: 'Candidate IDs or complete-radius scope is required',
});

/**
 * The surfer's alert pool: home, saved and custom spots plus nearby beaches in
 * the drive range, anchored on a fix under a day old or else the home beach,
 * exactly as Daily Call and swell alerts load it. Null when nothing anchors it.
 */
async function loadAlertPool(
  supabase: AuthenticatedContext['supabase'],
  userId: string,
  snapshot: LocationSnapshot | null,
  filters: readonly WeekScoutFilter[] | undefined,
  userLocation: { lat: number; lon: number } | undefined,
): Promise<WeekendScoutCandidatePool | null> {
  const profile = await supabase
    .from('profiles')
    .select('home_beach_id, max_drive_minutes')
    .eq('id', userId)
    .maybeSingle();
  if (profile.error) throw new Error(`Failed to load Week Scout profile: ${profile.error.message}`);
  const homeBeachId = profile.data?.home_beach_id ?? null;
  const maxDriveMinutes = profile.data?.max_drive_minutes ?? null;
  let homeBeach: { lat: number | null; lon: number | null } | null = null;
  if (homeBeachId) {
    const home = await supabase.from('beaches').select('lat, lon').eq('id', homeBeachId).maybeSingle();
    if (home.error) throw new Error(`Failed to load Week Scout home beach: ${home.error.message}`);
    homeBeach = home.data ?? null;
  }
  const { anchor } = resolveLocationAnchor(snapshot, new Date(), homeBeach);
  if (!anchor) return null;

  const exclusions = await supabase
    .from('user_beach_exclusions')
    .select('beach_id')
    .eq('user_id', userId);
  if (exclusions.error) throw new Error(`Failed to load Week Scout hidden beaches: ${exclusions.error.message}`);
  const poolBeaches = await loadUserPool({
    supabase: createSupabaseServiceRoleClient(),
    userId,
    homeBeachId,
    location: anchor,
    maxDriveMinutes,
  });
  return scopeAlertPoolCandidates(poolBeaches, {
    anchor,
    filters,
    nearbyLocation: userLocation ?? anchor,
    excludedBeachIds: new Set((exclusions.data ?? []).map((row) => row.beach_id)),
  });
}

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
  // The alert pool replaces only the candidate list. It carries no coverage
  // deadline (capped at a minute), so Home keeps its usual cache instead of
  // dropping the call every minute while it refetches.
  const usesAlertPool = completeRadiusScope?.kind === 'complete-radius'
    && completeRadiusScope.pool === 'alerts'
    && !completeRadiusScope.mapBounds;

  let userLocation: { lat: number; lon: number } | undefined;
  let locationSnapshot: LocationSnapshot | null = null;
  try {
    const { data } = await supabase
      .from('user_location_snapshots')
      .select('lat, lon, captured_at')
      .eq('user_id', user.id)
      .maybeSingle();
    const lat = data?.lat;
    const lon = data?.lon;
    const capturedAt = typeof data?.captured_at === 'string'
      ? Date.parse(data.captured_at)
      : Number.NaN;
    if (typeof lat === 'number' && typeof lon === 'number' && typeof data?.captured_at === 'string') {
      locationSnapshot = { lat, lon, captured_at: data.captured_at };
    }
    if (
      typeof lat === 'number'
      && Number.isFinite(lat)
      && lat >= -90
      && lat <= 90
      && typeof lon === 'number'
      && Number.isFinite(lon)
      && lon >= -180
      && lon <= 180
      && Number.isFinite(capturedAt)
      && capturedAt <= Date.now()
      && Date.now() - capturedAt < (
        completeRadiusScope?.kind === 'complete-radius'
          ? INTERACTIVE_LOCATION_MAX_AGE_MS
          : LEGACY_LOCATION_MAX_AGE_MS
      )
    ) {
      userLocation = { lat, lon };
    }
  } catch {
    // Location is optional; preserve the legacy conditions-only ranking.
  }

  let candidateBeachIds = parsed.data.candidateBeachIds ?? [];
  let scopeRadiusMiles: number | null = null;
  let scopeCandidateCounts: { enumerated: number; hydrated: number; filteredOut: number } | null = null;
  let candidateBeaches: Array<{ beachId: string; beachName: string; beachSlugOrRef: string; distanceMiles: number | null; timezone: string | null; lat: number; lon: number }> | undefined;
  if (completeRadiusScope?.kind === 'complete-radius') {
    const mapBounds = completeRadiusScope.mapBounds;
    if (!userLocation && mapBounds && completeRadiusScope.filters?.includes('nearby')) {
      return createValidationError('A current location is required for the nearby filter');
    }
    let pool: WeekendScoutCandidatePool;
    if (usesAlertPool) {
      const alertPool = await loadAlertPool(
        supabase,
        user.id,
        locationSnapshot,
        completeRadiusScope.filters,
        userLocation,
      );
      if (!alertPool) return createValidationError('A recent location or home beach is required for alert-pool Week Scout');
      pool = alertPool;
    } else {
      const mapCenter = mapBounds ? {
        lat: (mapBounds.minLat + mapBounds.maxLat) / 2,
        lon: (mapBounds.minLon + mapBounds.maxLon) / 2,
      } : null;
      const candidateOrigin = mapCenter ?? userLocation;
      if (!candidateOrigin) return createValidationError('A current location or map scope is required for complete-radius Week Scout');
      const profile = await supabase
        .from('profiles')
        .select('max_drive_minutes')
        .eq('id', user.id)
        .maybeSingle();
      if (profile.error) throw new Error(`Failed to load Week Scout profile: ${profile.error.message}`);
      const configuredMinutes = profile.data?.max_drive_minutes;
      const radiusMiles = mapBounds
        ? Math.max(
          calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.minLat, lon: mapBounds.minLon }),
          calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.minLat, lon: mapBounds.maxLon }),
          calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.maxLat, lon: mapBounds.minLon }),
          calculateDistanceInMiles(candidateOrigin, { lat: mapBounds.maxLat, lon: mapBounds.maxLon }),
        )
        : Math.max(0.5, driveRadiusMiles(configuredMinutes));
      const mapPrefilterMargin = mapBounds
        ? radiusMiles * MAP_PREFILTER_MARGIN_RATIO + MAP_PREFILTER_MARGIN_MIN_MILES
        : 0;
      if (radiusMiles + mapPrefilterMargin > MAX_RADIUS_MILES) {
        return createValidationError('Map scope exceeds the supported 100-mile extent');
      }
      const boundedRadiusMiles = Math.min(radiusMiles, MAX_RADIUS_MILES);
      scopeRadiusMiles = boundedRadiusMiles;
      pool = await buildWeekendScoutCandidatePool(user.id, {
        userLocation: candidateOrigin,
        // The RPC uses a different geodesic implementation than the client
        // corner calculation. Expand only the prefilter; map bounds remain the
        // exact final inclusion check in the candidate pool.
        radiusMiles: mapBounds
          ? boundedRadiusMiles + mapPrefilterMargin
          : boundedRadiusMiles,
        requirePagedCoverage: true,
        filters: completeRadiusScope.filters,
        mapBounds: completeRadiusScope.mapBounds,
        nearbyLocation: userLocation ?? null,
      });
    }
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
  }
  // The preference only narrows the pick; if it can't be read, rank every window.
  let sessionTime: ReturnType<typeof parseSessionTime> = null;
  try {
    const sessionTimeRow = await supabase
      .from('profiles')
      .select('preferred_session_time')
      .eq('id', user.id)
      .maybeSingle();
    sessionTime = sessionTimeRow.error ? null : parseSessionTime(sessionTimeRow.data?.preferred_session_time);
  } catch {
    sessionTime = null;
  }
  const swellsEnabled = isWeekScoutSwellsEnabled() && isWeekScoutSwellsUserAllowed(user.id);
  const forecast = await generateWeekScoutForecast(user.id, {
    candidateBeachIds,
    ...(sessionTime ? { sessionTime } : {}),
    localTimezone: parsed.data.localTimezone,
    startLocalDate: parsed.data.startLocalDate,
    dayCount: parsed.data.dayCount,
    ...(userLocation ? { userLocation } : {}),
    ...(completeRadiusScope?.kind === 'complete-radius' && !usesAlertPool
      ? { requirePerRowFreshness: true }
      : {}),
    ...(swellsEnabled ? { includeSwells: true } : {}),
  });
  const { coverage: forecastCoverage, swells, ...forecastPayload } = forecast;
  const coverage = completeRadiusScope?.kind === 'complete-radius' && !usesAlertPool
    ? {
        scope: {
          kind: 'complete-radius' as const,
          radiusMiles: scopeRadiusMiles,
          mapBounded: completeRadiusScope.mapBounds !== null && completeRadiusScope.mapBounds !== undefined,
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
  });
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
