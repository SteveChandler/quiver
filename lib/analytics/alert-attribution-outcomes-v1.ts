import { MEANINGFUL_ACTIVITY_EVENTS } from "./install-to-paid-funnel-v1";
import { finalPushOutcome, matchPushOpen, platformSetAt, PUSH_DECISION_EVENTS, type PushAttemptRow, type PushUserEventRow, type UserDeviceRow } from "./push-telemetry-v1";
import { localDate, selectAllPages, type ProfileExclusionReason, type ReadOnlySupabase } from "./report-guards";

const ALERT_ATTRIBUTION_OUTCOMES_SCHEMA_VERSION = "alert_attribution_outcomes.v1" as const;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const STAGES = ["alert_message_activated", "alert_app_returned", "alert_return_to_decision", "alert_decision_action"] as const;
type Channel = "push" | "email";
type Rate = { numerator: number; denominator: number; rate: number | null };
type Window = { startDate: string; endDate: string; start: string; end: string; timeZone: string };
interface TypeOutcome {
  sentInstances: number; interaction: Rate; attributedReturnRate: Rate;
  returnToDecisionRate: Rate; decisionActionRate: Rate;
  attributedReturnD1: Rate; attributedReturnD7: Rate;
  baselineActivityD1: Rate & { label: "baseline, not attributed" };
  baselineActivityD7: Rate & { label: "baseline, not attributed" };
  stages: Record<string, number>; decisionActions: Record<string, number>; decisionEvents: number;
}

export interface AlertLedgerRow {
  id: string; queue_id: string | null; rule_id: string | null; user_id: string;
  channel: Channel; status: string; skip_reason: string | null;
  attempted_at: string; message_instance_id: string | null;
}
export interface EmailSendRow {
  id: number; user_id: string; email_type: string; message_instance_id: string | null;
  resend_message_id: string | null; sent_at: string; delivered_at: string | null;
  opened_at: string | null; clicked_at: string | null; bounced_at: string | null;
}
export interface EmailProviderRow {
  id: number; email_send_log_id: number | null; resend_message_id: string;
  event_type?: string; event_at?: string; clicked_at?: string;
}
export interface SentAlertInstance {
  messageInstanceId: string; recipientId: string; channel: Channel; alertType: string;
  sentAt: string; queueIds: string[]; identityMatch: boolean; identityConflict: boolean;
  attributionCapable: boolean; identityCreatedAt?: string;
}
export interface AlertAttributionInput {
  window: Window; asOf: string; openHorizonHours: number;
  ledger: AlertLedgerRow[]; instances: SentAlertInstance[];
  userEvents: PushUserEventRow[]; pushOpens: PushUserEventRow[];
  pushAttempts: PushAttemptRow[]; devices: UserDeviceRow[];
  emailSends: EmailSendRow[]; emailDeliveryEvents: EmailProviderRow[]; emailClickEvents: EmailProviderRow[];
  knownSentMessageIds: ReadonlySet<string>;
  exclusions: ReadonlyMap<string, ProfileExclusionReason | null>;
}

function rate(numerator: number, denominator: number): Rate {
  return { numerator, denominator, rate: denominator === 0 ? null : numerator / denominator };
}
function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))].sort();
}
function chunks<T>(items: T[], size = 200): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
function max(rows: Array<string | null | undefined>): string | null {
  return rows.filter((value): value is string => !!value).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
}
function capable(channel: Channel, type: string): boolean {
  return channel === "email" ? type === "conditions_alert"
    : ["forecast_alert", "watched_call_update", "similarity_match"].includes(type);
}

