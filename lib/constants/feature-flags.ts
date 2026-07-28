/**
 * Server-only feature flags for the discovery pipeline.
 *
 * IMPORTANT: do NOT prefix with `NEXT_PUBLIC_`. The hero rerank only runs
 * inside the discovery API route (server) and these values must not be
 * exposed to the client bundle.
 */

/**
 * Gates Phase 2 of hero re-rank. The setup-aware ranker is the default
 * production behavior; an explicit "false" remains available as a kill switch.
 */
export const FEATURE_HERO_WINDOW_SCORE: boolean =
  process.env.HERO_WINDOW_SCORE !== "false";
