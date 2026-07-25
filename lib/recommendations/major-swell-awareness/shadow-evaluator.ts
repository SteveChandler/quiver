import {
  detectSwellWatch,
  type SwellWatchEvent,
} from "@/lib/alerts/swell-watch-detector";
import type { EnhancedForecastEntity } from "@/types/forecast";

const SHADOW_HORIZON_MS = 10 * 24 * 60 * 60 * 1000;
const MAJOR_PEAK_FT = 6;
const MAJOR_RISE_FT = 3;
const MAJOR_PERIOD_S = 12;

export type OfficialSwellAdvisoryKind =
  | "high_surf"
  | "tropical_cyclone"
  | "high_rip_current";

export interface OfficialSwellAdvisoryEvidence {
  evidenceRef: string;
  kind: OfficialSwellAdvisoryKind;
  startsAt: string;
  endsAt: string;
  beachIds: string[];
}

export interface MajorSwellAwarenessShadowResult {
  mode: "shadow";
  automationEnabled: false;
  signal:
    | "none"
    | "forecast_trend"
    | "official_advisory"
    | "corroborated";
  severity: "significant" | "major" | null;
  event: SwellWatchEvent | null;
  officialEvidenceRefs: string[];
  wouldSuppressCohorts: Array<"beginner" | "intermediate" | "unknown">;
}

export interface EvaluateMajorSwellAwarenessShadowInput {
  beachId: string;
  forecasts: EnhancedForecastEntity[];
  timezone: string;
  now: Date;
  officialAdvisories: readonly OfficialSwellAdvisoryEvidence[];
}

function validOfficialEvidence(
  evidence: OfficialSwellAdvisoryEvidence,
  beachId: string,
  now: Date,
): boolean {
  const startsAt = Date.parse(evidence.startsAt);
  const endsAt = Date.parse(evidence.endsAt);
  return (
    evidence.evidenceRef.trim().length > 0
    && ["high_surf", "tropical_cyclone", "high_rip_current"].includes(
      evidence.kind,
    )
    && Number.isFinite(startsAt)
    && Number.isFinite(endsAt)
    && startsAt < endsAt
    && endsAt > now.getTime()
    && startsAt <= now.getTime() + SHADOW_HORIZON_MS
    && evidence.beachIds.includes(beachId)
  );
}

function trendSeverity(
  event: SwellWatchEvent | null,
): "significant" | "major" | null {
  if (!event) return null;
  const rise = event.peakHeightFt - event.baselineHeightFt;
  return (
    event.peakHeightFt >= MAJOR_PEAK_FT
    && rise >= MAJOR_RISE_FT
    && event.peakPeriodS >= MAJOR_PERIOD_S
  )
    ? "major"
    : "significant";
}

function officialSeverity(
  advisories: readonly OfficialSwellAdvisoryEvidence[],
): "significant" | "major" | null {
  if (advisories.length === 0) return null;
  return advisories.some((advisory) => (
    advisory.kind === "high_surf"
    || advisory.kind === "tropical_cyclone"
  ))
    ? "major"
    : "significant";
}

export function evaluateMajorSwellAwarenessShadow(
  input: EvaluateMajorSwellAwarenessShadowInput,
): MajorSwellAwarenessShadowResult {
  const event = detectSwellWatch({
    forecasts: input.forecasts,
    timezone: input.timezone,
    now: input.now,
  });
  const officialAdvisories = input.officialAdvisories
    .filter((evidence) => (
      validOfficialEvidence(evidence, input.beachId, input.now)
    ))
    .sort((left, right) => (
      left.evidenceRef.localeCompare(right.evidenceRef)
    ));
  const hasTrend = event !== null;
  const hasOfficial = officialAdvisories.length > 0;
  const signal = hasTrend && hasOfficial
    ? "corroborated"
    : hasTrend
      ? "forecast_trend"
      : hasOfficial
        ? "official_advisory"
        : "none";
  const severity = (
    trendSeverity(event) === "major"
    || officialSeverity(officialAdvisories) === "major"
  )
    ? "major"
    : hasTrend || hasOfficial
      ? "significant"
      : null;

  return {
    mode: "shadow",
    automationEnabled: false,
    signal,
    severity,
    event,
    officialEvidenceRefs: Array.from(
      new Set(officialAdvisories.map(({ evidenceRef }) => evidenceRef)),
    ),
    wouldSuppressCohorts: signal === "none"
      ? []
      : ["beginner", "intermediate", "unknown"],
  };
}
