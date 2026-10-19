#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./load-env.mjs";
import {
  createReadOnlySupabaseFromEnv, loadProfileExclusions, resolveCompleteDayWindow,
  selectAllPages, USER_EVENT_USER_CHUNK_SIZE, type ReadOnlySupabase,
} from "../lib/analytics/report-guards";
import { MEANINGFUL_ACTIVITY_EVENTS } from "../lib/analytics/install-to-paid-funnel-v1";
import {
  buildPushTelemetryReport, PUSH_DECISION_EVENTS, PUSH_SERVER_STAGES,
  type AlertDeliveryAttemptRow, type NotificationEventRow, type PushAttemptRow,
  type PushTelemetryInput, type PushUserEventRow, type UserDeviceRow,
} from "../lib/analytics/push-telemetry-v1";

const CHUNK_SIZE = 200;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const USER_EVENT_TYPES = [...new Set([
  "native_open_from_push", "push_permission_denied", "push_device_registered",
  ...PUSH_SERVER_STAGES, ...PUSH_DECISION_EVENTS, ...MEANINGFUL_ACTIVITY_EVENTS,
])].sort();

interface CliOptions {
  window: PushTelemetryInput["window"];
  asOf: string;
  openHorizonHours: number;
  decisionHorizonMinutes: number;
  outputJson: string | null;
  outputMd: string | null;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}
