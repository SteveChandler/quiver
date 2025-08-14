import type { Beach } from "@/types/database";

export type RecommendationSnapshot = {
  wave_direction_deg?: number | null;
  wind_direction_deg?: number | null;
  wind_speed_kts?: number | null;
  tide_ft?: number | null;
  user_skill?: string | null; // beginner|intermediate|advanced
};

export type RecommendationScore = {
  score: number; // 0-100
  reasons: string[];
};

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

export function scoreRecommendation(
  beach: Beach,
  snap: RecommendationSnapshot
): RecommendationScore {
  let score = 0;
  const reasons: string[] = [];

  // Swell window (+3)
  const inWindow = inWrappedWindow(
    beach.swell_window_min_deg ?? null,
    beach.swell_window_max_deg ?? null,
    snap.wave_direction_deg ?? null
  );
  if (inWindow === true) {
    score += 30;
    reasons.push("in_swell_window");
  } else if (inWindow === false) {
    reasons.push("out_of_swell_window");
  }

  // Wind: offshore within tol +3; else cross-shore if wind ≤ cross ok +1; onshore > onshore_bad −2
  const offDeg = degNorm(beach.wind_offshore_deg ?? null);
  const offTol = beach.wind_offshore_tol_deg ?? 30;
  const windDir = degNorm(snap.wind_direction_deg ?? null);
  const windKts = snap.wind_speed_kts ?? null;
  if (offDeg != null && windDir != null) {
    const d = angDiff(offDeg, windDir);
    if (d != null && d <= offTol) {
      score += 30;
      reasons.push("offshore");
    } else if (d != null && Math.abs(d - 90) <= 30) {
      // cross-shore band
      if (windKts != null && beach.wind_cross_shore_ok_kt != null && windKts <= beach.wind_cross_shore_ok_kt) {
        score += 10;
        reasons.push("cross_ok");
      }
    } else {
      if (
        windKts != null &&
        beach.wind_onshore_bad_kt != null &&
        windKts > beach.wind_onshore_bad_kt
      ) {
        score -= 20;
        reasons.push("strong_onshore");
      }
    }
  }

  // Tide within preferred range (+2)
  if (
    beach.preferred_tide_ft_min != null &&
    beach.preferred_tide_ft_max != null &&
    snap.tide_ft != null
  ) {
    if (
      snap.tide_ft >= beach.preferred_tide_ft_min &&
      snap.tide_ft <= beach.preferred_tide_ft_max
    ) {
      score += 20;
      reasons.push("in_tide_window");
    } else {
      reasons.push("out_of_tide_window");
    }
  }

  // User skill vs spot requirement (+1 / −2)
  const required = (beach.skill_level || "intermediate").toLowerCase();
  const user = (snap.user_skill || "intermediate").toLowerCase();
  const rank: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 };
  if (rank[user] >= rank[required]) {
    score += 10;
    reasons.push("skill_ok");
  } else {
    score -= 20;
    reasons.push("skill_low");
  }

  // Clamp 0..100
  const finalScore = Math.max(0, Math.min(100, score));
  return { score: finalScore, reasons };
}

export const RecommendationMath = { degNorm, angDiff, inWrappedWindow };


