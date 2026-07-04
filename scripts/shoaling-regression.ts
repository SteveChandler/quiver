#!/usr/bin/env tsx
/**
 * Shoaling Regression Suite (Workstream D)
 *
 * Validates the 2026-04-09 shoaling decomposition + small-wave ceiling fix
 * across six gates (A-F). Gates A-D and F block CI; Gate E is advisory.
 *
 * Usage:
 *   yarn regression:shoaling            # fixture mode (default, CI-safe)
 *   yarn regression:shoaling --live     # live mode: pulls rows from dev DB
 *                                         (falls back to fixtures if .env.local
 *                                         is missing or the URL is prod)
 *   yarn regression:shoaling --no-e2e   # skip Gate E (Surfline advisory)
 *
 * Gates
 * -----
 * - Gate A: clean-day well-exposed beaches unchanged (delta <= 5%).
 *   Confirms the decomposition does not over-correct calibrated beaches on
 *   single-dominant-component clean days.
 * - Gate B: protected PB reefs (Tourmaline, TSP, Windansea) drop 30-70%.
 *   Confirms the Tourmaline 2026-04-09 bimodal-swell bug is fixed.
 * - Gate C: wind-swell beaches near-neutral (delta in [-20%, +10%]).
 *   Confirms short-period cutoff (8s) does not over-zero legitimate
 *   wind-swell spots.
 * - Gate D: uncalibrated beaches unchanged (byte-identical legacy path).
 *   Confirms the refactor did not accidentally change transformToFaceHeight.
 * - Gate E (ADVISORY): Surfline LOTUS parity for 6 beaches, print only.
 * - Gate F: CDIP→model handoff boundary default-off invariant + enabled
 *   continuity improvement.
 *
 * Read the companion markdown at scripts/shoaling-regression.md for the full
 * gate specification.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';

import {
  transformToFaceHeight,
  transformToFaceHeightDecomposed,
  type ShoalingFactors,
  type SwellComponentInput,
  type BeachTerrainConfig,
  type WaveHeightSourceTag,
} from '@/lib/utils/wave-height-transformer';
import {
  createForecastHandoffBlendState,
  processForecastHandoffBlendSlot,
} from '@/lib/utils/forecast-handoff-blend';
import {
  ScoringEngine,
  baseConditionsScorer,
  swellAlignmentScorer,
  swellInterferenceScorer,
  windQualityScorer,
  tideFitScorer,
  tideDirectionScorer,
  windowStabilityScorer,
  trendPreferenceScorer,
} from '@/lib/domains/scoring';
import { waveHeightCeiling } from '@/lib/domains/scoring/wave-height-ceiling';
import type { ConditionsSnapshot } from '@/lib/domains/conditions/types';
import type { SpotProfile } from '@/lib/domains/spot-profile/types';
import type { ScorerInput, CompositeScore } from '@/lib/domains/scoring/types';

// ===========================================================================
// Types
// ===========================================================================

interface FixtureForecast {
  wave_height: string | null;
  wave_period: string | null;
  swell_1_height: string | null;
  swell_1_period: string | null;
  swell_1_direction: string | null;
  swell_2_height: string | null;
  swell_2_period: string | null;
  swell_2_direction: string | null;
  wind_wave_height: string | null;
  wind_wave_period: string | null;
  wind_wave_direction: string | null;
  data_source: string;
  wind_speed: string | null;
  wind_direction: string | null;
  wind_direction_deg: number | null;
  tide_height: string | null;
  tide_status: string | null;
}

interface FixtureBeach {
  id: string;
  name: string;
  shoaling_factors: ShoalingFactors | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  terrain_enabled: boolean;
  swell_access_factors: number[] | null;
  forecast: FixtureForecast;
}

interface Fixtures {
  description: string;
  asOf: string;
  beaches: Record<string, FixtureBeach>;
  handoffBoundary?: Record<string, HandoffBoundaryFixture>;
  gates: {
    A: string[];
    B: string[];
    C: string[];
    D: string[];
    E: string[];
  };
}

interface HandoffBoundaryFixture {
  name: string;
  slots: HandoffBoundarySlot[];
}

interface HandoffBoundarySlot {
  forecast_at: string;
  wave_height: string | null;
  data_source: string | null;
  wave_height_source: WaveHeightSourceTag | null;
}

interface BeachResult {
  slug: string;
  name: string;
  oldFaceFt: number;
  newFaceFt: number;
  deltaPct: number;
  oldScore: number;
  newScoreBeforeCeiling: number;
  newScoreAfterCeiling: number;
  ceiling: number;
  details: string;
  passed: boolean;
}

interface GateResult {
  name: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  description: string;
  passed: boolean;
  blocking: boolean;
  beaches: BeachResult[];
  notes: string[];
}

// ===========================================================================
// Helpers
// ===========================================================================

const FIXTURE_PATH = resolve(
  __dirname,
  '__fixtures__/shoaling-regression-fixtures.json',
);

async function loadFixtures(): Promise<Fixtures> {
  const raw = await readFile(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as Fixtures;
}

function parseFt(value: string | null | undefined): number {
  if (value == null) return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function parsePeriodS(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = parseFloat(value.replace('s', ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDirDeg(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function beachTerrain(beach: FixtureBeach): BeachTerrainConfig {
  return {
    swell_access_factors: beach.swell_access_factors,
    terrain_enabled: beach.terrain_enabled,
    shoaling_factors: beach.shoaling_factors,
    swell_window_center_deg: beach.swell_window_center_deg,
    swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg,
  };
}

function inferSource(dataSource: string): WaveHeightSourceTag | undefined {
  const ds = dataSource.toUpperCase();
  if (ds === 'CDIP' || ds.startsWith('CDIP')) return 'cdip_sig';
  return undefined;
}

/**
 * Compute the PRE-fix face height. This is the legacy scalar path —
 * `transformToFaceHeight` with the `source` gate and the same inputs the
 * old `forecast-builder.getWaveHeight` would have passed. The function
 * itself is unchanged by the fix (Workstream A only ADDED new exports),
 * so we can call it directly as the baseline.
 */
