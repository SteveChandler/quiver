import { getScoreColorClasses } from "@/lib/utils/score-color-utils";

export const SCORE_ACTION_PHRASES = {
  EPIC: "Go now!",
  GOOD: "Go surf!",
  FAIR: "Worth a look",
  RIDEABLE: "Slim pickings",
  MEH: "Skip it",
} as const;

export type ScoreBand = keyof typeof SCORE_ACTION_PHRASES;

export interface ScoreCall {
  label: ScoreBand;
  action: (typeof SCORE_ACTION_PHRASES)[ScoreBand];
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
