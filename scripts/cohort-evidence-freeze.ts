#!/usr/bin/env node

// Monthly cohort freeze. user_events rows expire after ~90 days, so this writes the
// sign-up cohort's aggregates (never user ids or emails) to a durable JSON file.
// Read-only: every query goes through readOnlySupabase.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./load-env.mjs";
import {
  createReadOnlySupabaseFromEnv, localDate, profileExclusionReason, resolveCompleteDayWindow,
  selectAllPages, USER_EVENT_USER_CHUNK_SIZE, type ProfileExclusionReason, type ReadOnlySupabase,
} from "../lib/analytics/report-guards";

config({ path: ".env.local" });
config();

export const COHORT_FREEZE_SCHEMA_VERSION = "cohort-evidence-freeze-v1";
const TIME_ZONE = "America/Los_Angeles";
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const PROFILE_CHUNK_SIZE = 200;

// Android sign-ups in this range are Play closed-test accounts (Fiverr testers, Nov 13–27),
// not organic users. Later Android sign-ups count as real, so a December launch is not hidden.
export const ANDROID_CLOSED_TEST_START_DATE = "2026-11-01";
export const ANDROID_CLOSED_TEST_END_DATE = "2026-11-27";

export const FIRST_72H_EVENTS = [
  "decision_loop_completed",
  "home_nearby_spot_tap",
  "session_log_start",
  "push_device_registered",
  "forecast_interaction",
  "home_hero_forecast_viewed",
  "paywall_opened",
] as const;
const APP_EVENT_TYPES = new Set(["home_viewed", "tab_view", "paywall_opened"]);
const PLATFORMS = ["ios", "android", "app_unknown", "web"] as const;

export type CohortPlatform = typeof PLATFORMS[number];
export type CohortExclusionReason = ProfileExclusionReason | "android_closed_test";

export interface CohortProfile {
  id: string;
  created_at: string;
  home_beach_id: string | number | null;
  onboarding_completed_at: string | null;
  deleted_at: string | null;
  is_mock: boolean | null;
  is_system_account: boolean | null;
  analytics_is_real_user: boolean | null;
  analytics_exclusion_reason: string | null;
}

export interface CohortEvent {
  user_id: string;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface CohortTimestampRow {
  user_id: string;
  created_at: string;
}

export interface CohortFreezeInput {
  asOf: string;
  profiles: CohortProfile[];
  events: CohortEvent[];
  devices: CohortTimestampRow[];
  sessions: CohortTimestampRow[];
}

export interface Rate {
  numerator: number;
  denominator: number;
  rate: number | null;
}

interface PlatformGroup {
  signups: number;
  homeBeachSet: number;
  onboardingCompleted: number;
  returnedDays1to6: Rate;
  returnedDays7to13: Rate;
}

export interface CohortFreezeAggregates {
  signups: number;
  homeBeachSet: number;
  onboardingCompleted: number;
  platform: Record<CohortPlatform, number>;
  returnedDays1to6: Rate;
  returnedDays7to13: Rate;
  first72h: Record<typeof FIRST_72H_EVENTS[number], { did: Rate; returnedDays7to13: Rate }>;
  pushDeviceWithin72h: Rate;
  sessionLoggedWithin30d: Rate;
  byPlatform: Record<CohortPlatform, PlatformGroup>;
  exclusions: { total: number; byReason: Partial<Record<CohortExclusionReason, number>> };
  // Kept profiles that a stricter rule (analytics_is_real_user must be true and
  // analytics_exclusion_reason must be null) would drop. Diagnostic only.
  stricterFlagRuleWouldDrop: { analyticsIsRealUserNull: number; analyticsExclusionReasonSet: number };
}

function rate(numerator: number, denominator: number): Rate {
  return { numerator, denominator, rate: denominator === 0 ? null : Number((numerator / denominator).toFixed(4)) };
}

function dayNumber(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS;
}

function isClientEvent(event: CohortEvent): boolean {
  return event.metadata?.source !== "server";
}

function firstOpenPlatform(events: CohortEvent[]): string | null {
  const opens = events.filter((event) => event.event_type === "native_app_first_open")
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const open of opens) {
    const platform = open.metadata?.platform;
    if (platform === "ios" || platform === "android") return platform;
  }
  return null;
}

export function classifyPlatform(events: CohortEvent[]): CohortPlatform {
  const platform = firstOpenPlatform(events);
  if (platform === "ios" || platform === "android") return platform;
  if (events.some((event) => APP_EVENT_TYPES.has(event.event_type))) return "app_unknown";
  return "web";
}