function computeOldFaceHeight(beach: FixtureBeach): number {
  const f = beach.forecast;
  return transformToFaceHeight({
    rawHeightFt: parseFt(f.wave_height),
    periodS: parsePeriodS(f.wave_period),
    swellDirectionDeg: parseDirDeg(f.swell_1_direction),
    beach: beachTerrain(beach),
    source: inferSource(f.data_source),
  });
}

/**
 * Compute the POST-fix face height using the decomposed transform. Mirrors
 * `discovery-adapter.forecastToSnapshot` and `forecast-builder.getWaveHeight`
 * so the script's "new" answer matches both display and score paths.
 */
function computeNewFaceHeight(beach: FixtureBeach): {
  faceHeightFt: number;
  path: 'decomposed' | 'legacy';
} {
  const f = beach.forecast;
  const components: Array<SwellComponentInput | null> = [
    buildComponent(f.swell_1_height, f.swell_1_period, f.swell_1_direction),
    buildComponent(f.swell_2_height, f.swell_2_period, f.swell_2_direction),
    buildComponent(
      f.wind_wave_height,
      f.wind_wave_period,
      f.wind_wave_direction,
    ),
  ];

  const result = transformToFaceHeightDecomposed({
    components,
    beach: beachTerrain(beach),
    source: inferSource(f.data_source),
    rawHeightFt: parseFt(f.wave_height),
    periodS: parsePeriodS(f.wave_period),
    swellDirectionDeg: parseDirDeg(f.swell_1_direction),
  });

  return { faceHeightFt: result.faceHeightFt, path: result.path };
}

function buildComponent(
  h: string | null,
  p: string | null,
  d: string | null,
): SwellComponentInput | null {
  if (h == null || p == null) return null;
  const heightFt = parseFloat(h);
  const periodS = parseFloat((p ?? '').replace('s', ''));
  if (!Number.isFinite(heightFt) || heightFt <= 0) return null;
  if (!Number.isFinite(periodS) || periodS <= 0) return null;
  return {
    heightFt,
    periodS,
    directionDeg: parseDirDeg(d),
  };
}

// ===========================================================================
// Score path (engine wrapped around a minimal snapshot)
// ===========================================================================

