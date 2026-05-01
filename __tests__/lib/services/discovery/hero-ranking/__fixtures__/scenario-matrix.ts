/**
 * Hero-ranking scenario matrix — 16 deterministic OB / PB / Crystal Pier fixtures
 *
 * Each fixture provides 24 hourly forecast rows per beach. Used by Task 5's
 * scenario-matrix.test.ts to assert that `rerankHero` selects the correct
 * hero across canonical short-period W setups, mixed/south PB-favoring days,
 * tide/wind interactions, and user-personalization scenarios.
 *
 * Beach config below is frozen from prod DB on 2026-04-30 via
 * `npx tsx scripts/freeze-sd-beach-fixture.ts`.
 */
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// =============================================================================
// Frozen beach constants (from prod DB 2026-04-30)
// =============================================================================
//
// Note: `swell_window_min_deg=220, swell_window_max_deg=5` for OB Pier wraps
// through north. Do NOT normalize. The SwellWindow factory at
// lib/domains/spot-profile/spot-profile.ts:75-99 handles wraparound.

type FrozenBeach = Partial<Beach> & {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lon: number;
  timezone: string;
  swell_window_min_deg: number;
  swell_window_max_deg: number;
  wind_offshore_deg: number;
  wind_offshore_tol_deg: number;
  preferred_tide_ft_min: number;
  preferred_tide_ft_max: number;
  preferred_tide_direction: string;
  skill_level: string;
  break_type: string;
};

export const SD_BEACHES: {
  ob: FrozenBeach;
  pb: FrozenBeach;
  crystal: FrozenBeach;
} = {
  // Ocean Beach Pier — exposed beach break, wraparound window catches W/WNW/N
  ob: {
    id: "65d177de-e75a-4ad8-aa0d-48a67c0851b0",
    slug: "ocean-beach-pier",
    name: "Ocean Beach Pier",
    lat: 32.7486,
    lon: -117.2543,
    timezone: "America/Los_Angeles",
    swell_window_min_deg: 220,
    swell_window_max_deg: 5,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 45,
    preferred_tide_ft_min: 0,
    preferred_tide_ft_max: 4,
    preferred_tide_direction: "rising",
    skill_level: "advanced",
    break_type: "beach",
  },
  // Pacific Beach — beach break, narrower W/SW window
  pb: {
    id: "65809772-20bc-4009-b9b2-89c8ef3c4127",
    slug: "pacific-beach",
    name: "Pacific Beach",
    lat: 32.7979,
    lon: -117.255,
    timezone: "America/Los_Angeles",
    swell_window_min_deg: 190,
    swell_window_max_deg: 310,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 30,
    preferred_tide_ft_min: 1.5,
    preferred_tide_ft_max: 4.5,
    preferred_tide_direction: "falling",
    skill_level: "beginner-intermediate",
    break_type: "beach",
  },
  // Crystal Pier — jetty break, very wide window (halfWidth 128°)
  crystal: {
    id: "cc7c0837-257c-42c3-9d98-634911e73a6a",
    slug: "crystal-pier",
    name: "Crystal Pier",
    lat: 32.795,
    lon: -117.257,
    timezone: "America/Los_Angeles",
    swell_window_min_deg: 55,
    swell_window_max_deg: 310,
    wind_offshore_deg: 45,
    wind_offshore_tol_deg: 45,
    preferred_tide_ft_min: 3,
    preferred_tide_ft_max: 5,
    preferred_tide_direction: "rising",
    skill_level: "intermediate-advanced",
    break_type: "jetty",
  },
};

// =============================================================================
// Fixture type
// =============================================================================

export interface HeroScenarioFixture {
  name: string;
  beaches: { ob: FrozenBeach; pb: FrozenBeach; crystal: FrozenBeach };
  forecasts: Record<string, EnhancedForecastEntity[]>; // keyed by beach slug
  expectedHero: "ocean-beach-pier" | "pacific-beach" | "crystal-pier";
  expectedOrder?: string[];
  allowTie?: boolean;
  notes: string;
  /** Optional: skill level / personalization knobs used by build-recs */
  userSkillLevel?: "beginner" | "intermediate" | "advanced" | "expert";
}

