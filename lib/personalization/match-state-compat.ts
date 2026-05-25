export type RawMatchScoreState =
  | "ready"
  | "onboarding"
  | "learned"
  | "starter"
  | "avoidance_learned"
  | string
  | undefined;

export function isLearnedMatchState(state: RawMatchScoreState): boolean {
  return state === "ready" || state === "learned";
}

export function isStarterMatchState(state: RawMatchScoreState): boolean {
  return state === "onboarding" || state === "starter";
}

export function isAvoidanceLearnedMatchState(state: RawMatchScoreState): boolean {
  return state === "avoidance_learned";
}