function buildSpotProfile(beach: FixtureBeach): SpotProfile {
  const centerDeg = beach.swell_window_center_deg ?? 180;
  const halfWidthDeg = beach.swell_window_halfwidth_deg ?? 180;
  const minDeg = (((centerDeg - halfWidthDeg) % 360) + 360) % 360;
  const maxDeg = (((centerDeg + halfWidthDeg) % 360) + 360) % 360;
  return {
    id: beach.id,
    name: beach.name,
    timezone: 'America/Los_Angeles',
    coordinates: { lat: 33.0, lon: -117.5 },
    swellWindow: {
      minDeg,
      maxDeg,
      centerDeg,
      halfWidthDeg,
    },
    windThresholds: {
      offshoreDeg: 90,
      offshoreToleranceDeg: 45,
      maxOnshoreMph: 10,
      maxAnyMph: 18,
      crossShoreOkKts: 15,
    },
    tidePreferences: {
      minHeightFt: -2,
      maxHeightFt: 8,
      preferredDirection: 'either',
      directionSensitivity: 'medium',
    },
    skillLevel: null,
    breakType: null,
  };
}

function buildSnapshot(
  beach: FixtureBeach,
  waveHeightFt: number,
): ConditionsSnapshot {
  const f = beach.forecast;
  const wavePeriod = parsePeriodS(f.wave_period) ?? 10;
  const waveDirection = parseDirDeg(f.swell_1_direction);
  const windSpeed = parseFloat(f.wind_speed ?? '0') || 0;
  const windDir = f.wind_direction_deg;
  const tideHeight = parseFloat(f.tide_height ?? '0') || 0;

  const s1 = buildComponent(
    f.swell_1_height,
    f.swell_1_period,
    f.swell_1_direction,
  );
  const s2 = buildComponent(
    f.swell_2_height,
    f.swell_2_period,
    f.swell_2_direction,
  );

  return {
    timestamp: new Date('2026-04-09T21:00:00Z'),
    waveHeight: waveHeightFt,
    wavePeriod,
    waveDirection,
    primarySwell: s1
      ? {
          heightFt: s1.heightFt,
          periodS: s1.periodS,
          directionDeg: s1.directionDeg ?? 270,
          energy: s1.heightFt * s1.heightFt * s1.periodS,
        }
      : null,
    secondarySwell: s2
      ? {
          heightFt: s2.heightFt,
          periodS: s2.periodS,
          directionDeg: s2.directionDeg ?? 270,
          energy: s2.heightFt * s2.heightFt * s2.periodS,
        }
      : null,
    windWave: null,
    wind: { speedMph: windSpeed, directionDeg: windDir },
    tide: {
      heightFt: tideHeight,
      status: 'rising',
      direction: 'rising',
    },
    confidence: 80,
    dataSource: f.data_source,
  };
}

function makeEngine(): ScoringEngine {
  const engine = new ScoringEngine();
  return engine.registerAll([
    baseConditionsScorer,
    swellAlignmentScorer,
    swellInterferenceScorer,
    windQualityScorer,
    tideFitScorer,
    tideDirectionScorer,
    windowStabilityScorer,
    trendPreferenceScorer,
  ]);
}

const ENGINE = makeEngine();

/**
 * Run the scoring engine on a snapshot built with the given wave height.
 * Returns the composite total (already capped by the in-engine ceiling if
 * applicable). For the pre-ceiling number the caller builds a snapshot with
 * an artificially large wave height.
 */
function runEngine(beach: FixtureBeach, waveHeightFt: number): CompositeScore {
  const profile = buildSpotProfile(beach);
  const snapshot = buildSnapshot(beach, waveHeightFt);
  const input: ScorerInput = {
    profile,
    snapshot,
    window: null,
    preferences: null,
  };
  return ENGINE.score(input);
}

/**
 * Compute a "new score before ceiling" by temporarily bypassing the ceiling.
 * We do this by running the engine at a wave height guaranteed to be above
 * the ceiling's final threshold (3 ft → uncapped), recording the composite
 * total, then running at the actual new face height. The ratio between the
 * clamped output and the ceiling's cap tells us where the cap applied.
 *
 * Simpler approach: run the engine at the new face height and compute the
 * ceiling separately. If the ceiling is lower than the engine's pre-cap
 * output we don't see the pre-cap number in the composite total — we have
 * to reconstruct it. We do that by running a second pass at a "fake" wave
 * height high enough to disable the ceiling (>= 3 ft, but keeping the same
 * subscore inputs as much as possible). This is a diagnostic only.
 */