// =============================================================================
// Forecast row factory
// =============================================================================

/**
 * Build a 24-hour deterministic forecast series for a single beach.
 *
 * `params` describe the swell setup at the peak hour; the helper produces
 * a smooth diurnal envelope (height/wind/tide vary plausibly across the day)
 * keeping swell direction/period constant unless `secondarySwell` is set.
 * Returns 24 hourly rows starting at `dateBase` (UTC midnight).
 */
interface SeriesParams {
  beachId: string;
  dateBase: string; // YYYY-MM-DD
  waveHeightFt: number; // representative around 14:00Z
  wavePeriodS: number;
  primaryDirDeg: number;
  secondaryHeightFt?: number;
  secondaryPeriodS?: number;
  secondaryDirDeg?: number;
  windWaveHeightFt?: number;
  windWavePeriodS?: number;
  windWaveDirDeg?: number;
  windSpeedMph: number;
  windDirDeg: number;
  /** tide highs in feet at hours-of-day [t1, h1, t2, h2] (UTC). Linear interpolation between. */
  tideKeyframes: Array<{ hour: number; heightFt: number }>;
}

function tideAt(hour: number, kf: SeriesParams["tideKeyframes"]): number {
  // Linear interpolation between sorted keyframes; clamps at ends
  const sorted = [...kf].sort((a, b) => a.hour - b.hour);
  if (hour <= sorted[0].hour) return sorted[0].heightFt;
  if (hour >= sorted[sorted.length - 1].hour) {
    return sorted[sorted.length - 1].heightFt;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (hour >= a.hour && hour <= b.hour) {
      const t = (hour - a.hour) / (b.hour - a.hour);
      return a.heightFt + t * (b.heightFt - a.heightFt);
    }
  }
  return sorted[sorted.length - 1].heightFt;
}

function tideStatusFor(
  hour: number,
  kf: SeriesParams["tideKeyframes"],
): string {
  // Tide status: rising when next keyframe is higher, falling when lower,
  // slack within ±0.3ft of nearest keyframe peak.
  const sorted = [...kf].sort((a, b) => a.hour - b.hour);
  const here = tideAt(hour, kf);
  const next = tideAt(hour + 0.5, kf);
  const prev = tideAt(hour - 0.5, kf);

  const isPeak = sorted.some(
    (k) => Math.abs(k.hour - hour) < 0.5 && Math.abs(k.heightFt - here) < 0.3,
  );
  if (isPeak) {
    return here > 2.5 ? "slack-high" : "slack-low";
  }
  if (next > prev) return "rising";
  if (next < prev) return "falling";
  return "rising";
}

