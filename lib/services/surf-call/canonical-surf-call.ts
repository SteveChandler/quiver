import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { SpotSurfReportResult } from '@/lib/services/spot-surf-report-service';
import type { Beach } from '@/types/database';
import { applyForceVerdict } from '@/lib/utils/dev-force-verdict';
import { entitlementFromRow } from '@/lib/alerts/entitlements';
import { getProfileExperienceLevel } from '@/lib/profile/skill-level';
import { resolveCanonicalSessionDecisionContext } from '@/lib/recommendations/canonical-decision';
import { conditionLabelForVerdict } from '@/lib/recommendations/canonical-decision/engine';
import type { CanonicalSessionDecision } from '@/lib/recommendations/canonical-decision/types';
import type { SurfDiscoveryRecommendation, SurfDiscoveryResponse } from '@/types/personalization';
import { buildForecastRecommendationContext } from '@/lib/services/forecast-recommendation-context';
import {
  computeSurfCall,
  computeSurfCallTiers,
} from '@/lib/utils/surf-call-logic';
import { isFutureDayInTimezone } from '@/lib/utils/condition-tier-utils';
import { checkBoardFit } from '@/lib/domains/scoring/discovery-adapter';
import type { BoardClass, SkillLevel } from '@/lib/domains/user-preferences';
import type { RecommendationAvailability } from '@/lib/recommendations/major-event-hold/types';
import { resolveWaterQualityHolds, type WaterQualityHoldResolution } from '@/lib/recommendations/major-event-hold/water-quality';
import { resolveScopedRecommendationAvailability } from '@/lib/services/discovery/discovery-availability';
import { loadNowRecommendation } from '@/lib/services/discovery/now-recommendation';
import {
  FORECAST_ALIGNMENT_TOLERANCE_MINUTES,
  resolveForecastAlignment,
  type SurfCallForecastAlignment,
} from '@/lib/services/discovery/forecast-alignment';

type CanonicalSurfCallResponse = SpotSurfReportResult & {
  waterQuality: SurfCallWaterQuality;
  sessionDecision: CanonicalSessionDecision;
  candidateRejection: CanonicalSessionDecision['candidateRejection'];
  forecastAlignment?: SurfCallForecastAlignment;
  recommendedBoard?: SurfDiscoveryRecommendation["recommendedBoard"];
  boardPick?: SurfDiscoveryRecommendation["boardPick"];
  conditionLabel?: CanonicalSessionDecision["conditionLabel"];
  /** Public forecast window retained separately when no personalized window was selected. */
  objectiveWindow?: { start: string; end: string } | null;
  firstLight?: string;
  lastLight?: string;
  isDark?: boolean;
  nextWindowStart?: string;
  daylightAvailability?: SurfDiscoveryResponse['daylightAvailability'];
  /**
   * The beach's now-mode discovery recommendation, present only when the
   * request asked for it with `includeNow=1`. It is the same object
   * `/api/surf/discover?mode=now` returns for this beach, so a client that
   * labels spots from now-mode discovery on one screen and grades "now" from
   * the surf call on another reads one producer. `null` when the current
   * window is closed, the beach is held or ineligible, the entitlement gate
   * withholds recommendations, or the now-mode discovery failed; the surf
   * call itself is unaffected by any of those.
   */
  nowRecommendation?: SurfDiscoveryRecommendation | null;
};


type SurfCallWaterQuality = {
  status: 'advisory' | 'closure' | 'hold';
  source: 'county' | 'sample' | 'hold';
  countyKind?: 'general' | 'site';
  checkedAt?: string;
  sampleDate?: string;
  rainAdvisory?: { startedAt: string; lastRainAt: string | null; expiresAt: string };
} | null;

