/**
 * Build SurfDiscoveryRecommendation[] from a HeroScenarioFixture by running
 * fixture forecasts through the REAL discovery scoring engine + window
 * selector. Mirrors the parts of `surf-discovery-orchestrator` that produce
 * the recommendation array (without favorites / photo enrichment / API I/O).
 *
 * Used by Task 5's scenario-matrix.test.ts; this file ships in Task 1 so
 * the rerank module (Task 4) and its consumer test can import the helper.
 */
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type {
  PersonalizedForecastWindow,
  SurfDiscoveryRecommendation,
} from "@/types/personalization";

import {
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
  beachToSpotProfile,
  forecastToSnapshot,
} from "@/lib/domains/scoring";
import type { ScoringEngine } from "@/lib/domains/scoring";
import { selectBestWindow } from "@/lib/services/discovery/window-selector";
import type { SkillLevel } from "@/lib/domains/user-preferences/skill-level";

import type { HeroScenarioFixture } from "./scenario-matrix";

/**
 * Compute per-slot raw scorer outputs across the candidate's selected window.
 *
 * Mirrors the per-slot scoring contract Task 5 will extract into the
 * orchestrator: filters allHourly to forecasts whose forecast_at falls in
 * [window.start, window.end] (inclusive of start, exclusive of end), sorts
 * ascending, and runs the SAME 8-scorer engine that produced rec.score.
 */
export function computeWindowSlotScores(
  beach: Beach,
  windowStart: Date,
  windowEnd: Date,
  allHourly: EnhancedForecastEntity[],
  engine: ScoringEngine,
): number[] {
  const inWindow = allHourly
    .filter((f) => {
      const t = new Date(f.forecast_at).getTime();
      return t >= windowStart.getTime() && t < windowEnd.getTime();
    })
    .sort(
      (a, b) =>
        new Date(a.forecast_at).getTime() -
        new Date(b.forecast_at).getTime(),
    );

  const profile = beachToSpotProfile(beach);
  return inWindow.map((f) => {
    try {
      const snapshot = forecastToSnapshot(f);
      const composite = engine.score({
        profile,
        snapshot,
        window: null,
        preferences: null,
      });
      return composite.total;
    } catch {
      return 0;
    }
  });
}

interface BuildRecsOptions {
  /** Optional skill level for the per-beach scoring options */
  userSkillLevel?: SkillLevel | null;
}

/**
 * Run a HeroScenarioFixture through the real discovery scoring engine and
 * return SurfDiscoveryRecommendation[] in the same shape the orchestrator
 * produces (modulo favorites/photo/distance enrichment).
 *
 * Output ordering: by score descending — same as `merged` in the orchestrator
 * before rerank. Each rec is populated with: beach, window, forecast, score,
 * subscores, spotProfile, windowSlotScores.
 */
export function buildRecsFromFixture(
  fixture: HeroScenarioFixture,
  options: BuildRecsOptions = {},
): SurfDiscoveryRecommendation[] {
  const engine = createDiscoveryScoringEngine();
  const beachesByKey: Record<string, Beach> = {
    "ocean-beach-pier": fixture.beaches.ob as unknown as Beach,
    "pacific-beach": fixture.beaches.pb as unknown as Beach,
    "crystal-pier": fixture.beaches.crystal as unknown as Beach,
  };

  const skillLevel: SkillLevel | null =
    options.userSkillLevel ??
    (fixture.userSkillLevel as SkillLevel | undefined) ??
    null;

  const recs: SurfDiscoveryRecommendation[] = [];

  for (const slug of Object.keys(beachesByKey)) {
    const beach = beachesByKey[slug]!;
    const forecasts = fixture.forecasts[slug] ?? [];
    if (forecasts.length === 0) continue;

    const window: PersonalizedForecastWindow | null = selectBestWindow(
      forecasts,
      beach,
      null,
    );
    if (!window) continue;

    const sourceForecast =
      window.sourceForecast ??
      forecasts.reduce(
        (closest, f) => {
          const fTime = new Date(f.forecast_at).getTime();
          const closestTime = new Date(closest.forecast_at).getTime();
          const target = window.start.getTime();
          return Math.abs(fTime - target) < Math.abs(closestTime - target)
            ? f
            : closest;
        },
        forecasts[0]!,
      );

    const detailedScore = scoreBeachWithEngine(
      engine,
      beach,
      sourceForecast,
      {
        userSkillLevel: skillLevel ?? undefined,
        beachSkillLevel: beach.skill_level,
      },
    );

    const slotScores = computeWindowSlotScores(
      beach,
      window.start,
      window.end,
      forecasts,
      engine,
    );

    // Strip sourceForecast from the response window (orchestrator does this too).
    const responseWindow: PersonalizedForecastWindow = { ...window };
    delete responseWindow.sourceForecast;

    recs.push({
      beach: beach as Beach & { photo_url?: string | null },
      window: responseWindow,
      forecast: sourceForecast,
      score: detailedScore.total,
      matchQuality: detailedScore.matchQuality,
      subscores: detailedScore.subscores,
      summary: `${beach.name}: ${detailedScore.matchQuality}`,
      reasons: detailedScore.reasons,
      warnings: detailedScore.warnings,
      conditionBadges: detailedScore.conditionBadges,
      waveHeightBadge: detailedScore.waveHeightBadge,
      spotProfile: beachToSpotProfile(beach),
      windowSlotScores: slotScores,
      similarity: null,
      generated_at: new Date().toISOString(),
    });
  }

  recs.sort((a, b) => b.score - a.score);
  return recs;
}
