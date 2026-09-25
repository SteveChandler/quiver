import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import type { CanonicalDecisionVerdict } from "@/lib/recommendations/canonical-decision/types";

const SCORE_ACTION_PHRASES = {
  EPIC: "Go now!",
  GOOD: "Go surf!",
  FAIR: "Worth a look",
  RIDEABLE: "Slim pickings",
  MEH: "Skip it",
} as const;

/**
 * Only the positive tiers carry tense: "Go now!" over a window that opens
 * tomorrow tells the surfer to do something they cannot do. Mirrors native
 * `getSurfActionPhrase` (quiver-native src/lib/score-labels.ts).
 */
const UPCOMING_ACTION_PHRASES = {
  ...SCORE_ACTION_PHRASES,
  EPIC: "Don't miss it",
  GOOD: "Worth planning",
} as const;

type ScoreBand = keyof typeof SCORE_ACTION_PHRASES;

type SurfCallTense = "now" | "upcoming";

interface ScoreCall {
  label: ScoreBand;
  action: string;
}

/** Build the user-facing score call from the canonical score-band utility. */
export function getScoreCall(score: number): ScoreCall {
  const { label } = getScoreColorClasses(score);
  const band = label as ScoreBand;

  return {
    label: band,
    action: SCORE_ACTION_PHRASES[band],
  };
}

/** Score range each canonical verdict may occupy, so a label never contradicts its call. */
const VERDICT_SCORE_BOUNDS: Record<CanonicalDecisionVerdict, [number, number]> = {
  go: [70, 100],
  maybe: [40, 69],
  no: [0, 39],
};

const VERDICT_FALLBACK_BAND: Record<CanonicalDecisionVerdict, ScoreBand> = {
  go: "GOOD",
  maybe: "RIDEABLE",
  no: "MEH",
};

/**
 * The call for a canonical session decision, in the same vocabulary native
 * shows (quiver-native `decisionLabelForCandidate`): the verdict picks the
 * band, the score picks the tier inside it.
 */
export function getCanonicalVerdictCall(
  verdict: CanonicalDecisionVerdict,
  score: number | null | undefined,
  tense: SurfCallTense = "now",
): ScoreCall {
  const label =
    typeof score === "number" && Number.isFinite(score)
      ? (getScoreColorClasses(
          Math.min(
            VERDICT_SCORE_BOUNDS[verdict][1],
            Math.max(VERDICT_SCORE_BOUNDS[verdict][0], score),
          ),
        ).label as ScoreBand)
      : VERDICT_FALLBACK_BAND[verdict];
  const phrases = tense === "upcoming" ? UPCOMING_ACTION_PHRASES : SCORE_ACTION_PHRASES;

  return { label, action: phrases[label] };
}