function surfCallWaterQuality(
  resolution: WaterQualityHoldResolution,
  beachId: string,
): SurfCallWaterQuality {
  beachId = beachId.toLowerCase();
  if (resolution.state !== 'resolved' || !resolution.heldBeachIds.includes(beachId)) return null;
  const evidence = resolution.waterQualityEvidenceByBeachId?.[beachId];
  const status = resolution.waterQualityStatusByBeachId[beachId] ?? 'hold';
  if (evidence?.source === 'county') return { status, source: 'county',
    ...(evidence.countyKind ? { countyKind: evidence.countyKind } : {}),
    ...(evidence.countyKind === 'general' && evidence.rainAdvisory ? { rainAdvisory: evidence.rainAdvisory } : {}),
    ...(evidence.checkedAt ? { checkedAt: evidence.checkedAt } : {}) };
  if (evidence?.source === 'sample') return { status, source: 'sample',
    ...(evidence.sampleDate ? { sampleDate: evidence.sampleDate } : {}) };
  return { status, source: 'hold' };
}


type RecommendationGateBeach = Beach & {
  recommendation_eligible?: boolean;
  preference_model?: unknown;
};

function applyRecommendationEligibilityGate(
  result: CanonicalSurfCallResponse,
  beach: RecommendationGateBeach,
): CanonicalSurfCallResponse {
  if (beach.recommendation_eligible !== false) return result;

  const preferenceModel =
    beach.preference_model &&
    typeof beach.preference_model === 'object' &&
    !Array.isArray(beach.preference_model)
      ? beach.preference_model as Record<string, unknown>
      : null;
  const reason =
    typeof preferenceModel?.eligibility_reason === 'string'
      ? preferenceModel.eligibility_reason
      : 'This spot is available for forecast reference but is not eligible for a positive surf recommendation.';
  const holdEpoch = `recommendation-ineligible:${beach.id}`;
  const recommendationAvailability: RecommendationAvailability = {
    state: 'available',
    holdEpoch,
  };
  // The label follows the forced verdict, so no field reads GOOD beside a NO.
  const conditionLabel = conditionLabelForVerdict('no', 0);

  return {
    ...result,
    conditionLabel,
    candidateRejection: null,
    isTomorrow: false,
    forecastContext: null,
    ...(result.nowRecommendation !== undefined ? { nowRecommendation: null } : {}),
    report: {
      ...result.report,
      verdict: 'NO',
      bestWindowStart: null,
      bestWindowEnd: null,
      windowMinutes: null,
      shortWindow: false,
      whySentence: reason,
      score: null,
      peakTime: null,
      tiers: null,
      recommendationAvailability,
    },
    sessionDecision: {
      ...result.sessionDecision,
      verdict: 'no',
      conditionLabel,
      decisionBasis: 'safety_override',
      decisionBasisV2: 'safety_override',
      reasonCode: 'invalid_candidate',
      candidateRejection: null,
      selection: null,
      skillEligibility: {
        ...result.sessionDecision.skillEligibility,
        state: 'ineligible',
        reasonCodes: ['invalid_candidate'],
      },
      holdEpoch,
    },
  };
}

async function readForecastAlignment(
  supabase: SupabaseClient<Database>,
  beachId: string,
  requestedForecastAt: string,
): Promise<SurfCallForecastAlignment> {
  const requestedMs = Date.parse(requestedForecastAt);
  const toleranceMs = FORECAST_ALIGNMENT_TOLERANCE_MINUTES * 60 * 1000;
  const { data, error } = await supabase
    .from('enhanced_forecasts')
    .select('forecast_at')
    .eq('beach_id', beachId)
    .gte('forecast_at', new Date(requestedMs - toleranceMs).toISOString())
    .lte('forecast_at', new Date(requestedMs + toleranceMs).toISOString())
    .order('forecast_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return resolveForecastAlignment(
    data ?? [],
    requestedForecastAt,
  ).alignment;
}

function appendBoardNote(whySentence: string, boardNote: string | null): string {
  if (!boardNote) return whySentence;
  const sentence = `Board fit: ${boardNote}.`;
  return whySentence ? `${whySentence} ${sentence}` : sentence;
}