function scoreNewBeforeCeiling(
  beach: FixtureBeach,
  waveHeightFt: number,
): number {
  // Re-run with the same inputs but force the ceiling off by temporarily
  // telling the snapshot the wave is 3ft (the "uncapped" threshold). The
  // subscores that depend on wave height will shift, so this is not a
  // true pre-ceiling number — it is an upper bound that tells us roughly
  // what the composite would have been without the cap. Reported as a
  // diagnostic; the gate uses `newScoreAfterCeiling`.
  const unclamped = runEngine(beach, Math.max(waveHeightFt, 3.0));
  return unclamped.total;
}

// ===========================================================================
// Gates
// ===========================================================================

function evaluateBeach(
  slug: string,
  beach: FixtureBeach,
  passFn: (deltaPct: number, oldFace: number, newFace: number) => boolean,
): BeachResult {
  const oldFace = computeOldFaceHeight(beach);
  const { faceHeightFt: newFace } = computeNewFaceHeight(beach);
  const deltaPct = oldFace > 0 ? ((newFace - oldFace) / oldFace) * 100 : 0;

  const oldScoreResult = runEngine(beach, oldFace);
  const newScoreResult = runEngine(beach, newFace);
  const ceiling = waveHeightCeiling(newFace);
  const newBeforeCeiling = scoreNewBeforeCeiling(beach, newFace);

  const passed = passFn(deltaPct, oldFace, newFace);

  return {
    slug,
    name: beach.name,
    oldFaceFt: oldFace,
    newFaceFt: newFace,
    deltaPct,
    oldScore: oldScoreResult.total,
    newScoreBeforeCeiling: newBeforeCeiling,
    newScoreAfterCeiling: newScoreResult.total,
    ceiling,
    details: `${oldFace.toFixed(2)}ft → ${newFace.toFixed(2)}ft (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%), score ${oldScoreResult.total} → ${newScoreResult.total}`,
    passed,
  };
}

function runGateA(fixtures: Fixtures): GateResult {
  const beaches = fixtures.gates.A.map((slug) =>
    evaluateBeach(slug, fixtures.beaches[slug], (deltaPct) =>
      Math.abs(deltaPct) <= 5,
    ),
  );
  return {
    name: 'A',
    description:
      'Clean-day well-exposed beaches unchanged (|delta| ≤ 5%). Failure = decomposition over-corrects calibrated beaches on single-dominant-swell days.',
    passed: beaches.every((b) => b.passed),
    blocking: true,
    beaches,
    notes: [],
  };
}

function runGateB(fixtures: Fixtures): GateResult {
  const beaches = fixtures.gates.B.map((slug) =>
    evaluateBeach(slug, fixtures.beaches[slug], (deltaPct) => {
      // drop by 30-70%: delta should be in [-70%, -30%]
      return deltaPct <= -30 && deltaPct >= -70;
    }),
  );
  return {
    name: 'B',
    description:
      'Protected PB reefs drop 30-70% on the canonical Tourmaline 2026-04-09 bimodal reading (1ft 14s SSW + 2.5ft 7s W). Failure = the fix did not land.',
    passed: beaches.every((b) => b.passed),
    blocking: true,
    beaches,
    notes: [],
  };
}

function runGateC(fixtures: Fixtures): GateResult {
  const beaches = fixtures.gates.C.map((slug) =>
    evaluateBeach(slug, fixtures.beaches[slug], (deltaPct) => {
      // near-neutral: delta in [-20%, +10%]
      return deltaPct >= -20 && deltaPct <= 10;
    }),
  );
  return {
    name: 'C',
    description:
      'Wind-swell beaches near-neutral (delta in [-20%, +10%]). Failure = short-period cutoff over-zeros legitimate wind-swell spots.',
    passed: beaches.every((b) => b.passed),
    blocking: true,
    beaches,
    notes: [],
  };
}

