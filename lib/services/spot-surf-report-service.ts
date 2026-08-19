import "server-only";

import { unstable_cache } from 'next/cache';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { computeSurfCall, computeSurfCallTiers, type SurfCallResult } from '@/lib/utils/surf-call-logic';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone-constants';
import { formatDateInTimezone } from '@/lib/utils/date-time';
import { extractForecastDate } from '@/lib/utils/forecast-at-adapter';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getBatchSunTimes } from '@/lib/services/discovery';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import {
  buildForecastRecommendationContext,
  type ForecastRecommendationContext,
} from '@/lib/services/forecast-recommendation-context';
import { applyV51DisplayOverrideToForecasts } from '@/lib/services/forecast/v5-display-gate';
import { resolveTodayHeadline } from '@/lib/services/forecast/today-headline';
import {
  sanitizeSurfCallForMajorEventHold,
  type AuthorizedSurfCallTier,
  type MajorEventHoldSurfCallResult,
} from '@/lib/recommendations/major-event-hold/adapters/surf-call';
import { evaluateMajorEventHoldCandidates } from '@/lib/recommendations/major-event-hold/service';
import type { MajorEventHoldCandidate } from '@/lib/recommendations/major-event-hold/types';

export interface SpotSurfReportResult {
  report: MajorEventHoldSurfCallResult;
  isTomorrow: boolean;
  forecastContext: ForecastRecommendationContext | null;
  /** Only produced by the cached spot report; `/api/surf/call` omits it. */
  hourlyForecasts?: PublicForecastHour[];
  hourlyForecastDay?: PublicForecastDay;
}

interface CachedSpotSurfReportResult {
  report: SurfCallResult;
  isTomorrow: boolean;
  forecastContext: ForecastRecommendationContext | null;
  hourlyForecasts: PublicForecastHour[];
  hourlyForecastDay: PublicForecastDay;
}

export type PublicForecastDay = 'today' | 'tomorrow';

/** Fields projected into the crawlable hourly table (keeps the cached payload small). */
const PUBLIC_FORECAST_HOUR_FIELDS = [
  'forecast_at',
  'wave_height',
  'swell_1_height',
  'swell_1_period',
  'swell_1_direction',
  'swell_2_height',
  'swell_2_period',
  'swell_2_direction',
  'wind_speed',
  'wind_direction',
  'tide_height',
  'tide_status',
  'confidence_score',
] as const;

export type PublicForecastHour = Pick<
  EnhancedForecastEntity,
  (typeof PUBLIC_FORECAST_HOUR_FIELDS)[number]
>;

const NO_POSITIVE_SURF_CALL_HOLD_EPOCH = 'no-positive-surf-call';

function surfCallCandidate(
  report: SurfCallResult,
  beachId: string,
): MajorEventHoldCandidate | null {
  if (
    typeof report.bestWindowStart !== 'string' ||
    typeof report.bestWindowEnd !== 'string'
  ) {
    return null;
  }
  return {
    candidateId:
      `surf-call:${beachId}:${report.bestWindowStart}:${report.bestWindowEnd}`,
    beachId,
    startsAt: report.bestWindowStart,
    endsAt: report.bestWindowEnd,
  };
}

function hasPositiveSurfCallSemantics(report: SurfCallResult): boolean {
  if (report.bestWindowStart !== null || report.bestWindowEnd !== null) {
    return true;
  }
  if (report.verdict !== 'NO') return true;
  if (!report.tiers) return false;
  return Object.values(report.tiers).some(({ verdict }) => verdict !== 'NO');
}

function unavailableUnboundSurfCall(
  report: SurfCallResult,
): MajorEventHoldSurfCallResult {
  return {
    ...report,
    verdict: 'NO',
    bestWindowStart: null,
    bestWindowEnd: null,
    windowMinutes: null,
    shortWindow: false,
    whySentence: '',
    score: 0,
    peakTime: null,
    trendTags: [],
    character: null,
    tiers: null,
    recommendationAvailability: {
      state: 'none',
      reasonCode: 'hold_state_unavailable',
      holdEpoch: 'hold-state-unavailable',
    },
  };
}

