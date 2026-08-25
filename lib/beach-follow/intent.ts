export const SURF_SPECIFIC_SIGNAL_THRESHOLD = 2;
export const HIGH_INTENT_ACTION_THRESHOLD = 1;

export const EXPLICIT_BEACH_INTENTS = [
  "surfing",
  "swimming",
  "beach_days",
  "fishing",
  "diving_paddling",
  "other",
] as const;

export type ExplicitBeachIntent = (typeof EXPLICIT_BEACH_INTENTS)[number];

const EXPLICIT_BEACH_INTENT_SET = new Set<string>(EXPLICIT_BEACH_INTENTS);

export interface IntentSignals {
  utilityPageViewCount: number;
  surfSpecificSignalCount: number;
  spotComparison?: boolean;
  detailedSwellWindTideOpen?: boolean;
  surfAlertSaved?: boolean;
  exactSurfWindowHandoff?: boolean;
}

export type IntentEvidenceState = "explicit" | "inferred" | "unknown";

export type IntentEvidenceSource =
  | "explicit_choice"
  | "spot_comparison"
  | "detailed_surf_conditions"
  | "surf_alert_saved"
  | "exact_surf_window_handoff"
  | "surf_specific_signals"
  | "utility_page"
  | "none";

export type IntentQualificationReason =
  | "explicit_surfing"
  | "explicit_non_surf"
  | "high_intent_action"
  | "multiple_surf_signals"
  | "insufficient_surf_signals"
  | "utility_only"
  | "no_evidence";

export interface IntentQualification {
  state: IntentEvidenceState;
  intent: ExplicitBeachIntent | null;
  evidenceSource: IntentEvidenceSource;
  reason: IntentQualificationReason;
}

interface HighIntentSignal {
  active: boolean;
  source: IntentEvidenceSource;
}

function safeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function isExplicitBeachIntent(value: unknown): value is ExplicitBeachIntent {
  return (
    typeof value === "string" && EXPLICIT_BEACH_INTENT_SET.has(value)
  );
}

export function qualifyBeachIntent(
  explicitChoice: unknown,
  signals: IntentSignals
): IntentQualification {
  if (isExplicitBeachIntent(explicitChoice)) {
    return {
      state: "explicit",
      intent: explicitChoice,
      evidenceSource: "explicit_choice",
      // A non-surf choice suppresses surf defaults without prohibiting optional discovery.
      reason:
        explicitChoice === "surfing" ? "explicit_surfing" : "explicit_non_surf",
    };
  }

  const highIntentSignals: readonly HighIntentSignal[] = [
    { active: signals.spotComparison === true, source: "spot_comparison" },
    {
      active: signals.detailedSwellWindTideOpen === true,
      source: "detailed_surf_conditions",
    },
    { active: signals.surfAlertSaved === true, source: "surf_alert_saved" },
    {
      active: signals.exactSurfWindowHandoff === true,
      source: "exact_surf_window_handoff",
    },
  ];
  const activeHighIntentSignals = highIntentSignals.filter(
    (signal) => signal.active
  );

  if (activeHighIntentSignals.length >= HIGH_INTENT_ACTION_THRESHOLD) {
    return {
      state: "inferred",
      intent: "surfing",
      evidenceSource: activeHighIntentSignals[0].source,
      reason: "high_intent_action",
    };
  }

  const surfSpecificSignalCount = safeCount(signals.surfSpecificSignalCount);
  if (surfSpecificSignalCount >= SURF_SPECIFIC_SIGNAL_THRESHOLD) {
    return {
      state: "inferred",
      intent: "surfing",
      evidenceSource: "surf_specific_signals",
      reason: "multiple_surf_signals",
    };
  }

  if (surfSpecificSignalCount > 0) {
    return {
      state: "unknown",
      intent: null,
      evidenceSource: "surf_specific_signals",
      reason: "insufficient_surf_signals",
    };
  }

  if (safeCount(signals.utilityPageViewCount) > 0) {
    return {
      state: "unknown",
      intent: null,
      evidenceSource: "utility_page",
      reason: "utility_only",
    };
  }

  return {
    state: "unknown",
    intent: null,
    evidenceSource: "none",
    reason: "no_evidence",
  };
}