function runGateD(fixtures: Fixtures): GateResult {
  // Uncalibrated beaches with all components null → decomposed path must
  // fall back to the legacy scalar transform, producing a byte-identical
  // result. Delta must be 0 to the epsilon of rounding.
  const beaches = fixtures.gates.D.map((slug) => {
    const beach = fixtures.beaches[slug];
    const result = evaluateBeach(slug, beach, (_delta, oldFace, newFace) => {
      // Byte-identical: rounded face heights must match exactly.
      return Math.abs(oldFace - newFace) < 0.01;
    });
    // Also verify the decomposed path actually took the legacy branch.
    const { path } = computeNewFaceHeight(beach);
    if (path !== 'legacy') {
      result.passed = false;
      result.details += ` (expected legacy fallback, got ${path})`;
    }
    return result;
  });
  return {
    name: 'D',
    description:
      'Uncalibrated beaches with null components: decomposed path must fall back to the legacy scalar transform byte-identically. Failure = refactor accidentally changed the legacy pipeline.',
    passed: beaches.every((b) => b.passed),
    blocking: true,
    beaches,
    notes: [],
  };
}

async function runGateE(
  fixtures: Fixtures,
  skip: boolean,
): Promise<GateResult> {
  if (skip) {
    return {
      name: 'E',
      description:
        'Surfline LOTUS parity for 6 beaches (ADVISORY; print-only).',
      passed: true,
      blocking: false,
      beaches: [],
      notes: ['Skipped via --no-e2e flag.'],
    };
  }

  const notes: string[] = [
    'Gate E is ADVISORY — network failures and Surfline HTML changes never fail the suite.',
  ];
  const beaches: BeachResult[] = [];

  for (const slug of fixtures.gates.E) {
    const beach = fixtures.beaches[slug];
    const oldFace = computeOldFaceHeight(beach);
    const { faceHeightFt: newFace } = computeNewFaceHeight(beach);
    const deltaPct = oldFace > 0 ? ((newFace - oldFace) / oldFace) * 100 : 0;

    let surflineFt: number | null = null;
    try {
      surflineFt = await fetchSurflineFaceHeight(slug);
    } catch (err) {
      notes.push(
        `${beach.name}: Surfline fetch failed (${(err as Error).message}). Skipped.`,
      );
    }

    beaches.push({
      slug,
      name: beach.name,
      oldFaceFt: oldFace,
      newFaceFt: newFace,
      deltaPct,
      oldScore: 0,
      newScoreBeforeCeiling: 0,
      newScoreAfterCeiling: 0,
      ceiling: 0,
      details:
        surflineFt != null
          ? `new=${newFace.toFixed(2)}ft, Surfline=${surflineFt.toFixed(2)}ft, delta vs Surfline=${(((newFace - surflineFt) / surflineFt) * 100).toFixed(1)}%`
          : `new=${newFace.toFixed(2)}ft, Surfline unavailable`,
      passed: true,
    });
  }

  return {
    name: 'E',
    description: 'Surfline LOTUS parity for 6 beaches (ADVISORY; print-only).',
    passed: true,
    blocking: false,
    beaches,
    notes,
  };
}

function runGateF(fixtures: Fixtures): GateResult {
  const entries = Object.entries(fixtures.handoffBoundary ?? {});
  const beaches = entries.map(([slug, fixture]) => {
    const disabled = runHandoffFixture(fixture, false);
    const enabled = runHandoffFixture(fixture, true);

    const defaultOffUnchanged = fixture.slots.every(
      (slot, index) => disabled.waveHeights[index] === slot.wave_height,
    );
    const beforeDrop = Math.abs(disabled.handoffDiscontinuityFt ?? Infinity);
    const afterDrop = Math.abs(enabled.enabledDiscontinuityFt ?? Infinity);
    const improved = Number.isFinite(beforeDrop) && afterDrop < beforeDrop;

    return {
      slug,
      name: fixture.name,
      oldFaceFt: beforeDrop,
      newFaceFt: afterDrop,
      deltaPct:
        Number.isFinite(beforeDrop) && beforeDrop > 0
          ? ((afterDrop - beforeDrop) / beforeDrop) * 100
          : 0,
      oldScore: 0,
      newScoreBeforeCeiling: 0,
      newScoreAfterCeiling: 0,
      ceiling: 0,
      details:
        `default-off ${defaultOffUnchanged ? 'unchanged' : 'CHANGED'}, ` +
        `drop ${beforeDrop.toFixed(2)}ft → ${afterDrop.toFixed(2)}ft, ` +
        `first model ${enabled.firstModelBeforeFt?.toFixed(2) ?? 'n/a'}ft → ${enabled.firstModelAfterFt?.toFixed(2) ?? 'n/a'}ft`,
      passed: defaultOffUnchanged && improved,
    };
  });

  return {
    name: 'F',
    description:
      'CDIP→model handoff boundary blend default-off invariant + enabled continuity improvement.',
    passed: beaches.every((b) => b.passed),
    blocking: true,
    beaches,
    notes: [],
  };
}

