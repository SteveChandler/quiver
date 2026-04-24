/**
 * @jest-environment node
 *
 * Pre-sunset dead-zone integration test (PR #218 / commit 7e0f436f)
 *
 * Validates the orchestrator fall-through gate fix at the integration layer:
 * runs the REAL discoverSurfSpots() against REAL Supabase (live forecast cache)
 * with fake clock injection. The unit test (`surf-discovery-orchestrator.test.ts`,
 * "pre-sunset dead zone: falls through to tomorrow ...") mocks selectBestWindow
 * entirely; this test exercises the actual selectBestWindow + sunTimesCache +
 * getTimezoneFromCoords chain.
 *
 * Three scenarios on the SAME real day:
 *   1. ~10 min before today's San Diego sunset (dead zone) → window MUST be on tomorrow
 *   2. 06:23 PDT today (regression guard for the "Tomorrow's dawn patrol" bug)
 *      → window MUST be on today
 *   3. ~30 min after today's sunset (existing post-sunset path) → window MUST be on tomorrow
 *
 * Sunset is computed dynamically via SunCalc since it shifts a minute per day.
 *
 * Skipped automatically when RUN_INTEGRATION_TESTS=true is not set OR the
 * Supabase service-role env vars are missing (next/jest auto-loads .env.local).
 * Run with:
 *   RUN_INTEGRATION_TESTS=true yarn test:unit __tests__/api/surf-discover-pre-sunset.integration.test.ts
 *
 * IMPORTANT: jest.config.js maps `@/lib/supabase/server` to a global mock
 * (`__tests__/setup/mock-supabase.ts`). We override that mapping at the top of
 * this file via jest.mock() so the orchestrator and all discovery sub-modules
 * (candidate-pool-builder, forecast-batch-fetcher, personalization-layer,
 * response-formatter, preference-learning-service, beach-query-service,
 * forecast-service-utils) hit a REAL service-role client built directly here.
 */

import SunCalc from "suncalc";
import path from "node:path";

// next/jest skips .env.local when NODE_ENV=test (Next.js convention). Load it
// explicitly so we hit the REAL prod Supabase, not the localhost stub in .env.
require("dotenv").config({
  path: path.join(process.cwd(), ".env.local"),
  override: true,
});

// Restore real fetch BEFORE importing supabase-js (jest.setup.js installs a mock).
const undici = require("undici");
global.fetch = undici.fetch;
global.Headers = undici.Headers;
global.Request = undici.Request;
global.Response = undici.Response;

// Build a REAL service-role client and inject it for both server.ts and the
// supabase root module. The factory must be inside the jest.mock() so jest can
// hoist it; we lazy-construct the client on first call to ensure env vars are
// present when invoked.
jest.mock("@/lib/supabase/server", () => {
  const { createClient } = jest.requireActual("@supabase/supabase-js");
  let cached: any = null;
  const make = () => {
    if (cached) return cached;
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!url || !key) {
      throw new Error(
        `[integration test] missing Supabase env: NEXT_PUBLIC_SUPABASE_URL=${!!url} SUPABASE_SERVICE_ROLE_KEY=${!!key}`
      );
    }
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return cached;
  };
  return {
    createSupabaseServiceRoleClient: () => make(),
    createSupabaseServerClient: async () => make(),
    createPublicReadClient: () => make(),
  };
});

// The root @/lib/supabase mapping points at mock-supabase.ts too — but the
// orchestrator chain only imports from @/lib/supabase/server and
// @/lib/supabase/query-builders. query-builders is a pure function module that
// doesn't construct a client (it builds query chains from a passed-in client).
// Realtime mock from jest.setup.js stays in place — discovery doesn't subscribe.

const TEST_USER_ID = "610a5745-1e1c-4907-b5d4-f1d0d96cb4e4"; // stcha0004@gmail.com
const LA_JOLLA = { lat: 32.7486, lon: -117.2543 };

const shouldRunIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

jest.setTimeout(60000);

// Compute today's San Diego sunset dynamically. SunCalc returns a UTC Date.
function getTodaySunset(): Date {
  const realNow = new Date();
  const sunTimes = SunCalc.getTimes(realNow, LA_JOLLA.lat, LA_JOLLA.lon);
  return sunTimes.sunset;
}