function buildSeries(params: SeriesParams): EnhancedForecastEntity[] {
  const rows: EnhancedForecastEntity[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = h.toString().padStart(2, "0");
    const forecastAt = `${params.dateBase}T${hh}:00:00Z`;
    // Smooth diurnal envelope: height +/- 15% across the day, peak around 14:00Z.
    const heightDelta = Math.cos(((h - 14) * Math.PI) / 12) * 0.15;
    const waveHeight = Math.max(
      0.5,
      params.waveHeightFt * (1 + heightDelta),
    );
    const tideHeight = tideAt(h, params.tideKeyframes);
    const tideStatus = tideStatusFor(h, params.tideKeyframes);

    // Wind freshens slightly afternoon (typical SD onshore pattern)
    const windDelta = Math.max(0, (h - 10) / 14) * 0.4;
    const windSpeed = params.windSpeedMph * (1 + windDelta);

    rows.push({
      id: `${params.beachId}-${forecastAt}`,
      beach_id: params.beachId,
      forecast_at: forecastAt,
      forecast_date: params.dateBase,
      forecast_time: `${hh}:00`,
      wave_height: waveHeight.toFixed(1),
      wave_period: `${params.wavePeriodS}s`,
      wave_direction: String(params.primaryDirDeg),
      swell_1_height: waveHeight.toFixed(1),
      swell_1_period: `${params.wavePeriodS}s`,
      swell_1_direction: String(params.primaryDirDeg),
      swell_2_height:
        params.secondaryHeightFt != null
          ? params.secondaryHeightFt.toFixed(1)
          : null,
      swell_2_period:
        params.secondaryPeriodS != null
          ? `${params.secondaryPeriodS}s`
          : null,
      swell_2_direction:
        params.secondaryDirDeg != null
          ? String(params.secondaryDirDeg)
          : null,
      wind_wave_height:
        params.windWaveHeightFt != null
          ? params.windWaveHeightFt.toFixed(1)
          : null,
      wind_wave_period:
        params.windWavePeriodS != null
          ? `${params.windWavePeriodS}s`
          : null,
      wind_wave_direction:
        params.windWaveDirDeg != null ? String(params.windWaveDirDeg) : null,
      wind_speed: windSpeed.toFixed(1),
      wind_direction: String(params.windDirDeg),
      wind_direction_deg: params.windDirDeg,
      tide_height: tideHeight.toFixed(2),
      tide_status: tideStatus,
      water_temp: "62",
      weather_condition: "clear",
      confidence_score: 80,
      data_source: "NOAA_NWS",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    } as EnhancedForecastEntity);
  }
  return rows;
}

/**
 * Build forecasts for all three SD beaches with shared meteorological inputs.
 * Each beach gets its own beach_id and series, but the swell/wind/tide are identical
 * (this is realistic: the three are within ~5km, same offshore wave field).
 *
 * Tide differs by beach since OB and PB respond to slightly different tide preferences,
 * but the TIDE field itself is the same — the scoring engine reads the beach's
 * `preferred_tide_ft_*` to grade it.
 */
function buildAllBeaches(
  shared: Omit<SeriesParams, "beachId">,
): Record<string, EnhancedForecastEntity[]> {
  return {
    "ocean-beach-pier": buildSeries({ ...shared, beachId: SD_BEACHES.ob.id }),
    "pacific-beach": buildSeries({ ...shared, beachId: SD_BEACHES.pb.id }),
    "crystal-pier": buildSeries({ ...shared, beachId: SD_BEACHES.crystal.id }),
  };
}

/**
 * Build forecasts where each beach gets its own independent swell params
 * (used for divergent-swell scenarios where one beach is geometrically
 * blocked from a swell train its neighbors see). Tide and date are shared
 * — divergence is wave-only.
 */
function buildAllBeachesDivergent(
  common: { dateBase: string; tideKeyframes: SeriesParams["tideKeyframes"] },
  perBeach: {
    ob: Omit<SeriesParams, "beachId" | "dateBase" | "tideKeyframes">;
    pb: Omit<SeriesParams, "beachId" | "dateBase" | "tideKeyframes">;
    crystal: Omit<SeriesParams, "beachId" | "dateBase" | "tideKeyframes">;
  },
): Record<string, EnhancedForecastEntity[]> {
  return {
    "ocean-beach-pier": buildSeries({
      ...perBeach.ob,
      ...common,
      beachId: SD_BEACHES.ob.id,
    }),
    "pacific-beach": buildSeries({
      ...perBeach.pb,
      ...common,
      beachId: SD_BEACHES.pb.id,
    }),
    "crystal-pier": buildSeries({
      ...perBeach.crystal,
      ...common,
      beachId: SD_BEACHES.crystal.id,
    }),
  };
}

// =============================================================================
// Standard tide curves (24h)
// =============================================================================