export function isAndroidClosedTest(platform: CohortPlatform, signupDate: string): boolean {
  return platform === "android"
    && signupDate >= ANDROID_CLOSED_TEST_START_DATE
    && signupDate <= ANDROID_CLOSED_TEST_END_DATE;
}

interface UserFacts {
  platform: CohortPlatform;
  homeBeachSet: boolean;
  onboardingCompleted: boolean;
  mature7: boolean;
  mature14: boolean;
  mature72h: boolean;
  mature30d: boolean;
  returned1to6: boolean;
  returned7to13: boolean;
  first72h: Set<string>;
  pushDevice72h: boolean;
  session30d: boolean;
}

function groupByUser<T extends { user_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.user_id);
    if (list) list.push(row);
    else map.set(row.user_id, [row]);
  }
  return map;
}

export function buildCohortFreeze(input: CohortFreezeInput): CohortFreezeAggregates {
  const asOfMs = Date.parse(input.asOf);
  if (Number.isNaN(asOfMs)) throw new Error("asOf must be a valid timestamp");
  const asOfDay = dayNumber(localDate(new Date(asOfMs), TIME_ZONE));
  const eventsByUser = groupByUser(input.events);
  const devicesByUser = groupByUser(input.devices);
  const sessionsByUser = groupByUser(input.sessions);
  const exclusions: Partial<Record<CohortExclusionReason, number>> = {};
  const stricter = { analyticsIsRealUserNull: 0, analyticsExclusionReasonSet: 0 };
  const facts: UserFacts[] = [];

  for (const profile of input.profiles) {
    const events = eventsByUser.get(profile.id) ?? [];
    const signupMs = Date.parse(profile.created_at);
    const signupDate = localDate(new Date(signupMs), TIME_ZONE);
    const platform = classifyPlatform(events);
    const reason: CohortExclusionReason | null = profileExclusionReason(profile, profile.id)
      ?? (isAndroidClosedTest(platform, signupDate) ? "android_closed_test" : null);
    if (reason) {
      exclusions[reason] = (exclusions[reason] ?? 0) + 1;
      continue;
    }
    if (profile.analytics_is_real_user == null) stricter.analyticsIsRealUserNull += 1;
    if (profile.analytics_exclusion_reason != null) stricter.analyticsExclusionReasonSet += 1;

    const signupDay = dayNumber(signupDate);
    const clientDays = new Set(events.filter(isClientEvent)
      .map((event) => dayNumber(localDate(new Date(event.created_at), TIME_ZONE)) - signupDay));
    const has = (from: number, to: number): boolean => [...clientDays].some((day) => day >= from && day <= to);
    const within = (rows: CohortTimestampRow[], hours: number): boolean =>
      rows.some((row) => Date.parse(row.created_at) <= signupMs + hours * HOUR_MS);

    facts.push({
      platform,
      homeBeachSet: profile.home_beach_id != null,
      onboardingCompleted: profile.onboarding_completed_at != null,
      // A return window counts only once its last LA day has fully passed.
      mature7: signupDay + 6 < asOfDay,
      mature14: signupDay + 13 < asOfDay,
      mature72h: signupMs + 72 * HOUR_MS <= asOfMs,
      mature30d: signupMs + 30 * DAY_MS <= asOfMs,
      returned1to6: has(1, 6),
      returned7to13: has(7, 13),
      first72h: new Set(events.filter((event) => Date.parse(event.created_at) <= signupMs + 72 * HOUR_MS)
        .map((event) => event.event_type)),
      pushDevice72h: within(devicesByUser.get(profile.id) ?? [], 72),
      session30d: within(sessionsByUser.get(profile.id) ?? [], 30 * 24),
    });
  }

  const count = (rows: UserFacts[], test: (row: UserFacts) => boolean): number => rows.filter(test).length;
  const returnRate = (rows: UserFacts[], mature: keyof UserFacts, returned: keyof UserFacts): Rate => {
    const matured = rows.filter((row) => row[mature] === true);
    return rate(count(matured, (row) => row[returned] === true), matured.length);
  };
  const mature72h = facts.filter((row) => row.mature72h);
  const first72h = Object.fromEntries(FIRST_72H_EVENTS.map((event) => {
    const did = mature72h.filter((row) => row.first72h.has(event));
    return [event, {
      did: rate(did.length, mature72h.length),
      returnedDays7to13: returnRate(did, "mature14", "returned7to13"),
    }];
  })) as CohortFreezeAggregates["first72h"];
  const byPlatform = Object.fromEntries(PLATFORMS.map((platform) => {
    const rows = facts.filter((row) => row.platform === platform);
    return [platform, {
      signups: rows.length,
      homeBeachSet: count(rows, (row) => row.homeBeachSet),
      onboardingCompleted: count(rows, (row) => row.onboardingCompleted),
      returnedDays1to6: returnRate(rows, "mature7", "returned1to6"),
      returnedDays7to13: returnRate(rows, "mature14", "returned7to13"),
    }];
  })) as Record<CohortPlatform, PlatformGroup>;
  const mature30d = facts.filter((row) => row.mature30d);

  return {
    signups: facts.length,
    homeBeachSet: count(facts, (row) => row.homeBeachSet),
    onboardingCompleted: count(facts, (row) => row.onboardingCompleted),
    platform: Object.fromEntries(PLATFORMS.map((platform) => [platform, byPlatform[platform].signups])) as Record<CohortPlatform, number>,
    returnedDays1to6: returnRate(facts, "mature7", "returned1to6"),
    returnedDays7to13: returnRate(facts, "mature14", "returned7to13"),
    first72h,
    pushDeviceWithin72h: rate(count(mature72h, (row) => row.pushDevice72h), mature72h.length),
    sessionLoggedWithin30d: rate(count(mature30d, (row) => row.session30d), mature30d.length),
    byPlatform,
    exclusions: { total: Object.values(exclusions).reduce((sum, n) => sum + (n ?? 0), 0), byReason: exclusions },
    stricterFlagRuleWouldDrop: stricter,
  };
}

