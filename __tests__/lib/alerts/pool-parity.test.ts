/**
 * @jest-environment node
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import beginnerPoolReplay from "@/__tests__/fixtures/daily-call-beginner-pool-20261013.json";
import type { PoolBeach } from "@/lib/alerts/user-pool";
import { runDailyCallCron, type DailyCallDeps, type DailyCallProfile } from "@/lib/cron/daily-call-runner";
import { buildDriveRangeCandidatePool } from "@/lib/services/discovery/weekend-scout-candidate-pool";
import type { Beach, Database } from "@/types/database";

it("gives Home and the Daily Call the same beginner pool from the production replay", async () => {
  const anchor = { lat: 32.805, lon: -117.26 };
  const pool: PoolBeach[] = beginnerPoolReplay.beaches.map((row) => ({
    beach: {
      id: row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: row.name,
      slug: row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      skill_level: row.skillLevel,
      timezone: "America/Los_Angeles",
      ...anchor,
    } as Beach,
    relation: row.relation as PoolBeach["relation"],
    distanceMiles: row.distanceMiles,
  }));
  const home = pool.find(({ relation }) => relation === "home")!;
  const profile: DailyCallProfile = {
    id: "beginner-user",
    homeBeachId: home.beach.id,
    homeBeach: home.beach,
    timezone: "America/Los_Angeles",
    dailyCallTime: "06:00",
    notifPushEnabled: true,
    notifForecastAlerts: true,
    experienceLevel: "beginner",
    maxDriveMinutes: null,
    location: null,
  };
  const supabase = {} as SupabaseClient<Database>;
  const loadPool = jest.fn<ReturnType<DailyCallDeps["loadPool"]>, Parameters<DailyCallDeps["loadPool"]>>(async () => pool);
  const buildCandidates = jest.fn<ReturnType<DailyCallDeps["buildCandidates"]>, Parameters<DailyCallDeps["buildCandidates"]>>(
    async () => ({ candidates: [], hadForecasts: false, noInWindowRowCount: 0 }),
  );

  const homePool = await buildDriveRangeCandidatePool(profile.id, {
    anchor,
    homeBeachId: profile.homeBeachId,
    maxDriveMinutes: null,
    experienceLevel: profile.experienceLevel,
    filters: undefined,
  }, { loadPool, supabase });
  const result = await runDailyCallCron({
    now: new Date("2026-10-13T13:00:00.000Z"),
    supabase,
    deps: {
      isEnabled: () => true,
      isUserAllowed: () => true,
      loadProfiles: async () => [profile],
      resolveTimezone: () => "America/Los_Angeles",
      getSunrise: () => null,
      alreadySentToday: async () => false,
      usesSharedRanking: () => false,
      loadPool,
      buildCandidates,
    },
  });

  expect(result).toMatchObject({ errors: 0, silent: 1 });
  expect(buildCandidates).toHaveBeenCalledTimes(1);
  expect(loadPool).toHaveBeenCalledTimes(2);
  for (const [args] of loadPool.mock.calls) {
    expect(args).toEqual({ supabase, userId: profile.id, homeBeachId: home.beach.id, location: anchor, maxDriveMinutes: null });
  }
  const callPool = buildCandidates.mock.calls[0][0].pool;
  expect(callPool.filter(({ relation }) => relation === "nearby")).toHaveLength(50);
  expect(homePool.candidates.map(({ beach }) => beach.id).sort())
    .toEqual(callPool.map(({ beach }) => beach.id).sort());
  for (const entries of [homePool.candidates, callPool]) {
    expect(entries.map(({ beach }) => beach.name))
      .toEqual(expect.arrayContaining(["72nd Place", "Torrance Beach (RAT Beach)"]));
  }
});