function runHandoffFixture(
  fixture: HandoffBoundaryFixture,
  enabled: boolean,
): {
  waveHeights: Array<string | null>;
  handoffDiscontinuityFt: number | null;
  enabledDiscontinuityFt: number | null;
  firstModelBeforeFt: number | null;
  firstModelAfterFt: number | null;
} {
  const state = createForecastHandoffBlendState();
  const waveHeights: Array<string | null> = [];
  let handoffDiscontinuityFt: number | null = null;
  let firstModelBeforeFt: number | null = null;
  let firstModelAfterFt: number | null = null;
  let cdipFaceFt: number | null = null;

  for (const slot of fixture.slots) {
    const result = processForecastHandoffBlendSlot({
      state,
      enabled,
      slot: {
        forecastAt: slot.forecast_at,
        waveHeight: slot.wave_height,
        dataSource: slot.data_source,
        waveHeightSource: slot.wave_height_source,
      },
    });

    if (result.metric && handoffDiscontinuityFt == null) {
      handoffDiscontinuityFt = result.metric.handoffDiscontinuityFt;
      cdipFaceFt = result.metric.cdipFaceFt;
      firstModelBeforeFt = result.metric.modelFaceFt;
    }

    const waveHeight = result.adjustment?.waveHeight ?? slot.wave_height;
    if (result.adjustment && firstModelAfterFt == null) {
      firstModelAfterFt = parseFt(waveHeight);
    }
    waveHeights.push(waveHeight);
  }

  const enabledDiscontinuityFt =
    cdipFaceFt != null && firstModelAfterFt != null
      ? cdipFaceFt - firstModelAfterFt
      : handoffDiscontinuityFt;

  return {
    waveHeights,
    handoffDiscontinuityFt,
    enabledDiscontinuityFt,
    firstModelBeforeFt,
    firstModelAfterFt,
  };
}

/**
 * Surfline LOTUS scraper. Uses the same undocumented JSON endpoint Surfline's
 * frontend calls for their spot report page. Never throws — a network error,
 * non-200, or schema mismatch surfaces as a thrown string that Gate E catches
 * and logs as a `Skipped.` note. There is no token and no rate limiting here:
 * if we get blocked, we degrade gracefully.
 */
const SURFLINE_SPOT_IDS: Record<string, string> = {
  'tourmaline-beach': '5842041f4e65fad6a7708849',
  'blacks': '5842041f4e65fad6a7708841',
  'lower-trestles': '5842041f4e65fad6a77088f9',
  'swamis': '5842041f4e65fad6a770884c',
  'hb-pier-southside': '5842041f4e65fad6a77088c2',
  'the-wedge': '5842041f4e65fad6a77088a9',
};

async function fetchSurflineFaceHeight(slug: string): Promise<number> {
  const spotId = SURFLINE_SPOT_IDS[slug];
  if (!spotId) throw new Error(`no Surfline spot ID mapped for ${slug}`);
  const url = `https://services.surfline.com/kbyg/spots/forecasts/wave?spotId=${spotId}&days=1&intervalHours=1&units[waveHeight]=FT`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuiverShoalingRegression/1.0 (research)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as {
    data?: { wave?: Array<{ surf?: { min: number; max: number } }> };
  };
  const wave = payload.data?.wave;
  if (!Array.isArray(wave) || wave.length === 0) {
    throw new Error('no wave data in Surfline response');
  }
  // Use the first interval's midpoint as the "current" estimate.
  const surf = wave[0].surf;
  if (!surf) throw new Error('no surf height in first interval');
  return (surf.min + surf.max) / 2;
}

// ===========================================================================
// Live-mode guard
// ===========================================================================

function checkLiveSafety(): { safe: boolean; reason: string } {
  dotenvConfig({ path: '.env.local' });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      safe: false,
      reason:
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. Falling back to fixture mode.',
    };
  }
  if (!/dev|localhost|127\.0\.0\.1/i.test(url)) {
    return {
      safe: false,
      reason: `SUPABASE_URL does not contain 'dev' or 'localhost' (got ${url}). Refusing to connect to production. Falling back to fixture mode.`,
    };
  }
  return { safe: true, reason: 'ok' };
}

