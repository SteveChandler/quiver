import { MEANINGFUL_ACTIVITY_EVENTS } from "./install-to-paid-funnel-v1";
import type { ProfileExclusionReason } from "./report-guards";

export const PUSH_TELEMETRY_SCHEMA_VERSION = "push_telemetry.v1" as const;
export const PUSH_DECISION_EVENTS = new Set([
  "decision_loop_completed", "beach_view", "forecast_interaction", "home_nearby_spot_tap",
  "watch_spot_tapped", "alert_rule_created", "session_log_start",
]);
export const PUSH_SERVER_STAGES = [
  "alert_message_activated", "alert_app_returned", "alert_return_to_decision", "alert_decision_action",
] as const;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface PushAttemptRow {
  id: string;
  notification_event_id: string;
  channel: string;
  status: string;
  created_at: string;
  provider_response: Record<string, unknown> | null;
  error_message?: string | null;
  attempt_number?: number | null;
}
export interface NotificationEventRow {
  id: string;
  recipient_user_id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  status: string;
}
export interface UserDeviceRow {
  user_id: string;
  platform: string;
  device_token: string;
  installation_id: string | null;
  created_at: string;
  updated_at: string;
  retired_at: string | null;
  retired_reason: string | null;
}
export interface PushUserEventRow {
  id: string;
  user_id: string | null;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}
export interface AlertDeliveryAttemptRow {
  id: string;
  user_id: string;
  channel: string;
  status: string;
  attempted_at: string;
  message_instance_id: string | null;
}
export interface PushTelemetryInput {
  window: { startDate: string; endDate: string; start: string; end: string; timeZone: string };
  asOf: string;
  openHorizonHours: number;
  decisionHorizonMinutes: number;
  attempts: PushAttemptRow[];
  allChannelAttempts: PushAttemptRow[];
  notificationEvents: NotificationEventRow[];
  devices: UserDeviceRow[];
  userEvents: PushUserEventRow[];
  orphanCandidateOpens: PushUserEventRow[];
  knownPushAttemptIds: ReadonlySet<string>;
  alertDeliveryAttempts: AlertDeliveryAttemptRow[];
  exclusions: ReadonlyMap<string, ProfileExclusionReason | null>;
  deliveryTargetRows: Array<{ created_at: string }>;
}
type PlatformSet = "ios_only" | "android_only" | "mixed" | "none_active";
type PermissionEvidence = "last_signal_registered" | "last_signal_denied" | "no_signal_within_ttl";
type PushOutcome = "provider_accepted" | "provider_failed" | "skipped" | "deferred_unresolved";
interface Rate { numerator: number; denominator: number; rate: number | null }
interface StageCounts {
  messages: number;
  finalOutcome: Record<PushOutcome, number>;
  skippedByStatus: Record<string, number>;
  attempted: number;
  providerAccepted: number;
  tokenOutcomes: { success: number; failed: number; invalidTokenCount: number };
  opened: Rate;
  immatureForOpen: number;
  immatureOpened: number;
  openUserMismatch: number;
  pushDrivenAppReturn: Rate;
  anyActivityWithinHorizon: { label: "baseline, not attributed"; numerator: number; denominator: number; rate: number | null };
  decisionAfterOpen: Rate;
  immatureForDecision: number;
  serverStages: Record<string, number>;
}

function rate(numerator: number, denominator: number): Rate {
  return { numerator, denominator, rate: denominator === 0 ? null : numerator / denominator };
}
function timestamp(value: string): number { return Date.parse(value); }
function inWindow(value: string, start: string, end: string): boolean {
  return timestamp(value) >= timestamp(start) && timestamp(value) < timestamp(end);
}
function messageId(row: PushUserEventRow): string | null {
  const value = row.metadata?.notification_event_id ?? row.metadata?.message_instance_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}
function byTimeId<T extends { created_at: string; id: string }>(a: T, b: T): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

export function finalPushOutcome(attempts: PushAttemptRow[]): { outcome: PushOutcome; status: string; finalAttempt: PushAttemptRow } {
  const finalAttempt = attempts.filter((row) => row.channel === "push").sort(byTimeId).at(-1);
  if (!finalAttempt) throw new Error("Push message has no push attempt");
  const status = finalAttempt.status;
  if (status === "sent") return { outcome: "provider_accepted", status, finalAttempt };
  if (status === "failed_provider" || status === "failed_internal") return { outcome: "provider_failed", status, finalAttempt };
  if (status === "deferred_quiet_hours") return { outcome: "deferred_unresolved", status, finalAttempt };
  if (status.startsWith("skipped_")) return { outcome: "skipped", status, finalAttempt };
  throw new Error(`Unknown push delivery status: ${status}`);
}