function availableNonPositiveSurfCall(
  report: SurfCallResult,
): MajorEventHoldSurfCallResult {
  return {
    ...report,
    recommendationAvailability: {
      state: 'available',
      holdEpoch: NO_POSITIVE_SURF_CALL_HOLD_EPOCH,
    },
  };
}

async function applySurfCallMajorEventHold(
  result: CachedSpotSurfReportResult,
  beachId: string,
  profileExperience: unknown,
  authorizedTier: AuthorizedSurfCallTier,
): Promise<SpotSurfReportResult> {
  const candidate = surfCallCandidate(result.report, beachId);
  if (!candidate) {
    const report = hasPositiveSurfCallSemantics(result.report)
      ? unavailableUnboundSurfCall(result.report)
      : availableNonPositiveSurfCall(result.report);
    return {
      ...result,
      report,
      forecastContext:
        report.recommendationAvailability.state === 'none'
          ? null
          : result.forecastContext,
    };
  }

  const candidates = [candidate];
  const decisions = await evaluateMajorEventHoldCandidates({
    candidates,
    profileExperience,
  });
  const report = sanitizeSurfCallForMajorEventHold(
    result.report,
    {
      candidateId: candidate.candidateId,
      beachId,
      authorizedTier,
    },
    candidates,
    decisions,
  );

  return {
    ...result,
    report,
    forecastContext:
      report.recommendationAvailability.state === 'none'
        ? null
        : result.forecastContext,
  };
}

interface BuildReportOptions {
  isTomorrow?: boolean;
}

/**
 * Wrap `computeSurfCall` to also attach the per-skill tier verdict ladder.
 * The wrapper exists so the return sites in `getCachedSurfReport` stay terse.
 */
