import type { Json } from "@/types/database";

export const SESSION_DECOMPOSITION_VERSION = 1 as const;

export const SESSION_MOMENT_TAGS = ["waves", "crew", "vibe"] as const;
export const SESSION_SKILL_FIT_VALUES = [
  "under",
  "dialed",
  "over_my_head",
] as const;
export const SESSION_BOARD_FIT_VALUES = [
  "too_small",
  "right",
  "too_much_board",
  "wrong_type",
  "na",
] as const;

export type SessionMomentTag = (typeof SESSION_MOMENT_TAGS)[number];
export type SessionSkillFit = (typeof SESSION_SKILL_FIT_VALUES)[number];
export type SessionBoardFitSignal = (typeof SESSION_BOARD_FIT_VALUES)[number];

export interface SessionDecomposition {
  [key: string]: Json | undefined;
  version: typeof SESSION_DECOMPOSITION_VERSION;
  waves?: true;
  crew?: true;
  vibe?: true;
  skill_fit?: SessionSkillFit;
  board_fit?: SessionBoardFitSignal;
}

export interface SessionDecompositionInput {
  version?: typeof SESSION_DECOMPOSITION_VERSION;
  waves?: boolean;
  crew?: boolean;
  vibe?: boolean;
  skill_fit?: SessionSkillFit;
  board_fit?: SessionBoardFitSignal;
}

export function hasSessionDecompositionSignal(
  value: SessionDecompositionInput | null | undefined
): boolean {
  if (!value) return false;
  return (
    value.waves === true ||
    value.crew === true ||
    value.vibe === true ||
    Boolean(value.skill_fit) ||
    Boolean(value.board_fit)
  );
}

export function normalizeSessionDecomposition(
  value: SessionDecompositionInput | null | undefined
): SessionDecomposition | null {
  if (!hasSessionDecompositionSignal(value)) return null;

  const normalized: SessionDecomposition = {
    version: SESSION_DECOMPOSITION_VERSION,
  };

  if (value?.waves === true) normalized.waves = true;
  if (value?.crew === true) normalized.crew = true;
  if (value?.vibe === true) normalized.vibe = true;
  if (value?.skill_fit) normalized.skill_fit = value.skill_fit;
  if (value?.board_fit) normalized.board_fit = value.board_fit;

  return normalized;
}
