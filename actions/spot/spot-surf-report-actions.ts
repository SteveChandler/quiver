"use server";

import { unstable_cache } from 'next/cache';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Beach } from '@/types/database';
import type { Database } from '@/types/supabase';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { computeSurfCall, computeSurfCallTiers, type SurfCallResult } from '@/lib/utils/surf-call-logic';
import { getTimezoneFromCoords } from '@/lib/utils/timezone-utils.server';
import { DEFAULT_TIMEZONE } from '@/lib/utils/timezone-constants';
import { formatDateInTimezone } from '@/lib/utils/date-time';
import { extractForecastDate } from '@/lib/utils/forecast-at-adapter';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getBatchSunTimes } from '@/lib/services/discovery';
import { getUserSurfPreferences, type UserSurfPreferences } from '@/lib/services/preference-learning-service';
import { checkBoardFit, checkSkillCeiling, checkSkillFloor } from '@/lib/domains/scoring/discovery-adapter';
import type { BoardClass, SkillLevel } from '@/lib/domains/user-preferences';
import { getRideabilityBand, resolveVerdictSkill, type ResolvedVerdictSkill } from '@/lib/domains/rideability';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import {
  buildForecastRecommendationContext,
  type ForecastRecommendationContext,
} from '@/lib/services/forecast-recommendation-context';
import { applyV51DisplayOverrideToForecasts } from '@/lib/services/forecast/v5-display-gate';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';
import { resolveTodayHeadline } from '@/lib/services/forecast/today-headline';

export interface SpotSurfReportResult {
  report: SurfCallResult;
  isTomorrow: boolean;
  forecastContext: ForecastRecommendationContext | null;
}

export interface SpotSurfReportAuthContext {
  user: User;
  supabase: SupabaseClient<Database>;
}

interface BuildReportOptions {
  isTomorrow?: boolean;
  boardNote?: string | null;
}

/**
 * Wrap `computeSurfCall` to also attach the per-skill tier verdict ladder and
 * the viewer's parsed skill level. The wrapper exists so the five return-sites
 * in `getCachedSurfReport` stay terse.
 */
function buildReport(
  window: PersonalizedForecastWindow | null,
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  options: BuildReportOptions,
  resolvedSkill: ResolvedVerdictSkill | null,
): SurfCallResult {
  const surfCallOptions = { isTomorrow: options.isTomorrow };
  const baseline = computeSurfCall(window, forecasts, beach, surfCallOptions);
  const tiers = computeSurfCallTiers(window, forecasts, beach, surfCallOptions);
  const whySentence = options.boardNote
    ? appendBoardNote(baseline.whySentence, options.boardNote)
    : baseline.whySentence;

  return {
    ...baseline,
    whySentence,
    score: clampScore(baseline.score),
    tiers,
    userTier: resolvedSkill?.skill ?? null,
    skillSource: resolvedSkill?.source ?? null,
  };
}