export function deriveSentAlertInstances(
  rows: AlertLedgerRow[], window: Window,
  pushIdentities: Array<{ id: string; recipient_user_id: string; type: string; created_at?: string }>,
  emailSends: EmailSendRow[],
): SentAlertInstance[] {
  const windowStart = Date.parse(window.start);
  const windowEnd = Date.parse(window.end);
  const push = new Map(pushIdentities.map((row) => [row.id, row]));
  const email = new Map(emailSends.filter((row) => row.message_instance_id).map((row) => [row.message_instance_id, row]));
  const grouped = new Map<string, AlertLedgerRow[]>();
  for (const row of rows) {
    if (!row.message_instance_id) continue;
    const key = `${row.channel}:${row.message_instance_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const instances: SentAlertInstance[] = [];
  for (const rowsForId of grouped.values()) {
    const sentRows = rowsForId.filter((row) => row.status === "sent")
      .sort((a, b) => Date.parse(a.attempted_at) - Date.parse(b.attempted_at) || a.id.localeCompare(b.id));
    const first = sentRows[0];
    if (!first) continue;
    if (Date.parse(first.attempted_at) < windowStart || Date.parse(first.attempted_at) >= windowEnd) continue;
    const id = first.message_instance_id!;
    const recipientIds = unique(rowsForId.map((row) => row.user_id));
    const identity = first.channel === "push" ? push.get(id) : email.get(id);
    const identityUser = identity && ("recipient_user_id" in identity ? identity.recipient_user_id : identity.user_id);
    instances.push({
      messageInstanceId: id, recipientId: first.user_id, channel: first.channel,
      alertType: first.channel === "push" ? (push.get(id)?.type ?? "unknown") : (email.get(id)?.email_type ?? "conditions_alert"),
      sentAt: first.attempted_at, queueIds: unique(rowsForId.map((row) => row.queue_id)),
      identityMatch: !!identity && identityUser === first.user_id,
      identityConflict: recipientIds.length > 1,
      attributionCapable: !!identity && identityUser === first.user_id && recipientIds.length === 1 &&
        capable(first.channel, first.channel === "push" ? push.get(id)!.type : email.get(id)!.email_type),
      identityCreatedAt: first.channel === "push" ? push.get(id)?.created_at : undefined,
    });
  }
  return instances.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.channel.localeCompare(b.channel) || a.messageInstanceId.localeCompare(b.messageInstanceId));
}

export async function loadSentAlertInstances(client: ReadOnlySupabase, window: Window, ledgerRows?: AlertLedgerRow[]): Promise<SentAlertInstance[]> {
  const columns = "id,queue_id,rule_id,user_id,channel,status,skip_reason,attempted_at,message_instance_id";
  const windowRows = ledgerRows ?? await selectAllPages<AlertLedgerRow>(() => client.from("alert_delivery_attempts")
    .select(columns).gte("attempted_at", window.start).lt("attempted_at", window.end).order("attempted_at").order("id"));
  const ids = unique(windowRows.filter((row) => row.status === "sent").map((row) => row.message_instance_id));
  const allRows = [...windowRows];
  for (const idChunk of chunks(ids)) {
    const historical = await selectAllPages<AlertLedgerRow>(() => client.from("alert_delivery_attempts")
      .select(columns).in("message_instance_id", idChunk)
      .lt("attempted_at", window.end).order("attempted_at").order("id"));
    const seen = new Set(allRows.map((row) => row.id));
    for (const row of historical) if (!seen.has(row.id)) { allRows.push(row); seen.add(row.id); }
  }
  const pushes: Array<{ id: string; recipient_user_id: string; type: string; created_at: string }> = [];
  const emails: EmailSendRow[] = [];
  for (const idChunk of chunks(ids)) {
    pushes.push(...await selectAllPages<typeof pushes[number]>(() => client.from("notification_events")
      .select("id,recipient_user_id,type,created_at").in("id", idChunk).order("id")));
    emails.push(...await selectAllPages<EmailSendRow>(() => client.from("email_send_log")
      .select("id,user_id,email_type,message_instance_id,resend_message_id,sent_at,delivered_at,opened_at,clicked_at,bounced_at")
      .in("message_instance_id", idChunk).order("id")));
  }
  return deriveSentAlertInstances(allRows, window, pushes, emails);
}

function eventMid(row: PushUserEventRow): string | null {
  const value = row.metadata?.message_instance_id;
  return typeof value === "string" ? value : null;
}
function stageFor(instance: SentAlertInstance, events: PushUserEventRow[], asOf: number): PushUserEventRow[] {
  const send = Date.parse(instance.sentAt);
  return events.filter((row) => row.user_id === instance.recipientId && eventMid(row) === instance.messageInstanceId &&
    row.metadata?.delivery_channel === instance.channel && STAGES.includes(row.event_type as typeof STAGES[number]) &&
    Date.parse(row.created_at) >= send && Date.parse(row.created_at) <= Math.min(send + 7 * DAY_MS, asOf));
}

export function buildAlertAttributionOutcomesReport(input: AlertAttributionInput) {
  const asOf = Date.parse(input.asOf);
  const windowStart = Date.parse(input.window.start);
  const windowEnd = Date.parse(input.window.end);
  const ttlFloor = new Date(asOf - 90 * DAY_MS).toISOString();
  const excluded: Record<string, number> = {};
  const exclusion = (userId: string): ProfileExclusionReason | null => {
    if (!input.exclusions.has(userId)) throw new Error(`Missing profile exclusion result for ${userId}`);
    return input.exclusions.get(userId) ?? null;
  };
  const eligible = input.instances.filter((item) => {
    const reason = exclusion(item.recipientId);
    if (reason) excluded[reason] = (excluded[reason] ?? 0) + 1;
    return !reason && !item.identityConflict;
  });
  const ledger: Record<string, Record<string, { rows: number; distinctUsers: number }>> = {};
  const usersByStatus = new Map<string, Set<string>>();
  const sentWithoutIdentity: Record<string, { rows: number; distinctUsers: number }> = {};
  const nullUsers = new Map<string, Set<string>>();
  const skips: Record<string, number> = {};
  const failures: Record<string, number> = {};
  for (const row of input.ledger.filter((item) => Date.parse(item.attempted_at) >= windowStart && Date.parse(item.attempted_at) < windowEnd)) {
    const channel = ledger[row.channel] ??= {};
    const item = channel[row.status] ??= { rows: 0, distinctUsers: 0 };
    item.rows += 1;
    const key = `${row.channel}:${row.status}`;
    const users = usersByStatus.get(key) ?? new Set<string>();
    users.add(row.user_id); usersByStatus.set(key, users); item.distinctUsers = users.size;
    if (row.status === "sent" && !row.message_instance_id) {
      const value = sentWithoutIdentity[row.channel] ??= { rows: 0, distinctUsers: 0 };
      value.rows += 1;
      const set = nullUsers.get(row.channel) ?? new Set<string>();
      set.add(row.user_id); nullUsers.set(row.channel, set); value.distinctUsers = set.size;
    }
    if (row.status.startsWith("skipped_") || row.status === "shadow_withheld") skips[key] = (skips[key] ?? 0) + 1;
    if (row.status.startsWith("failed_")) failures[key] = (failures[key] ?? 0) + 1;
  }
  const unmatchedDelivery: Record<Channel, Rate> = { push: rate(0, 0), email: rate(0, 0) };
  const byChannelType: Record<Channel, Record<string, TypeOutcome>> = { push: {}, email: {} };
  const deliveryCapability: Record<Channel, { capableInstances: number; incapableInstances: number; unmatchedInstances: number; withoutIdentityRows: number }> = {
    push: { capableInstances: 0, incapableInstances: 0, unmatchedInstances: 0, withoutIdentityRows: sentWithoutIdentity.push?.rows ?? 0 },
    email: { capableInstances: 0, incapableInstances: 0, unmatchedInstances: 0, withoutIdentityRows: sentWithoutIdentity.email?.rows ?? 0 },
  };
  const notAttributableByConstruction: Record<string, number> = {};
  const pushPlatform: Record<string, number> = {};
  const pushFinalOutcome: Record<string, number> = {};
  const sentIds = new Set([...input.instances.map((item) => item.messageInstanceId), ...input.knownSentMessageIds]);
  const stageRows = input.userEvents.filter((row) => STAGES.includes(row.event_type as typeof STAGES[number]));
  const orphanStages = stageRows.filter((row) => Date.parse(row.created_at) >= windowStart && Date.parse(row.created_at) <= windowEnd + 7 * DAY_MS &&
    (!eventMid(row) || !sentIds.has(eventMid(row)!))).length;
  const channelMismatch = stageRows.filter((row) => eligible.some((item) => item.messageInstanceId === eventMid(row) && item.recipientId === row.user_id && row.metadata?.delivery_channel !== item.channel)).length;
  let interactions = 0; let missing = 0;
  const state = new Map<string, { returned: boolean; returnAt: string | null; mature: boolean }>();
  const emailByMid = new Map(input.emailSends.map((row) => [row.message_instance_id, row]));
  const rawProviderOpens = { events: 0, legacyLogFields: 0 };
  const rawProviderClicks = { events: 0, deliveryEvents: 0, legacyLogFields: 0 };
  for (const item of eligible) {
    unmatchedDelivery[item.channel].denominator += 1;
    if (!item.identityMatch) unmatchedDelivery[item.channel].numerator += 1;
    if (!item.identityMatch) deliveryCapability[item.channel].unmatchedInstances += 1;
    else if (item.attributionCapable) deliveryCapability[item.channel].capableInstances += 1;
    else deliveryCapability[item.channel].incapableInstances += 1;
    const key = `${item.channel}:${item.messageInstanceId}`;
    const send = Date.parse(item.sentAt);
    const mature1 = send + DAY_MS <= asOf;
    const mature7 = send + 7 * DAY_MS <= asOf;
    const stages = stageFor(item, stageRows, asOf);
    const has = (name: string, limit = send + 7 * DAY_MS): boolean => stages.some((row) => row.event_type === name && Date.parse(row.created_at) <= limit);
    const returns = stages.filter((row) => row.event_type === "alert_app_returned").sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
    const returned = returns.length > 0;
    state.set(key, { returned, returnAt: returns[0]?.created_at ?? null, mature: mature7 });
    if (item.channel === "push") {
      const platform = platformSetAt(input.devices.filter((row) => row.user_id === item.recipientId), item.sentAt);
      pushPlatform[platform] = (pushPlatform[platform] ?? 0) + 1;
      const attempts = input.pushAttempts.filter((row) => row.notification_event_id === item.messageInstanceId && row.channel === "push");
      if (attempts.length) { const outcome = finalPushOutcome(attempts).outcome; pushFinalOutcome[outcome] = (pushFinalOutcome[outcome] ?? 0) + 1; }
    }
    if (item.channel === "email") {
      const email = emailByMid.get(item.messageInstanceId);
      if (email) {
        const providerMatches = (row: EmailProviderRow): boolean => row.email_send_log_id === email.id || (!!email.resend_message_id && row.resend_message_id === email.resend_message_id);
        rawProviderOpens.events += input.emailDeliveryEvents.filter((row) => providerMatches(row) && row.event_type?.replace(/^email\./, "") === "opened").length;
        rawProviderClicks.events += input.emailClickEvents.filter(providerMatches).length;
        rawProviderClicks.deliveryEvents += input.emailDeliveryEvents.filter((row) => providerMatches(row) && row.event_type?.replace(/^email\./, "") === "clicked").length;
        rawProviderOpens.legacyLogFields += Number(!!email.opened_at);
        rawProviderClicks.legacyLogFields += Number(!!email.clicked_at);
      }
    }
    if (!item.identityMatch) continue;
    if (!item.attributionCapable) {
      const typeKey = `${item.channel}:${item.alertType}`;
      notAttributableByConstruction[typeKey] = (notAttributableByConstruction[typeKey] ?? 0) + 1;
      continue;
    }
    const type = byChannelType[item.channel][item.alertType] ??= {
      sentInstances: 0, interaction: rate(0, 0), attributedReturnRate: rate(0, 0),
      returnToDecisionRate: rate(0, 0), decisionActionRate: rate(0, 0),
      attributedReturnD1: rate(0, 0), attributedReturnD7: rate(0, 0),
      baselineActivityD1: { label: "baseline, not attributed", ...rate(0, 0) },
      baselineActivityD7: { label: "baseline, not attributed", ...rate(0, 0) },
      stages: Object.fromEntries(STAGES.map((name) => [name, 0])), decisionActions: {},
      decisionEvents: 0,
    };
    type.sentInstances += 1;
    const interaction = item.channel === "push"
      ? matchPushOpen(input.pushOpens, { messageId: item.messageInstanceId, recipientId: item.recipientId, from: item.sentAt, horizonHours: input.openHorizonHours })
      : input.userEvents.find((row) => row.event_type === "native_open_from_email" && row.user_id === item.recipientId && eventMid(row) === item.messageInstanceId &&
        Date.parse(row.created_at) >= send && Date.parse(row.created_at) < send + input.openHorizonHours * HOUR_MS);
    if (send + input.openHorizonHours * HOUR_MS <= asOf) {
      type.interaction.denominator += 1;
      type.interaction.numerator += Number(!!interaction);
    }
    if (interaction) { interactions += 1; if (!has("alert_message_activated")) missing += 1; }
    for (const name of STAGES) type.stages[name] += Number(has(name));
    for (const row of stages.filter((candidate) => candidate.event_type === "alert_decision_action")) {
      const action = typeof row.metadata?.action === "string" ? row.metadata.action : "unknown";
      type.decisionActions[action] = (type.decisionActions[action] ?? 0) + 1;
    }
    type.decisionEvents += input.userEvents.filter((row) => row.user_id === item.recipientId && PUSH_DECISION_EVENTS.has(row.event_type) && Date.parse(row.created_at) > send && Date.parse(row.created_at) <= send + 7 * DAY_MS).length;
    if (mature7) { type.attributedReturnRate.denominator += 1; type.attributedReturnRate.numerator += Number(returned); }
    if (returned) {
      type.returnToDecisionRate.denominator += 1; type.returnToDecisionRate.numerator += Number(has("alert_return_to_decision"));
      type.decisionActionRate.denominator += 1; type.decisionActionRate.numerator += Number(has("alert_decision_action"));
    }
    for (const [days, mature, field, baseline] of [[1, mature1, "attributedReturnD1", "baselineActivityD1"], [7, mature7, "attributedReturnD7", "baselineActivityD7"]] as const) {
      if (!mature) continue;
      type[field].denominator += 1; type[field].numerator += Number(has("alert_app_returned", send + days * DAY_MS));
      type[baseline].denominator += 1;
      type[baseline].numerator += Number(input.userEvents.some((row) => row.user_id === item.recipientId && MEANINGFUL_ACTIVITY_EVENTS.has(row.event_type) && Date.parse(row.created_at) > send && Date.parse(row.created_at) <= send + days * DAY_MS));
    }
  }
  for (const channel of ["push", "email"] as const) {
    const value = unmatchedDelivery[channel]; value.rate = rate(value.numerator, value.denominator).rate;
    for (const type of Object.values(byChannelType[channel])) {
      for (const key of ["interaction", "attributedReturnRate", "returnToDecisionRate", "decisionActionRate", "attributedReturnD1", "attributedReturnD7", "baselineActivityD1", "baselineActivityD7"] as const) {
        type[key].rate = rate(type[key].numerator, type[key].denominator).rate;
      }
    }
  }
  // Shared queue IDs form connected components; queue-less messages use the local send date and type.
  const occasionItems = eligible.filter((item) => item.attributionCapable);
  const parent = occasionItems.map((_, index) => index);
  const root = (index: number): number => { while (parent[index] !== index) index = parent[index]; return index; };
  const byQueue = new Map<string, number>();
  const byFallback = new Map<string, number>();
  occasionItems.forEach((item, index) => {
    const keys = item.queueIds.length ? item.queueIds.map((id) => `${item.recipientId}:queue:${id}`)
      : [`${item.recipientId}:date:${localDate(new Date(item.sentAt), input.window.timeZone)}:${item.alertType}`];
    const map = item.queueIds.length ? byQueue : byFallback;
    for (const key of keys) { const prior = map.get(key); if (prior !== undefined) parent[root(index)] = root(prior); else map.set(key, index); }
  });
  const groups = new Map<number, SentAlertInstance[]>();
  occasionItems.forEach((item, index) => groups.set(root(index), [...(groups.get(root(index)) ?? []), item]));
  let multiChannelOccasions = 0; let matureOccasions = 0; let returnedOccasions = 0;
  const returnsByFirstChannel: Record<Channel, number> = { push: 0, email: 0 };
  for (const group of groups.values()) {
    if (new Set(group.map((item) => item.channel)).size > 1) multiChannelOccasions += 1;
    if (!group.every((item) => state.get(`${item.channel}:${item.messageInstanceId}`)?.mature)) continue;
    matureOccasions += 1;
    const first = group.map((item) => ({ channel: item.channel, at: state.get(`${item.channel}:${item.messageInstanceId}`)?.returnAt }))
      .filter((item): item is { channel: Channel; at: string } => !!item.at).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.channel.localeCompare(b.channel))[0];
    if (first) { returnedOccasions += 1; returnsByFirstChannel[first.channel] += 1; }
  }
  return {
    schemaVersion: ALERT_ATTRIBUTION_OUTCOMES_SCHEMA_VERSION, window: input.window, asOf: input.asOf,
    ttlFloor, windowBeforeTtlFloor: windowStart < Date.parse(ttlFloor), openHorizonHours: input.openHorizonHours,
    sourceFreshness: {
      alert_delivery_attempts: max(input.ledger.map((row) => row.attempted_at)),
      notification_events: max(input.instances.map((row) => row.channel === "push" ? row.identityCreatedAt : null)),
      notification_delivery_attempts: max(input.pushAttempts.map((row) => row.created_at)),
      user_events: max(input.userEvents.map((row) => row.created_at).concat(input.pushOpens.map((row) => row.created_at))),
      email_send_log: max(input.emailSends.map((row) => row.sent_at)),
      email_delivery_events: max(input.emailDeliveryEvents.map((row) => row.event_at)),
      email_click_events: max(input.emailClickEvents.map((row) => row.clicked_at)),
      user_devices: max(input.devices.map((row) => row.updated_at)),
    },
    excluded, ledger: { byChannelStatus: ledger, sentWithoutIdentity, skips, failures },
    sentInstances: eligible.length, identityConflict: input.instances.filter((item) => item.identityConflict).length,
    unmatchedDelivery, deliveryCapability, notAttributableByConstruction, byChannelType,
    missingAttribution: rate(missing, interactions), orphanStages, channelMismatch,
    rawProviderOpens, rawProviderClicks, pushPlatform, pushFinalOutcome,
    occasions: groups.size, multiChannelOccasions, dedupedReturnRate: rate(returnedOccasions, matureOccasions), returnsByFirstChannel,
  };
}
