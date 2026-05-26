import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BETA_ACCESS_NOT_ENABLED,
  BILLING_ISSUE_LOCKED,
  ENTITLEMENT_SYNCING,
  PERSONALIZATION_DISABLED,
  getPersonalizationEligibility,
  type PersonalizationEligibilityResult,
} from "@/lib/personalization/eligibility";
import {
  isAvoidanceLearnedMatchState,
  isLearnedMatchState,
  isStarterMatchState,
} from "@/lib/personalization/match-state-compat";

export const STARTER_MATCH_BODY =
  "This fits your stated preferences. We will get more personal as you rate sessions.";

const AVOIDANCE_BODY =
  "We know what you tend to avoid. Rate a few good sessions to sharpen your match.";

const DEGRADED_BODY =
  "Forecasts are still available. Retry personal match when you are ready.";

export type MatchState =
  | "locked"
  | "starter"
  | "learned"
  | "avoidance_learned"
  | "syncing"
  | "beta_not_enabled"
  | "degraded";

export type MatchQualityBand =
  | "locked"
  | "starter"
  | "mixed_signal"
  | "session_backed"
  | "dense_signal"
  | "degraded";

export type MatchSource =
  | "entitlement"
  | "testflight_bypass"
  | "profile_preferences"
  | "session_history";

export type MatchReasonType =
  | "starter_preferences"
  | "session_history"
  | "avoidance_learning"
  | "board_fit"
  | "condition_change"
  | "low_confidence"
  | "degraded"
  | "locked";

export interface MatchReasonFact {
  kind: string;
  value: string | number | boolean | null;
}

export interface MatchScoreForecastInput {
  beachId: string;
  waveHeight: string;
  wavePeriod: string;
  windSpeed: string;
  windDirection: string;
  tideHeight: string;
}

export interface MatchScoreResponse {
  state: MatchState;
  fit_label: string;
  reason_bullets: string[];
  session_count: number;
  sessions_needed: number;
  source: MatchSource;
  quality_band: MatchQualityBand;
  score: number | null;
  reason_type: MatchReasonType;
  reason_facts: MatchReasonFact[];
  latency_ms: number;
  body?: string;
  board_tip?: string | null;
  profile_kind?: string | null;
  lock_reason?: "free" | "billing_issue" | "disabled";
}

interface RawMatchScoreResult {
  state?: string;
  score?: number | null;
  label?: string | null;
  fit_label?: string | null;
  reason_bullets?: string[] | null;
  board_tip?: string | null;
  session_count?: number | null;
  sessions_needed?: number | null;
  sessions_in_profile?: number | null;
  profile_kind?: string | null;
  confidence?: string | null;
  reason?: string | null;
  aversion_sample_count?: number | null;
}

export interface ResolveMatchScoreStateInput {
  eligibilitySource: PersonalizationEligibilityResult["source"];
  forecast: MatchScoreForecastInput;
  rpcResult: RawMatchScoreResult;
}

type MatchScoreRpcClient = Pick<SupabaseClient, "rpc">;

function coerceCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hasDebugCopy(text: string): boolean {
  return /profile peak|raw score|confidence low/i.test(text);
}

function snapshotQualityFor(sessionCount: number): string {
  if (sessionCount <= 0) return "none";
  if (sessionCount < 5) return "sparse";
  if (sessionCount >= 15) return "dense";
  return "usable";
}

function signalBalanceFor(
  sessionCount: number,
  rpcResult: RawMatchScoreResult,
): string {
  if (sessionCount < 5) return "sparse";
  if (
    rpcResult.reason === "no_positive_sessions" ||
    rpcResult.profile_kind === "neutral" ||
    isAvoidanceLearnedMatchState(rpcResult.state)
  ) {
    return "avoidance";
  }

  const aversionCount = coerceCount(rpcResult.aversion_sample_count, 0);
  if (
    rpcResult.profile_kind === "two_sided" &&
    aversionCount >= Math.ceil(sessionCount / 2)
  ) {
    return "mixed";
  }

  return "positive";
}

