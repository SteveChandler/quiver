import type { LocationAnchor, LocationSnapshot } from "@/lib/alerts/location-freshness";
import { getWeekScoutLocation } from "@/lib/services/discovery/week-scout-scope";
import type { RankDay } from "@/lib/cron/daily-call-runner";
import type { DailyCallPayload } from "@/lib/notifications/types/daily-call";
import type { CanonicalWeekScoutResponse, WeekScoutDayResponse, WeekScoutWindowResponse } from "@/lib/services/discovery/week-scout";

interface ParityArgs {
  userId: string;
  date?: string;
}

export function parseParityArgs(argv: string[]): ParityArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (flag !== "--user" && flag !== "--date") throw new Error(`Unknown flag: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (values.has(flag)) throw new Error(`Duplicate flag: ${flag}`);
    values.set(flag, value);
  }
  const userId = values.get("--user");
  if (!userId) throw new Error("--user is required");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("--user must be a UUID");
  }
  const date = values.get("--date");
  if (date !== undefined) {
    const instant = new Date(`${date}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(instant.getTime())
      || instant.toISOString().slice(0, 10) !== date) {
      throw new Error("--date must be a valid YYYY-MM-DD");
    }
  }
  return { userId, ...(date ? { date } : {}) };
}

/**
 * Week Scout ranks on the cron's instant; it otherwise reads the real clock, hours after the send.
 * Forecast rows are still the current batch, so a replay of a past --date has no rows to rank.
 */
export function rankDayAt(rankDay: RankDay, at: Date): RankDay {
  return (args) => rankDay({ ...args, now: at });
}

export function missingParityEnv(env: Readonly<Record<string, string | undefined>>): string[] {
  return ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((name) => !env[name]?.trim());
}

/**
 * A surfer who taps the push normally gives Home a fresh fix near the snapshot the cron ranked
 * around, so "cron-anchor" is the like-for-like Home. "no-fix" is a cold open with no fix under
 * Home's 15-minute rule, where Home falls back to the home beach.
 */
export type HomeReplayModel = "cron-anchor" | "no-fix";
export const HOME_REPLAY_MODELS: readonly HomeReplayModel[] = ["cron-anchor", "no-fix"];
export const HOME_REPLAY_LABELS: Readonly<Record<HomeReplayModel, string>> = {
  "cron-anchor": "Home with the cron's anchor",
  "no-fix": "Home with no fix (home anchor)",
};

/** The userLocation the Week Scout route would get; undefined makes it use the home beach. */
export function homeReplayUserLocation(
  model: HomeReplayModel,
  snapshot: LocationSnapshot | null | undefined,
  at: Date,
  cronAnchor: LocationAnchor,
): { lat: number; lon: number } | undefined {
  if (model === "no-fix") return getWeekScoutLocation(snapshot ?? null, at.getTime());
  return cronAnchor.source === "location" && cronAnchor.anchor ? cronAnchor.anchor : undefined;
}

export function describeAnchor(
  source: string,
  anchor: { lat: number; lon: number } | null,
  snapshotCapturedAt: string | null | undefined,
  at: Date,
): string {
  const coordinates = anchor ? `(${anchor.lat.toFixed(2)}, ${anchor.lon.toFixed(2)})` : "(none)";
  const ageMs = snapshotCapturedAt ? at.getTime() - Date.parse(snapshotCapturedAt) : NaN;
  return `${source} ${coordinates}; snapshot age ${Number.isFinite(ageMs) ? `${(ageMs / 3_600_000).toFixed(2)} h` : "none"}`;
}

const READ_ONLY_RPCS = new Set([
  // STABLE SELECT of eligible beaches: 20260902093602_add_humboldt_surf_beaches.sql.
  "get_weekend_scout_candidates",
  // SELECT-only wrapper (20260923041000); nested compute_user_match_scores is STABLE (20261002200000).
  "get_week_scout_personalization",
]);