const TIDE_RISING_MORNING = [
  { hour: 0, heightFt: 1.5 },
  { hour: 6, heightFt: -0.5 },
  { hour: 13, heightFt: 4.5 }, // mid-afternoon high
  { hour: 19, heightFt: 0.8 },
  { hour: 23, heightFt: 2.0 },
];

const TIDE_FALLING_MORNING = [
  { hour: 0, heightFt: 4.0 },
  { hour: 7, heightFt: 4.5 }, // morning high
  { hour: 14, heightFt: 0.5 },
  { hour: 20, heightFt: 4.0 },
  { hour: 23, heightFt: 3.5 },
];

const TIDE_LOW_ALL_MORNING = [
  { hour: 0, heightFt: 2.0 },
  { hour: 4, heightFt: 4.5 }, // pre-dawn high
  { hour: 13, heightFt: -0.3 },
  { hour: 19, heightFt: 4.0 },
  { hour: 23, heightFt: 3.0 },
];

const TIDE_HIGH_PB_FAVORED = [
  // Tide profile that puts mid-day at 4ft falling — PB's preferred range
  { hour: 0, heightFt: 1.0 },
  { hour: 6, heightFt: 4.8 },
  { hour: 14, heightFt: 4.0 },
  { hour: 18, heightFt: 0.8 },
  { hour: 23, heightFt: 3.0 },
];

// =============================================================================
// Scenario matrix — 16 fixtures
// =============================================================================
//
// Layout:
//   Canonical (1-8):                short-period W/WNW setups; OB or Crystal should win
//   PB-wins-legitimately (9-11):    longer-period S/SW or proper PB tide windows
//   OB-wins-despite-tide (12-14):   ideal OB swell despite suboptimal tide
//   User-personalization (15-16):   skill-level driven preferences

