// SQL ↔ TS preset parity.
//
// The anon-capture flow materializes alert_rules in two ways:
//   1. Anonymous form → POST /api/alerts/anon-capture → pending_alert_captures
//      → /auth/callback → finalize_anon_alert_capture RPC, which calls SQL
//      preset_default_conditions(p_preset, p_beach_id) to populate
//      alert_rules.conditions.
//   2. Authenticated form → existing TS path → getPreset(type).buildConditions(beach).
//
// If the SQL and TS sides drift, the same user creating "glass_off" via the
// two paths gets different conditions JSON. This file is the canary.
//
// Two layers of coverage:
//
// 1. RUNNABLE TS regression: asserts the canonical TS output for each of the
//    3 anon-capture presets against a frozen fixture. Catches accidental TS
//    drift in CI (no DB needed).
//
// 2. SKIPPED live-RPC parity: matches the plan-spec test verbatim. Skipped
//    because local supabase db reset is currently broken on this codebase by
//    pre-existing migration-history defects (see plan amendment "Execution
//    amendment (2026-04-26): mocked-Supabase pivot"). Unskip after the
//    migration-replay-repair branch lands, OR run against Vercel Preview as
//    part of Phase-3 validation.

import { getPreset } from "@/lib/alerts/presets";
import type { BeachAlertMeta } from "@/lib/alerts/types";

const ALLOWED_PRESETS = ["glass_off", "big_day", "mellow_session"] as const;

const TEST_BEACH_ID = "11111111-1111-1111-1111-111111111111";
const TEST_BEACH: BeachAlertMeta = {
  id: TEST_BEACH_ID,
  name: "Parity Test Beach",
  slug: "parity-test-beach",
  lat: 32.85,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 30,
  aspect_deg: 270,
  preferred_tide_ft_min: null,
  preferred_tide_ft_max: null,
  preferred_tide_direction: null,
  swell_window_center_deg: null,
  swell_window_halfwidth_deg: null,
};

const SANDY_BEGINNER_BEACH: BeachAlertMeta = {
  ...TEST_BEACH,
  name: "Bolsa Chica",
  slug: "bolsa-chica",
  skill_level: "beginner",
  break_type: "beach",
  features: ["sand bottom", "beginner sandy beachbreak"],
  preferred_tide_ft_min: 0.5,
  preferred_tide_ft_max: 3,
  preference_model: {
    beginner_window: {
      model: "socal_sandy_beginner",
      beginner_fit: "primary",
      acceptable_wave_height_ft: { min: 0.5, max: 3 },
      best_time_local: { start: "06:00", end: "10:00" },
      max_beginner_wind_mph: 10,
    },
  },
};

// Frozen fixture: what each preset's TS buildConditions(TEST_BEACH) outputs
// today. The SQL helper preset_default_conditions(preset, beach_id) MUST
// produce the same JSON for every key listed here, plus tide fields when the
// beach has tide preferences (TEST_BEACH does not, so they're absent).
const EXPECTED_TS_CONDITIONS: Record<(typeof ALLOWED_PRESETS)[number], unknown> =
  {
    glass_off: {
      wind_direction: "offshore",
      wind_speed_max_kt: 5,
      swell_height_min: 2,
    },
    big_day: {
      swell_height_min: 6,
      swell_period_min: 10,
    },
    mellow_session: {
      swell_height_min: 1.5,
      swell_height_max: 4,
      wind_speed_max_kt: 8,
      // tide_height_min_ft / max omitted because TEST_BEACH has null preferences
      // tide_direction omitted for the same reason
    },
  };

describe("preset TS regression — anon-capture set", () => {
  for (const preset of ALLOWED_PRESETS) {
    it(`${preset}: TS buildConditions matches frozen fixture`, () => {
      const tsConditions = getPreset(preset)!.buildConditions(TEST_BEACH);
      // Strip undefined keys so the comparison ignores TS's `?? undefined` outputs.
      const stripped = JSON.parse(JSON.stringify(tsConditions));
      expect(stripped).toEqual(EXPECTED_TS_CONDITIONS[preset]);
    });
  }
});

it("mellow_session: TS buildConditions uses the sandy beginner window when beach metadata qualifies", () => {
  const tsConditions = getPreset("mellow_session")!.buildConditions(
    SANDY_BEGINNER_BEACH,
  );
  expect(JSON.parse(JSON.stringify(tsConditions))).toEqual({
    swell_height_min: 0.5,
    swell_height_max: 3,
    wind_speed_max_kt: 9,
    tide_height_min_ft: 0.5,
    tide_height_max_ft: 3,
    avoid_tide_statuses: ["high"],
    local_time_start: "06:00",
    local_time_end: "10:00",
    beginner_sandy_window: true,
  });
});

// SQL parity is skipped on this branch — see file header for context.
// eslint-disable-next-line jest/no-disabled-tests -- live DB parity is documented above and local migration replay is currently blocked.
describe.skip("RPC preset parity (TS vs SQL — live DB required)", () => {
  // To re-enable: ensure local supabase db reset succeeds, regenerate types,
  // import createServiceClient, and remove the .skip. The body below mirrors
  // the plan's original Task 16 spec.
  //
  // import { createServiceClient } from "@/lib/supabase/service";
  // const supabase = createServiceClient();
  //
  // beforeAll(async () => {
  //   await supabase.from("beaches").upsert({
  //     id: TEST_BEACH_ID,
  //     name: TEST_BEACH.name,
  //     slug: TEST_BEACH.slug,
  //     center_lat: TEST_BEACH.lat,
  //     center_lng: TEST_BEACH.lon,
  //     timezone: TEST_BEACH.timezone,
  //     wind_offshore_deg: TEST_BEACH.wind_offshore_deg,
  //     wind_offshore_tol_deg: TEST_BEACH.wind_offshore_tol_deg,
  //     aspect_deg: TEST_BEACH.aspect_deg,
  //   });
  // });
  //
  // for (const preset of ALLOWED_PRESETS) {
  //   it(`${preset}: SQL preset_default_conditions matches TS`, async () => {
  //     const tsConditions = getPreset(preset)!.buildConditions(TEST_BEACH);
  //     const { data: sqlConditions, error } = await supabase.rpc("preset_default_conditions", {
  //       p_preset: preset,
  //       p_beach_id: TEST_BEACH_ID,
  //     });
  //     if (error) throw error;
  //     expect(sqlConditions).toEqual(JSON.parse(JSON.stringify(tsConditions)));
  //   });
  // }
  it("placeholder so describe.skip has a body", () => {
    expect(true).toBe(true);
  });
});
