#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./load-env.mjs";
import { createReadOnlySupabaseFromEnv, resolveCompleteDayWindow, type ReadOnlySupabase } from "../lib/analytics/report-guards";

import {
  buildInstallToPaidRows,
  buildInstallDimensions,
  buildInstallToPaidAggregates,
  INSTALL_TO_PAID_SCHEMA_VERSION,
  MEANINGFUL_ACTIVITY_EVENTS,
  type FailedWebhook,
  type InstallBehaviorEvent,
  type InstallLink,
  type InstallProfile,
  type InstallToPaidRow,
  type InstallToPaidAggregates,
  type RevenueCatLedgerEvent,
} from "../lib/analytics/install-to-paid-funnel-v1";

config({ path: ".env.local" });
config();

const PAGE_SIZE = 1000;
const POSTHOG_MAX_ATTEMPTS = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSTHOG_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CliOptions {
  start: string;
  end: string;
  asOf: string;
  trialWindowDays: number;
  outputJson: string | null;
  outputCsv: string | null;
  outputMd: string | null;
  ascJson: string | null;
  window: InstallToPaidAggregates["window"];
}

interface PostHogPayload {
  results?: unknown[][];
}

interface PostHogCursor {
  timestamp: string;
  uuid: string;
}

interface AscAggregate {
  date: string;
  downloads: number;
  platform?: string;
  territory?: string;
}

