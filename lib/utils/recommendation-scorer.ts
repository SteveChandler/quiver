import type { Beach } from "@/types/database";

type RecommendationSnapshot = {
  wave_direction_deg?: number | null;
  wind_direction_deg?: number | null;
  wind_speed_kts?: number | null;
  tide_ft?: number | null;
  user_skill?: string | null; // beginner|intermediate|advanced
};

type RecommendationScore = {
  score: number; // 0-100
  reasons: string[];
};

/**
 * Result from a single scoring criterion
 */
type ScoringResult = {
  points: number;
  reasons: string[];
};

/**
 * Strategy interface for individual scoring criteria
 */
interface ScoringCriterion {
  /**
   * Calculate score contribution for this criterion
   * @param beach - Beach configuration
   * @param snapshot - Current conditions snapshot
   * @returns Points and reasons for this criterion
   */
  score(beach: Beach, snapshot: RecommendationSnapshot): ScoringResult;
}

function degNorm(d?: number | null): number | null {
  if (d == null || !isFinite(d)) return null;
  let n = d % 360;
  if (n < 0) n += 360;
  return n;
}

function angDiff(a?: number | null, b?: number | null): number | null {
  const A = degNorm(a);
  const B = degNorm(b);
  if (A == null || B == null) return null;
  let d = Math.abs(A - B);
  if (d > 180) d = 360 - d;
  return d; // 0..180
}

function inWrappedWindow(min?: number | null, max?: number | null, dir?: number | null): boolean | null {
  const MIN = degNorm(min);
  const MAX = degNorm(max);
  const DIR = degNorm(dir);
  if (MIN == null || MAX == null || DIR == null) return null;
  if (MIN <= MAX) return DIR >= MIN && DIR <= MAX;
  // window wraps 360→0
  return DIR >= MIN || DIR <= MAX;
}

/**
 * Scores based on whether wave direction falls within beach's optimal swell window
 * Max points: 30
 */
class SwellWindowScorer implements ScoringCriterion {
  score(beach: Beach, snapshot: RecommendationSnapshot): ScoringResult {
    const inWindow = inWrappedWindow(
      beach.swell_window_min_deg ?? null,
      beach.swell_window_max_deg ?? null,
      snapshot.wave_direction_deg ?? null
    );

    if (inWindow === true) {
      return { points: 30, reasons: ["in_swell_window"] };
    } else if (inWindow === false) {
      return { points: 0, reasons: ["out_of_swell_window"] };
    }

    return { points: 0, reasons: [] };
  }
}

/**
 * Scores based on wind direction and speed relative to beach orientation
 * Max points: 30
 * Penalty: -20 for strong onshore winds
 */
class WindScorer implements ScoringCriterion {
  score(beach: Beach, snapshot: RecommendationSnapshot): ScoringResult {
    const offDeg = degNorm(beach.wind_offshore_deg ?? null);
    const offTol = beach.wind_offshore_tol_deg ?? 30;
    const windDir = degNorm(snapshot.wind_direction_deg ?? null);
    const windKts = snapshot.wind_speed_kts ?? null;

    if (offDeg == null || windDir == null) {
      return { points: 0, reasons: [] };
    }

    const diff = angDiff(offDeg, windDir);
    if (diff == null) {
      return { points: 0, reasons: [] };
    }

    // Offshore wind (within tolerance)
    if (diff <= offTol) {
      return { points: 30, reasons: ["offshore"] };
    }

    // Cross-shore wind (around 90 degrees)
    if (Math.abs(diff - 90) <= 30) {
      if (windKts != null && beach.wind_cross_shore_ok_kt != null && windKts <= beach.wind_cross_shore_ok_kt) {
        return { points: 10, reasons: ["cross_ok"] };
      }
      return { points: 0, reasons: [] };
    }

    // Onshore wind - check if it's too strong
    if (windKts != null && beach.wind_onshore_bad_kt != null && windKts > beach.wind_onshore_bad_kt) {
      return { points: -20, reasons: ["strong_onshore"] };
    }

    return { points: 0, reasons: [] };
  }
}

/**
 * Scores based on tide being within beach's preferred range
 * Max points: 20
 */
class TideScorer implements ScoringCriterion {
  score(beach: Beach, snapshot: RecommendationSnapshot): ScoringResult {
    if (
      beach.preferred_tide_ft_min == null ||
      beach.preferred_tide_ft_max == null ||
      snapshot.tide_ft == null
    ) {
      return { points: 0, reasons: [] };
    }

    if (
      snapshot.tide_ft >= beach.preferred_tide_ft_min &&
      snapshot.tide_ft <= beach.preferred_tide_ft_max
    ) {
      return { points: 20, reasons: ["in_tide_window"] };
    }

    return { points: 0, reasons: ["out_of_tide_window"] };
  }
}

/**
 * Scores based on user skill level matching beach requirements
 * Max points: 10
 * Penalty: -20 if user skill is below required level
 */
class SkillScorer implements ScoringCriterion {
  private readonly SKILL_RANKS: Record<string, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };

  score(beach: Beach, snapshot: RecommendationSnapshot): ScoringResult {
    const required = (beach.skill_level || "intermediate").toLowerCase();
    const user = (snapshot.user_skill || "intermediate").toLowerCase();

    const userRank = this.SKILL_RANKS[user] ?? 2; // default to intermediate
    const requiredRank = this.SKILL_RANKS[required] ?? 2;

    if (userRank >= requiredRank) {
      return { points: 10, reasons: ["skill_ok"] };
    }

    return { points: -20, reasons: ["skill_low"] };
  }
}

// Initialize scorer instances (reusable across calls)
const scorers: ScoringCriterion[] = [
  new SwellWindowScorer(),
  new WindScorer(),
  new TideScorer(),
  new SkillScorer(),
];

/**
 * Score a beach recommendation based on current conditions and user profile
 * Uses Strategy pattern to cleanly separate scoring criteria
 * @param beach - Beach configuration with optimal conditions
 * @param snap - Current conditions snapshot
 * @returns Score (0-100) and reasons for the score
 */
export function scoreRecommendation(
  beach: Beach,
  snap: RecommendationSnapshot
): RecommendationScore {
  let totalScore = 0;
  const allReasons: string[] = [];

  // Apply each scoring criterion
  for (const scorer of scorers) {
    const result = scorer.score(beach, snap);
    totalScore += result.points;
    allReasons.push(...result.reasons);
  }

  // Clamp score to valid range (0-100)
  const finalScore = Math.max(0, Math.min(100, totalScore));

  return {
    score: finalScore,
    reasons: allReasons,
  };
}
