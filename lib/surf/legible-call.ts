import type { computeHourScoreBreakdown } from "@/lib/surf/scoring";

export type SkillBand = "beginner" | "intermediate" | "advanced" | "expert";
export type ClauseKind = "size" | "swell_angle" | "wind" | "tide" | "tide_window";
export type TideStatus = "Rising" | "Falling";
export type LegibleVerdict = "YES" | "MAYBE" | "NO";

export interface LegibleClause {
  kind: ClauseKind;
  text: string;
  signal: string;
  value: number | string;
  estimated?: boolean;
}

export interface LegibleCall {
  verdict: LegibleVerdict;
  verdictLabel: string;
  headline: string;
  clauses: LegibleClause[];
  skillBand: SkillBand | null;
}

export type LegibleHourBreakdown = ReturnType<typeof computeHourScoreBreakdown>;

export interface LegibleHourInput {
  tsISO: string;
  faceHeightFt: number | null;
  isCalibrated: boolean;
  breakdown: LegibleHourBreakdown;
  swellDirDeg: number | null;
  windKts: number | null;
  windDirDeg: number | null;
  tideFt: number | null;
  tideStatus: TideStatus | null;
}

export interface BeachGeometry {
  name?: string | null;
  break_type?: string | null;
  wind_offshore_deg?: number | null;
  wind_cross_ok_kts?: number | null;
  swell_window_min_deg?: number | null;
  swell_window_max_deg?: number | null;
  tide_min_ft?: number | null;
  tide_max_ft?: number | null;
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
  preferred_tide_direction?: string | null;
  terrain_enabled?: boolean | null;
  wind_exposure_factors?: number[] | null;
  swell_access_factors?: number[] | null;
  shoaling_factors?: unknown | null;
}

export interface LegibleCallParams {
  beach: BeachGeometry;
  skillBand: SkillBand | null;
  hours: LegibleHourInput[];
}

interface SizeAssessment {
  clause: LegibleClause | null;
  gate: "ok" | "marginal" | "too_small" | "too_big" | "missing";
}

interface TideBand {
  min: number;
  max: number;
}

interface WindState {
  clean: boolean;
  onshore: boolean;
}

const SKILL_SIZE_LIMITS: Record<SkillBand, { floor: number; ceiling: number }> = {
  beginner: { floor: 0.5, ceiling: 3 },
  intermediate: { floor: 1, ceiling: 5 },
  advanced: { floor: 2, ceiling: 8 },
  expert: { floor: 2.5, ceiling: 10 },
};

const VERDICT_LABELS: Record<LegibleVerdict, string> = {
  YES: "Worth it",
  MAYBE: "Might work",
  NO: "Skip",
};

const MARGINAL_BUFFER_FT = 0.5;
const CLEAN_WIND_MAX_KTS = 10;
const ONSHORE_MIN_OFF_BY_DEG = 135;
const OFFSHORE_MAX_OFF_BY_DEG = 45;

export function isLastMileCallEnabled(): boolean {
  return process.env.LAST_MILE_CALL_ENABLED === "true";
}

export function composeLegibleCall(params: LegibleCallParams): LegibleCall {
  const peakHour = selectPeakHour(params.hours);
  if (!peakHour) {
    return {
      verdict: "NO",
      verdictLabel: VERDICT_LABELS.NO,
      headline: "Skip",
      clauses: [],
      skillBand: params.skillBand,
    };
  }

  const size = buildSizeClause(peakHour, params.skillBand);
  const clauses = [
    size.clause,
    buildSwellAngleClause(peakHour),
    buildWindClause(params.beach, params.hours, peakHour),
    buildTideClause(params.beach, peakHour),
    buildTideWindowClause(params.beach, params.hours),
  ].filter((clause): clause is LegibleClause => clause !== null);

  const verdict = applySizeGate(verdictFromScore(peakHour.breakdown.total0to100), size.gate);
  const headline = buildHeadline(verdict, clauses);

  return {
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    headline,
    clauses,
    skillBand: params.skillBand,
  };
}

function selectPeakHour(hours: LegibleHourInput[]): LegibleHourInput | null {
  if (hours.length === 0) return null;
  return hours.reduce((best, hour) => {
    if (hour.breakdown.total0to100 > best.breakdown.total0to100) return hour;
    return best;
  }, hours[0]);
}