interface ReportEnvelope {
  schemaVersion: typeof INSTALL_TO_PAID_SCHEMA_VERSION;
  generatedAt: string;
  cohort: { start: string; end: string; asOf: string };
  window: InstallToPaidAggregates["window"];
  asOf: string;
  sourceFreshness: InstallToPaidAggregates["sourceFreshness"];
  rows: InstallToPaidRow[];
  aggregates: InstallToPaidAggregates;
  ascAggregateDownloads: {
    joinPolicy: "aggregate_only_never_person_joined";
    rows: AscAggregate[];
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parseDate(value: string, flag: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dateOnly && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error(`${flag} must include UTC (Z/offset) or be a date-only UTC value`);
  }
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${flag} must be a valid date`);
  return parsed.toISOString();
}

function flagValue(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  return index < 0 ? null : argv[index + 1] ?? null;
}

export function parseCliArgs(argv: string[], now: Date = new Date()): CliOptions {
  const startArg = flagValue(argv, "--start");
  const endArg = flagValue(argv, "--end");
  const tzArg = flagValue(argv, "--tz");
  const daysArg = flagValue(argv, "--days");
  const days = daysArg === null ? 30 : Number(daysArg);
  const trialWindowArg = flagValue(argv, "--trial-window-days");
  const trialWindowDays = trialWindowArg === null ? 7 : Number(trialWindowArg);
  if ((argv.includes("--trial-window-days") && trialWindowArg === null)
    || !Number.isSafeInteger(trialWindowDays) || trialWindowDays < 1) {
    throw new Error("--trial-window-days must be a positive integer");
  }
  const localDates = (!startArg && !endArg) || (Boolean(tzArg)
    && (!startArg || /^\d{4}-\d{2}-\d{2}$/.test(startArg))
    && (!endArg || /^\d{4}-\d{2}-\d{2}$/.test(endArg)));
  const resolved = localDates ? resolveCompleteDayWindow({
    startDate: startArg ?? undefined,
    endDate: endArg ?? undefined,
    days,
    timeZone: tzArg ?? undefined,
    now,
  }) : null;
  const end = resolved?.end.toISOString() ?? parseDate(endArg ?? now.toISOString(), "--end");
  const start = resolved?.start.toISOString() ?? parseDate(
    startArg ?? new Date(Date.parse(end) - days * 86_400_000).toISOString(), "--start");
  const asOf = parseDate(flagValue(argv, "--as-of") ?? now.toISOString(), "--as-of");
  if (Date.parse(start) >= Date.parse(end)) throw new Error("--start must be before --end");
  const window = resolved ? {
    startDate: resolved.startDate, endDate: resolved.endDate, start, end,
    timeZone: resolved.timeZone,
  } : { startDate: start.slice(0, 10), endDate: end.slice(0, 10), start, end,
    timeZone: tzArg ?? "America/Los_Angeles" };
  return {
    start,
    end,
    asOf,
    trialWindowDays,
    outputJson: flagValue(argv, "--output-json"),
    outputCsv: flagValue(argv, "--output-csv"),
    outputMd: flagValue(argv, "--output-md"),
    ascJson: flagValue(argv, "--asc-json"),
    window,
  };
}

export function createReportClient(): ReadOnlySupabase {
  return createReadOnlySupabaseFromEnv();
}

async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await fetchPage(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function postHogEvents(): string[] {
  return [
    "native_app_first_open",
    "native_install_attribution_joined",
    "home_viewed",
    "home_hero_forecast_viewed",
    "paywall_opened",
    "onboarding_paywall_viewed",
    ...MEANINGFUL_ACTIVITY_EVENTS,
  ].filter((value, index, all) => all.indexOf(value) === index);
}

function parsePostHogProperties(value: unknown): Record<string, unknown> | undefined {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : undefined;
}

export function parsePostHogRows(payload: PostHogPayload): InstallBehaviorEvent[] {
  return (payload.results ?? []).flatMap((row): InstallBehaviorEvent[] => {
    const [event, timestamp, distinctId, personId, nativeInstallId, properties] = row;
    if (![event, timestamp, distinctId, personId].every((value) => typeof value === "string")) return [];
    return [{
      event: event as string,
      timestamp: new Date(timestamp as string).toISOString(),
      distinctId: distinctId as string,
      personId: personId as string,
      nativeInstallId: typeof nativeInstallId === "string" ? nativeInstallId : null,
      properties: parsePostHogProperties(properties),
    }];
  });
}

function postHogCursor(row: unknown[] | undefined): PostHogCursor {
  const timestamp = row?.[1];
  const uuid = row?.[6];
  if (typeof timestamp !== "string" || typeof uuid !== "string" || !POSTHOG_UUID_PATTERN.test(uuid)) {
    throw new Error("PostHog page is missing a valid timestamp/UUID cursor");
  }
  const parsedTimestamp = new Date(timestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) {
    throw new Error("PostHog page is missing a valid timestamp/UUID cursor");
  }
  return { timestamp, uuid };
}

async function queryPostHog(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok || ![429, 502, 503, 504].includes(response.status) || attempt + 1 >= POSTHOG_MAX_ATTEMPTS) {
      return response;
    }
    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = Number(retryAfter);
    const delayMs = retryAfter !== null && Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : 1000 * 2 ** attempt;
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }
}

export async function fetchPostHogEvents(options: Pick<CliOptions, "start" | "end" | "asOf">): Promise<InstallBehaviorEvent[]> {
  const host = (process.env.POSTHOG_HOST ?? "https://us.posthog.com").replace(/\/$/, "");
  const projectId = requiredEnv("POSTHOG_PROJECT_ID");
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY ?? requiredEnv("POSTHOG_API_KEY");
  const eventList = postHogEvents().map((event) => `'${event}'`).join(", ");
  const behaviorEnd = new Date(Math.min(Date.parse(options.asOf), Date.parse(options.end) + 720 * 3_600_000)).toISOString();
  const events: InstallBehaviorEvent[] = [];
  const behaviorEndMs = Date.parse(behaviorEnd);
  for (let windowStartMs = Date.parse(options.start); windowStartMs < behaviorEndMs; windowStartMs += 86_400_000) {
    const windowStart = new Date(windowStartMs).toISOString();
    const windowEnd = new Date(Math.min(windowStartMs + 86_400_000, behaviorEndMs)).toISOString();
    let cursor: PostHogCursor | null = null;
    for (;;) {
      const cursorClause = cursor
        ? `
          AND (
            timestamp > '${cursor.timestamp}'
            OR (timestamp = '${cursor.timestamp}' AND uuid > toUUID('${cursor.uuid}'))
          )`
        : "";
      const query = `
        SELECT event, timestamp, distinct_id, toString(person_id),
          nullIf(properties.native_install_id, ''), properties, uuid
        FROM events
        WHERE timestamp >= toDateTime('${windowStart}')
          AND timestamp < toDateTime('${windowEnd}')
          AND (event IN (${eventList}) OR properties.experiment = 'onboarding_monetization_v1'
            OR notEmpty(properties.onboarding_variant))
          AND (event != 'native_app_first_open' OR timestamp < toDateTime('${options.end}'))
          ${cursorClause}
        ORDER BY timestamp ASC, uuid ASC
        LIMIT ${PAGE_SIZE}
      `;
      const response = await queryPostHog(`${host}/api/projects/${projectId}/query/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      });
      if (!response.ok) throw new Error(`PostHog query failed: ${response.status} ${await response.text()}`);
      const payload = await response.json() as PostHogPayload;
      const page = parsePostHogRows(payload);
      events.push(...page);
      const resultCount = payload.results?.length ?? 0;
      if (resultCount < PAGE_SIZE) break;
      cursor = postHogCursor(payload.results?.at(-1));
    }
  }
  return events;
}