function safetyReason(decision: CanonicalSessionDecision, beachName: string): string {
  const rejection = decision.candidateRejection;
  const waterQualityReason = rejection?.observed?.status === 'advisory'
    ? `Water quality is under an advisory at ${beachName}; an open status is required.`
    : rejection?.observed?.status === 'closure' || decision.reasonCode === 'water_quality_closure'
      ? `Water quality is closed at ${beachName}; an open status is required.`
      : `Water quality is on hold at ${beachName}; an open status is required.`;
  if (decision.reasonCode === 'no_candidates' && rejection) {
    switch (rejection.gate) {
      case 'forecast_rows':
        return `Forecast data for ${beachName} is not available yet.`;
      case 'past_forecast':
        return `No future forecast hours are available for ${beachName}.`;
      case 'forecast_alignment':
        return `No forecast row for ${beachName} matches the requested hour.`;
      case 'daylight':
        return `No forecast hours for ${beachName} fall in daylight within the requested horizon.`;
      case 'horizon':
        return `The next forecast hour for ${beachName} is ${Math.round(rejection.observed?.hoursAhead ?? 0)} hours ahead, beyond the ${rejection.allowed?.maximumHoursAhead ?? 24}-hour horizon.`;
      case 'score_floor':
        return `Forecast score ${rejection.observed?.score ?? 'unknown'} for ${beachName} is below the window threshold of ${rejection.allowed?.minimumScore ?? 'unknown'}.`;
      case 'session_duration':
        return `The ${rejection.observed?.durationHours?.toFixed(1) ?? 'available'}-hour window for ${beachName} is shorter than the ${rejection.allowed?.minimumDurationHours ?? 1}-hour minimum.`;
      case 'window_selection':
        return `No forecast window for ${beachName} passed window selection.`;
      case 'water_quality_hold':
        return waterQualityReason;
      case 'candidate_pool':
        return rejection.detail === 'Beach location unavailable'
          ? `Location data for ${beachName} is unavailable.`
          : `${beachName} was not available in the forecast candidate pool.`;
      case 'time_slot':
        return `No forecast hours for ${beachName} match the requested time slot.`;
      case 'skill_gate':
        return `No window for ${beachName} passed the recommendation skill gate.`;
      case 'saved_spot_eligibility':
        return `No saved-spot window for ${beachName} met the recommendation threshold.`;
      case 'ranking':
        return `${beachName} did not remain in the ranked candidates.`;
    }
  }
  switch (decision.reasonCode) {
    case 'water_quality_closure':
      return waterQualityReason;
    case 'major_event_hold':
      return 'Major-event conditions are unresolved.';
    case 'beach_skill_exceeds_user':
      return `This break requires ${rejection?.observed?.skill ?? 'a higher skill level'}; your profile is ${rejection?.allowed?.skill ?? decision.skillEligibility.skill}.`;
    case 'wave_height_exceeds_skill':
      if (rejection?.observed?.waveHeightFt !== undefined && rejection.allowed?.minimumWaveHeightFt !== undefined && rejection.allowed.maximumWaveHeightFt !== undefined) {
        const observed = `${rejection.observed.waveHeightFt} ft`;
        const range = `${rejection.allowed.minimumWaveHeightFt}-${rejection.allowed.maximumWaveHeightFt} ft`;
        const appliedSkill = rejection.allowed.skill ?? 'profile';
        return decision.skillEligibility?.skill === 'unknown'
          ? `Forecast ${observed} exceeds the ${appliedSkill} safety range of ${range} applied when skill is unknown.`
          : `Forecast ${observed} exceeds the ${appliedSkill} safety range of ${range}.`;
      }
      return 'Forecast wave height exceeds your profile range.';
    case 'missing_beach_skill':
    case 'missing_wave_height':
    case 'unknown_skill':
    case 'invalid_candidate':
    case 'hold_state_unavailable':
      return 'Forecast or profile data is incomplete.';
    case 'no_candidates':
      return `No personalized forecast window was available for ${beachName}.`;
    default:
      return 'No personalized forecast window is available.';
  }
}

