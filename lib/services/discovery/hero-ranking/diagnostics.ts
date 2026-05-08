/**
 * Hero-ranking diagnostics
 *
 * Single source of truth for `hero_rank_candidate` log lines emitted from the
 * discovery orchestrator. Phase 1 (this module) ships placeholder zeros for
 * the four computed-later fields; Phase 2 (Task 5) replaces those zeros with
 * values from `rerankHero(...)`.
 *
 * Subscore field names mirror `types/personalization.ts:178-193` exactly —
 * do not invent new keys here.
 */
import { createContextLogger } from '@/lib/logger';

const log = createContextLogger('HeroRanking');

export interface HeroRankingDiagnostic {
  beachSlug: string;
  representativeSlotScore: number;
  /** 0-100 — Task 4 fills, Task 2 ships zero placeholder */
  setupSuitability: number;
  /** = rec.subscores.windAlignment (0-20) */
  windAlignment: number;
  /** = rec.subscores.tideFit (0-15) */
  tideFit: number;
  /** = rec.subscores.waveHeightFit (0-25) */
  waveHeightFit: number;
  /** = rec.subscores.periodEnergyScore (0-20) */
  periodEnergyScore: number;
  /** = rec.subscores.affinityBonus */
  affinityBonus: number;
  windowDurationHours: number;
  /** 0-100 — Task 4 fills, Task 2 ships zero placeholder */
  windowPersistence: number;
  /** 0-100 — Task 4 fills, Task 2 ships zero placeholder */
  heroWindowScore: number;
  finalRank: number;
  isHero: boolean;
  /**
   * Cluster-shared setup signal that fed `setupSuitability` for this
   * candidate (Task 8). Same value across every diagnostic in a single
   * `rerankHero` call — slight redundancy makes individual log lines
   * self-explanatory in production.
   */
  sharedSetupSignal: {
    directionDeg: number | null;
    periodS: number | null;
    source: "cluster-majority" | "fallback";
  };
}

export function logHeroRankingDiagnostic(d: HeroRankingDiagnostic): void {
  log.info('hero_rank_candidate', d);
}
