#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./load-env.mjs";
import { MEANINGFUL_ACTIVITY_EVENTS } from "../lib/analytics/install-to-paid-funnel-v1";
import {
  buildAlertAttributionOutcomesReport, loadSentAlertInstances,
  type AlertAttributionInput, type AlertLedgerRow, type EmailProviderRow, type EmailSendRow,
} from "../lib/analytics/alert-attribution-outcomes-v1";
import { PUSH_DECISION_EVENTS, type PushAttemptRow, type PushUserEventRow, type UserDeviceRow } from "../lib/analytics/push-telemetry-v1";
import {
  createReadOnlySupabaseFromEnv, loadProfileExclusions, resolveCompleteDayWindow,
  selectAllPages, type ReadOnlySupabase,
} from "../lib/analytics/report-guards";
import { loadPushOpens } from "./push-telemetry-report";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const STAGES = ["alert_message_activated", "alert_app_returned", "alert_return_to_decision", "alert_decision_action"];
const USER_EVENT_COLUMNS = "id,user_id,event_type,created_at,metadata";
const LEDGER_COLUMNS = "id,queue_id,rule_id,user_id,channel,status,skip_reason,attempted_at,message_instance_id";

interface CliOptions {
  window: AlertAttributionInput["window"]; asOf: string; openHorizonHours: number;
  outputJson: string | null; outputMd: string | null;
}
function value(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}
function positive(raw: string | undefined, fallback: number, flag: string): number {
  if (raw === undefined) return fallback;
  const result = Number(raw);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`${flag} must be positive`);
  return result;
}
function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((item): item is string => !!item))].sort();
}
function chunks<T>(rows: T[], size = 200): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}
export function parseCliArgs(argv: string[], now = new Date()): CliOptions {
  const allowed = new Set(["--start", "--end", "--days", "--tz", "--as-of", "--output-json", "--output-md", "--open-horizon-hours"]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index])) throw new Error(`Unknown flag: ${argv[index]}`);
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(`${argv[index]} requires a value`);
  }
  const startDate = value(argv, "--start"); const endDate = value(argv, "--end"); const daysValue = value(argv, "--days");
  if ((startDate || endDate) && (!startDate || !endDate || daysValue)) throw new Error("Use --start and --end together, or --days");
  const days = positive(daysValue, 7, "--days");
  if (!Number.isInteger(days)) throw new Error("--days must be an integer");
  const rawAsOf = value(argv, "--as-of");
  const asOf = rawAsOf ? new Date(rawAsOf) : now;
  if (!Number.isFinite(asOf.getTime()) || (rawAsOf && !/(Z|[+-]\d\d:\d\d)$/.test(rawAsOf))) throw new Error("--as-of must be an ISO datetime with timezone");
  const window = resolveCompleteDayWindow({ startDate, endDate, days, timeZone: value(argv, "--tz"), now: asOf });
  if (window.end > asOf) throw new Error("Window end must be at or before --as-of");
  return {
    window: { startDate: window.startDate, endDate: window.endDate, start: window.start.toISOString(), end: window.end.toISOString(), timeZone: window.timeZone },
    asOf: asOf.toISOString(), openHorizonHours: positive(value(argv, "--open-horizon-hours"), 72, "--open-horizon-hours"),
    outputJson: value(argv, "--output-json") ?? null, outputMd: value(argv, "--output-md") ?? null,
  };
}
export function createReportClient(env: NodeJS.ProcessEnv = process.env): ReadOnlySupabase {
  return createReadOnlySupabaseFromEnv(env);
}