function appendBoardNote(whySentence: string, boardNote: string): string {
  const sentence = `Board fit: ${boardNote}.`;
  if (!whySentence) return sentence;
  return `${whySentence} ${sentence}`;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate a stable cache key segment from user preferences.
 * This ensures consistent serialization for cache key generation.
 */
function getPrefsKey(prefs: UserSurfPreferences | null): string {
  if (!prefs) return 'default';
  // Include wave range and confidence - the key factors affecting surf verdicts
  return `${prefs.wave_min_ft ?? 0}-${prefs.wave_max_ft ?? 99}-${prefs.max_wind_mph ?? 99}-${Math.round((prefs.confidence ?? 0) * 100)}`;
}

/**
 * Get today's (or tomorrow's) surf report for a beach.
 *
 * Cached for 15 minutes via unstable_cache to avoid redundant DB hits
 * on a force-dynamic page. Returns null on any error so the UI gracefully
 * degrades (no card rendered).
 *
 * Cache is keyed per-user so authenticated users get personalized verdicts
 * based on their learned surf preferences.
 */
/**
 * Cookie-free surf report for ISR/SSG beach pages.
 *
 * Uses the service-role client directly (no cookies()) so Next.js can honour
 * the page-level `revalidate = 3600` export without being forced into dynamic
 * rendering.  Returns the anonymous-user report — personalisation happens
 * client-side inside BeachDetailClient after hydration.
 *
 * Keep `getSpotSurfReport` for authenticated/personalised callers.
 */
export async function getSpotSurfReportPublic(beach: Beach): Promise<SpotSurfReportResult | null> {
  if (!beach.id) return null;

  try {
    return await getCachedSurfReport(
      beach.id,
      canonicalizeBeachForSurfCall(beach),
      'anonymous',
      'default',
      null,
      null,
      null
    );
  } catch (error) {
    console.error('[getSpotSurfReportPublic] Error:', {
      beachId: beach.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

export async function getSpotSurfReport(
  beach: Beach,
  boardClass?: BoardClass | null,
  authContext?: SpotSurfReportAuthContext
): Promise<SpotSurfReportResult | null> {
  if (!beach.id) return null;

  try {
    const supabase = authContext?.supabase ?? await createSupabaseServerClient();
    const user = authContext?.user ?? (await supabase.auth.getUser()).data.user;

    // 'anonymous' key allows sharing cache across unauthenticated users
    const userId = user?.id ?? 'anonymous';

    // Fetch user preferences (null for anonymous users)
    // Gracefully degrade to default scoring if preference fetch fails
    let userPrefs: UserSurfPreferences | null = null;
    if (user) {
      try {
        userPrefs = await getUserSurfPreferences(user.id);
      } catch (prefError) {
        console.warn('[getSpotSurfReport] Preference fetch failed, using defaults:', {
          userId: user.id,
          message: prefError instanceof Error ? prefError.message : 'Unknown error',
        });
        // Continue with null prefs - user still gets a report, just not personalized
      }
    }

    const userSkillLevel = await getProfileExperienceLevel(supabase, user?.id);

    // Generate stable preference key for cache (avoids object serialization issues)
    const prefsKey = getPrefsKey(userPrefs);

    return await getCachedSurfReport(
      beach.id,
      canonicalizeBeachForSurfCall(beach),
      userId,
      prefsKey,
      boardClass ?? null,
      userPrefs,
      userSkillLevel
    );
  } catch (error) {
    console.error('[getSpotSurfReport] Error:', {
      beachId: beach.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

interface PreferenceAdjustmentResult {
  window: PersonalizedForecastWindow;
  boardNote: string | null;
}

/**
 * Apply skill-ceiling adjustment to a window's score.
 * Returns a new window object with the adjusted score, or the original if no adjustment applies.
 *
 * Safety-first: if waves exceed the user's skill level, that penalty is applied.
 */
function applyPreferenceAdjustments(
  window: PersonalizedForecastWindow,
  resolvedSkill: ResolvedVerdictSkill | null,
  boardClass: BoardClass | null
): PreferenceAdjustmentResult {
  const waveHeight = parseFloat(window.waveHeight || '0');
  let adjustedWindow = window;

  if (resolvedSkill) {
    const skillResult = checkSkillCeiling(waveHeight, resolvedSkill.skill);
    if (skillResult.penalty > 0) {
      adjustedWindow = {
        ...adjustedWindow,
        score: clampScore((adjustedWindow.score ?? 0) - skillResult.penalty),
      };
    } else {
      const floorResult = checkSkillFloor(waveHeight, resolvedSkill.skill);
      if (floorResult.penalty > 0) {
        adjustedWindow = {
          ...adjustedWindow,
          score: clampScore((adjustedWindow.score ?? 0) - floorResult.penalty),
        };
      }
    }
  }

  if (!boardClass || !resolvedSkill) {
    return { window: adjustedWindow, boardNote: null };
  }

  const boardFit = checkBoardFit(
    waveHeight,
    resolvedSkill.skill,
    boardClass
  );
  const boardAdjustment = boardFit.bonus - boardFit.penalty;
  if (boardAdjustment !== 0) {
    adjustedWindow = {
      ...adjustedWindow,
      score: clampScore((adjustedWindow.score ?? 0) + boardAdjustment),
    };
  }

  return { window: adjustedWindow, boardNote: boardFit.note };
}

/**
 * Canonicalize a beach to the stable subset that surf-call computation
 * actually reads. Without this, `unstable_cache` would hash the entire beach
 * object — and since the API route (home hero) selected a narrow column list
 * while the SSR loader (detail page) passed a fuller beach, the two callers
 * produced different cache keys for the same beach and could see divergent
 * verdicts at the same minute (the "MAYBE on home, NO on detail" bug
 * Steven reported 2026-04-27). Both callers now route through this
 * canonicalizer before reaching the cached function, so cache keys converge.
 *
 * IMPORTANT: the field set below MUST mirror every `beach.*` read inside
 * `lib/services/discovery/window-selector/*` and `lib/utils/surf-call-logic.ts`.
 * Adding a new beach-field read in either path without extending this list
 * silently degrades the canonicalized beach to `undefined` for that field,
 * which can flip a verdict in production while leaving every test green.
 * If you add a read, add the column here and to the SQL select in
 * `app/api/surf/call/route.ts`.
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
    swell_window_center_deg: b.swell_window_center_deg ?? null,
    swell_window_halfwidth_deg: b.swell_window_halfwidth_deg ?? null,
    swell_access_factors: b.swell_access_factors ?? null,
    wind_exposure_factors: b.wind_exposure_factors ?? null,
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

/**
 * Cached surf report computation.
 *
 * Cache duration: 900s (15 minutes). Rationale:
 * - Forecast data (NOAA/NDBC) refreshes every 1–6 hours; 15 min is well
 *   within the freshness window while cutting DB load by ~95% on popular spots.
 * - The parent page is force-dynamic (cookie access), so without this cache
 *   every page load would re-fetch forecasts + run window selection.
 * - "Updated" timestamp shown in the UI reflects computation time, not page
 *   serve time, so users see how recent the call actually is.
 * - 15 min is short enough that a surf report won't feel stale before/during
 *   a session, but long enough to survive traffic spikes on popular spots.
 *
 * Cache is keyed by (beachId, userId, prefsKey, boardClass) so each user gets
 * personalized results based on their surf preferences and board-aware calls.
 * The prefsKey is a stable string derived from preference values to ensure
 * consistent cache key generation.
 */
const getCachedSurfReport = unstable_cache(
  async (
    beachId: string,
    beach: Beach,
    userId: string,
    prefsKey: string,
    boardClass: BoardClass | null,
    userPrefs: UserSurfPreferences | null,
    userSkillLevel: SkillLevel | null
  ): Promise<SpotSurfReportResult | null> => {
    const resolvedSkillForBoard = boardClass
      ? resolveVerdictSkill(userSkillLevel, boardClass)
      : null;
    const resolvedSkill = userId === 'anonymous' && !boardClass
      ? null
      : resolvedSkillForBoard ?? resolveVerdictSkill(userSkillLevel, null);

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
        report: buildReport(null, [], beach, {}, resolvedSkill),
        isTomorrow: false,
        forecastContext: null,
      };
    }

    if (!data || data.length === 0) {
      return {
        report: buildReport(null, [], beach, {}, resolvedSkill),
        isTomorrow: false,
        forecastContext: null,
      };
    }

    const forecasts = await applyV51DisplayOverrideToForecasts(
      data as EnhancedForecastEntity[],
      { enabled: true },
    );

    // 4. Filter to today first; fall back to tomorrow if no viable window today
    const todayForecasts = forecasts.filter(f => extractForecastDate(f.forecast_at, beachTz) === todayStr);
    const tomorrowForecasts = forecasts.filter(f => extractForecastDate(f.forecast_at, beachTz) === tomorrowStr);
    const rideabilityBand = boardClass
      ? getRideabilityBand(resolvedSkillForBoard!.skill, boardClass)
      : null;

    // Try today's forecasts first
    if (todayForecasts.length > 0) {
      const headline = resolveTodayHeadline({
        forecasts: todayForecasts,
        beach,
        userPrefs,
        horizonHours: 24,
        sunTimesCache,
        rideabilityBand,
        userSkillLevel,
      });

      if (headline) {
        const {
          window: adjustedWindow,
          boardNote,
        } = applyPreferenceAdjustments(headline.window, resolvedSkill, boardClass);
        const forecastContext = buildForecastRecommendationContext({
          beach,
          forecasts: todayForecasts,
          window: adjustedWindow,
          timezone: beachTz,
        });
        delete adjustedWindow.sourceForecast;
        return {
          report: buildReport(adjustedWindow, todayForecasts, beach, { isTomorrow: false, boardNote }, resolvedSkill),
          isTomorrow: false,
          forecastContext,
        };
      }
    }

    // Fall back to tomorrow if today has no viable window (or no data)
    if (tomorrowForecasts.length > 0) {
      const headline = resolveTodayHeadline({
        forecasts: tomorrowForecasts,
        beach,
        userPrefs,
        horizonHours: 48,
        sunTimesCache,
        rideabilityBand,
        userSkillLevel,
      });

      if (headline) {
        const {
          window: adjustedWindow,
          boardNote,
        } = applyPreferenceAdjustments(headline.window, resolvedSkill, boardClass);
        const forecastContext = buildForecastRecommendationContext({
          beach,
          forecasts: tomorrowForecasts,
          window: adjustedWindow,
          timezone: beachTz,
        });
        delete adjustedWindow.sourceForecast;
        return {
          report: buildReport(adjustedWindow, tomorrowForecasts, beach, { isTomorrow: true, boardNote }, resolvedSkill),
          isTomorrow: true,
          forecastContext,
        };
      }
      return {
        report: buildReport(null, tomorrowForecasts, beach, { isTomorrow: true }, resolvedSkill),
        isTomorrow: true,
        forecastContext: buildForecastRecommendationContext({
          beach,
          forecasts: tomorrowForecasts,
          window: null,
          timezone: beachTz,
        }),
      };
    }

    // No forecast data for either day
    return {
      report: buildReport(null, [], beach, {}, resolvedSkill),
      isTomorrow: false,
      forecastContext: null,
    };
  },
  ['spot-surf-report'],
  { revalidate: 900 } // 15-minute cache
);