export function platformSetAt(devices: UserDeviceRow[], instant: string): PlatformSet {
  const at = timestamp(instant);
  const active = devices.filter((device) => timestamp(device.created_at) <= at &&
    (device.retired_at === null || timestamp(device.retired_at) > at));
  const ios = active.some((device) => device.platform === "ios");
  const android = active.some((device) => device.platform === "android");
  if (ios && android) return "mixed";
  if (ios) return "ios_only";
  if (android) return "android_only";
  return "none_active";
}

export function permissionEvidenceAt(events: PushUserEventRow[], instant: string): PermissionEvidence {
  const latest = events.filter((row) =>
    (row.event_type === "push_device_registered" || row.event_type === "push_permission_denied") &&
    timestamp(row.created_at) < timestamp(instant)).sort(byTimeId).at(-1);
  if (!latest) return "no_signal_within_ttl";
  return latest.event_type === "push_device_registered" ? "last_signal_registered" : "last_signal_denied";
}

export function matchPushOpen(
  opens: PushUserEventRow[],
  match: { messageId: string; recipientId: string; from: string; horizonHours: number },
): PushUserEventRow | null {
  const from = timestamp(match.from);
  return opens.filter((row) => row.event_type === "native_open_from_push" &&
    messageId(row) === match.messageId && row.user_id === match.recipientId &&
    timestamp(row.created_at) >= from && timestamp(row.created_at) < from + match.horizonHours * HOUR_MS)
    .sort(byTimeId)[0] ?? null;
}

function emptyStage(): StageCounts {
  return {
    messages: 0,
    finalOutcome: { provider_accepted: 0, provider_failed: 0, skipped: 0, deferred_unresolved: 0 },
    skippedByStatus: {}, attempted: 0, providerAccepted: 0,
    tokenOutcomes: { success: 0, failed: 0, invalidTokenCount: 0 },
    opened: rate(0, 0), immatureForOpen: 0, immatureOpened: 0, openUserMismatch: 0,
    pushDrivenAppReturn: rate(0, 0),
    anyActivityWithinHorizon: { label: "baseline, not attributed", ...rate(0, 0) },
    decisionAfterOpen: rate(0, 0), immatureForDecision: 0,
    serverStages: Object.fromEntries(PUSH_SERVER_STAGES.map((stage) => [stage, 0])),
  };
}
function addRate(value: Rate, numerator: number, denominator: number): Rate {
  return rate(value.numerator + numerator, value.denominator + denominator);
}
function tokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function addMessage(stage: StageCounts, facts: {
  outcome: PushOutcome; status: string; finalAttempt: PushAttemptRow; matureOpen: boolean;
  opened: boolean; mismatchCount: number; activity: boolean; matureDecision: boolean;
  decision: boolean; serverStages: ReadonlySet<string>;
}): void {
  stage.messages += 1;
  stage.finalOutcome[facts.outcome] += 1;
  if (facts.outcome === "skipped") stage.skippedByStatus[facts.status] = (stage.skippedByStatus[facts.status] ?? 0) + 1;
  if (facts.outcome === "provider_accepted" || facts.outcome === "provider_failed") stage.attempted += 1;
  if (facts.outcome === "provider_accepted") stage.providerAccepted += 1;
  const response = facts.finalAttempt.provider_response;
  stage.tokenOutcomes.success += tokenCount(response?.success);
  stage.tokenOutcomes.failed += tokenCount(response?.failed);
  stage.tokenOutcomes.invalidTokenCount += tokenCount(response?.invalidTokenCount) ||
    (Array.isArray(response?.invalidTokens) ? response.invalidTokens.length : 0);
  stage.openUserMismatch += facts.mismatchCount;
  if (facts.outcome === "provider_accepted") {
    if (facts.matureOpen) {
      stage.opened = addRate(stage.opened, Number(facts.opened), 1);
      stage.pushDrivenAppReturn = addRate(stage.pushDrivenAppReturn, Number(facts.opened), 1);
      const baseline = stage.anyActivityWithinHorizon;
      const result = rate(baseline.numerator + Number(facts.activity), baseline.denominator + 1);
      stage.anyActivityWithinHorizon = { label: "baseline, not attributed", ...result };
    } else {
      stage.immatureForOpen += 1;
      if (facts.opened) stage.immatureOpened += 1;
    }
  }
  if (facts.opened) {
    if (facts.matureDecision) stage.decisionAfterOpen = addRate(stage.decisionAfterOpen, Number(facts.decision), 1);
    else stage.immatureForDecision += 1;
  }
  for (const serverStage of facts.serverStages) stage.serverStages[serverStage] += 1;
}
function maxTimestamp(rows: Array<Record<string, unknown>>, field: string): string | null {
  return rows.map((row) => row[field]).filter((value): value is string => typeof value === "string").sort().at(-1) ?? null;
}