interface CliOptions {
  startDate: string;
  endDate: string;
  start: string;
  endExclusive: string;
  asOf: string;
  out: string;
  force: boolean;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function findWorkspaceRoot(from: string = process.cwd()): string {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(resolve(dir, ".quiver"))) return dir;
    if (dirname(dir) === dir) throw new Error("Cannot find the workspace root (a folder with .quiver); pass --out");
  }
}

// --start and --end are inclusive LA sign-up dates. Default: the last full calendar month.
export function parseCliArgs(argv: string[], now: Date = new Date(), workspaceRoot?: () => string): CliOptions {
  const startArg = flagValue(argv, "--start");
  const endArg = flagValue(argv, "--end");
  if (Boolean(startArg) !== Boolean(endArg)) throw new Error("Pass both --start and --end, or neither");
  const today = localDate(now, TIME_ZONE);
  const thisMonthStart = `${today.slice(0, 7)}-01`;
  const startDate = startArg ?? `${addDays(thisMonthStart, -1).slice(0, 7)}-01`;
  const endDate = endArg ?? addDays(thisMonthStart, -1);
  const window = resolveCompleteDayWindow({ startDate, endDate: addDays(endDate, 1), timeZone: TIME_ZONE });
  const asOfArg = flagValue(argv, "--as-of");
  const asOf = asOfArg === undefined ? now.toISOString()
    : /^\d{4}-\d{2}-\d{2}$/.test(asOfArg)
      ? resolveCompleteDayWindow({ startDate: addDays(asOfArg, -1), endDate: asOfArg, timeZone: TIME_ZONE }).end.toISOString()
      : asOfArg;
  if (Number.isNaN(Date.parse(asOf)) || !/(?:Z|[+-]\d{2}:\d{2})$|^\d{4}-\d{2}-\d{2}$/i.test(asOfArg ?? asOf)) {
    throw new Error("--as-of must be an LA date (YYYY-MM-DD) or a timestamp with a UTC offset");
  }
  if (Date.parse(asOf) < window.start.getTime()) throw new Error("--as-of must not be before --start");
  const out = flagValue(argv, "--out")
    ?? resolve((workspaceRoot ?? findWorkspaceRoot)(), ".quiver/runs/cohort-freeze", `${startDate.slice(0, 7)}.json`);
  return {
    startDate, endDate, start: window.start.toISOString(), endExclusive: window.end.toISOString(), asOf, out,
    force: argv.includes("--force"),
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function loadCohortFreezeInput(client: ReadOnlySupabase, options: CliOptions): Promise<CohortFreezeInput> {
  const profiles = await selectAllPages<CohortProfile>(() => client.from("profiles")
    .select("id,created_at,home_beach_id,onboarding_completed_at,deleted_at,is_mock,is_system_account,analytics_is_real_user,analytics_exclusion_reason")
    .gte("created_at", options.start).lt("created_at", options.endExclusive)
    .order("created_at").order("id"));
  const ids = profiles.map((profile) => profile.id);
  // Events up to day 13 (returns) and 30 days (platform signal); first opens can precede sign-up.
  const eventStart = new Date(Date.parse(options.start) - 30 * DAY_MS).toISOString();
  const eventEnd = new Date(Math.min(Date.parse(options.asOf), Date.parse(options.endExclusive) + 31 * DAY_MS)).toISOString();
  const events: CohortEvent[] = [];
  for (const chunk of chunks(ids, USER_EVENT_USER_CHUNK_SIZE)) {
    events.push(...await selectAllPages<CohortEvent>(() => client.from("user_events")
      .select("id,user_id,event_type,created_at,metadata").in("user_id", chunk)
      .gte("created_at", eventStart).lt("created_at", eventEnd)
      .order("user_id").order("created_at", { ascending: false }).order("id")));
  }
  const devices: CohortTimestampRow[] = [];
  const sessions: CohortTimestampRow[] = [];
  for (const chunk of chunks(ids, PROFILE_CHUNK_SIZE)) {
    devices.push(...await selectAllPages<CohortTimestampRow>(() => client.from("user_devices")
      .select("id,user_id,created_at").in("user_id", chunk).lte("created_at", options.asOf)
      .order("user_id").order("created_at").order("id")));
    sessions.push(...await selectAllPages<CohortTimestampRow>(() => client.from("sessions")
      .select("id,user_id,created_at").in("user_id", chunk).is("deleted_at", null).lte("created_at", options.asOf)
      .order("user_id").order("created_at").order("id")));
  }
  return { asOf: options.asOf, profiles, events, devices, sessions };
}

// A re-run after the ~90-day purge reads fewer events, so it must not replace a good freeze.
export function assertCanWrite(output: string, force: boolean, exists: (path: string) => boolean = existsSync): void {
  if (exists(output) && !force) throw new Error(`${output} exists; pass --force to replace it`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  assertCanWrite(resolve(options.out), options.force);
  const generatedAt = new Date().toISOString();
  const input = await loadCohortFreezeInput(createReadOnlySupabaseFromEnv(), options);
  const report = {
    schemaVersion: COHORT_FREEZE_SCHEMA_VERSION,
    generatedAt,
    window: {
      signupStartDate: options.startDate,
      signupEndDateInclusive: options.endDate,
      start: options.start,
      endExclusive: options.endExclusive,
      timeZone: TIME_ZONE,
    },
    asOf: options.asOf,
    definitions: {
      exclusions: "profileExclusionReason (internal ids, missing, deleted, mock, system, analytics_is_real_user=false); android_closed_test = native_app_first_open platform android and LA sign-up date in "
        + `[${ANDROID_CLOSED_TEST_START_DATE}, ${ANDROID_CLOSED_TEST_END_DATE}] (Play closed test)`,
      platform: "earliest native_app_first_open metadata.platform ios/android; else app_unknown if home_viewed/tab_view/paywall_opened; else web",
      returns: "any user_events row with metadata.source != 'server' on LA day 1-6 or 7-13 after the LA sign-up date; denominator = sign-ups whose window ended before the as-of LA date",
      first72h: "user_events event_type within 72 h of profiles.created_at; denominator = sign-ups at least 72 h old; returnedDays7to13 among those that are also 14-day mature",
      pushDeviceWithin72h: "user_devices.created_at <= profiles.created_at + 72 h, any device row including retired",
      sessionLoggedWithin30d: "sessions not deleted with created_at <= profiles.created_at + 30 days; denominator = sign-ups at least 30 days old",
      purgeEdge: "user_events rows expire after ~90 days; a window that starts before as-of minus 90 days undercounts events",
    },
    sourceCounts: {
      profiles: input.profiles.length,
      userEvents: input.events.length,
      userDevices: input.devices.length,
      sessions: input.sessions.length,
      earliestUserEventAt: input.events.map((event) => event.created_at).sort()[0] ?? null,
    },
    aggregates: buildCohortFreeze(input),
  };
  const output = resolve(options.out);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(`${output}\n`);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unknown report failure");
    process.exitCode = 1;
  });
}
