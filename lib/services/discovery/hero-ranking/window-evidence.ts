/**
 * Window evidence helpers — pure functions used by `heroWindowScore`.
 *
 * Persistence (stddev-based 0-100) and duration (linear 0-100, capping at
 * 4hr+) damp rank volatility from one-slot peaks and reward longer viable
 * windows. They are inputs to the hero composer; nothing here logs.
 */

const PERSISTENCE_STDDEV_WEIGHT = 5;
const DURATION_HOURS_PER_POINT = 25;
const DURATION_CAP_HOURS = 4;

/**
 * Computes a 0-100 persistence score from a window's per-slot raw scores.
 *
 * Lower stddev → higher persistence. A perfectly steady window scores 100;
 * a one-slot peak followed by a collapse scores low. Stddev is multiplied
 * by a weight (5) before subtracting from 100, giving a useful spread for
 * realistic discovery score variance.
 *
 * Returns 0 for an empty array (no evidence ⇒ no persistence credit).
 */
export function computeWindowPersistence(slotScores: number[]): number {
  if (slotScores.length === 0) return 0;
  const mean =
    slotScores.reduce((sum, v) => sum + v, 0) / slotScores.length;
  const variance =
    slotScores.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    slotScores.length;
  const stddev = Math.sqrt(variance);
  return Math.max(0, Math.min(100, 100 - stddev * PERSISTENCE_STDDEV_WEIGHT));
}

/**
 * Linear duration score:
 *   0h → 0, 1h → 25, 2h → 50, 3h → 75, 4h+ → 100.
 *
 * Negative inputs clamp to 0; values past `DURATION_CAP_HOURS` clamp to 100.
 */
export function computeWindowDurationScore(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  if (hours >= DURATION_CAP_HOURS) return 100;
  return Math.max(0, Math.min(100, hours * DURATION_HOURS_PER_POINT));
}