export async function loadAlertAttributionInput(client: ReadOnlySupabase, options: CliOptions): Promise<AlertAttributionInput> {
  const { window, asOf, openHorizonHours } = options;
  const end = new Date(Math.min(Date.parse(asOf) + 1, Date.parse(window.end) + 7 * DAY_MS)).toISOString();
  const ledger = await selectAllPages<AlertLedgerRow>(() => client.from("alert_delivery_attempts")
    .select(LEDGER_COLUMNS).gte("attempted_at", window.start).lt("attempted_at", window.end).order("attempted_at").order("id"));
  const instances = await loadSentAlertInstances(client, window, ledger);
  const mids = unique(instances.map((item) => item.messageInstanceId));
  const emailSends: EmailSendRow[] = [];
  const pushAttempts: PushAttemptRow[] = [];
  for (const ids of chunks(mids)) {
    emailSends.push(...await selectAllPages<EmailSendRow>(() => client.from("email_send_log")
      .select("id,user_id,email_type,message_instance_id,resend_message_id,sent_at,delivered_at,opened_at,clicked_at,bounced_at")
      .in("message_instance_id", ids).order("id")));
    pushAttempts.push(...await selectAllPages<PushAttemptRow>(() => client.from("notification_delivery_attempts")
      .select("id,notification_event_id,channel,status,created_at,provider_response")
      .in("notification_event_id", ids).eq("channel", "push").lte("created_at", asOf).order("created_at").order("id")));
  }
  const emailDeliveryEvents: EmailProviderRow[] = []; const emailClickEvents: EmailProviderRow[] = [];
  const logIds = emailSends.map((row) => row.id);
  const resendIds = unique(emailSends.map((row) => row.resend_message_id));
  for (const ids of chunks(logIds)) {
    emailDeliveryEvents.push(...await selectAllPages<EmailProviderRow>(() => client.from("email_delivery_events")
      .select("id,email_send_log_id,resend_message_id,event_type,event_at").in("email_send_log_id", ids).order("id")));
    emailClickEvents.push(...await selectAllPages<EmailProviderRow>(() => client.from("email_click_events")
      .select("id,email_send_log_id,resend_message_id,clicked_at").in("email_send_log_id", ids).order("id")));
  }
  for (const ids of chunks(resendIds)) {
    emailDeliveryEvents.push(...await selectAllPages<EmailProviderRow>(() => client.from("email_delivery_events")
      .select("id,email_send_log_id,resend_message_id,event_type,event_at").in("resend_message_id", ids).order("id")));
    emailClickEvents.push(...await selectAllPages<EmailProviderRow>(() => client.from("email_click_events")
      .select("id,email_send_log_id,resend_message_id,clicked_at").in("resend_message_id", ids).order("id")));
  }
  const dedup = (rows: EmailProviderRow[]): EmailProviderRow[] => [...new Map(rows.map((row) => [row.id, row])).values()];
  const userIds = unique([...ledger.map((row) => row.user_id), ...instances.map((row) => row.recipientId)]);
  const exclusions = await loadProfileExclusions(client, userIds);
  const stageRows = await selectAllPages<PushUserEventRow>(() => client.from("user_events")
    .select(USER_EVENT_COLUMNS).in("event_type", STAGES).gte("created_at", window.start).lt("created_at", end)
    .order("created_at").order("id"));
  const knownSentMessageIds = new Set(instances.map((item) => item.messageInstanceId));
  const stageIds = unique(stageRows.map((row) => typeof row.metadata?.message_instance_id === "string" ? row.metadata.message_instance_id : null));
  for (const ids of chunks(stageIds)) {
    const sentRows = await selectAllPages<Pick<AlertLedgerRow, "message_instance_id">>(() => client.from("alert_delivery_attempts")
      .select("message_instance_id").in("message_instance_id", ids).eq("status", "sent")
      .lte("attempted_at", asOf).order("message_instance_id").order("id"));
    sentRows.forEach((row) => { if (row.message_instance_id) knownSentMessageIds.add(row.message_instance_id); });
  }
  const events = [...stageRows];
  const eventTypes = unique(["native_open_from_email", ...MEANINGFUL_ACTIVITY_EVENTS, ...PUSH_DECISION_EVENTS]);
  for (const ids of chunks(userIds)) {
    events.push(...await selectAllPages<PushUserEventRow>(() => client.from("user_events")
      .select(USER_EVENT_COLUMNS).in("user_id", ids).in("event_type", eventTypes)
      .gte("created_at", window.start).lt("created_at", end).order("created_at").order("id")));
  }
  const pushOpens = await loadPushOpens(client, { start: window.start,
    end: new Date(Math.min(Date.parse(asOf) + 1, Date.parse(window.end) + openHorizonHours * HOUR_MS)).toISOString() });
  const devices: UserDeviceRow[] = [];
  for (const ids of chunks(userIds)) devices.push(...await selectAllPages<UserDeviceRow>(() => client.from("user_devices")
    .select("user_id,platform,device_token,installation_id,created_at,updated_at,retired_at,retired_reason")
    .in("user_id", ids).lte("created_at", window.end).order("created_at").order("user_id").order("device_token")));
  return { window, asOf, openHorizonHours, ledger, instances, userEvents: events, pushOpens,
    pushAttempts, devices, emailSends, emailDeliveryEvents: dedup(emailDeliveryEvents), emailClickEvents: dedup(emailClickEvents),
    knownSentMessageIds, exclusions };
}

function writeOutput(path: string, content: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}
export function markdown(report: ReturnType<typeof buildAlertAttributionOutcomesReport>): string {
  const lines = ["# Alert attribution outcomes v1", "",
    `Window: ${report.window.startDate} to ${report.window.endDate} (end exclusive, ${report.window.timeZone}).`,
    `As of: ${report.asOf}. Unit: distinct sent message instance, anchored to its first sent attempt.`,
    `Attribution horizon: 7 days. Open horizon: ${report.openHorizonHours} hours. Provider email opens and clicks are raw telemetry only.`, ""];
  lines.push(`User-event TTL floor: ${report.ttlFloor}; window before floor: ${report.windowBeforeTtlFloor}.`, "");
  const walk = (value: unknown, key: string): void => {
    if (typeof value === "number") { lines.push(`- ${key}: ${value}`); return; }
    if (!value || typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    if (typeof row.numerator === "number" && typeof row.denominator === "number") {
      lines.push(`- ${key}: ${row.numerator}/${row.denominator} (${row.rate === null ? "n/a" : `${(Number(row.rate) * 100).toFixed(2)}%`})`);
      return;
    }
    for (const [name, child] of Object.entries(row)) walk(child, key ? `${key}.${name}` : name);
  };
  for (const [key, value] of Object.entries(report)) {
    if (["schemaVersion", "window", "asOf", "ttlFloor", "windowBeforeTtlFloor", "openHorizonHours"].includes(key)) continue;
    lines.push(`## ${key}`, ""); walk(value, ""); lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
export async function main(argv = process.argv.slice(2)): Promise<void> {
  config({ path: ".env.local" }); config();
  const options = parseCliArgs(argv);
  const report = buildAlertAttributionOutcomesReport(await loadAlertAttributionInput(createReportClient(), options));
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputJson) writeOutput(options.outputJson, json);
  else process.stdout.write(json);
  if (options.outputMd) writeOutput(options.outputMd, markdown(report));
}
if (require.main === module) {
  main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