function positive(value: string | undefined, fallback: number, flag: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${flag} must be positive`);
  return parsed;
}
export function parseCliArgs(argv: string[], now = new Date()): CliOptions {
  const allowed = new Set(["--start", "--end", "--days", "--tz", "--as-of", "--output-json", "--output-md", "--open-horizon-hours", "--decision-horizon-minutes"]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index])) throw new Error(`Unknown flag: ${argv[index]}`);
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(`${argv[index]} requires a value`);
  }
  const startDate = flagValue(argv, "--start");
  const endDate = flagValue(argv, "--end");
  const daysValue = flagValue(argv, "--days");
  if ((startDate || endDate) && (!startDate || !endDate || daysValue)) {
    throw new Error("Use --start and --end together, or --days");
  }
  const days = positive(daysValue, 7, "--days");
  if (!Number.isInteger(days)) throw new Error("--days must be an integer");
  const asOfValue = flagValue(argv, "--as-of");
  const asOf = asOfValue ? new Date(asOfValue) : now;
  if (!Number.isFinite(asOf.getTime()) || (asOfValue && !/(Z|[+-]\d\d:\d\d)$/.test(asOfValue))) {
    throw new Error("--as-of must be an ISO datetime with timezone");
  }
  const window = resolveCompleteDayWindow({ startDate, endDate, days, timeZone: flagValue(argv, "--tz"), now: asOf });
  if (window.end > asOf) throw new Error("Window end must be at or before --as-of");
  return {
    window: { startDate: window.startDate, endDate: window.endDate, start: window.start.toISOString(), end: window.end.toISOString(), timeZone: window.timeZone },
    asOf: asOf.toISOString(),
    openHorizonHours: positive(flagValue(argv, "--open-horizon-hours"), 24, "--open-horizon-hours"),
    decisionHorizonMinutes: positive(flagValue(argv, "--decision-horizon-minutes"), 60, "--decision-horizon-minutes"),
    outputJson: flagValue(argv, "--output-json") ?? null,
    outputMd: flagValue(argv, "--output-md") ?? null,
  };
}

export function createReportClient(env: NodeJS.ProcessEnv = process.env): ReadOnlySupabase {
  return createReadOnlySupabaseFromEnv(env);
}
function chunks<T>(rows: T[], size = CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}
function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))].sort();
}
function pushId(row: PushUserEventRow): string | null {
  const value = row.metadata?.notification_event_id ?? row.metadata?.message_instance_id;
  return typeof value === "string" ? value : null;
}
const attemptColumns = "id,notification_event_id,channel,status,provider_response,error_message,created_at,attempt_number";
const eventColumns = "id,recipient_user_id,type,entity_type,entity_id,created_at,status";
const deviceColumns = "user_id,platform,device_token,installation_id,created_at,updated_at,retired_at,retired_reason";
const userEventColumns = "id,user_id,event_type,created_at,metadata";

export async function loadPushOpens(client: ReadOnlySupabase, window: { start: string; end: string }): Promise<PushUserEventRow[]> {
  return selectAllPages<PushUserEventRow>(() => client.from("user_events").select(userEventColumns)
    .eq("event_type", "native_open_from_push")
    .gte("created_at", window.start).lt("created_at", window.end)
    .order("created_at").order("id"));
}

export async function loadPushTelemetryInput(client: ReadOnlySupabase, options: CliOptions): Promise<PushTelemetryInput> {
  const { window, asOf } = options;
  const firstCandidates = await selectAllPages<PushAttemptRow>(() => client.from("notification_delivery_attempts")
    .select(attemptColumns).eq("channel", "push")
    .gte("created_at", window.start).lt("created_at", window.end)
    .order("created_at").order("id"));
  const allChannelAttempts = await selectAllPages<PushAttemptRow>(() => client.from("notification_delivery_attempts")
    .select(attemptColumns).gte("created_at", window.start).lt("created_at", window.end)
    .order("created_at").order("id"));
  const candidateIds = unique(firstCandidates.map((row) => row.notification_event_id));
  const attempts: PushAttemptRow[] = [];
  for (const ids of chunks(candidateIds)) {
    attempts.push(...await selectAllPages<PushAttemptRow>(() => client.from("notification_delivery_attempts")
      .select(attemptColumns).eq("channel", "push").in("notification_event_id", ids)
      .lte("created_at", asOf).order("created_at").order("id")));
  }
  const ledger = await selectAllPages<AlertDeliveryAttemptRow>(() => client.from("alert_delivery_attempts")
    .select("id,user_id,channel,status,attempted_at,message_instance_id")
    .gte("attempted_at", window.start).lt("attempted_at", window.end)
    .order("attempted_at").order("id"));
  const legacyIds = unique(allChannelAttempts.filter((row) => row.channel === "push" && row.status === "sent")
    .map((row) => row.notification_event_id));
  const alertIds = unique(ledger.map((row) => row.message_instance_id));
  const notificationEvents: NotificationEventRow[] = [];
  for (const ids of chunks(unique([...candidateIds, ...legacyIds, ...alertIds]))) {
    notificationEvents.push(...await selectAllPages<NotificationEventRow>(() => client.from("notification_events")
      .select(eventColumns).in("id", ids).order("id")));
  }
  // The snapshot needs all devices, including users who received no message in this window.
  const deviceIds = await selectAllPages<{ user_id: string; device_token: string }>(() => client.from("user_devices")
    .select("user_id,device_token").lte("created_at", window.end).order("user_id").order("device_token"));
  const devices: UserDeviceRow[] = [];
  for (const ids of chunks(unique(deviceIds.map((row) => row.user_id)))) {
    devices.push(...await selectAllPages<UserDeviceRow>(() => client.from("user_devices")
      .select(deviceColumns).in("user_id", ids).lte("created_at", window.end)
      .order("created_at").order("user_id").order("device_token")));
  }
  const exclusions = await loadProfileExclusions(client, unique([
    ...notificationEvents.map((row) => row.recipient_user_id),
    ...ledger.map((row) => row.user_id), ...devices.map((row) => row.user_id),
  ]));
  const recipientIds = unique(notificationEvents.map((row) => row.recipient_user_id));
  const ttlFloor = Date.parse(asOf) - 90 * DAY_MS;
  const eventStart = new Date(Math.max(Date.parse(window.start) - 90 * DAY_MS, ttlFloor)).toISOString();
  const eventEnd = new Date(Math.min(Date.parse(asOf) + 1,
    Date.parse(window.end) + options.openHorizonHours * HOUR_MS + options.decisionHorizonMinutes * MINUTE_MS)).toISOString();
  const userEvents: PushUserEventRow[] = [];
  for (const ids of chunks(recipientIds, USER_EVENT_USER_CHUNK_SIZE)) {
    userEvents.push(...await selectAllPages<PushUserEventRow>(() => client.from("user_events")
      .select(userEventColumns).in("user_id", ids).in("event_type", USER_EVENT_TYPES)
      .gte("created_at", eventStart).lt("created_at", eventEnd)
      .order("user_id").order("created_at", { ascending: false }).order("id")));
  }
  const orphanCandidateOpens = await loadPushOpens(client, {
    start: window.start,
    end: new Date(Math.min(Date.parse(asOf) + 1,
      Date.parse(window.end) + options.openHorizonHours * HOUR_MS)).toISOString(),
  });
  const seenUserEventIds = new Set(userEvents.map((row) => row.id));
  for (const open of orphanCandidateOpens) {
    if (!seenUserEventIds.has(open.id)) userEvents.push(open);
  }
  userEvents.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
  const knownPushAttemptIds = new Set<string>(attempts.map((row) => row.notification_event_id));
  for (const ids of chunks(unique(orphanCandidateOpens.map(pushId)))) {
    const rows = await selectAllPages<Pick<PushAttemptRow, "id" | "notification_event_id" | "created_at">>(() =>
      client.from("notification_delivery_attempts").select("id,notification_event_id,created_at")
        .eq("channel", "push").in("notification_event_id", ids).lte("created_at", asOf)
        .order("created_at").order("id"));
    rows.forEach((row) => knownPushAttemptIds.add(row.notification_event_id));
  }
  const deliveryTargetRows = await selectAllPages<{ created_at: string }>(() => client.from("notification_delivery_targets")
    .select("created_at").order("created_at"));
  return {
    window, asOf, openHorizonHours: options.openHorizonHours,
    decisionHorizonMinutes: options.decisionHorizonMinutes,
    attempts, allChannelAttempts, notificationEvents, devices, userEvents,
    orphanCandidateOpens, knownPushAttemptIds, alertDeliveryAttempts: ledger,
    exclusions, deliveryTargetRows,
  };
}

function writeOutput(path: string, content: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}
function markdown(report: ReturnType<typeof buildPushTelemetryReport>): string {
  const lines = [
    "# Push telemetry v1", "",
    `Window: ${report.window.startDate} to ${report.window.endDate} (end exclusive, ${report.window.timeZone}).`,
    `As of: ${report.asOf}. Unit: notification event with first push attempt in window.`,
    `Open horizon: ${report.horizons.openHours} hours; decision horizon: ${report.horizons.decisionMinutes} minutes.`,
    "Provider accepted means accepted by Expo/FCM, not device receipt.", "",
  ];
  const walk = (value: unknown, name: string): void => {
    if (typeof value === "number") { lines.push(`- ${name}: ${value}`); return; }
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if (typeof object.numerator === "number" && typeof object.denominator === "number") {
      lines.push(`- ${name}: ${object.numerator}/${object.denominator} (${object.rate === null ? "n/a" : `${(Number(object.rate) * 100).toFixed(2)}%`})`);
      return;
    }
    for (const [key, child] of Object.entries(object)) walk(child, name ? `${name}.${key}` : key);
  };
  for (const key of ["excluded", "stages", "breakdowns", "opensByPlatform", "orphanOpens", "registeredDevices", "legacy", "sourceFreshness"] as const) {
    lines.push(`## ${key}`, "");
    walk(report[key], "");
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  config({ path: ".env.local" });
  config();
  const options = parseCliArgs(argv);
  const report = buildPushTelemetryReport(await loadPushTelemetryInput(createReportClient(), options));
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputJson) writeOutput(options.outputJson, json);
  else process.stdout.write(json);
  if (options.outputMd) writeOutput(options.outputMd, markdown(report));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
