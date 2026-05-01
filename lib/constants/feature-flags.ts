/**
 * Server-only feature flags for the discovery pipeline.
 *
 * IMPORTANT: do NOT prefix with `NEXT_PUBLIC_`. The hero rerank only runs
 * inside the discovery API route (server) and these values must not be
 * exposed to the client bundle.
 */

/**
 * Gates Phase 2 of hero re-rank: when true, `surf-discovery-orchestrator`
 * returns the `rerankHero(...)` lifted slice as the response array; when
 * false, the original engine-score-sorted slice is returned. Diagnostics
 * emit either way.
 */
export const FEATURE_HERO_WINDOW_SCORE: boolean =
  process.env.HERO_WINDOW_SCORE === "true";