class ReadOnlyViolation extends Error {
  constructor(method: string, url: URL, callPath: string) {
    super(`ReadOnlyViolation: ${method} ${url.origin}${url.pathname} via ${callPath}`);
    this.name = "ReadOnlyViolation";
  }
}

interface CallPick {
  beachId: string;
  start: string;
  end: string;
}

function sameAnchor(left: LocationAnchor, right: LocationAnchor): boolean {
  return left.source === right.source
    && left.anchor?.lat === right.anchor?.lat
    && left.anchor?.lon === right.anchor?.lon;
}

function compareCalls(label: string, left: CallPick | null, right: CallPick | null, reason: string, window: boolean, anchors: string): void {
  if (!left || !right) {
    console.log(`${label}: n/a (${reason}); ${anchors}`);
    return;
  }
  const differences: string[] = [];
  if (left.beachId !== right.beachId) differences.push("beach");
  if (window && (Date.parse(left.start) !== Date.parse(right.start) || Date.parse(left.end) !== Date.parse(right.end))) {
    differences.push("display window");
  }
  console.log(`${label}: ${differences.length ? `DIFFER (${differences.join(", ")})` : "AGREE"}; ${anchors}`);
}

async function main(): Promise<void> {
  let args: ParityArgs;
  try {
    args = parseParityArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${(error as Error).message}\nUsage: npx tsx scripts/check-call-parity.ts --user <uuid> [--date YYYY-MM-DD]`);
    process.exitCode = 2;
    return;
  }
  const missing = missingParityEnv(process.env);
  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(", ")}. Export them before running; no .env files are loaded.`);
    process.exitCode = 2;
    return;
  }

  let violation: ReadOnlyViolation | undefined;
  let callPath = "module loading";
  try {
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim());
    const restPath = `${supabaseUrl.pathname.replace(/\/$/, "")}/rest/v1/`;
    const canRead = (method: string, url: URL): boolean => {
      if (url.origin === supabaseUrl.origin && url.pathname.startsWith(restPath)) {
        if (method === "GET" || method === "HEAD") return true;
        const rpc = url.pathname.slice(restPath.length);
        return method === "POST" && rpc.startsWith("rpc/") && READ_ONLY_RPCS.has(rpc.slice(4));
      }
      return method === "GET" && url.origin === "https://api.weather.gov";
    };
    const assert: typeof import("node:assert/strict") = require("node:assert/strict");
    // These checks exercise the backstop without creating a client or making any network request.
    for (const [method, path, allowed] of [
      ["GET", `${restPath}profiles`, true],
      ["HEAD", `${restPath}profiles`, true],
      ["POST", `${restPath}rpc/get_weekend_scout_candidates`, true],
      ["POST", `${restPath}rpc/get_week_scout_personalization`, true],
      ["POST", `${restPath}profiles`, false],
      ["POST", `${restPath}rpc/unlisted`, false],
      ["POST", `${restPath}rpc/get_week_scout_personalization/extra`, false],
      ["PATCH", `${restPath}profiles`, false],
      ["PUT", `${restPath}profiles`, false],
      ["DELETE", `${restPath}profiles`, false],
      ["GET", "/auth/v1/user", false],
    ] as const) {
      assert.equal(canRead(method, new URL(path, supabaseUrl)), allowed);
    }
    assert.equal(canRead("GET", new URL("https://api.weather.gov/alerts/active")), true);
    assert.equal(canRead("POST", new URL("https://api.weather.gov/alerts/active")), false);
    const otherHost = new URL(`${restPath}profiles`, supabaseUrl);
    otherHost.port = supabaseUrl.port === "1" ? "2" : "1";
    assert.equal(canRead("GET", otherHost), false);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      if (violation) throw violation;
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url ?? String(input));
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      if (!canRead(method, url)) {
        violation = new ReadOnlyViolation(method, url, callPath);
        throw violation;
      }
      // Automatic redirects could escape the allowed host without passing through this wrapper.
      return originalFetch(input, { ...init, redirect: "error" });
    };

    const Module = require("node:module") as typeof import("node:module") & {
      _resolveFilename: (request: string, parent: NodeModule | undefined, isMain?: boolean, options?: { paths?: string[] }) => string;
    };
    const originalResolve = Module._resolveFilename;
    const aliases: Readonly<Record<string, string>> = {
      "server-only": require.resolve("next/dist/compiled/server-only/empty.js"),
      // Its import-only exports need the same entry mapping as the repository's Jest config.
      "@neaps/tide-predictor": require.resolve("../node_modules/@neaps/tide-predictor/dist/index.js"),
    };
    Module._resolveFilename = function (request, parent, isMain, options): string {
      return originalResolve.call(this, aliases[request] ?? request, parent, isMain, options);
    };
    process.env.LOG_LEVEL ??= "warn";

    const { loadDailyCallProfiles, runDailyCallCron, rankDayWithWeekScout } = await import("@/lib/cron/daily-call-runner");
    const { loadSwellAlertProfiles, evaluateSwellAlertPool, orderSwellCandidatesForTomorrow, SWELL_ALERT_SEND_HOUR } = await import("@/lib/cron/swell-alert-runner");
    const { generateWeekScoutForecast, weekScoutDependenciesAt } = await import("@/lib/services/discovery/week-scout");
    const { selectDayCall } = await import("@/lib/recommendations/day-call");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { capNearbyPool, loadUserPool } = await import("@/lib/alerts/user-pool");
    const { buildDriveRangeCandidatePool } = await import("@/lib/services/discovery/weekend-scout-candidate-pool");
    const { DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS, isAwayFromHome, resolveLocationAnchor } = await import("@/lib/alerts/location-freshness");
    const { resolveWeekScoutScopeAnchor } = await import("@/lib/services/discovery/week-scout-scope");
    const { isWeekScoutSwellsEnabled, isWeekScoutSwellsUserAllowed } = await import("@/lib/flags/week-scout-swells");
    const { getLocalDateString, resolveBeachTimezone } = await import("@/lib/utils/timezone-utils");
    const { localDateTimeToUTC } = await import("@/lib/utils/forecast-time-resolver");
    const { getDaylightWindow } = await import("@/lib/alerts/sunrise");
    const { parseDailyCallTime, resolveSendInstant } = await import("@/lib/alerts/send-time");
    const { driveRadiusMiles } = await import("@/lib/profile/drive-range");
    const { calculateDistanceInMiles } = await import("@/lib/utils/distance-utils");
    const { formatInTimeZone } = await import("date-fns-tz");
    const { parseDailyCallPayload } = await import("@/lib/notifications/types/daily-call");

    const fixtureHome = { lat: 3, lon: 4 };
    const fixtureLocation = { lat: 1, lon: 2, captured_at: "2026-10-10T16:00:00Z" };
    const fixtureCall = resolveLocationAnchor(fixtureLocation, new Date("2026-10-11T13:00:00Z"), fixtureHome, DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS);
    const fixtureNow = resolveLocationAnchor(fixtureLocation, new Date("2026-10-11T19:00:00Z"), fixtureHome);
    const fixtureEvening = resolveLocationAnchor(fixtureLocation, new Date("2026-10-12T00:00:00Z"), fixtureHome);
    assert.equal(fixtureCall.source, "home");
    assert.equal(resolveLocationAnchor(fixtureLocation, new Date("2026-10-11T13:00:00Z"), fixtureHome).source, "location");
    assert.equal(getWeekScoutLocation(fixtureLocation, Date.parse("2026-10-10T16:15:00Z")), undefined);
    assert.deepEqual(getWeekScoutLocation(fixtureLocation, Date.parse("2026-10-10T16:14:59Z")), { lat: 1, lon: 2 });
    assert.equal(fixtureNow.source, "home");
    assert.equal(sameAnchor(fixtureCall, fixtureEvening), true);
    assert.equal(sameAnchor(fixtureNow, fixtureEvening), true);
    assert.equal(sameAnchor(fixtureCall, { source: "home", anchor: { lat: 3, lon: 2 } }), false);
    assert.equal(sameAnchor(fixtureCall, { source: "home", anchor: { lat: 1, lon: 4 } }), false);
    assert.equal(sameAnchor(fixtureCall, { ...fixtureCall, source: "location" }), false);
    assert.equal(sameAnchor({ anchor: null, source: "none" }, { anchor: null, source: "none" }), true);
    // A 3 h old fix 4 mi from home: the cron ranks around it, and so must the like-for-like Home.
    const nearHome = { lat: 32.75, lon: -117.25 };
    const nearFix = { lat: 32.80, lon: -117.21, captured_at: "2026-11-14T11:00:00Z" };
    const nearAt = new Date("2026-11-14T14:00:00Z");
    assert.ok(Math.abs(calculateDistanceInMiles(nearFix, nearHome) - 4) < 0.5);
    const nearCron = resolveLocationAnchor(nearFix, nearAt, nearHome, DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS);
    assert.equal(nearCron.source, "location");
    assert.deepEqual(homeReplayUserLocation("cron-anchor", nearFix, nearAt, nearCron), nearCron.anchor);
    assert.equal(homeReplayUserLocation("no-fix", nearFix, nearAt, nearCron), undefined);

    // Libraries may catch fetch errors and degrade; a latched violation must still stop the CLI.
    const read = async <T>(path: string, run: () => Promise<T>): Promise<T> => {
      if (violation) throw violation;
      callPath = path;
      try {
        return await run();
      } finally {
        if (violation) throw violation;
      }
    };
    const realNow = new Date();
    const client = createSupabaseServiceRoleClient();
    const profile = (await read("loadDailyCallProfiles", () => loadDailyCallProfiles(client, [args.userId])))[0];
    if (!profile) throw new Error(`No active profile found for ${args.userId}`);
    const anchorAtNow = resolveLocationAnchor(profile.location, realNow, profile.homeBeach, DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS);
    const timezone = resolveBeachTimezone((anchorAtNow.source === "location" ? profile.location?.timezone : null)
      ?? profile.timezone ?? profile.homeBeach?.timezone);
    const today = getLocalDateString(realNow, timezone);
    const date = args.date ?? today;
    const tomorrow = new Date(`${date}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDate = tomorrow.toISOString().slice(0, 10);
    const local = (instant: Date | string): string => formatInTimeZone(instant, timezone, "yyyy-MM-dd HH:mm:ss zzz");
    const sessionTime = profile.preferredSessionTime ?? null;
    const lat = (anchorAtNow.source === "location" ? profile.location?.lat : null) ?? profile.homeBeach?.lat;
    const lon = (anchorAtNow.source === "location" ? profile.location?.lon : null) ?? profile.homeBeach?.lon;
    const sunrise = lat == null || lon == null ? null
      : getDaylightWindow(lat, lon, localDateTimeToUTC(date, "12:00:00", timezone)).sunrise;
    const at = resolveSendInstant({ pref: parseDailyCallTime(profile.dailyCallTime), localDate: date, timezone, sunrise });
    const eveningAt = localDateTimeToUTC(date, `${String(SWELL_ALERT_SEND_HOUR).padStart(2, "0")}:00:00`, timezone);
    const anchorAtCall = resolveLocationAnchor(profile.location, at, profile.homeBeach, DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS);
    const anchorAtEvening = resolveLocationAnchor(profile.location, eveningAt, profile.homeBeach);
    const reuseCallPool = sameAnchor(anchorAtCall, anchorAtEvening);
    const anchorLabel = ({ anchor, source }: { anchor: LocationAnchor["anchor"]; source: string }): string => {
      const home = profile.homeBeach;
      const miles = anchor && home?.lat != null && home.lon != null
        ? calculateDistanceInMiles(anchor, { lat: home.lat, lon: home.lon }).toFixed(2) : "n/a";
      return `${source}; ${miles} miles from home beach`;
    };
    const ageHours = profile.location ? (realNow.getTime() - Date.parse(profile.location.captured_at)) / 3_600_000 : null;
    console.log(`User: ${profile.id}\nTimezone: ${timezone}\nDate D: ${date}`);
    console.log(`max_drive_minutes: ${profile.maxDriveMinutes ?? "null"}; radius: ${driveRadiusMiles(profile.maxDriveMinutes)} miles`);
    console.log(`Home beach: ${profile.homeBeach ? `${profile.homeBeach.name} (${profile.homeBeach.id})` : "none"}`);
    console.log(`Location snapshot: ${profile.location?.captured_at ?? "none"}; age: ${ageHours === null ? "none" : `${ageHours.toFixed(2)} hours`}`);
    console.log(`Daily Call anchor at realNow (${local(realNow)}): ${anchorLabel(anchorAtNow)}`);
    console.log(`Anchor at Daily Call at (${local(at)}): ${anchorLabel(anchorAtCall)}`);
    if (anchorAtCall.source === "home" && isAwayFromHome(profile.location, at, profile.homeBeach)) {
      console.log("Daily Call: silent (away_from_home)");
    }
    console.log(`Anchor at eveningAt (${local(eveningAt)}): ${anchorLabel(anchorAtEvening)}`);
    console.log(`preferred_session_time: ${sessionTime ?? "none"}`);
    console.log(`Daily Call at: ${local(at)} (${at.toISOString()}); preference: ${profile.dailyCallTime ?? "default"}`);
    console.log("Home device filters are not readable here; no filters applied.");

    const fullCallPool = await read(`loadUserPool at ${at.toISOString()}`, () => loadUserPool({
      supabase: client, userId: profile.id, homeBeachId: profile.homeBeachId,
      location: anchorAtCall.anchor, maxDriveMinutes: profile.maxDriveMinutes,
    }));
    const { pool } = capNearbyPool(fullCallPool);
    console.log(`Daily Call pool for D at ${local(at)}: ${pool.length} beaches (${fullCallPool.length} before cap)`);
    for (const { beach, relation } of pool) {
      const miles = anchorAtCall.anchor ? calculateDistanceInMiles(anchorAtCall.anchor, { lat: beach.lat, lon: beach.lon }).toFixed(2) : "n/a";
      console.log(`  ${beach.name} (${beach.id}); ${relation}; ${miles} miles`);
    }

    const beachNames = new Map(pool.map(({ beach }) => [beach.id, beach.name]));
    const beachName = (id: string): string => beachNames.get(id) ?? id;
    const showScout = (label: string, response: CanonicalWeekScoutResponse | null, dayDate: string, now: Date): CallPick | null => {
      const day = response?.days.find(({ localDate }) => localDate === dayDate) as WeekScoutDayResponse | undefined;
      const pick: WeekScoutWindowResponse | null = day ? selectDayCall(day, now, { closeBufferMs: 0 }) : null;
      const sessionId = response?.sessionDecision.selection?.candidateId;
      const sessionDate = response?.days.find((value) => value.windows.some(({ id }) => id === sessionId))?.localDate;
      console.log(`${label}: generatedAt=${response?.generatedAt ?? "n/a"}; at=${now.toISOString()} (forecast rows can have refreshed since at)`);
      console.log(`  bestWindowId=${day?.bestWindowId ?? "null"}; sessionDecision.selection.candidateId=${sessionId ?? "null"}; session window local date=${sessionDate ?? "none"}`);
      if (!pick) {
        console.log(`  ${!response ? "Home complete-radius scope unavailable: no location/home anchor" : !day ? `${dayDate} outside response days` : `no open pick; exclusions=${day.exclusionReasons.join(", ") || "none"}`}`);
        return null;
      }
      console.log(`  ${beachName(pick.beachId)} (${pick.beachId}); ${local(pick.displayWindowStart)} – ${local(pick.displayWindowEnd)}; personalVerdict=${pick.personalVerdict ?? "missing"}; personalLabel=${pick.personalLabel ?? "missing"}; conditionScore=${pick.conditionScore}`);
      return { beachId: pick.beachId, start: pick.displayWindowStart, end: pick.displayWindowEnd };
    };
    interface HomeReplay { response: CanonicalWeekScoutResponse | null; anchor: string }
    const homeCache = new Map<string, Promise<CanonicalWeekScoutResponse | null>>();
    const loadHomeAt = async (poolAt: Date, model: HomeReplayModel, cronAnchor: LocationAnchor): Promise<HomeReplay> => {
      const resolved = await read(`${HOME_REPLAY_LABELS[model]} anchor at ${poolAt.toISOString()}`, () => resolveWeekScoutScopeAnchor(
        client, null, homeReplayUserLocation(model, profile.location, poolAt, cronAnchor), profile.homeBeachId,
      ));
      const anchor = describeAnchor(resolved?.source ?? "none", resolved?.anchor ?? null, profile.location?.captured_at, poolAt);
      console.log(`${HOME_REPLAY_LABELS[model]} anchor at ${local(poolAt)}: ${anchor}`);
      if (!resolved) return { response: null, anchor };
      const key = `${poolAt.toISOString()}|${resolved.anchor.lat}|${resolved.anchor.lon}`;
      if (!homeCache.has(key)) homeCache.set(key, buildHomeAt(poolAt, resolved));
      return { response: await homeCache.get(key)!, anchor };
    };
    const buildHomeAt = async (poolAt: Date, resolved: { anchor: { lat: number; lon: number }; source: string }): Promise<CanonicalWeekScoutResponse | null> => {
      const homePool = await read(`Home pool at ${poolAt.toISOString()}`, () => buildDriveRangeCandidatePool(profile.id, {
        anchor: resolved.anchor, homeBeachId: profile.homeBeachId,
        maxDriveMinutes: profile.maxDriveMinutes, filters: undefined,
      }, { loadPool: loadUserPool, supabase: client }));
      for (const { beach } of homePool.candidates) beachNames.set(beach.id, beach.name);
      console.log(`Home anchor at ${local(poolAt)}: ${anchorLabel(resolved)}; pool: ${homePool.candidates.length} beaches; capped: ${homePool.cappedCount}`);
      return read(`Home -> generateWeekScoutForecast (7 days; pool at ${poolAt.toISOString()})`, () => generateWeekScoutForecast(profile.id, {
        candidateBeachIds: homePool.candidates.map(({ beach }) => beach.id),
        localTimezone: timezone, startLocalDate: date, dayCount: 7,
        userLocation: resolved.anchor, ...(sessionTime ? { sessionTime } : {}),
        driveRadiusMiles: driveRadiusMiles(profile.maxDriveMinutes), requirePerRowFreshness: true,
        ...(isWeekScoutSwellsEnabled() && isWeekScoutSwellsUserAllowed(profile.id) ? { includeSwells: true } : {}),
      }, weekScoutDependenciesAt(poolAt)));
    };
    const cronAnchorText = describeAnchor(anchorAtCall.source, anchorAtCall.anchor, profile.location?.captured_at, at);
    const eveningAnchorText = describeAnchor(anchorAtEvening.source, anchorAtEvening.anchor, profile.location?.captured_at, eveningAt);
    console.log(`Cron anchor at ${local(at)}: ${cronAnchorText}`);
    const homeD = new Map<HomeReplayModel, HomeReplay & { pick: CallPick | null }>();
    for (const model of HOME_REPLAY_MODELS) {
      const replay = await loadHomeAt(at, model, anchorAtCall);
      const pick = showScout(`${HOME_REPLAY_LABELS[model]} for ${date} (7-day request starts ${date}; pool at ${local(at)}; anchor ${replay.anchor})`, replay.response, date, at);
      homeD.set(model, { ...replay, pick });
    }
    const cronScout = await read("Crons -> rankDayWithWeekScout (7-day week, day D)", () => rankDayAt(rankDayWithWeekScout, at)({
      userId: profile.id, poolBeachIds: pool.map(({ beach }) => beach.id), timezone,
      localDate: date, sessionTime, anchor: anchorAtCall.anchor, weekStartLocalDate: date,
      driveRadiusMiles: driveRadiusMiles(profile.maxDriveMinutes),
    }));
    const cronPick = showScout(`Crons' Week Scout for ${date} (pool at ${local(at)}; anchor ${cronAnchorText})`, cronScout, date, at);
    for (const model of HOME_REPLAY_MODELS) {
      console.log(`D bestWindowId: ${HOME_REPLAY_LABELS[model]}=${homeD.get(model)!.response?.days.find((day) => day.localDate === date)?.bestWindowId ?? "null"}; cron=${cronScout.days[0]?.bestWindowId ?? "null"}`);
    }

    console.log(`Daily Call push preferences forced on; real notif_push_enabled=${profile.notifPushEnabled}; notif_forecast_alerts=${profile.notifForecastAlerts}. Dedupe bypassed; enqueue is a successful no-op.`);
    const dailyResults: Array<{ pick: CallPick | null; reason: string }> = [];
    for (const shared of [false, true]) {
      const captured: DailyCallPayload[] = [];
      const summary = await read(`runDailyCallCron (flag ${shared ? "on" : "off"})`, () => runDailyCallCron({
        now: at, supabase: client, deps: {
          isEnabled: () => true,
          isUserAllowed: () => true,
          loadProfiles: (sb) => loadDailyCallProfiles(sb, [args.userId]).then((profiles) => profiles.map((value) => ({
            ...value, notifPushEnabled: true, notifForecastAlerts: true,
          }))),
          alreadySentToday: async () => false,
          enqueue: async ({ payload }) => {
            captured.push(parseDailyCallPayload(payload));
            return { enqueued: true, eventId: "parity-no-op" };
          },
          usesSharedRanking: () => shared,
          rankDay: rankDayAt(rankDayWithWeekScout, at),
        },
      }));
      const payload = captured[0];
      const reason = `${Object.entries(summary.skippedCounts).filter(([, count]) => count > 0)
        .map(([key, count]) => `${key}=${count}`).join(", ") || "no enqueue"}; errors=${summary.errors}`;
      console.log(`Daily Call flag ${shared ? "on" : "off"} (pool at ${local(at)}): ${payload
        ? `${payload.beach_name} (${payload.beach_id}); window_local=${payload.window_local}; ${payload.window_start} – ${payload.window_end}`
        : `silent: ${reason}`}`);
      dailyResults.push({ pick: payload ? { beachId: payload.beach_id, start: payload.window_start, end: payload.window_end } : null, reason });
    }

    const eveningPool = reuseCallPool ? fullCallPool : await read(`loadUserPool at ${eveningAt.toISOString()}`, () => loadUserPool({
      supabase: client, userId: profile.id, homeBeachId: profile.homeBeachId,
      location: anchorAtEvening.anchor, maxDriveMinutes: profile.maxDriveMinutes,
    }));
    const callPoolIds = new Set(fullCallPool.map(({ beach }) => beach.id));
    const eveningPoolIds = new Set(eveningPool.map(({ beach }) => beach.id));
    const added = eveningPool.filter(({ beach }) => !callPoolIds.has(beach.id));
    const removed = fullCallPool.filter(({ beach }) => !eveningPoolIds.has(beach.id));
    console.log(`Pool for D+1 comparison at ${local(eveningAt)}: ${eveningPool.length} beaches${reuseCallPool ? "; reused uncapped D pool (identical anchor and source)" : ""}`);
    if (added.length || removed.length) {
      console.log(`Evening pool changes from D: ${added.length} added; ${removed.length} removed`);
      for (const { beach } of added) console.log(`  + ${beach.name} (${beach.id})`);
      for (const { beach } of removed) console.log(`  - ${beach.name} (${beach.id})`);
    }
    for (const { beach } of eveningPool) beachNames.set(beach.id, beach.name);
    const homeTomorrowByModel = new Map<HomeReplayModel, HomeReplay>();
    for (const model of HOME_REPLAY_MODELS) homeTomorrowByModel.set(model, await loadHomeAt(eveningAt, model, anchorAtEvening));
    console.log(`Swell evening at: ${local(eveningAt)} (${eveningAt.toISOString()}); target D+1: ${tomorrowDate}`);
    const swellProfile = (await read("loadSwellAlertProfiles", () => loadSwellAlertProfiles(client, eveningAt, [args.userId])))[0];
    const swellLeads: Array<CallPick | null> = [];
    if (!swellProfile) throw new Error(`No active swell profile found for ${args.userId}`);
    const swellSilentReason = swellProfile.awayFromHome ? "away_from_home" : "no swell event for D+1";
    if (swellProfile.awayFromHome) {
      console.log("Swell evening: silent (away_from_home)");
      swellLeads.push(null, null);
    } else {
      const evaluation = await read("evaluateSwellAlertPool", () => evaluateSwellAlertPool(client, swellProfile, eveningAt));
      for (const shared of [false, true]) {
        const ordered = await read(`orderSwellCandidatesForTomorrow (flag ${shared ? "on" : "off"})`, () => orderSwellCandidatesForTomorrow({
          profile: swellProfile, evaluation, now: eveningAt, rankDay: rankDayAt(rankDayWithWeekScout, eveningAt), usesSharedRanking: () => shared,
        }));
        console.log(`Swell flag ${shared ? "on" : "off"} (pool at ${local(eveningAt)}): ${ordered.length ? "top three" : "no swell event for D+1"}`);
        for (const candidate of ordered.slice(0, 3)) {
          console.log(`  ${candidate.beach.name} (${candidate.beach.id}); peakScore=${candidate.peakScore}; peakDate=${candidate.peakDate}`);
        }
        swellLeads.push(ordered[0] ? { beachId: ordered[0].beach.id, start: "", end: "" } : null);
      }
    }
    const homeTomorrowPicks = new Map<HomeReplayModel, CallPick | null>();
    for (const model of HOME_REPLAY_MODELS) {
      const replay = homeTomorrowByModel.get(model)!;
      homeTomorrowPicks.set(model, showScout(`${HOME_REPLAY_LABELS[model]}, tomorrow card for ${tomorrowDate} (pool at ${local(eveningAt)}; anchor ${replay.anchor})`, replay.response, tomorrowDate, eveningAt));
    }
    const homeReason = (response: CanonicalWeekScoutResponse | null, dayDate: string): string => !response ? "no location/home anchor"
      : !response.days.some((day) => day.localDate === dayDate) ? `${dayDate} outside Home's 7 days` : "no open Home pick";
    for (const model of HOME_REPLAY_MODELS) {
      const label = HOME_REPLAY_LABELS[model];
      const { response: home, anchor: homeAnchor, pick: homePick } = homeD.get(model)!;
      const dAnchors = `cron anchor: ${cronAnchorText}; Home anchor: ${homeAnchor}`;
      for (const [index, flag] of ["off", "on"].entries()) {
        const daily = dailyResults[index];
        compareCalls(`Daily Call (flag ${flag}) vs ${label} D`, daily.pick, homePick, !daily.pick ? `silent: ${daily.reason}` : homeReason(home, date), true, dAnchors);
      }
      compareCalls(`Crons' pick vs ${label} D`, cronPick, homePick, !cronPick ? "no open cron pick" : homeReason(home, date), true, dAnchors);
      const evening = homeTomorrowByModel.get(model)!;
      for (const [index, flag] of ["off", "on"].entries()) {
        compareCalls(`Swell lead (flag ${flag}) vs ${label} D+1`, swellLeads[index], homeTomorrowPicks.get(model) ?? null,
          !swellLeads[index] ? `silent: ${swellSilentReason}` : homeReason(evening.response, tomorrowDate), false,
          `swell anchor: ${eveningAnchorText}; Home anchor: ${evening.anchor}`);
      }
    }
  } catch (error) {
    const failure = violation ?? error;
    console.error(`${failure instanceof ReadOnlyViolation ? "BLOCKED: " : "Call parity failed: "}${failure instanceof Error ? failure.message : String(failure)}`);
    process.exitCode = failure instanceof ReadOnlyViolation ? 3 : 1;
  }
}

if (require.main === module) void main();