function buildSizeClause(hour: LegibleHourInput, skillBand: SkillBand | null): SizeAssessment {
  if (hour.faceHeightFt == null) {
    return { clause: null, gate: "missing" };
  }

  const height = round1(hour.faceHeightFt);
  const prefix = hour.isCalibrated ? "" : "~";
  const valueText = `${prefix}${formatFeet(height)}ft`;
  const estimated = hour.isCalibrated ? undefined : true;

  if (!skillBand) {
    return {
      clause: {
        kind: "size",
        text: `${valueText} surf`,
        signal: "wave_height",
        value: height,
        estimated,
      },
      gate: "ok",
    };
  }

  const limits = SKILL_SIZE_LIMITS[skillBand];
  if (height > limits.ceiling) {
    return {
      clause: {
        kind: "size",
        text: `${valueText} too big for you`,
        signal: "wave_height",
        value: height,
        estimated,
      },
      gate: "too_big",
    };
  }

  if (height < limits.floor) {
    return {
      clause: {
        kind: "size",
        text: `${valueText} too small to bother`,
        signal: "wave_height",
        value: height,
        estimated,
      },
      gate: "too_small",
    };
  }

  const nearFloor = height < limits.floor + MARGINAL_BUFFER_FT;
  const nearCeiling = height > limits.ceiling - MARGINAL_BUFFER_FT;
  if (nearFloor || nearCeiling) {
    return {
      clause: {
        kind: "size",
        text: `${valueText} borderline size for you`,
        signal: "wave_height",
        value: height,
        estimated,
      },
      gate: "marginal",
    };
  }

  return {
    clause: {
      kind: "size",
      text: `${valueText} fun size for you`,
      signal: "wave_height",
      value: height,
      estimated,
    },
    gate: "ok",
  };
}

function buildSwellAngleClause(hour: LegibleHourInput): LegibleClause | null {
  if (hour.swellDirDeg == null) return null;

  const hasTerrainAccess = typeof hour.breakdown.swellAccess === "number";
  const score = hasTerrainAccess ? hour.breakdown.swellAccess : hour.breakdown.swellDirScore;
  if (score == null || !Number.isFinite(score)) return null;

  return {
    kind: "swell_angle",
    text: swellAngleText(score),
    signal: hasTerrainAccess ? "swell_access" : "swellDirScore",
    value: round2(score),
  };
}

function swellAngleText(score: number): string {
  if (score >= 0.7) return "angled in clean";
  if (score >= 0.4) return "a touch side-on";
  if (score >= 0.15) return "partly shadowed at this angle";
  return "wrong angle - mostly blocked";
}

function buildWindClause(
  beach: BeachGeometry,
  hours: LegibleHourInput[],
  peakHour: LegibleHourInput
): LegibleClause | null {
  const crossover = firstCleanToOnshoreCrossover(beach, hours);
  if (crossover) {
    return {
      kind: "wind",
      text: `clean till ~${formatHour(crossover.tsISO)}`,
      signal: "wind_crossover",
      value: crossover.value,
    };
  }

  if (peakHour.windKts == null || peakHour.windDirDeg == null) return null;

  const state = classifyWind(beach, peakHour.windKts, peakHour.windDirDeg);
  return {
    kind: "wind",
    text: windText(state, peakHour.windKts),
    signal: "wind_vector",
    value: `${round1(peakHour.windKts)}kt@${Math.round(peakHour.windDirDeg)}deg`,
  };
}

function firstCleanToOnshoreCrossover(
  beach: BeachGeometry,
  hours: LegibleHourInput[]
): { tsISO: string; value: string } | null {
  let sawClean = false;
  for (const hour of hours) {
    if (hour.windKts == null || hour.windDirDeg == null) continue;
    const state = classifyWind(beach, hour.windKts, hour.windDirDeg);
    if (sawClean && state.onshore) {
      return {
        tsISO: hour.tsISO,
        value: `${round1(hour.windKts)}kt@${Math.round(hour.windDirDeg)}deg`,
      };
    }
    if (state.clean) sawClean = true;
  }
  return null;
}

function classifyWind(beach: BeachGeometry, windKts: number, windDirDeg: number): WindState {
  const offshoreDeg = beach.wind_offshore_deg ?? null;
  if (offshoreDeg == null) {
    return {
      clean: windKts <= CLEAN_WIND_MAX_KTS,
      onshore: false,
    };
  }

  const offBy = angularDistance(windDirDeg, offshoreDeg);
  return {
    clean: windKts <= CLEAN_WIND_MAX_KTS || offBy <= OFFSHORE_MAX_OFF_BY_DEG,
    onshore: offBy >= ONSHORE_MIN_OFF_BY_DEG && windKts > CLEAN_WIND_MAX_KTS,
  };
}

function windText(state: WindState, windKts: number): string {
  if (windKts <= 5) return "light wind, clean texture";
  if (state.onshore) return "onshore wind on it";
  if (state.clean) return "offshore wind grooming it";
  return "crosswind texture";
}

function buildTideClause(beach: BeachGeometry, hour: LegibleHourInput): LegibleClause | null {
  const band = tideBandFor(beach);
  if (!band || hour.tideFt == null) return null;

  const tide = round1(hour.tideFt);
  const preferred = normalizedTideDirection(beach.preferred_tide_direction);
  const tideStatus = hour.tideStatus;
  const statusText = tideStatus ? `, ${tideStatus.toLowerCase()}` : "";

  if (tide < band.min) {
    return {
      kind: "tide",
      text: `tide drained out (${formatFeet(tide)}ft${statusText}) - washes out till it fills`,
      signal: "tide_ft",
      value: tide,
    };
  }

  if (tide > band.max) {
    return {
      kind: "tide",
      text: `tide too full (${formatFeet(tide)}ft${statusText})`,
      signal: "tide_ft",
      value: tide,
    };
  }

  const matchesPreferred =
    preferred !== null && tideStatus !== null && preferred === tideStatus.toLowerCase();
  return {
    kind: "tide",
    text: matchesPreferred
      ? `tide filling into the zone (${formatFeet(tide)}ft, ${tideStatus.toLowerCase()})`
      : `tide in the zone (${formatFeet(tide)}ft${statusText})`,
    signal: "tide_ft",
    value: tide,
  };
}