function forecastFacts(forecast: MatchScoreForecastInput): MatchReasonFact[] {
  return [
    { kind: "wave_height", value: forecast.waveHeight },
    { kind: "wave_period", value: forecast.wavePeriod },
    { kind: "wind_speed", value: forecast.windSpeed },
    { kind: "wind_direction", value: forecast.windDirection },
    { kind: "tide_height", value: forecast.tideHeight },
  ];
}

function reasonFactsFor(
  forecast: MatchScoreForecastInput,
  sessionCount: number,
  sessionsNeeded: number,
  rpcResult: RawMatchScoreResult = {},
): MatchReasonFact[] {
  const facts: MatchReasonFact[] = [
    { kind: "session_count", value: sessionCount },
    { kind: "sessions_needed", value: sessionsNeeded },
    { kind: "snapshot_quality", value: snapshotQualityFor(sessionCount) },
    { kind: "signal_balance", value: signalBalanceFor(sessionCount, rpcResult) },
    ...forecastFacts(forecast),
  ];

  if (rpcResult.board_tip) {
    facts.push({ kind: "board_fit", value: rpcResult.board_tip });
  }
  if (rpcResult.profile_kind) {
    facts.push({ kind: "profile_kind", value: rpcResult.profile_kind });
  }
  if (typeof rpcResult.aversion_sample_count === "number") {
    facts.push({
      kind: "aversion_sample_count",
      value: rpcResult.aversion_sample_count,
    });
  }

  return facts;
}

function starterReasons(forecast: MatchScoreForecastInput): string[] {
  return [
    STARTER_MATCH_BODY,
    `Current window: ${forecast.waveHeight} ft, ${forecast.wavePeriod}s period, ${forecast.windSpeed} mph wind.`,
    "Rate sessions after you surf so Quiver can learn what works for you.",
  ];
}

function learnedReasons(
  rpcResult: RawMatchScoreResult,
  forecast: MatchScoreForecastInput,
  sessionCount: number,
): string[] {
  const clean = (rpcResult.reason_bullets ?? []).filter(
    (reason) => reason && !hasDebugCopy(reason),
  );
  const generated = [
    `This window sits around ${forecast.waveHeight} ft at ${forecast.wavePeriod}s with ${forecast.windSpeed} mph wind.`,
    rpcResult.board_tip
      ? `${rpcResult.board_tip} has worked for your better sessions in similar surf.`
      : `Tide near ${forecast.tideHeight} ft keeps this tied to the current window, not a generic beach score.`,
    "Keep rating sessions to sharpen the call.",
  ];

  if (rpcResult.confidence === "low" || sessionCount < 10) {
    return [
      `Early learned read: this uses ${sessionCount} rated sessions, so keep rating after you surf.`,
      ...clean,
      ...generated,
    ].slice(0, 3);
  }

  if (clean.length > 0) return clean;
  return generated;
}

function qualityBandFor(
  sessionCount: number,
  rpcResult: RawMatchScoreResult,
): MatchQualityBand {
  if (sessionCount < 5) return "starter";
  const aversionCount = coerceCount(rpcResult.aversion_sample_count, 0);
  if (
    rpcResult.reason === "no_positive_sessions" ||
    rpcResult.profile_kind === "neutral" ||
    aversionCount >= Math.ceil(sessionCount / 2)
  ) {
    return "mixed_signal";
  }
  if (sessionCount >= 15) return "dense_signal";
  return "session_backed";
}

function sourceForEligible(
  eligibilitySource: PersonalizationEligibilityResult["source"],
  learned: boolean,
): MatchSource {
  if (learned) return "session_history";
  if (eligibilitySource === "testflight_bypass") return "testflight_bypass";
  return "profile_preferences";
}