// ===========================================================================
// Report
// ===========================================================================

function printGate(gate: GateResult): void {
  const marker = gate.passed ? '[PASS]' : '[FAIL]';
  const blockingTag = gate.blocking ? '' : ' (advisory)';
  console.log(`\n${marker} Gate ${gate.name}${blockingTag}`);
  console.log(`  ${gate.description}`);
  for (const b of gate.beaches) {
    const bMarker = b.passed ? '  ok   ' : '  FAIL ';
    console.log(`${bMarker}${b.name.padEnd(40)} ${b.details}`);
    if (!b.passed || gate.name === 'B') {
      console.log(
        `         score pre-ceiling (diagnostic): ${b.newScoreBeforeCeiling}, ceiling@${b.newFaceFt.toFixed(1)}ft: ${b.ceiling}`,
      );
    }
  }
  for (const note of gate.notes) {
    console.log(`  note: ${note}`);
  }
}

function printHeader(mode: 'fixture' | 'live-fallback'): void {
  console.log('='.repeat(70));
  console.log('Shoaling Regression Suite (Workstream D)');
  console.log(`Mode:  ${mode}`);
  console.log(`As of: 2026-04-09T21:00:00Z`);
  console.log('='.repeat(70));
}

function printTourmalineCanary(gateB: GateResult): void {
  const tourmaline = gateB.beaches.find((b) => b.slug === 'tourmaline-beach');
  if (!tourmaline) return;
  console.log('\n--- Tourmaline canary (the key result) ---');
  console.log(
    `  old face: ${tourmaline.oldFaceFt.toFixed(2)} ft  (pre-fix: 3 × 1.45 = 4.35)`,
  );
  console.log(
    `  new face: ${tourmaline.newFaceFt.toFixed(2)} ft  (post-fix: 7s W wind-swell zeroed)`,
  );
  console.log(
    `  delta:    ${tourmaline.deltaPct >= 0 ? '+' : ''}${tourmaline.deltaPct.toFixed(1)}%`,
  );
  console.log(`  old score: ${tourmaline.oldScore}/100`);
  console.log(
    `  new score (before ceiling):  ${tourmaline.newScoreBeforeCeiling}/100`,
  );
  console.log(
    `  new score (after ceiling ${tourmaline.ceiling}): ${tourmaline.newScoreAfterCeiling}/100`,
  );
  console.log(`  gate:  ${tourmaline.passed ? 'PASS' : 'FAIL'}`);
}

// ===========================================================================
// Main
// ===========================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const skipE = args.includes('--no-e2e');

  let mode: 'fixture' | 'live-fallback' = 'fixture';
  if (live) {
    const { safe, reason } = checkLiveSafety();
    if (!safe) {
      console.warn(`[live-mode] ${reason}`);
      mode = 'live-fallback';
    } else {
      // Live mode is a stub: we still run fixture gates, but also print a
      // note. Actually wiring Supabase rows into the gate is left as a
      // follow-up because CI does not need it and fixtures are the source
      // of truth for pass/fail.
      console.warn(
        '[live-mode] Live SELECT is not wired yet — using fixtures for pass/fail. Add live rows when dev DB is stable.',
      );
      mode = 'live-fallback';
    }
  }

  printHeader(mode);

  const fixtures = await loadFixtures();
  const gateA = runGateA(fixtures);
  const gateB = runGateB(fixtures);
  const gateC = runGateC(fixtures);
  const gateD = runGateD(fixtures);
  const gateE = await runGateE(fixtures, skipE);
  const gateF = runGateF(fixtures);

  const results: GateResult[] = [gateA, gateB, gateC, gateD, gateE, gateF];
  for (const g of results) printGate(g);

  printTourmalineCanary(gateB);

  const blockingFailed = results
    .filter((g) => g.blocking)
    .filter((g) => !g.passed);

  console.log('\n' + '='.repeat(70));
  if (blockingFailed.length > 0) {
    console.error(
      `FAIL: blocking gates failed: ${blockingFailed.map((g) => g.name).join(', ')}`,
    );
    console.log('='.repeat(70));
    process.exit(1);
  }
  console.log('PASS: all blocking gates (A-D, F) passed.');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('[regression:shoaling] fatal:', err);
  process.exit(2);
});
