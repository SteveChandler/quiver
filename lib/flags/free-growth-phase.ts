import "server-only";

/** Defaults OFF. Enables reversible softening for the free-growth phase. */
export function isFreeGrowthPhaseEnabled(): boolean {
  return process.env.FREE_GROWTH_PHASE === "true";
}