function lockedResponse(
  fitLabel: string,
  lockReason: NonNullable<MatchScoreResponse["lock_reason"]>,
): MatchScoreResponse {
  return {
    state: "locked",
    fit_label: fitLabel,
    reason_bullets: [
      lockReason === "billing_issue"
        ? "Your forecast is still here. Update your payment method to turn personal match back on."
        : "Forecasts stay free. Pro adds your fit, reasons, ranked windows, and personal alerts.",
    ],
    session_count: 0,
    sessions_needed: 5,
    source: "entitlement",
    quality_band: "locked",
    score: null,
    reason_type: "locked",
    reason_facts: [
      { kind: "lock_reason", value: lockReason },
      { kind: "session_count", value: 0 },
      { kind: "snapshot_quality", value: "none" },
    ],
    latency_ms: 0,
    lock_reason: lockReason,
  };
}

function syncingResponse(): MatchScoreResponse {
  return {
    state: "syncing",
    fit_label: "Syncing Pro access",
    reason_bullets: [
      "Your purchase is active. We are waiting for the server to catch up.",
    ],
    session_count: 0,
    sessions_needed: 5,
    source: "entitlement",
    quality_band: "locked",
    score: null,
    reason_type: "locked",
    reason_facts: [
      { kind: "lock_reason", value: "syncing" },
      { kind: "session_count", value: 0 },
      { kind: "snapshot_quality", value: "none" },
    ],
    latency_ms: 0,
  };
}

function betaNotEnabledResponse(): MatchScoreResponse {
  return {
    state: "beta_not_enabled",
    fit_label: "Beta access is not enabled for this account",
    reason_bullets: [
      "Use the account invited to TestFlight or contact support to enable beta access.",
    ],
    session_count: 0,
    sessions_needed: 5,
    source: "entitlement",
    quality_band: "locked",
    score: null,
    reason_type: "locked",
    reason_facts: [
      { kind: "lock_reason", value: "beta_not_enabled" },
      { kind: "session_count", value: 0 },
      { kind: "snapshot_quality", value: "none" },
    ],
    latency_ms: 0,
  };
}

export function degradedMatchScoreResponse(
  sessionCount = 0,
): MatchScoreResponse {
  return {
    state: "degraded",
    fit_label: "Personal match did not load",
    reason_bullets: [DEGRADED_BODY],
    session_count: sessionCount,
    sessions_needed: Math.max(5 - sessionCount, 0),
    source: "session_history",
    quality_band: "degraded",
    score: null,
    reason_type: "degraded",
    reason_facts: [
      { kind: "session_count", value: sessionCount },
      { kind: "sessions_needed", value: Math.max(5 - sessionCount, 0) },
      { kind: "snapshot_quality", value: snapshotQualityFor(sessionCount) },
    ],
    latency_ms: 0,
  };
}

function mapLockedEligibility(
  eligibility: PersonalizationEligibilityResult,
): MatchScoreResponse | null {
  if (eligibility.canUsePersonalMatch) return null;
  if (eligibility.code === ENTITLEMENT_SYNCING) return syncingResponse();
  if (eligibility.code === BETA_ACCESS_NOT_ENABLED) return betaNotEnabledResponse();
  if (eligibility.code === BILLING_ISSUE_LOCKED) {
    return lockedResponse("Update payment to use personal match", "billing_issue");
  }
  if (eligibility.code === PERSONALIZATION_DISABLED) {
    return lockedResponse("Personalization is temporarily disabled", "disabled");
  }
  return lockedResponse("Personal match unlocks with Pro", "free");
}