function buildTideWindowClause(
  beach: BeachGeometry,
  hours: LegibleHourInput[]
): LegibleClause | null {
  const band = tideBandFor(beach);
  if (!band) return null;

  const preferred = normalizedTideDirection(beach.preferred_tide_direction);
  const runs: LegibleHourInput[][] = [];
  let current: LegibleHourInput[] = [];

  for (const hour of hours) {
    if (isPreferredTideHour(hour, band, preferred)) {
      current.push(hour);
      continue;
    }
    if (current.length > 0) runs.push(current);
    current = [];
  }
  if (current.length > 0) runs.push(current);

  const longest = runs.reduce<LegibleHourInput[]>((best, run) => {
    if (run.length > best.length) return run;
    return best;
  }, []);
  if (longest.length < 2) return null;

  const start = longest[0];
  const end = longest[longest.length - 1];
  return {
    kind: "tide_window",
    text: `best on the push, ~${formatHour(start.tsISO)}-${formatHour(end.tsISO)}`,
    signal: "tide_window",
    value: `${start.tsISO}/${end.tsISO}`,
  };
}

function isPreferredTideHour(
  hour: LegibleHourInput,
  band: TideBand,
  preferred: "rising" | "falling" | null
): boolean {
  if (hour.tideFt == null) return false;
  if (hour.tideFt < band.min || hour.tideFt > band.max) return false;
  if (!preferred) return true;
  return hour.tideStatus?.toLowerCase() === preferred;
}

function tideBandFor(beach: BeachGeometry): TideBand | null {
  const min = beach.preferred_tide_ft_min ?? beach.tide_min_ft ?? null;
  const max = beach.preferred_tide_ft_max ?? beach.tide_max_ft ?? null;
  if (min == null || max == null) return null;
  return { min, max };
}

function normalizedTideDirection(direction: string | null | undefined): "rising" | "falling" | null {
  if (!direction) return null;
  const normalized = direction.toLowerCase();
  if (normalized === "rising" || normalized === "incoming" || normalized === "push") {
    return "rising";
  }
  if (normalized === "falling" || normalized === "outgoing" || normalized === "dropping") {
    return "falling";
  }
  return null;
}

function verdictFromScore(score: number): LegibleVerdict {
  if (score >= 70) return "YES";
  if (score >= 40) return "MAYBE";
  return "NO";
}

function applySizeGate(verdict: LegibleVerdict, gate: SizeAssessment["gate"]): LegibleVerdict {
  if (gate === "too_big" || gate === "too_small" || gate === "missing") return "NO";
  if (gate === "marginal" && verdict === "YES") return "MAYBE";
  return verdict;
}

function buildHeadline(verdict: LegibleVerdict, clauses: LegibleClause[]): string {
  const selected = selectHeadlineClauses(clauses);
  if (selected.length === 0) return `${verdict} · ${VERDICT_LABELS[verdict]}`;
  return `${verdict} · ${VERDICT_LABELS[verdict]} — ${selected.map((clause) => clause.text).join(" · ")}`;
}

function selectHeadlineClauses(clauses: LegibleClause[]): LegibleClause[] {
  const size = clauses.find((clause) => clause.kind === "size");
  const limiting = clauses.find((clause) => {
    if (clause.kind === "tide") return /washes out|too full/.test(clause.text);
    if (clause.kind === "swell_angle") return /shadowed|blocked|side-on/.test(clause.text);
    if (clause.kind === "wind") return /onshore/.test(clause.text);
    return false;
  });
  const tideWindow = clauses.find((clause) => clause.kind === "tide_window");
  const wind = clauses.find((clause) => clause.kind === "wind");

  return uniqueClauses([size, limiting, tideWindow, wind]).slice(0, 4);
}

function uniqueClauses(clauses: Array<LegibleClause | undefined>): LegibleClause[] {
  const seen = new Set<ClauseKind>();
  const result: LegibleClause[] = [];
  for (const clause of clauses) {
    if (!clause || seen.has(clause.kind)) continue;
    seen.add(clause.kind);
    result.push(clause);
  }
  return result;
}

function angularDistance(aDeg: number, bDeg: number): number {
  const a = normalizeDeg(aDeg);
  const b = normalizeDeg(bDeg);
  return Math.abs(((a - b + 540) % 360) - 180);
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function formatHour(tsISO: string): string {
  const date = new Date(tsISO);
  const hour = date.getUTCHours();
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

function formatFeet(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
