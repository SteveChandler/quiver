#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildInstallToPaidRows,
  INSTALL_TO_PAID_SCHEMA_VERSION,
  MEANINGFUL_ACTIVITY_EVENTS,
  type FailedWebhook,
  type InstallBehaviorEvent,
  type InstallLink,
  type InstallProfile,
  type InstallToPaidRow,
  type RevenueCatLedgerEvent,
} from "../lib/analytics/install-to-paid-funnel-v1";

config({ path: ".env.local" });
config();

const PAGE_SIZE = 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CliOptions {
  start: string;
  end: string;
  asOf: string;
  outputJson: string | null;
  outputCsv: string | null;
  ascJson: string | null;
}

interface PostHogPayload {
  results?: unknown[][];
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
  rows: InstallToPaidRow[];
  ascAggregateDownloads: {
    joinPolicy: "aggregate_only_never_person_joined";
    rows: AscAggregate[];
  };
}

type AdminClient = SupabaseClient<any, "public", any>;

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
  const end = parseDate(flagValue(argv, "--end") ?? now.toISOString(), "--end");
  const start = parseDate(
    flagValue(argv, "--start") ?? new Date(Date.parse(end) - 30 * 86_400_000).toISOString(),
    "--start",
  );
  const asOf = parseDate(flagValue(argv, "--as-of") ?? now.toISOString(), "--as-of");
  if (Date.parse(start) >= Date.parse(end)) throw new Error("--start must be before --end");
  return {
    start,
    end,
    asOf,
    outputJson: flagValue(argv, "--output-json"),
    outputCsv: flagValue(argv, "--output-csv"),
    ascJson: flagValue(argv, "--asc-json"),
  };
}

function createAdminClient(): AdminClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
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
    "home_viewed",
    "home_hero_forecast_viewed",
    "paywall_opened",
    "onboarding_paywall_viewed",
    ...MEANINGFUL_ACTIVITY_EVENTS,
  ].filter((value, index, all) => all.indexOf(value) === index);
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
      properties: properties && typeof properties === "object" && !Array.isArray(properties)
        ? properties as Record<string, unknown>
        : {},
    }];
  });
}

export async function fetchPostHogEvents(options: CliOptions): Promise<InstallBehaviorEvent[]> {
  const host = (process.env.POSTHOG_HOST ?? "https://us.posthog.com").replace(/\/$/, "");
  const projectId = requiredEnv("POSTHOG_PROJECT_ID");
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY ?? requiredEnv("POSTHOG_API_KEY");
  const eventList = postHogEvents().map((event) => `'${event}'`).join(", ");
  const behaviorEnd = new Date(Math.min(Date.parse(options.asOf), Date.parse(options.end) + 720 * 3_600_000)).toISOString();
  const events: InstallBehaviorEvent[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = `
      SELECT event, timestamp, distinct_id, toString(person_id),
        nullIf(properties.native_install_id, ''), properties, uuid
      FROM events
      WHERE timestamp >= toDateTime('${options.start}')
        AND timestamp < toDateTime('${behaviorEnd}')
        AND event IN (${eventList})
        AND (event != 'native_app_first_open' OR timestamp < toDateTime('${options.end}'))
      ORDER BY timestamp ASC, uuid ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `;
    const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });
    if (!response.ok) throw new Error(`PostHog query failed: ${response.status} ${await response.text()}`);
    const payload = await response.json() as PostHogPayload;
    const page = parsePostHogRows(payload);
    events.push(...page);
    if ((payload.results?.length ?? 0) < PAGE_SIZE) return events;
  }
}

async function fetchSupabaseRows(
  supabase: AdminClient,
  options: CliOptions,
): Promise<{
  links: InstallLink[];
  profiles: InstallProfile[];
  ledger: RevenueCatLedgerEvent[];
  dlq: FailedWebhook[];
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

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const supabase = createAdminClient();
  const [behaviorEvents, sourceRows] = await Promise.all([
    fetchPostHogEvents(options),
    fetchSupabaseRows(supabase, options),
  ]);
  const fetchedAt = new Date().toISOString();
  const ledgerLatestAt = sourceRows.ledger.map((event) => event.eventTimestamp).sort().at(-1) ?? null;
  const rows = buildInstallToPaidRows({
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
  });
  const report: ReportEnvelope = {
    schemaVersion: INSTALL_TO_PAID_SCHEMA_VERSION,
    generatedAt: startedAt,
    cohort: { start: options.start, end: options.end, asOf: options.asOf },
    rows,
    ascAggregateDownloads: {
      joinPolicy: "aggregate_only_never_person_joined",
      rows: readAscAggregate(options.ascJson),
    },
  };
  const json = JSON.stringify(report, null, 2) + "\n";
  if (options.outputJson) writeOutput(options.outputJson, json);
  if (options.outputCsv) writeOutput(options.outputCsv, rowsToCsv(rows));
  if (!options.outputJson) process.stdout.write(json);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unknown report failure");
    process.exitCode = 1;
  });
}