export function resolveMatchScoreState({
  eligibilitySource,
  forecast,
  rpcResult,
}: ResolveMatchScoreStateInput): MatchScoreResponse {
  const sessionCount = coerceCount(
    rpcResult.session_count ?? rpcResult.sessions_in_profile,
    0,
  );
  const sessionsNeeded = Math.max(
    coerceCount(rpcResult.sessions_needed, Math.max(5 - sessionCount, 0)),
    0,
  );

  if (
    sessionCount >= 5 &&
    (rpcResult.reason === "no_positive_sessions" ||
      rpcResult.profile_kind === "neutral" ||
      isAvoidanceLearnedMatchState(rpcResult.state))
  ) {
    return {
      state: "avoidance_learned",
      fit_label: "Need a few more ratings",
      reason_bullets: [AVOIDANCE_BODY],
      session_count: sessionCount,
      sessions_needed: 0,
      source: "session_history",
      quality_band: "mixed_signal",
      score: null,
      reason_type: "avoidance_learning",
      reason_facts: reasonFactsFor(forecast, sessionCount, 0, rpcResult),
      latency_ms: 0,
      board_tip: rpcResult.board_tip ?? null,
      profile_kind: rpcResult.profile_kind ?? null,
    };
  }

  if (sessionCount < 5 || isStarterMatchState(rpcResult.state)) {
    return {
      state: "starter",
      fit_label: rpcResult.fit_label ?? "Fits your stated preferences",
      body: STARTER_MATCH_BODY,
      reason_bullets: starterReasons(forecast),
      session_count: sessionCount,
      sessions_needed: sessionsNeeded,
      source: sourceForEligible(eligibilitySource, false),
      quality_band: "starter",
      score: null,
      reason_type: "starter_preferences",
      reason_facts: reasonFactsFor(
        forecast,
        sessionCount,
        sessionsNeeded,
        rpcResult,
      ),
      latency_ms: 0,
    };
  }

  if (typeof rpcResult.score !== "number") {
    return degradedMatchScoreResponse(sessionCount);
  }

  return {
    state: "learned",
    fit_label: rpcResult.fit_label ?? rpcResult.label ?? "FAIR",
    reason_bullets: learnedReasons(rpcResult, forecast, sessionCount),
    session_count: sessionCount,
    sessions_needed: 0,
    source: sourceForEligible(eligibilitySource, true),
    quality_band: qualityBandFor(sessionCount, rpcResult),
    score: typeof rpcResult.score === "number" ? rpcResult.score : null,
    reason_type: "session_history",
    reason_facts: reasonFactsFor(forecast, sessionCount, 0, rpcResult),
    latency_ms: 0,
    board_tip: rpcResult.board_tip ?? null,
    profile_kind: rpcResult.profile_kind ?? null,
  };
}

export async function getPersonalizationMatchScore(
  userId: string,
  supabase: SupabaseClient,
  forecast: MatchScoreForecastInput,
  options: {
    betaAccessRequired?: boolean;
    personalizationDisabled?: boolean;
    createScoringClient?: () => Promise<MatchScoreRpcClient> | MatchScoreRpcClient;
    now?: () => number;
  } = {},
): Promise<MatchScoreResponse> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const withLatency = (response: MatchScoreResponse): MatchScoreResponse => ({
    ...response,
    latency_ms: Math.max(0, Math.round(now() - startedAt)),
  });

  const eligibility = await getPersonalizationEligibility(userId, supabase, {
    betaAccessRequired: options.betaAccessRequired,
    personalizationDisabled: options.personalizationDisabled,
  });
  const locked = mapLockedEligibility(eligibility);
  if (locked) return withLatency(locked);

  let scoringClient: MatchScoreRpcClient = supabase;
  let rpcName = "compute_user_match_score";

  if (eligibility.source === "testflight_bypass" && options.createScoringClient) {
    try {
      scoringClient = await options.createScoringClient();
      rpcName = "compute_user_match_score_core";
    } catch {
      return withLatency(degradedMatchScoreResponse());
    }
  }

  const { data, error } = await scoringClient.rpc(rpcName, {
    p_user_id: userId,
    p_beach_id: forecast.beachId,
    p_wave_height: forecast.waveHeight,
    p_wave_period: forecast.wavePeriod,
    p_wind_speed: forecast.windSpeed,
    p_wind_direction: forecast.windDirection,
    p_tide_height: forecast.tideHeight,
  });

  if (error) return withLatency(degradedMatchScoreResponse());

  return withLatency(
    resolveMatchScoreState({
      eligibilitySource: eligibility.source,
      forecast,
      rpcResult: (data ?? {}) as RawMatchScoreResult,
    }),
  );
}