(shouldRunIntegration ? describe : describe.skip)(
  "discoverSurfSpots — pre-sunset dead-zone fall-through (PR #218)",
  () => {
    let todaySunset: Date;
    let preSunsetDeadZone: Date;
    let earlyMorning: Date;
    let postSunset: Date;

    beforeAll(() => {
      todaySunset = getTodaySunset();

      // 10 min before today's sunset — inside the MIN_SESSION_HOURS reject zone
      preSunsetDeadZone = new Date(todaySunset.getTime() - 10 * 60 * 1000);

      // 06:23 today in PDT (= 13:23 UTC during DST). Anchor to today's sunset's
      // UTC date minus 1 day if sunset is past midnight UTC, so we land on the
      // same local PDT day as `preSunsetDeadZone`.
      const sunsetLocalDateUTC = new Date(todaySunset.getTime() - 7 * 60 * 60 * 1000);
      earlyMorning = new Date(Date.UTC(
        sunsetLocalDateUTC.getUTCFullYear(),
        sunsetLocalDateUTC.getUTCMonth(),
        sunsetLocalDateUTC.getUTCDate(),
        13, 23, 0, 0
      ));

      // 30 min after today's sunset
      postSunset = new Date(todaySunset.getTime() + 30 * 60 * 1000);

      // eslint-disable-next-line no-console
      console.log("[integration test anchors]", {
        realNowUTC: new Date().toISOString(),
        todaySunsetUTC: todaySunset.toISOString(),
        preSunsetDeadZoneUTC: preSunsetDeadZone.toISOString(),
        earlyMorningUTC: earlyMorning.toISOString(),
        postSunsetUTC: postSunset.toISOString(),
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    async function runDiscoverAt(fakeNow: Date): Promise<any> {
      jest.useFakeTimers({
        now: fakeNow,
        // Don't fake setImmediate / nextTick — Supabase / fetch use them.
        doNotFake: ["nextTick", "setImmediate", "queueMicrotask", "performance", "setTimeout", "clearTimeout"],
      });

      // Require AFTER fake timers installed so any module-init-time clocks see
      // the fake. The orchestrator reads new Date()/Date.now() at call time.
      const { discoverSurfSpots } = require("@/lib/services/discovery/surf-discovery-orchestrator");

      try {
        const result = await discoverSurfSpots(TEST_USER_ID, {
          userLocation: LA_JOLLA,
          maxResults: 10,
        });
        return result;
      } finally {
        jest.useRealTimers();
      }
    }

    function describeRec(rec: any): string {
      if (!rec) return "<no rec>";
      const ws = rec.window?.start;
      const wsIso = ws instanceof Date ? ws.toISOString() : String(ws);
      return `beach=${rec.beach?.name} window.start=${wsIso}`;
    }

    test("scenario 1: pre-sunset dead zone (10 min before sunset) falls through to TOMORROW", async () => {
      const result = await runDiscoverAt(preSunsetDeadZone);
      const top = result.recommendations[0];

      // eslint-disable-next-line no-console
      console.log("[scenario 1 result]", {
        recs: result.recommendations.length,
        top: describeRec(top),
        metadata: result.metadata,
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(top).toBeDefined();
      expect(top.window).toBeDefined();

      const windowStart = top.window.start instanceof Date
        ? top.window.start
        : new Date(top.window.start);

      // The fix: window MUST be after today's sunset (i.e., on tomorrow).
      expect(windowStart.getTime()).toBeGreaterThan(todaySunset.getTime());
    });

    test("scenario 2: 06:23 PDT regression guard returns TODAY's window", async () => {
      const result = await runDiscoverAt(earlyMorning);
      const top = result.recommendations[0];

      // eslint-disable-next-line no-console
      console.log("[scenario 2 result]", {
        recs: result.recommendations.length,
        top: describeRec(top),
        metadata: result.metadata,
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(top).toBeDefined();
      expect(top.window).toBeDefined();

      const windowStart = top.window.start instanceof Date
        ? top.window.start
        : new Date(top.window.start);

      // 6:23 AM regression guard: window MUST be before today's sunset (i.e., today),
      // not flipped to tomorrow's dawn patrol.
      expect(windowStart.getTime()).toBeLessThan(todaySunset.getTime());
    });

    test("scenario 3: post-sunset (30 min after sunset) returns TOMORROW's window", async () => {
      const result = await runDiscoverAt(postSunset);
      const top = result.recommendations[0];

      // eslint-disable-next-line no-console
      console.log("[scenario 3 result]", {
        recs: result.recommendations.length,
        top: describeRec(top),
        metadata: result.metadata,
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(top).toBeDefined();
      expect(top.window).toBeDefined();

      const windowStart = top.window.start instanceof Date
        ? top.window.start
        : new Date(top.window.start);

      // Post-sunset path (existing behavior): window MUST be on tomorrow.
      expect(windowStart.getTime()).toBeGreaterThan(todaySunset.getTime());
    });
  }
);

// When skipped, give a single passing assertion so Jest doesn't complain about
// an empty test file in CI runs that don't set RUN_INTEGRATION_TESTS=true.
if (!shouldRunIntegration) {
  describe("discoverSurfSpots integration (skipped)", () => {
    it("requires RUN_INTEGRATION_TESTS=true and Supabase env vars", () => {
      expect(true).toBe(true);
    });
  });
}