function buildCanonicalSurfCall(
  decision: CanonicalSessionDecision,
  requestedBeachId: string,
  recommendations: SurfDiscoveryRecommendation[],
  beach: Beach,
  now: Date,
  profileExperience: SkillLevel | null,
  boardClass: BoardClass | null,
  recommendationAvailability: RecommendationAvailability,
): Omit<CanonicalSurfCallResponse, 'waterQuality'> {
  const selection = decision.selection;
  const selectedRecommendation = selection
    ? recommendations.find(
        (recommendation) =>
          recommendation.recommendationId === selection.candidateId &&
          recommendation.beach.id === requestedBeachId,
      ) ?? null
    : null;
  const objectiveRecommendation =
    selectedRecommendation ??
    recommendations.find(
      (recommendation) => recommendation.beach.id === requestedBeachId,
    ) ??
    null;
  const window = objectiveRecommendation?.window ?? null;
  const forecasts = objectiveRecommendation
    ? [objectiveRecommendation.forecast]
    : [];
  const timezone = window?.timezone ?? beach.timezone ?? 'UTC';
  const isTomorrow = window
    ? isFutureDayInTimezone(window.start, timezone)
    : false;
  const reportVerdict =
    decision.verdict === 'go'
      ? 'YES' as const
      : decision.verdict === 'maybe'
        ? 'MAYBE' as const
        : 'NO' as const;
  // The decision owns the verdict; the explanation and tiers are derived from
  // it, so no field describes a verdict the response does not carry.
  const baseline = computeSurfCall(
    window,
    forecasts,
    beach,
    { isTomorrow, verdict: reportVerdict },
  );
  const exactSelection =
    selection !== null &&
    selectedRecommendation !== null &&
    selection.beachId === requestedBeachId;
  // One snapshot of the window row. Its score is the window's own, distinct
  // from report.score, which is the decision's score.
  const forecastContext = exactSelection && window
    ? buildForecastRecommendationContext({
        beach,
        forecasts,
        window,
        now,
        timezone,
      })
    : null;
  const boardNote =
    exactSelection && window && profileExperience && boardClass
      ? checkBoardFit(
          Number.parseFloat(window.waveHeight),
          profileExperience,
          boardClass,
        ).note
      : null;
  const personalReasons =
    selection?.evidence.personalMatch?.reasons.join(' ') ?? '';
  const whySentence = appendBoardNote(
    decision.decisionBasis === 'safety_override'
      ? safetyReason(decision, beach.name)
      : personalReasons || baseline.whySentence,
    boardNote,
  );
  const report = {
    ...baseline,
    verdict: reportVerdict,
    bestWindowStart: exactSelection ? selection.windowStart : null,
    bestWindowEnd: exactSelection ? selection.windowEnd : null,
    windowMinutes: exactSelection ? baseline.windowMinutes : null,
    shortWindow: exactSelection ? baseline.shortWindow : false,
    whySentence,
    score: exactSelection ? selection.evidence.conditionScore : null,
    peakTime: exactSelection ? baseline.peakTime : null,
    tiers:
      decision.decisionBasis === 'physical_fallback' && window
        ? computeSurfCallTiers(window, forecasts, beach, {
            isTomorrow,
            verdict: reportVerdict,
            timezone,
          })
        : null,
    userTier: profileExperience,
    skillSource: profileExperience ? 'profile' as const : null,
    recommendationAvailability,
  };

  return {
    report,
    candidateRejection: decision.candidateRejection ?? null,
    objectiveWindow: !exactSelection && window
      ? { start: window.start.toISOString(), end: window.end.toISOString() }
      : null,
    recommendedBoard: objectiveRecommendation?.recommendedBoard ?? null,
    boardPick: objectiveRecommendation?.boardPick ?? null,
    conditionLabel: decision.conditionLabel,
    isTomorrow,
    forecastContext,
    sessionDecision: decision,
  };
}