export const scenarioMatrix: HeroScenarioFixture[] = [
  // -------------------------------------------------------------------------
  // 1. Canonical: short-period W swell @ 6s, 3ft, mid-day
  // -------------------------------------------------------------------------
  {
    name: "short-period W swell 270 @ 6s 3ft, light offshore",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3,
      wavePeriodS: 6,
      primaryDirDeg: 270,
      windSpeedMph: 4,
      windDirDeg: 90, // E offshore
      tideKeyframes: TIDE_RISING_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "Short-period W energy. PB's narrower window + windswell-aversion " +
      "should push it down; OB Pier converts this best.",
  },

  // -------------------------------------------------------------------------
  // 2. Canonical: short-period WNW @ 7s, 3.5ft, slack-high tide peak
  // -------------------------------------------------------------------------
  {
    name: "short-period WNW 285 @ 7s, slack-high tide at peak hour",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3.5,
      wavePeriodS: 7,
      primaryDirDeg: 285,
      windSpeedMph: 5,
      windDirDeg: 90,
      tideKeyframes: TIDE_HIGH_PB_FAVORED,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "Tests Task 0 slack-tide guard interaction. PB's mid-day high should NOT " +
      "carry it past OB on a short-period setup.",
  },

  // -------------------------------------------------------------------------
  // 3. Canonical: short-period W 270 @ 5s — true windswell, 2.5ft
  // -------------------------------------------------------------------------
  {
    name: "short-period windswell W 270 @ 5s 2.5ft, glassy",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 2.5,
      wavePeriodS: 5,
      primaryDirDeg: 270,
      windSpeedMph: 2,
      windDirDeg: 90,
      tideKeyframes: TIDE_RISING_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "Pure windswell. Crystal's super-wide window competes; OB still wins via " +
      "exposure-vs-period bonus for a beach pier converting short-period chop.",
  },

  // -------------------------------------------------------------------------
  // 4. Canonical: short-period W 280 @ 7s with a small SW background
  // -------------------------------------------------------------------------
  {
    name: "short-period W 280 @ 7s + SW 200 @ 12s background 1ft",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3,
      wavePeriodS: 7,
      primaryDirDeg: 280,
      secondaryHeightFt: 1,
      secondaryPeriodS: 12,
      secondaryDirDeg: 200,
      windSpeedMph: 5,
      windDirDeg: 90,
      tideKeyframes: TIDE_RISING_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "Mixed but dominant W. Background SW shouldn't be enough to flip the call " +
      "to PB — primary pulse is still W.",
  },

  // -------------------------------------------------------------------------
  // 5. Canonical: WNW 290 @ 8s, 4ft (still short-period band per spec)
  // -------------------------------------------------------------------------
  {
    name: "WNW 290 @ 8s 4ft, light offshore",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 4,
      wavePeriodS: 8,
      primaryDirDeg: 290,
      windSpeedMph: 4,
      windDirDeg: 90,
      tideKeyframes: TIDE_RISING_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "Boundary case at 8s. SetupSuitability period threshold is <= 8s; OB " +
      "should still win on alignment + exposure.",
  },

  // -------------------------------------------------------------------------
  // 6. Canonical: short-period N 350 @ 7s — wraparound test
  // -------------------------------------------------------------------------
  {
    name: "short-period N 350 @ 7s 3ft (OB wraparound test)",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3,
      wavePeriodS: 7,
      primaryDirDeg: 350,
      windSpeedMph: 5,
      windDirDeg: 90,
      tideKeyframes: TIDE_RISING_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "Direction = 350° must be INSIDE OB's 220→5° wraparound window. PB's " +
      "190-310 cuts off at 310 so 350° is OUTSIDE PB's window. If this fails, " +
      "the wraparound math in calculateWindowAlignment is broken.",
  },

  // -------------------------------------------------------------------------
  // 7. Canonical: W 270 @ 6s but wind has freshened to onshore
  // -------------------------------------------------------------------------
  {
    name: "W 270 @ 6s 3ft, onshore W wind 14mph",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3,
      wavePeriodS: 6,
      primaryDirDeg: 270,
      windSpeedMph: 14,
      windDirDeg: 270, // onshore W
      tideKeyframes: TIDE_RISING_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "All beaches degraded equally by wind. OB still has best setup match; " +
      "wind quality is uniformly bad so it shouldn't change the rank order.",
  },

  // -------------------------------------------------------------------------
  // 8. Canonical: short-period W with one fragile peak slot
  // -------------------------------------------------------------------------
  {
    name: "W 270 @ 6s 3ft, PB peak fragility test",
    beaches: SD_BEACHES,
    forecasts: (() => {
      const all = buildAllBeaches({
        dateBase: "2026-05-01",
        waveHeightFt: 3,
        wavePeriodS: 6,
        primaryDirDeg: 270,
        windSpeedMph: 4,
        windDirDeg: 90,
        tideKeyframes: TIDE_FALLING_MORNING,
      });
      // Spike PB's 14:00Z slot to look great briefly; surrounding slots stay weak.
      // Without windowPersistence this fragile peak could win the engine sort;
      // hero-window-score should reject it via low persistence.
      const pb = all["pacific-beach"]!;
      pb[14] = {
        ...pb[14]!,
        wave_height: "5",
        swell_1_period: "9s",
        wave_period: "9s",
      };
      return all;
    })(),
    expectedHero: "ocean-beach-pier",
    notes:
      "PB has one anomalously good slot at peak hour but the rest of the day " +
      "is weak. windowPersistence should keep OB ahead.",
  },

  // -------------------------------------------------------------------------
  // 9. PB wins legitimately: long-period SW 220 @ 14s, mid-tide falling
  // -------------------------------------------------------------------------
  {
    name: "long-period SW 220 @ 14s 4ft, mid-tide falling — PB favorite",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 4,
      wavePeriodS: 14,
      primaryDirDeg: 220,
      windSpeedMph: 4,
      windDirDeg: 90,
      tideKeyframes: TIDE_FALLING_MORNING,
    }),
    expectedHero: "pacific-beach",
    notes:
      "Long-period SW lines up perfectly with PB's preferred tide direction " +
      "(falling) and tide range. OB's wraparound advantage doesn't apply at 14s.",
  },

  // -------------------------------------------------------------------------
  // 10. PB wins: south swell 195 @ 15s 3.5ft
  // -------------------------------------------------------------------------
  {
    name: "S swell 195 @ 15s 3.5ft, glassy AM",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3.5,
      wavePeriodS: 15,
      primaryDirDeg: 195,
      windSpeedMph: 3,
      windDirDeg: 90,
      tideKeyframes: TIDE_FALLING_MORNING,
    }),
    expectedHero: "pacific-beach",
    notes:
      "Pure south swell. OB's window starts at 220°; 195° is outside it. " +
      "PB's 190-310 catches it cleanly.",
  },

  // -------------------------------------------------------------------------
  // 11. PB wins: clean SW 210 @ 12s, mid-tide
  // -------------------------------------------------------------------------
  {
    name: "SW 210 @ 12s 3ft, clean falling tide",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3,
      wavePeriodS: 12,
      primaryDirDeg: 210,
      windSpeedMph: 4,
      windDirDeg: 90,
      tideKeyframes: TIDE_HIGH_PB_FAVORED,
    }),
    expectedHero: "pacific-beach",
    notes:
      "Clean SW mid-period. PB's preferred tide range 1.5-4.5 hits at peak; " +
      "OB requires lower tide. This is a legitimate PB day.",
  },

  // -------------------------------------------------------------------------
  // 12. OB wins despite tide: short-period W on a high-tide day
  // -------------------------------------------------------------------------
  {
    name: "short-period W 270 @ 6s 3ft, all-day high tide (OB unfavored tide)",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3,
      wavePeriodS: 6,
      primaryDirDeg: 270,
      windSpeedMph: 4,
      windDirDeg: 90,
      tideKeyframes: [
        { hour: 0, heightFt: 4.5 },
        { hour: 12, heightFt: 5.0 },
        { hour: 23, heightFt: 4.5 },
      ],
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "Tide is wrong for OB (above 4ft preferred max all day). Short-period W " +
      "swell setup correctness should still beat PB on tideFit alone.",
  },

  // -------------------------------------------------------------------------
  // 13. OB wins despite tide: short-period WNW with PB tide direction wrong
  // -------------------------------------------------------------------------
  {
    name: "WNW 285 @ 7s 3ft, PB on rising tide (wrong direction)",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 3,
      wavePeriodS: 7,
      primaryDirDeg: 285,
      windSpeedMph: 4,
      windDirDeg: 90,
      tideKeyframes: TIDE_LOW_ALL_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    notes:
      "PB prefers falling tide; this fixture has rising tide most of the day. " +
      "OB's setup match wins outright.",
  },

  // -------------------------------------------------------------------------
  // 14. OB wins despite tide: short-period W with persistent steady window
  // -------------------------------------------------------------------------
  {
    name: "W 275 @ 7s, OB steady 4-hour window vs PB 1-hour spike",
    beaches: SD_BEACHES,
    forecasts: (() => {
      const all = buildAllBeaches({
        dateBase: "2026-05-01",
        waveHeightFt: 3,
        wavePeriodS: 7,
        primaryDirDeg: 275,
        windSpeedMph: 5,
        windDirDeg: 90,
        tideKeyframes: TIDE_RISING_MORNING,
      });
      // Make PB worse outside one peak slot; OB stays steady.
      const pb = all["pacific-beach"]!;
      for (let h = 0; h < 24; h++) {
        if (h !== 14) {
          pb[h] = {
            ...pb[h]!,
            wave_height: "1.5",
            swell_1_height: "1.5",
          };
        }
      }
      return all;
    })(),
    expectedHero: "ocean-beach-pier",
    notes:
      "PB has one big hour but most of the day is tiny. windowPersistence + " +
      "duration both favor OB's steady setup-correct window.",
  },

  // -------------------------------------------------------------------------
  // 15. User-personalization: beginner skill on PB-favoring swell
  // -------------------------------------------------------------------------
  {
    name: "SW 210 @ 12s 2.5ft, beginner skill — PB stays hero",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 2.5,
      wavePeriodS: 12,
      primaryDirDeg: 210,
      windSpeedMph: 4,
      windDirDeg: 90,
      tideKeyframes: TIDE_HIGH_PB_FAVORED,
    }),
    expectedHero: "pacific-beach",
    userSkillLevel: "beginner",
    notes:
      "Beginner-friendly PB beach break aligned with user skill. SkillLevel " +
      "ceiling check should keep PB on top vs OB Pier (advanced).",
  },

  // -------------------------------------------------------------------------
  // 16. User-personalization: advanced skill on borderline W setup
  // -------------------------------------------------------------------------
  {
    name: "W 270 @ 7s 4ft, advanced skill — OB clear winner",
    beaches: SD_BEACHES,
    forecasts: buildAllBeaches({
      dateBase: "2026-05-01",
      waveHeightFt: 4,
      wavePeriodS: 7,
      primaryDirDeg: 270,
      windSpeedMph: 5,
      windDirDeg: 90,
      tideKeyframes: TIDE_RISING_MORNING,
    }),
    expectedHero: "ocean-beach-pier",
    userSkillLevel: "advanced",
    notes:
      "Advanced surfer, classic OB short-period W setup at solid 4ft. Setup " +
      "suitability + skill alignment combine; PB stays nearby but OB wins.",
  },

  // -------------------------------------------------------------------------
  // 17. Divergent swell — OB blocked from south by Point Loma; PB/Crystal
  //     see the 13s SW combo as primary (Task 8 — shared setup signal)
  // -------------------------------------------------------------------------
  {
    name: "divergent-swell — OB only sees 6s WNW; PB/Crystal see 13s SW combo (PB stays hero)",
    beaches: SD_BEACHES,
    forecasts: buildAllBeachesDivergent(
      {
        dateBase: "2026-05-01",
        tideKeyframes: TIDE_HIGH_PB_FAVORED,
      },
      {
        // OB: geometrically blocked from south swell — only the local
        // short-period WNW pulse arrives.
        ob: {
          waveHeightFt: 1.4,
          wavePeriodS: 6,
          primaryDirDeg: 292,
          windSpeedMph: 4,
          windDirDeg: 90,
        },
        // PB: 13s SW primary, 7s WNW secondary — the actual regional setup.
        pb: {
          waveHeightFt: 2.0,
          wavePeriodS: 13,
          primaryDirDeg: 225,
          secondaryHeightFt: 1.0,
          secondaryPeriodS: 7,
          secondaryDirDeg: 292,
          windSpeedMph: 4,
          windDirDeg: 90,
        },
        // Crystal: same combo as PB.
        crystal: {
          waveHeightFt: 2.0,
          wavePeriodS: 13,
          primaryDirDeg: 225,
          secondaryHeightFt: 1.0,
          secondaryPeriodS: 7,
          secondaryDirDeg: 292,
          windSpeedMph: 4,
          windDirDeg: 90,
        },
      },
    ),
    expectedHero: "pacific-beach",
    notes:
      "Divergent-swell day (today's bug): OB is geometrically blocked from " +
      "south swell by Point Loma; PB and Crystal both see the 13s SW as " +
      "primary. Shared setup signal aggregates the cluster's primaries and " +
      "picks 13s SW (cluster-majority). Each beach is then judged against " +
      "13s SW: OB poorly (window edge, no exposure bonus on long-period), " +
      "PB well (south-favorable, narrower selectivity), Crystal moderately " +
      "(absurdly-wide penalty at long-period). PB's realized score advantage " +
      "(combo day + favorable falling tide) confirms the call.",
  },
];
