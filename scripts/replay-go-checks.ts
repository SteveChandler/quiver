import type { ForecastVerdict } from "@/lib/alerts/canonical-forecast-verdict";
import type { BoardClass } from "@/lib/domains/rideability";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { missingParityEnv } from "@/scripts/check-call-parity";

interface ReplayArgs {
  userIds: string[];
  beginnerSample: number;
  days: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPLAY_FLAGS = ["--users", "--beginner-sample", "--days"];

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number, message: string): number {
  if (value === undefined) return fallback;
  const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!(parsed >= min && parsed <= max)) throw new Error(message);
  return parsed;
}

export function parseReplayArgs(argv: string[]): ReplayArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!REPLAY_FLAGS.includes(flag)) throw new Error(`Unknown flag: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (values.has(flag)) throw new Error(`Duplicate flag: ${flag}`);
    values.set(flag, value);
  }
  const users = values.get("--users");
  if (!users) throw new Error("--users is required");
  // Database ids are lowercase; a mixed-case id misses the sample exclusion and its own board rows.
  const userIds = users.split(",").map((userId) => userId.toLowerCase());
  if (!userIds.every((userId) => UUID_PATTERN.test(userId))) throw new Error("--users must be UUIDs");
  const repeated = userIds.find((userId, index) => userIds.indexOf(userId) !== index);
  if (repeated) throw new Error(`Duplicate user in --users: ${repeated}`);
  return {
    userIds,
    beginnerSample: boundedInteger(values.get("--beginner-sample"), 20, 0, 50, "--beginner-sample must be 0-50"),
    days: boundedInteger(values.get("--days"), 7, 1, 7, "--days must be 1-7"),
  };
}

export interface ReplayRow {
  userId: string;
  localDate: string;
  beachId: string;
  beachName: string;
  forecastAt: string;
  waveHeightFt: number;
  wavePeriodS: number;
  windMph: number | null;
  windDeg: number | null;
  boardClass: BoardClass | null;
  off: ForecastVerdict;
  on: ForecastVerdict;
}

interface SideCounts {
  off: number;
  on: number;
}

interface ReplayUserSummary {
  userId: string;
  goWindowsPerDay: Record<string, SideCounts>;
  goDays: SideCounts;
  changed: ReplayRow[];
}

/** Go windows are runs inside one beach's day; rows of two beaches never join. */
export function summarizeReplay(
  rows: readonly ReplayRow[],
  groupGo: (evaluations: ForecastVerdict[]) => ForecastVerdict[][],
): ReplayUserSummary[] {
  const rowsByUser = new Map<string, ReplayRow[]>();
  for (const row of rows) {
    const userRows = rowsByUser.get(row.userId) ?? [];
    userRows.push(row);
    rowsByUser.set(row.userId, userRows);
  }
  return [...rowsByUser].map(([userId, userRows]) => {
    const goWindowsPerDay: Record<string, SideCounts> = {};
    const beachDays = new Map<string, ReplayRow[]>();
    for (const row of userRows) {
      goWindowsPerDay[row.localDate] ??= { off: 0, on: 0 };
      const key = `${row.localDate}|${row.beachId}`;
      const beachDay = beachDays.get(key) ?? [];
      beachDay.push(row);
      beachDays.set(key, beachDay);
    }
    for (const beachDay of beachDays.values()) {
      const sorted = [...beachDay].sort((left, right) => Date.parse(left.forecastAt) - Date.parse(right.forecastAt));
      const day = goWindowsPerDay[sorted[0].localDate];
      day.off += groupGo(sorted.map(({ off }) => off)).length;
      day.on += groupGo(sorted.map(({ on }) => on)).length;
    }
    const days = Object.values(goWindowsPerDay);
    return {
      userId,
      goWindowsPerDay,
      goDays: { off: days.filter(({ off }) => off > 0).length, on: days.filter(({ on }) => on > 0).length },
      changed: userRows
        .filter(({ off, on }) => off.verdict !== on.verdict)
        .sort((left, right) => Date.parse(left.forecastAt) - Date.parse(right.forecastAt)
          || left.beachId.localeCompare(right.beachId)),
    };
  });
}

/**
 * fetchBoardClassesByUser returns [] when its read fails, which prints like a user with no boards.
 * The replay compares it with a checked read of the same rows and stops on a mismatch.
 */
export function boardReadMismatch(
  activeRows: number,
  expected: readonly BoardClass[],
  actual: readonly BoardClass[],
): string | null {
  if (expected.length === actual.length && expected.every((boardClass, index) => boardClass === actual[index])) return null;
  return `boards table has ${activeRows} active rows (${expected.join(", ") || "no known class"}), `
    + `but fetchBoardClassesByUser returned ${actual.join(", ") || "none"}`;
}

const REPLAY_SCORING_FLAGS =["HOURLY_BRIDGE_ENABLED", "NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED", "NEXT_PUBLIC_TIDE_SWING_ENABLED"] as const;
const TRUSTED_FORECAST_PREFIX = "TRUSTED_FORECAST_";

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

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const PROFILE_CHUNK_SIZE = 100;

function parseNumber(value: unknown): number {
  return Number.parseFloat(String(value ?? ""));
}

async function main(): Promise<void> {
  let args: ReplayArgs;
  try {
    args = parseReplayArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${(error as Error).message}\nUsage: npx tsx scripts/replay-go-checks.ts --users <uuid,uuid> [--beginner-sample 0-50] [--days 1-7]`);
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

    const { loadDailyCallProfiles, groupGoForecasts } = await import("@/lib/cron/daily-call-runner");
    const { capNearbyPool, loadUserPool } = await import("@/lib/alerts/user-pool");
    const { evaluateForecastVerdict } = await import("@/lib/alerts/canonical-forecast-verdict");
    const { fetchBoardClassesByUser, orderBoardClasses } = await import("@/lib/profile/board-classes");
    const { normalizeBoardClass } = await import("@/lib/domains/rideability");
    const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
    const { DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS, resolveLocationAnchor } = await import("@/lib/alerts/location-freshness");
    const { getLocalDateString, resolveBeachTimezone } = await import("@/lib/utils/timezone-utils");
    const { formatInTimeZone } = await import("date-fns-tz");

    const trustedNames = Object.keys(process.env).filter((name) => name.startsWith(TRUSTED_FORECAST_PREFIX)).sort();
    let anyUnset = trustedNames.length === 0;
    for (const name of [...REPLAY_SCORING_FLAGS, ...trustedNames]) {
      const value = process.env[name];
      if (value === undefined) anyUnset = true;
      console.log(`${name}: ${value ?? "UNSET"}`);
    }
    if (trustedNames.length === 0) console.log(`${TRUSTED_FORECAST_PREFIX}*: UNSET`);
    if (anyUnset) console.log("WARNING: production sets these flags; absolute counts can differ from production (spec 6a).");

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
    const now = new Date();
    const client = createSupabaseServiceRoleClient();

    const sample: string[] = [];
    if (args.beginnerSample > 0) {
      const boardUserIds = new Set<string>();
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await read(`boards page at ${from}`, async () => await client
          .from("boards").select("id, user_id").is("retired_at", null).order("id").range(from, from + PAGE_SIZE - 1));
        if (error) throw new Error(`Failed to load boards: ${error.message}`);
        for (const { user_id } of data ?? []) boardUserIds.add(user_id);
        if ((data ?? []).length < PAGE_SIZE) break;
      }
      const boardUsers = [...boardUserIds].sort();
      const beginners: string[] = [];
      for (let start = 0; start < boardUsers.length; start += PROFILE_CHUNK_SIZE) {
        const chunk = boardUsers.slice(start, start + PROFILE_CHUNK_SIZE);
        const { data, error } = await read(`beginner profiles at ${start}`, async () => await client
          .from("profiles").select("id").in("id", chunk).eq("experience_level", "beginner").is("deleted_at", null));
        if (error) throw new Error(`Failed to load beginner profiles: ${error.message}`);
        beginners.push(...(data ?? []).map(({ id }) => id));
      }
      const excluded = new Set(args.userIds);
      const activeSince = new Date(now.getTime() - 30 * DAY_MS).toISOString();
      for (const userId of beginners.sort().filter((id) => !excluded.has(id))) {
        if (sample.length >= args.beginnerSample) break;
        const { data, error } = await read(`user_events probe for ${userId}`, async () => await client
          .from("user_events").select("id").eq("user_id", userId).gte("created_at", activeSince).limit(1));
        if (error) throw new Error(`Failed to probe user_events: ${error.message}`);
        if ((data ?? []).length > 0) sample.push(userId);
      }
    }
    console.log(`Beginner sample: ${sample.length} of ${args.beginnerSample} requested`);
    if (sample.length < args.beginnerSample) console.log(`WARNING: only ${sample.length} active beginners with boards`);

    const since = new Date(now.getTime() - args.days * DAY_MS).toISOString();
    console.log(`Window: forecast_at from ${since} to ${now.toISOString()} (days: ${args.days})`);
    for (const userId of [...args.userIds, ...sample]) {
      const [profile] = await read(`loadDailyCallProfiles for ${userId}`, () => loadDailyCallProfiles(client, [userId]));
      if (!profile) {
        console.log(`\nUser ${userId}: no active profile; skipped`);
        continue;
      }
      const boardClasses = (await read(`fetchBoardClassesByUser for ${userId}`, () => fetchBoardClassesByUser(client, [userId])))
        .get(userId) ?? [];
      const boardTypes: string[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await read(`boards check for ${userId} at ${from}`, async () => await client
          .from("boards").select("id, board_type").eq("user_id", userId).is("retired_at", null)
          .order("id").range(from, from + PAGE_SIZE - 1));
        if (error) throw new Error(`Failed to check boards for ${userId}: ${error.message}`);
        boardTypes.push(...(data ?? []).map(({ board_type }) => board_type));
        if ((data ?? []).length < PAGE_SIZE) break;
      }
      const expectedClasses = orderBoardClasses(boardTypes.map((boardType) => normalizeBoardClass(boardType))
        .filter((boardClass): boardClass is BoardClass => boardClass !== null));
      const mismatch = boardReadMismatch(boardTypes.length, expectedClasses, boardClasses);
      if (mismatch) throw new Error(`Board read for ${userId} is not trusted: ${mismatch}`);
      const { anchor, source } = resolveLocationAnchor(profile.location, now, profile.homeBeach, DAILY_CALL_LOCATION_FIX_MAX_AGE_HOURS);
      const { pool } = capNearbyPool(await read(`loadUserPool for ${userId}`, () => loadUserPool({
        supabase: client, userId, homeBeachId: profile.homeBeachId,
        location: anchor, maxDriveMinutes: profile.maxDriveMinutes,
      })), { experienceLevel: profile.experienceLevel });
      const userTimezone = resolveBeachTimezone((source === "location" ? profile.location?.timezone : null)
        ?? profile.timezone ?? profile.homeBeach?.timezone);

      const rows: ReplayRow[] = [];
      const beachTimezones = new Map<string, string>();
      for (const { beach } of pool) {
        const timezone = resolveBeachTimezone(beach.timezone || userTimezone);
        beachTimezones.set(beach.id, timezone);
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await read(`enhanced_forecasts for ${beach.id} at ${from}`, async () => await client
            .from("enhanced_forecasts").select("*").eq("beach_id", beach.id)
            .gte("forecast_at", since).lt("forecast_at", now.toISOString())
            .order("forecast_at", { ascending: true }).range(from, from + PAGE_SIZE - 1));
          if (error) throw new Error(`Failed to load forecasts for ${beach.id}: ${error.message}`);
          const forecasts = (data ?? []) as EnhancedForecastEntity[];
          for (const forecast of forecasts) {
            const base = { forecast, beach, experienceLevel: profile.experienceLevel, timezone, now, candidateIdPrefix: "replay-go-checks" };
            const off = evaluateForecastVerdict(base);
            const on = evaluateForecastVerdict({ ...base, goChecks: { boardClasses } });
            const windMph = parseNumber(forecast.wind_speed);
            rows.push({
              userId,
              localDate: getLocalDateString(new Date(forecast.forecast_at), timezone),
              beachId: beach.id,
              beachName: beach.name,
              forecastAt: forecast.forecast_at,
              waveHeightFt: parseNumber(forecast.wave_height),
              wavePeriodS: parseNumber(forecast.wave_period),
              windMph: Number.isFinite(windMph) ? windMph : null,
              windDeg: forecast.wind_direction_deg ?? null,
              boardClass: on.boardClass ?? null,
              off,
              on,
            });
          }
          if (forecasts.length < PAGE_SIZE) break;
        }
      }

      console.log(`\nUser ${userId}: skill=${profile.experienceLevel ?? "none"}; boards=${boardClasses.join(", ") || "none"} (${boardTypes.length} active rows); pool=${pool.length} beaches; rows=${rows.length}`);
      const [summary] = summarizeReplay(rows, groupGoForecasts);
      if (!summary) {
        console.log("  No forecast rows in the window.");
        continue;
      }
      console.log("  Go windows per day (off -> on):");
      for (const date of Object.keys(summary.goWindowsPerDay).sort()) {
        const { off, on } = summary.goWindowsPerDay[date];
        console.log(`    ${date}: ${off} -> ${on}`);
      }
      console.log(`  Days with a go (off -> on): ${summary.goDays.off} -> ${summary.goDays.on}`);
      console.log(`  Changed rows: ${summary.changed.length}`);
      for (const row of summary.changed) {
        const time = formatInTimeZone(row.forecastAt, beachTimezones.get(row.beachId) ?? userTimezone, "yyyy-MM-dd HH:mm zzz");
        const wind = row.windMph === null ? "wind unknown" : `wind ${row.windMph} mph${row.windDeg === null ? "" : ` ${row.windDeg} deg`}`;
        console.log(`    ${time} ${row.beachName} (${row.beachId}): ${row.waveHeightFt} ft, ${row.wavePeriodS} s, ${wind}; `
          + `off=${row.off.verdict} (${row.off.score}) -> on=${row.on.verdict} (${row.on.score}); board=${row.boardClass ?? "none"}`);
      }
    }
  } catch (error) {
    const failure = violation ?? error;
    console.error(`${failure instanceof ReadOnlyViolation ? "BLOCKED: " : "Replay failed: "}${failure instanceof Error ? failure.message : String(failure)}`);
    process.exitCode = failure instanceof ReadOnlyViolation ? 3 : 1;
  }
}

if (require.main === module) void main();