export function buildPushTelemetryReport(input: PushTelemetryInput) {
  const { window, asOf } = input;
  const eventsById = new Map(input.notificationEvents.map((row) => [row.id, row]));
  const exclusionFor = (userId: string): ProfileExclusionReason | null => {
    if (!input.exclusions.has(userId)) throw new Error(`Missing profile exclusion result for ${userId}`);
    return input.exclusions.get(userId) ?? null;
  };
  const attemptsById = new Map<string, PushAttemptRow[]>();
  for (const attempt of input.attempts.filter((row) => row.channel === "push" && timestamp(row.created_at) <= timestamp(asOf))) {
    const rows = attemptsById.get(attempt.notification_event_id) ?? [];
    rows.push(attempt);
    attemptsById.set(attempt.notification_event_id, rows);
  }
  const stages = emptyStage();
  const breakdowns: {
    platformSet: Record<string, StageCounts>; permissionEvidence: Record<string, StageCounts>;
    notificationType: Record<string, StageCounts>; platformSetByType: Record<string, StageCounts>;
  } = { platformSet: {}, permissionEvidence: {}, notificationType: {}, platformSetByType: {} };
  const excluded: Record<string, number> = {};
  const opensByPlatform: Record<string, number> = {};
  for (const [id, attempts] of [...attemptsById.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const first = attempts.sort(byTimeId)[0];
    if (!inWindow(first.created_at, window.start, window.end)) continue;
    const event = eventsById.get(id);
    if (!event) throw new Error(`Missing notification_events row for ${id}`);
    const exclusion = exclusionFor(event.recipient_user_id);
    if (exclusion) {
      excluded[exclusion] = (excluded[exclusion] ?? 0) + 1;
      continue;
    }
    const recipientEvents = input.userEvents.filter((row) => row.user_id === event.recipient_user_id);
    const recipientDevices = input.devices.filter((row) => row.user_id === event.recipient_user_id);
    const platform = platformSetAt(recipientDevices, first.created_at);
    const permission = permissionEvidenceAt(recipientEvents, first.created_at);
    const final = finalPushOutcome(attempts);
    const matchedOpen = final.outcome === "provider_accepted" ? matchPushOpen(input.userEvents, {
      messageId: id, recipientId: event.recipient_user_id,
      from: first.created_at, horizonHours: input.openHorizonHours,
    }) : null;
    const horizonEnd = timestamp(first.created_at) + input.openHorizonHours * HOUR_MS;
    const matureOpen = horizonEnd <= timestamp(asOf);
    const mismatchCount = input.userEvents.filter((row) => row.event_type === "native_open_from_push" &&
      messageId(row) === id && row.user_id !== event.recipient_user_id &&
      timestamp(row.created_at) >= timestamp(first.created_at) && timestamp(row.created_at) < horizonEnd).length;
    const activity = recipientEvents.some((row) => MEANINGFUL_ACTIVITY_EVENTS.has(row.event_type) &&
      timestamp(row.created_at) > timestamp(first.created_at) && timestamp(row.created_at) <= horizonEnd);
    const decisionEnd = matchedOpen ? timestamp(matchedOpen.created_at) + input.decisionHorizonMinutes * MINUTE_MS : 0;
    const decision = Boolean(matchedOpen && recipientEvents.some((row) => PUSH_DECISION_EVENTS.has(row.event_type) &&
      timestamp(row.created_at) > timestamp(matchedOpen.created_at) && timestamp(row.created_at) <= decisionEnd));
    const serverStages = new Set(recipientEvents.filter((row) =>
      PUSH_SERVER_STAGES.some((stage) => stage === row.event_type) &&
      row.metadata?.message_instance_id === id && row.metadata?.delivery_channel === "push")
      .map((row) => row.event_type));
    const facts = {
      outcome: final.outcome, status: final.status, finalAttempt: final.finalAttempt,
      matureOpen, opened: Boolean(matchedOpen), mismatchCount, activity,
      matureDecision: decisionEnd <= timestamp(asOf), decision, serverStages,
    };
    addMessage(stages, facts);
    for (const [kind, key] of [
      ["platformSet", platform], ["permissionEvidence", permission], ["notificationType", event.type],
      ["platformSetByType", `${platform} × ${event.type}`],
    ] as const) {
      const group = breakdowns[kind];
      group[key] ??= emptyStage();
      addMessage(group[key], facts);
    }
    if (matchedOpen) {
      const openPlatform = matchedOpen.metadata?._platform;
      const key = typeof openPlatform === "string" ? openPlatform : "unknown";
      opensByPlatform[key] = (opensByPlatform[key] ?? 0) + 1;
    }
  }
  const orphanOpens = input.orphanCandidateOpens.filter((row) =>
    row.event_type === "native_open_from_push" && inWindow(row.created_at, window.start, window.end) &&
    (!messageId(row) || !input.knownPushAttemptIds.has(messageId(row) as string)));
  const orphanByNotificationType: Record<string, number> = {};
  for (const row of orphanOpens) {
    const value = row.metadata?.notification_type;
    const key = typeof value === "string" ? value : "unknown";
    orphanByNotificationType[key] = (orphanByNotificationType[key] ?? 0) + 1;
  }
  const registeredDevices: Record<string, { devices: number; users: number }> = {};
  for (const platform of ["ios", "android", "web"]) {
    const active = input.devices.filter((row) => row.platform === platform &&
      timestamp(row.created_at) <= timestamp(window.end) &&
      (row.retired_at === null || timestamp(row.retired_at) > timestamp(window.end)) &&
      !exclusionFor(row.user_id));
    registeredDevices[platform] = { devices: active.length, users: new Set(active.map((row) => row.user_id)).size };
  }
  const allChannelAttemptRows: Record<string, Record<string, number>> = {};
  for (const row of input.allChannelAttempts.filter((item) => inWindow(item.created_at, window.start, window.end))) {
    allChannelAttemptRows[row.channel] ??= {};
    allChannelAttemptRows[row.channel][row.status] = (allChannelAttemptRows[row.channel][row.status] ?? 0) + 1;
  }
  const sentPushEventIds = new Set(input.allChannelAttempts.filter((row) => {
    if (row.channel !== "push" || row.status !== "sent" || !inWindow(row.created_at, window.start, window.end)) return false;
    const event = eventsById.get(row.notification_event_id);
    if (!event) throw new Error(`Missing notification_events row for ${row.notification_event_id}`);
    return !exclusionFor(event.recipient_user_id);
  }).map((row) => row.notification_event_id));
  const alertIds = new Set(input.alertDeliveryAttempts.filter((row) => row.channel === "push" &&
    row.status === "sent" && row.message_instance_id !== null &&
    inWindow(row.attempted_at, window.start, window.end) && !exclusionFor(row.user_id))
    .map((row) => row.message_instance_id as string));
  const userEventsByType: Record<string, string> = {};
  for (const row of input.userEvents) {
    if (!userEventsByType[row.event_type] || row.created_at > userEventsByType[row.event_type]) {
      userEventsByType[row.event_type] = row.created_at;
    }
  }
  return {
    schemaVersion: PUSH_TELEMETRY_SCHEMA_VERSION, window, asOf,
    horizons: { openHours: input.openHorizonHours, decisionMinutes: input.decisionHorizonMinutes },
    ttlFloor: new Date(timestamp(asOf) - 90 * DAY_MS).toISOString(),
    windowStartsBeforeTtlFloor: timestamp(window.start) < timestamp(asOf) - 90 * DAY_MS,
    excluded, stages, breakdowns, opensByPlatform,
    orphanOpens: { count: orphanOpens.length, byNotificationType: orphanByNotificationType },
    deviceReceipt: { captured: false, reason: "Expo receipts are never fetched and ticket ids are discarded (lib/services/push-delivery.ts); provider acceptance is not device delivery" },
    currentPermission: { captured: false, reason: "no permission state is stored server-side or in PostHog person properties" },
    registeredDevices: { byPlatform: registeredDevices, permissionEnabledDevices: { captured: false } },
    legacy: {
      allChannelAttemptRows,
      sentPushEventIds: sentPushEventIds.size,
      alertLedgerSentPushMessageInstances: {
        count: alertIds.size,
        inNotificationEvents: [...alertIds].filter((id) => eventsById.has(id)).length,
      },
    },
    sourceFreshness: {
      notificationDeliveryAttempts: maxTimestamp([...input.allChannelAttempts, ...input.attempts] as unknown as Array<Record<string, unknown>>, "created_at"),
      notificationEvents: maxTimestamp(input.notificationEvents as unknown as Array<Record<string, unknown>>, "created_at"),
      userDevices: maxTimestamp(input.devices as unknown as Array<Record<string, unknown>>, "updated_at"),
      userEvents: maxTimestamp(input.userEvents as unknown as Array<Record<string, unknown>>, "created_at"),
      userEventsByType,
      alertDeliveryAttempts: maxTimestamp(input.alertDeliveryAttempts as unknown as Array<Record<string, unknown>>, "attempted_at"),
      notificationDeliveryTargets: {
        rowCount: input.deliveryTargetRows.length,
        latestCreatedAt: maxTimestamp(input.deliveryTargetRows as unknown as Array<Record<string, unknown>>, "created_at"),
      },
    },
  };
}