async function fetchSupabaseRows(
  supabase: ReadOnlySupabase,
  options: CliOptions,
): Promise<{
  links: InstallLink[];
  profiles: InstallProfile[];
  ledger: RevenueCatLedgerEvent[];
  dlq: FailedWebhook[];
  userEventsLatestAt: string | null;
}> {
  const [eventRows, profileRows, ledgerRows, dlqRows] = await Promise.all([
    readAll<any>((from, to) => supabase.from("user_events")
      .select("id,session_id,user_id,created_at,metadata")
      .eq("event_type", "native_app_first_open")
      .gte("created_at", options.start)
      .lt("created_at", options.end)
      .not("user_id", "is", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)),
    readAll<any>((from, to) => supabase.from("profiles")
      .select("id,created_at,onboarding_completed_at,analytics_is_real_user,analytics_exclusion_reason,deleted_at,is_mock,is_system_account")
      .lte("created_at", options.asOf)
      .order("id", { ascending: true })
      .range(from, to)),
    readAll<any>((from, to) => supabase.from("revenuecat_provider_events")
      .select("provider_event_id,app_user_id,app_user_id_status,event_type,event_timestamp,purchased_at,expiration_at,product_id,period_type,environment,store,received_at")
      .lte("event_timestamp", options.asOf)
      .order("event_timestamp", { ascending: true })
      .order("provider_event_id", { ascending: true })
      .range(from, to)),
    readAll<any>((from, to) => supabase.from("user_entitlements_failed_webhooks")
      .select("id,user_id,received_at")
      .lte("received_at", options.asOf)
      .order("received_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)),
  ]);

  const links = eventRows.flatMap((row): InstallLink[] => {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const installId = UUID_PATTERN.test(row.session_id ?? "")
      ? row.session_id
      : metadata.native_install_id;
    return typeof installId === "string" && UUID_PATTERN.test(installId) && typeof row.user_id === "string"
      ? [{ nativeInstallId: installId, userId: row.user_id }]
      : [];
  }).filter((link, index, all) => all.findIndex((candidate) => candidate.nativeInstallId === link.nativeInstallId) === index);
  return {
    links,
    userEventsLatestAt: eventRows.map((row) => row.created_at as string).sort().at(-1) ?? null,
    profiles: profileRows.map((row): InstallProfile => ({
      id: row.id,
      createdAt: row.created_at,
      onboardingCompletedAt: row.onboarding_completed_at,
      analyticsIsRealUser: row.analytics_is_real_user,
      analyticsExclusionReason: row.analytics_exclusion_reason,
      deletedAt: row.deleted_at,
      isMock: row.is_mock,
      isSystemAccount: row.is_system_account,
    })),
    ledger: ledgerRows.map((row): RevenueCatLedgerEvent => ({
      providerEventId: row.provider_event_id,
      appUserId: row.app_user_id,
      appUserIdStatus: row.app_user_id_status,
      eventType: row.event_type,
      eventTimestamp: row.event_timestamp,
      purchasedAt: row.purchased_at,
      expirationAt: row.expiration_at,
      productId: row.product_id,
      periodType: row.period_type,
      environment: row.environment,
      store: row.store,
    })),
    dlq: dlqRows.map((row): FailedWebhook => ({ userId: row.user_id, receivedAt: row.received_at })),
  };
}

function readAscAggregate(path: string | null): AscAggregate[] {
  if (!path) return [];
  const value = JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;
  if (!Array.isArray(value)) throw new Error("--asc-json must contain an array");
  return value.map((row): AscAggregate => {
    if (!row || typeof row !== "object") throw new Error("Invalid ASC aggregate row");
    const record = row as Record<string, unknown>;
    if (typeof record.date !== "string" || typeof record.downloads !== "number") {
      throw new Error("ASC rows require date and numeric downloads");
    }
    return {
      date: parseDate(record.date, "ASC date").slice(0, 10),
      downloads: record.downloads,
      platform: typeof record.platform === "string" ? record.platform : undefined,
      territory: typeof record.territory === "string" ? record.territory : undefined,
    };
  });
}

function csvCell(value: unknown): string {
  const stringValue = value == null ? "" : String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

export function rowsToCsv(rows: InstallToPaidRow[]): string {
  const headers = [
    "schema_version", "native_install_id", "installed_at", "user_id", "join_status",
    "unknown_join_reason", "maturity_status", "excluded_from_install_to_signup", "exclusion_reason",
    "signup", "home_activated", "first_decision_loop", "d1_return", "d7_return",
    "paywall_viewed", "verified_trial", "d30_paid", "posthog_fetched_at",
    "supabase_fetched_at", "revenuecat_ledger_latest_at",
  ];
  const values = rows.map((row) => [
    row.schemaVersion, row.nativeInstallId, row.installedAt, row.userId, row.joinStatus,
    row.unknownJoinReason, row.maturityStatus, row.excludedFromInstallToSignup, row.exclusionReason,
    row.milestones.signup, row.milestones.homeActivated, row.milestones.firstDecisionLoop,
    row.milestones.d1Return, row.milestones.d7Return, row.milestones.paywallViewed,
    row.milestones.verifiedTrial, row.milestones.d30Paid, row.sourceFreshness.posthogFetchedAt,
    row.sourceFreshness.supabaseFetchedAt, row.sourceFreshness.revenuecatLedgerLatestAt,
  ]);
  return [headers, ...values].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function writeOutput(path: string, content: string): void {
  const output = resolve(path);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, content);
}

const STAGE_LABELS: Array<[keyof InstallToPaidAggregates["overall"]["stages"], string]> = [
  ["nativeInstall", "Native install"], ["signup", "Signup"], ["homeActivated", "Home activated"],
  ["firstDecisionLoop", "First decision loop"], ["d1Return", "D1 return"],
  ["d7Return", "D7 return"], ["paywallViewed", "Paywall viewed"],
  ["verifiedTrial", "Verified trial"], ["d30Paid", "D30 paid"],
];

export function aggregatesToMarkdown(aggregates: InstallToPaidAggregates): string {
  const lines = [
    "# Install-to-paid funnel", "",
    `Window: ${aggregates.window.startDate} to ${aggregates.window.endDate} (end exclusive, ${aggregates.window.timeZone}); as of ${aggregates.asOf}.`,
    `Unit: native install. Known-join rate uses true / (true + false); lower bound counts unknown as no. Excluded, immature, and not applicable installs are outside both denominators. Verified trial requires a RevenueCat trial purchase within ${aggregates.maturityHours.verifiedTrial / 24} days and matures at that deadline. ASC downloads are aggregate only.`,
    "",
  ];
  const addGroup = (title: string, group: InstallToPaidAggregates["overall"]): void => {
    lines.push(`## ${title}`, "",
      `Installs n=${group.installs}; eligible signup installs n=${group.eligibleInstalls}; joins exact n=${group.joinStatus.exact}, unknown n=${group.joinStatus.unknown}, excluded n=${group.joinStatus.excluded}.`,
      `Excluded: ${Object.entries(group.excluded).map(([reason, n]) => `${reason} n=${n}`).join(", ") || "none n=0"}.`,
      `Unknown joins: ${Object.entries(group.unknownJoinReason).map(([reason, n]) => `${reason} n=${n}`).join(", ") || "none n=0"}.`,
      "", "| Stage | True n | False n | Unknown n | Immature n | Not applicable n | known-join rate | lower bound (unknown counted as no) | Unknown share |",
      "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |");
    for (const [key, label] of STAGE_LABELS) {
      const stage = group.stages[key];
      const fraction = (value: { numerator: number; denominator: number; rate: number | null }): string =>
        `n=${value.numerator}/${value.denominator} (${value.rate === null ? "n/a" : `${(value.rate * 100).toFixed(1)}%`})`;
      lines.push(`| ${label} | ${stage.true} | ${stage.false} | ${stage.unknown} | ${stage.immature} | ${stage.notApplicable} | ${fraction(stage.rate)} | ${fraction(stage.lowerBoundRate)} | ${fraction(stage.unknownShare)} |`);
    }
    lines.push("");
  };
  addGroup("Overall", aggregates.overall);
  for (const group of aggregates.cohortWeeks) addGroup(`Install week ${group.value}`, group);
  for (const [name, groups] of Object.entries(aggregates.breakdowns)) {
    for (const group of groups) addGroup(`${name}: ${group.value}`, group);
  }
  lines.push(`ASC downloads ${aggregates.ascDownloads.downloads === null
    ? "not supplied" : `n=${aggregates.ascDownloads.downloads}`} (not joined to installs).`, "");
  return lines.join("\n");
}

export async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const supabase = createReportClient();
  const [behaviorEvents, sourceRows] = await Promise.all([
    fetchPostHogEvents(options),
    fetchSupabaseRows(supabase, options),
  ]);
  const fetchedAt = new Date().toISOString();
  const ledgerLatestAt = sourceRows.ledger.map((event) => event.eventTimestamp).sort().at(-1) ?? null;
  const input = {
    asOf: options.asOf,
    behaviorEvents,
    installLinks: sourceRows.links,
    profiles: sourceRows.profiles,
    revenueCatEvents: sourceRows.ledger,
    failedWebhooks: sourceRows.dlq,
    sourceFreshness: {
      posthogFetchedAt: fetchedAt,
      supabaseFetchedAt: fetchedAt,
      revenuecatLedgerLatestAt: ledgerLatestAt,
    },
  };
  const rows = buildInstallToPaidRows(input);
  const dimensions = buildInstallDimensions(input, rows, { trialWindowDays: options.trialWindowDays });
  const ascAggregateDownloads = {
    joinPolicy: "aggregate_only_never_person_joined" as const,
    rows: readAscAggregate(options.ascJson),
  };
  const aggregates = buildInstallToPaidAggregates(rows, dimensions, {
    asOf: options.asOf,
    trialWindowDays: options.trialWindowDays,
    revenueCatEvents: input.revenueCatEvents,
    window: options.window,
    sourceFreshness: {
      ...input.sourceFreshness,
      posthogLatestEventAt: behaviorEvents.map((event) => event.timestamp).sort().at(-1) ?? null,
      userEventsLatestAt: sourceRows.userEventsLatestAt,
      profilesLatestAt: sourceRows.profiles.map((profile) => profile.createdAt).sort().at(-1) ?? null,
      failedWebhooksLatestAt: sourceRows.dlq.map((event) => event.receivedAt).sort().at(-1) ?? null,
    },
    ascDownloads: options.ascJson
      ? ascAggregateDownloads.rows
        .filter((row) => row.date >= options.window.startDate && row.date < options.window.endDate)
        .reduce((total, row) => total + row.downloads, 0) : null,
  });
  const report: ReportEnvelope = {
    schemaVersion: INSTALL_TO_PAID_SCHEMA_VERSION,
    generatedAt: startedAt,
    cohort: { start: options.start, end: options.end, asOf: options.asOf },
    window: options.window,
    asOf: options.asOf,
    sourceFreshness: aggregates.sourceFreshness,
    rows,
    aggregates,
    ascAggregateDownloads,
  };
  const json = JSON.stringify(report, null, 2) + "\n";
  if (options.outputJson) writeOutput(options.outputJson, json);
  if (options.outputCsv) writeOutput(options.outputCsv, rowsToCsv(rows));
  if (options.outputMd) writeOutput(options.outputMd, aggregatesToMarkdown(aggregates));
  if (!options.outputJson) process.stdout.write(json);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unknown report failure");
    process.exitCode = 1;
  });
}