type CanonicalSurfCallOutcome =
  | { status: 'ok'; result: CanonicalSurfCallResponse }
  | { status: 'not_found' }
  | { status: 'unavailable'; error: unknown };

/**
 * The surf call for one beach, as `/api/surf/call` returns it.
 *
 * `supabase` reads the beach, forecast alignment, profile and entitlement; the
 * profile and entitlement reads are scoped to `userId`, so a caller holding a
 * service-role client (the Garmin watch) gets the same call the user's own
 * session would. `userId: null` is the anonymous general call.
 */
export async function computeCanonicalSurfCall({
  supabase,
  userId,
  beachId,
  forecastAt,
  includeNow,
  boardClass,
  forceVerdict,
}: {
  supabase: SupabaseClient<Database>;
  userId: string | null;
  beachId: string;
  forecastAt?: string;
  includeNow?: boolean;
  boardClass: BoardClass | null;
  forceVerdict?: string | null;
}): Promise<CanonicalSurfCallOutcome> {
  // Narrow column list — only what discovery and computeSurfCall read. Skips
  // the heavy text/jsonb columns
  // (description, terrain_*, access_tips, geog, etc.) that the surf-call
  // chain doesn't touch but `select('*')` would otherwise pull on every
  // 5-min refetch from the native client.
  const { data: beach, error: beachError } = await supabase
    .from('beaches')
    .select(
      'id, name, slug, lat, lon, city, state, country, region, ' +
      'timezone, break_type, skill_level, cdip_station, cdip_eligible, ' +
      'recommendation_eligible, ' +
      'wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, ' +
      'wind_cross_shore_ok_kt, wind_onshore_bad_kt, ' +
      'max_wind_onshore_mph, max_wind_any_mph, ' +
      'swell_window_min_deg, swell_window_max_deg, ' +
      'swell_window_center_deg, swell_window_halfwidth_deg, ' +
      'swell_access_factors, wind_exposure_factors, ' +
      'shoaling_factors, ' +
      'preferred_tide_direction, preferred_tide_ft_min, ' +
      'preferred_tide_ft_max, tide_direction_sensitivity, preference_model, ' +
      'features, hazards, average_rating, review_count, deleted_at',
    )
    .eq('id', beachId)
    .is('deleted_at', null)
    .single();

  if (beachError || !beach) {
    return { status: 'not_found' };
  }
  const typedBeach = beach as unknown as RecommendationGateBeach;

  let profileExperience: SkillLevel | null = null;
  if (userId) {
    try {
      profileExperience = await getProfileExperienceLevel(supabase, userId);
    } catch {
      profileExperience = null;
    }
  }
  let isPro = false;
  if (userId) {
    const { data: entitlementRow } = await supabase
      .from('user_entitlements')
      .select('is_pro, is_trialing, billing_issue, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    isPro = entitlementFromRow(entitlementRow ?? null) === 'premium';
  }
  const anchor = new Date();
  const anchorTime = anchor.toISOString();
  const requestedForecastTime = forecastAt
    ? new Date(forecastAt)
    : null;
  const scopeStart = requestedForecastTime
    ? new Date(
        requestedForecastTime.getTime() -
          FORECAST_ALIGNMENT_TOLERANCE_MINUTES * 60 * 1000,
      )
    : anchor;
  const requestedScopeEndMs = requestedForecastTime
    ? requestedForecastTime.getTime() + 24 * 60 * 60 * 1000
    : 0;
  const scopeEnd = new Date(
    Math.max(
      anchor.getTime() + 24 * 60 * 60 * 1000,
      requestedScopeEndMs,
    ),
  );
  // Started alongside the canonical decision so the now call adds latency
  // only where it is slower than the best-window discovery it runs beside.
  const nowRecommendationPromise = includeNow && userId
    ? loadNowRecommendation({
        userId,
        beach: typedBeach,
        isPro,
        profileExperience,
        now: anchor,
      })
    : null;
  const waterQualityPromise = resolveWaterQualityHolds([{
    candidateId: `surf-call:${beachId}`,
    beachId,
    startsAt: scopeStart.toISOString(),
    endsAt: scopeEnd.toISOString(),
  }]).then((resolution) => surfCallWaterQuality(resolution, beachId))
    .catch((error: unknown) => {
      console.error('[surf-call:water-quality-error]', error);
      return null;
    });
  let canonicalContext;
  try {
    canonicalContext = await resolveCanonicalSessionDecisionContext({
      userId,
      profileExperience,
      anchorTime,
      candidateBeachIds: [beachId],
      scope: {
        kind: 'plan_next_session',
        windowStart: scopeStart.toISOString(),
        windowEnd: scopeEnd.toISOString(),
        timezone: typedBeach.timezone ?? 'UTC',
      },
      discoveryOptions: {
        userLocation:
          typedBeach.lat !== null && typedBeach.lon !== null
            ? { lat: typedBeach.lat, lon: typedBeach.lon }
            : undefined,
        horizonHours: 24,
        candidatePoolLimit: 1,
        ...(forecastAt ? { forecastAt } : {}),
        includeBeachIds: [beachId],
        allowRecommendationIneligibleIncludes: true,
        isPro,
        throwOnFailure: true,
      },
    });
  } catch (error) {
    return { status: 'unavailable', error };
  }
  const sessionDecision = canonicalContext.decision;
  const waterQuality = await waterQualityPromise;
  const recommendations = [
    ...canonicalContext.discovery.recommendations,
    ...(canonicalContext.discovery.includedRecommendations ?? []),
  ];
  const recommendationAvailability = resolveScopedRecommendationAvailability(
    canonicalContext.discovery,
    sessionDecision.holdEpoch,
  );
  const nowRecommendationResult = nowRecommendationPromise
    ? await nowRecommendationPromise
    : null;
  const canonicalResult: CanonicalSurfCallResponse = {
    firstLight: canonicalContext.discovery.firstLight,
    lastLight: canonicalContext.discovery.lastLight,
    isDark: canonicalContext.discovery.isDark,
    nextWindowStart: canonicalContext.discovery.nextWindowStart,
    ...buildCanonicalSurfCall(
      sessionDecision,
      beachId,
      recommendations,
      typedBeach,
      anchor,
      profileExperience,
      boardClass,
      recommendationAvailability,
    ),
    waterQuality,
    ...(nowRecommendationResult
      ? { nowRecommendation: nowRecommendationResult.recommendation }
      : {}),
    // A scoped call's availability describes its hour, like its isDark; now-mode's describes now.
    ...(!forecastAt && nowRecommendationResult?.daylightAvailability
      ? { daylightAvailability: nowRecommendationResult.daylightAvailability }
      : {}),
    ...(canonicalContext.discovery.daylightAvailability
      ? { daylightAvailability: canonicalContext.discovery.daylightAvailability }
      : {}),
  };
  const scopedCanonicalResult: CanonicalSurfCallResponse = forecastAt
    ? {
        ...canonicalResult,
        // A refined window peak is not the identity of its supporting forecast row.
        forecastContext: canonicalResult.forecastContext && sessionDecision.selection
          ? {
              ...canonicalResult.forecastContext,
              selectedRowTime: sessionDecision.selection.forecastRef.forecastAt,
            }
          : canonicalResult.forecastContext,
        forecastAlignment: await readForecastAlignment(
          supabase,
          beachId,
          forecastAt,
        ),
      }
    : canonicalResult;
  const forcedResult = applyForceVerdict(
    scopedCanonicalResult,
    forceVerdict ?? null,
    process.env.NODE_ENV !== 'production',
  ) as CanonicalSurfCallResponse;
  const result = applyRecommendationEligibilityGate(forcedResult, typedBeach);

  return { status: 'ok', result };
}