function buildReport(
  window: PersonalizedForecastWindow | null,
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  options: BuildReportOptions,
): SurfCallResult {
  const surfCallOptions = { isTomorrow: options.isTomorrow };
  const baseline = computeSurfCall(window, forecasts, beach, surfCallOptions);
  const tiers = computeSurfCallTiers(window, forecasts, beach, surfCallOptions);

  return {
    ...baseline,
    score: clampScore(baseline.score),
    tiers,
    userTier: null,
    skillSource: null,
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/**
 * Cookie-free surf report for ISR/SSG beach pages.
 *
 * Uses the service-role client directly (no cookies()) so Next.js can honour
 * the page-level `revalidate = 3600` export without being forced into dynamic
 * rendering.  Returns the anonymous-user report — personalisation happens
 * client-side inside BeachDetailClient after hydration.
 *
 */
export async function getSpotSurfReportPublic(beach: Beach): Promise<SpotSurfReportResult | null> {
  if (!beach.id) return null;

  try {
    const cached = await getCachedSurfReport(
      beach.id,
      canonicalizeBeachForSurfCall(beach),
    );
    return cached
      ? await applySurfCallMajorEventHold(cached, beach.id, null, null)
      : null;
  } catch (error) {
    console.error('[getSpotSurfReportPublic] Error:', {
      beachId: beach.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Canonicalize a beach to the stable subset that surf-call computation
 * actually reads. Without this, `unstable_cache` would hash the entire beach
 * object — callers can provide different projections of the same beach, which
 * would otherwise produce divergent cache keys and surf calls. Every public
 * caller now routes through this canonicalizer before reaching the cached
 * function, so cache keys converge.
 *
 * IMPORTANT: the field set below MUST mirror every `beach.*` read inside
 * `lib/services/discovery/window-selector/*` and `lib/utils/surf-call-logic.ts`.
 * Adding a new beach-field read in either path without extending this list
 * silently degrades the canonicalized beach to `undefined` for that field,
 * which can flip a verdict in production while leaving every test green.
 * If you add a read, add the field here and to every caller's beach projection.
 */
function canonicalizeBeachForSurfCall(beach: Beach): Beach {
  const b = beach as unknown as Record<string, unknown>;
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    lat: b.lat ?? null,
    lon: b.lon ?? null,
    city: b.city ?? null,
    state: b.state ?? null,
    country: b.country ?? null,
    region: b.region ?? null,
    timezone: b.timezone ?? null,
    break_type: b.break_type ?? null,
    skill_level: b.skill_level ?? null,
    cdip_station: b.cdip_station ?? null,
    cdip_eligible: b.cdip_eligible ?? null,
    wind_offshore_deg: b.wind_offshore_deg ?? null,
    wind_offshore_tol_deg: b.wind_offshore_tol_deg ?? null,
    wind_cross_shore_ok_kt: b.wind_cross_shore_ok_kt ?? null,
    wind_onshore_bad_kt: b.wind_onshore_bad_kt ?? null,
    max_wind_onshore_mph: b.max_wind_onshore_mph ?? null,
    max_wind_any_mph: b.max_wind_any_mph ?? null,
    swell_window_min_deg: b.swell_window_min_deg ?? null,
    swell_window_max_deg: b.swell_window_max_deg ?? null,
    swell_window_center_deg: b.swell_window_center_deg ?? null,
    swell_window_halfwidth_deg: b.swell_window_halfwidth_deg ?? null,
    swell_access_factors: b.swell_access_factors ?? null,
    wind_exposure_factors: b.wind_exposure_factors ?? null,
    shoaling_factors: b.shoaling_factors ?? null,
    preferred_tide_direction: b.preferred_tide_direction ?? null,
    preferred_tide_ft_min: b.preferred_tide_ft_min ?? null,
    preferred_tide_ft_max: b.preferred_tide_ft_max ?? null,
    tide_direction_sensitivity: b.tide_direction_sensitivity ?? null,
    preference_model: b.preference_model ?? null,
    features: b.features ?? null,
    hazards: b.hazards ?? null,
    average_rating: b.average_rating ?? null,
    review_count: b.review_count ?? null,
  } as unknown as Beach;
}

function toPublicForecastHour(forecast: EnhancedForecastEntity): PublicForecastHour {
  return Object.fromEntries(
    PUBLIC_FORECAST_HOUR_FIELDS.map(field => [field, forecast[field] ?? null]),
  ) as PublicForecastHour;
}

/**
 * Cached surf report computation.
 *
 * Cache duration: 900s (15 minutes). Rationale:
 * - Forecast data (NOAA/NDBC) refreshes every 1–6 hours; 15 min is well
 *   within the freshness window while cutting DB load by ~95% on popular spots.
 * - Public spot pages can be force-dynamic for unrelated data, so without
 *   this cache every page load would re-fetch forecasts + run window selection.
 * - "Updated" timestamp shown in the UI reflects computation time, not page
 *   serve time, so users see how recent the call actually is.
 * - 15 min is short enough that a surf report won't feel stale before/during
 *   a session, but long enough to survive traffic spikes on popular spots.
 *
 * Cache is keyed by the beach id and canonical beach fields so all public
 * callers share the same anonymous report.
 */
const getCachedSurfReport = unstable_cache(
  async (
    beachId: string,
    beach: Beach,
  ): Promise<CachedSpotSurfReportResult | null> => {
    // 1. Determine beach timezone
    const beachTz = beach.lat != null && beach.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : DEFAULT_TIMEZONE;

    // 2. Determine "today" and "tomorrow" in beach timezone
    const now = new Date();
    const todayStr = formatDateInTimezone(now, beachTz);
    const tomorrow = new Date(now.getTime() + 86_400_000);
    const tomorrowStr = formatDateInTimezone(tomorrow, beachTz);

    // 2.5. Fetch sun times for sunset capping
    const sunTimesCache = await getBatchSunTimes([beachId], [todayStr, tomorrowStr]);

    // 3. Query enhanced_forecasts directly with timezone-aware dates
    const dayAfterTomorrow = new Date(new Date(tomorrowStr + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
    const supabase = await createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from('enhanced_forecasts')
      .select('*')
      .eq('beach_id', beachId)
      .gte('forecast_at', `${todayStr}T00:00:00Z`)
      .lt('forecast_at', `${dayAfterTomorrow}T00:00:00Z`)
      .order('forecast_at', { ascending: true })
      .limit(48);

    if (error) {
      console.error('[getCachedSurfReport] Database error:', {
        beachId,
        message: error.message,
        code: error.code,
      });
      return {
        report: buildReport(null, [], beach, {}),
        isTomorrow: false,
        forecastContext: null,
        hourlyForecasts: [],
        hourlyForecastDay: 'today',
      };
    }

    if (!data || data.length === 0) {
      return {
        report: buildReport(null, [], beach, {}),
        isTomorrow: false,
        forecastContext: null,
        hourlyForecasts: [],
        hourlyForecastDay: 'today',
      };
    }

    const forecasts = await applyV51DisplayOverrideToForecasts(
      data as EnhancedForecastEntity[],
      { enabled: true },
    );

    // 4. Filter to today first; fall back to tomorrow if no viable window today
    const todayForecasts = forecasts.filter(f => extractForecastDate(f.forecast_at, beachTz) === todayStr);
    const tomorrowForecasts = forecasts.filter(f => extractForecastDate(f.forecast_at, beachTz) === tomorrowStr);
    const hasTodayForecasts = todayForecasts.length > 0;
    const publicHourlyForecasts = hasTodayForecasts ? todayForecasts : tomorrowForecasts;
    const hourlyForecastDay: PublicForecastDay = hasTodayForecasts ? 'today' : 'tomorrow';
    // Try today's forecasts first
    if (todayForecasts.length > 0) {
      const headline = resolveTodayHeadline({
        forecasts: todayForecasts,
        beach,
        userPrefs: null,
        horizonHours: 24,
        sunTimesCache,
        rideabilityBand: null,
        userSkillLevel: null,
      });

      if (headline) {
        const forecastContext = buildForecastRecommendationContext({
          beach,
          forecasts: todayForecasts,
          window: headline.window,
          timezone: beachTz,
        });
        delete headline.window.sourceForecast;
        return {
          report: buildReport(headline.window, todayForecasts, beach, { isTomorrow: false }),
          isTomorrow: false,
          forecastContext,
          hourlyForecasts: publicHourlyForecasts.map(toPublicForecastHour),
          hourlyForecastDay,
        };
      }
    }

    // Fall back to tomorrow if today has no viable window (or no data)
    if (tomorrowForecasts.length > 0) {
      const headline = resolveTodayHeadline({
        forecasts: tomorrowForecasts,
        beach,
        userPrefs: null,
        horizonHours: 48,
        sunTimesCache,
        rideabilityBand: null,
        userSkillLevel: null,
      });

      if (headline) {
        const forecastContext = buildForecastRecommendationContext({
          beach,
          forecasts: tomorrowForecasts,
          window: headline.window,
          timezone: beachTz,
        });
        delete headline.window.sourceForecast;
        return {
          report: buildReport(headline.window, tomorrowForecasts, beach, { isTomorrow: true }),
          isTomorrow: true,
          forecastContext,
          hourlyForecasts: publicHourlyForecasts.map(toPublicForecastHour),
          hourlyForecastDay,
        };
      }
      return {
        report: buildReport(null, tomorrowForecasts, beach, { isTomorrow: true }),
        isTomorrow: true,
        forecastContext: buildForecastRecommendationContext({
          beach,
          forecasts: tomorrowForecasts,
          window: null,
          timezone: beachTz,
        }),
        hourlyForecasts: publicHourlyForecasts.map(toPublicForecastHour),
        hourlyForecastDay,
      };
    }

    // Keep today's physical forecast crawlable even when no recommendation window exists.
    if (todayForecasts.length > 0) {
      return {
        report: buildReport(null, todayForecasts, beach, { isTomorrow: false }),
        isTomorrow: false,
        forecastContext: buildForecastRecommendationContext({
          beach,
          forecasts: todayForecasts,
          window: null,
          timezone: beachTz,
        }),
        hourlyForecasts: publicHourlyForecasts.map(toPublicForecastHour),
        hourlyForecastDay,
      };
    }

    // No forecast data for either day
    return {
      report: buildReport(null, [], beach, {}),
      isTomorrow: false,
      forecastContext: null,
      hourlyForecasts: [],
      hourlyForecastDay: 'today',
    };
  },
  ['spot-surf-report'],
  { revalidate: 900 } // 15-minute cache
);
