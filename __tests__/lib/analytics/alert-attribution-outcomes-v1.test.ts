import { buildAlertAttributionOutcomesReport, deriveSentAlertInstances, type AlertAttributionInput, type AlertLedgerRow, type EmailSendRow } from "@/lib/analytics/alert-attribution-outcomes-v1";

const start = "2026-01-01T00:00:00.000Z";
const send = "2026-01-01T01:00:00.000Z";
const end = "2026-01-02T00:00:00.000Z";
const window = { startDate: "2026-01-01", endDate: "2026-01-02", start, end, timeZone: "UTC" };
const internal = "73040cff-afe9-4fa0-a874-2016203fc015";
const ledger = (id: string, mid: string | null, channel: "push" | "email", userId = "u", status = "sent", queueId: string | null = "q"): AlertLedgerRow => ({
  id, message_instance_id: mid, channel, user_id: userId, status, queue_id: queueId, rule_id: id,
  skip_reason: null, attempted_at: send,
});
const email = (mid: string, userId = "u"): EmailSendRow => ({
  id: 1, user_id: userId, email_type: "conditions_alert", message_instance_id: mid,
  resend_message_id: "provider-1", sent_at: send, delivered_at: null, opened_at: send, clicked_at: send, bounced_at: null,
});
const event = (id: string, userId: string, eventType: string, at: string, metadata: Record<string, unknown>) => ({
  id, user_id: userId, event_type: eventType, created_at: at, metadata,
});
function input(): AlertAttributionInput {
  return { window, asOf: "2026-01-10T00:00:00.000Z", openHorizonHours: 72,
    ledger: [], instances: [], userEvents: [], pushOpens: [], pushAttempts: [], devices: [],
    emailSends: [], emailDeliveryEvents: [], emailClickEvents: [], knownSentMessageIds: new Set(), exclusions: new Map() };
}
function resolve(data: AlertAttributionInput, pushTypes: Record<string, string> = {}): void {
  data.instances = deriveSentAlertInstances(data.ledger, window,
    Object.entries(pushTypes).map(([id, type]) => ({ id, type, recipient_user_id: "u" })), data.emailSends);
}

describe("alert attribution outcomes v1", () => {
  it("counts N rule rows once, isolates NULL identities, skips and failures", () => {
    const data = input();
    data.ledger = [ledger("a", "p", "push"), ledger("b", "p", "push"), ledger("old", null, "push"),
      ledger("skip", null, "push", "u", "skipped_cooldown"), ledger("fail", null, "push", "u", "failed_provider")];
    resolve(data, { p: "forecast_alert" }); data.exclusions = new Map([["u", null]]);
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.sentInstances).toBe(1);
    expect(report.ledger.sentWithoutIdentity.push).toEqual({ rows: 1, distinctUsers: 1 });
    expect(report.deliveryCapability.push).toEqual({ capableInstances: 1, incapableInstances: 0, unmatchedInstances: 0, withoutIdentityRows: 1 });
    expect(report.ledger.skips["push:skipped_cooldown"]).toBe(1);
    expect(report.ledger.failures["push:failed_provider"]).toBe(1);
    expect(report.byChannelType.push.forecast_alert.sentInstances).toBe(1);
  });

  it("flags unmatched push and email identities and excludes them from typed attribution", () => {
    const data = input(); data.ledger = [ledger("a", "p", "push"), ledger("b", "e", "email")];
    resolve(data); data.exclusions = new Map([["u", null]]);
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.unmatchedDelivery.push).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(report.unmatchedDelivery.email).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(report.deliveryCapability.email.unmatchedInstances).toBe(1);
    expect(report.byChannelType.email).toEqual({});
  });

  it.each(["", "email."])("counts provider opens and clicks with prefix '%s' without attributing a return", (prefix) => {
    const data = input(); data.ledger = [ledger("a", "e", "email")]; data.emailSends = [email("e")];
    data.emailDeliveryEvents = [
      { id: 1, email_send_log_id: null, resend_message_id: "provider-1", event_type: `${prefix}opened`, event_at: send },
      { id: 2, email_send_log_id: 1, resend_message_id: "provider-1", event_type: `${prefix}clicked`, event_at: send },
      { id: 3, email_send_log_id: 1, resend_message_id: "provider-1", event_type: `${prefix}delivered`, event_at: send },
    ];
    data.emailClickEvents = [{ id: 2, email_send_log_id: null, resend_message_id: "provider-1", clicked_at: send }];
    resolve(data); data.exclusions = new Map([["u", null]]);
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.rawProviderOpens.events).toBe(1); expect(report.rawProviderClicks.events).toBe(1);
    expect(report.rawProviderClicks.deliveryEvents).toBe(1);
    expect(report.byChannelType.email.conditions_alert.interaction.numerator).toBe(0);
    expect(report.byChannelType.email.conditions_alert.attributedReturnRate.numerator).toBe(0);
  });

  it("matches native interaction, rejects wrong channel, and dedupes a two-channel occasion", () => {
    const data = input(); data.ledger = [ledger("a", "p", "push"), ledger("b", "e", "email")]; data.emailSends = [email("e")];
    resolve(data, { p: "forecast_alert" }); data.exclusions = new Map([["u", null]]);
    data.pushOpens = [event("tap", "u", "native_open_from_push", "2026-01-01T02:00:00.000Z", { notification_event_id: "p" })];
    data.userEvents = [
      event("native", "u", "native_open_from_email", "2026-01-01T02:00:00.000Z", { message_instance_id: "e" }),
      event("wrong", "u", "alert_return_to_decision", "2026-01-01T02:00:00.000Z", { message_instance_id: "p", delivery_channel: "email" }),
      event("p-return", "u", "alert_app_returned", "2026-01-01T03:00:00.000Z", { message_instance_id: "p", delivery_channel: "push" }),
      event("e-return", "u", "alert_app_returned", "2026-01-01T04:00:00.000Z", { message_instance_id: "e", delivery_channel: "email" }),
      event("orphan", "u", "alert_app_returned", "2026-01-01T05:00:00.000Z", { message_instance_id: "other", delivery_channel: "email" }),
    ];
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.channelMismatch).toBe(1); expect(report.orphanStages).toBe(1);
    expect(report.byChannelType.push.forecast_alert.returnToDecisionRate.numerator).toBe(0);
    expect(report.missingAttribution).toEqual({ numerator: 2, denominator: 2, rate: 1 });
    expect(report.occasions).toBe(1); expect(report.multiChannelOccasions).toBe(1);
    expect(report.dedupedReturnRate).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(report.returnsByFirstChannel).toEqual({ push: 1, email: 0 });
  });

  it("uses separate D1/D7 maturity and marks daily_call incapable", () => {
    const data = input(); data.asOf = "2026-01-03T00:00:00.000Z";
    data.ledger = [ledger("a", "p", "push"), ledger("b", "d", "push")];
    resolve(data, { p: "forecast_alert", d: "daily_call" }); data.exclusions = new Map([["u", null]]);
    data.userEvents = [event("return", "u", "alert_app_returned", "2026-01-01T04:00:00.000Z", { message_instance_id: "p", delivery_channel: "push" })];
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.byChannelType.push.forecast_alert.attributedReturnD1).toEqual({ numerator: 1, denominator: 1, rate: 1 });
    expect(report.byChannelType.push.forecast_alert.attributedReturnD7).toEqual({ numerator: 0, denominator: 0, rate: null });
    expect(report.notAttributableByConstruction["push:daily_call"]).toBe(1);
    expect(report.deliveryCapability.push.incapableInstances).toBe(1);
  });

  it("counts founder exclusion and identity conflict", () => {
    const data = input(); data.ledger = [ledger("a", "p", "push", internal), ledger("b", "x", "push"), ledger("c", "x", "push", "other")];
    resolve(data, { p: "forecast_alert", x: "forecast_alert" });
    data.exclusions = new Map([[internal, "internal_account"], ["u", null]]);
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.excluded.internal_account).toBe(1); expect(report.identityConflict).toBe(1);
    expect(report.sentInstances).toBe(0);
  });

  it("anchors retries to the earliest sent row and uses all queue links", () => {
    const earlier = { ...ledger("first", "p", "push", "u", "sent", "q1"), attempted_at: "2025-12-31T23:00:00.000Z" };
    const retry = ledger("retry", "p", "push", "u", "sent", "q2");
    expect(deriveSentAlertInstances([earlier, retry], window,
      [{ id: "p", type: "forecast_alert", recipient_user_id: "u" }], [])).toEqual([]);
    const delivered = ledger("delivery", "p", "push", "u", "sent", "q1");
    const other = ledger("skipped", "p", "push", "u", "skipped_cooldown", "q2");
    expect(deriveSentAlertInstances([delivered, other], window,
      [{ id: "p", type: "forecast_alert", recipient_user_id: "u" }], [])[0].queueIds).toEqual(["q1", "q2"]);
  });

  it("does not mark a stage orphan when its sent message is outside the report window", () => {
    const data = input(); data.knownSentMessageIds = new Set(["older"]);
    data.userEvents = [event("stage", "u", "alert_app_returned", send, { message_instance_id: "older", delivery_channel: "push" })];
    expect(buildAlertAttributionOutcomesReport(data).orphanStages).toBe(0);
  });

  it("includes +00:00 rows exactly at window start and excludes sends at window end", () => {
    const data = input();
    data.window = {
      startDate: "2026-10-07", endDate: "2026-10-08", timeZone: "America/Los_Angeles",
      start: "2026-10-07T07:00:00.000Z", end: "2026-10-08T07:00:00.000Z",
    };
    data.asOf = "2026-10-17T00:00:00.000Z";
    data.ledger = [
      { ...ledger("at-start", "p", "push"), attempted_at: "2026-10-07T07:00:00+00:00" },
      { ...ledger("before-start", "before", "push"), attempted_at: "2026-10-07T06:59:59.999Z" },
      { ...ledger("at-end", "after", "push"), attempted_at: "2026-10-08T07:00:00+00:00" },
    ];
    data.instances = deriveSentAlertInstances(data.ledger, data.window,
      ["p", "before", "after"].map((id) => ({ id, type: "forecast_alert", recipient_user_id: "u" })), []);
    data.exclusions = new Map([["u", null]]);
    data.userEvents = [
      event("start", "u", "alert_app_returned", "2026-10-07T07:00:00+00:00", { message_instance_id: "orphan", delivery_channel: "push" }),
      event("before", "u", "alert_app_returned", "2026-10-07T06:59:59.999Z", { message_instance_id: "orphan", delivery_channel: "push" }),
      event("last", "u", "alert_app_returned", "2026-10-15T07:00:00+00:00", { message_instance_id: "orphan", delivery_channel: "push" }),
      event("after", "u", "alert_app_returned", "2026-10-15T07:00:00.001Z", { message_instance_id: "orphan", delivery_channel: "push" }),
    ];
    expect(data.instances.map((instance) => instance.messageInstanceId)).toEqual(["p"]);
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.sentInstances).toBe(1);
    expect(report.ledger.byChannelStatus.push.sent).toEqual({ rows: 1, distinctUsers: 1 });
    expect(report.orphanStages).toBe(2);
  });

  it("orders send anchors, instances, and freshness by instant across timezone formats", () => {
    const data = input();
    data.ledger = [
      { ...ledger("first", "p", "push"), attempted_at: "2026-01-01T02:00:00+01:00" },
      { ...ledger("retry", "p", "push"), attempted_at: "2026-01-01T01:00:00.500Z" },
      { ...ledger("next", "q", "push"), attempted_at: "2026-01-01T01:30:00.000Z" },
    ];
    resolve(data, { p: "forecast_alert", q: "forecast_alert" });
    data.exclusions = new Map([["u", null]]);
    expect(data.instances.map((instance) => instance.messageInstanceId)).toEqual(["p", "q"]);
    expect(data.instances[0].sentAt).toBe("2026-01-01T02:00:00+01:00");
    expect(buildAlertAttributionOutcomesReport(data).sourceFreshness.alert_delivery_attempts).toBe("2026-01-01T01:30:00.000Z");
  });

  it("assigns the first returning channel using instants across timezone formats", () => {
    const data = input();
    data.ledger = [ledger("push", "p", "push"), ledger("email", "e", "email")];
    data.emailSends = [email("e")];
    resolve(data, { p: "forecast_alert" });
    data.exclusions = new Map([["u", null]]);
    data.userEvents = [
      event("push-first", "u", "alert_app_returned", "2026-01-01T03:00:00+01:00", { message_instance_id: "p", delivery_channel: "push" }),
      event("push-later", "u", "alert_app_returned", "2026-01-01T02:30:00.000Z", { message_instance_id: "p", delivery_channel: "push" }),
      event("email", "u", "alert_app_returned", "2026-01-01T02:15:00.000Z", { message_instance_id: "e", delivery_channel: "email" }),
    ];
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.returnsByFirstChannel).toEqual({ push: 1, email: 0 });
    expect(report.sourceFreshness.user_events).toBe("2026-01-01T02:30:00.000Z");
  });

  it("does not flag a window at the TTL floor when timestamp formats differ", () => {
    const data = input();
    data.window = { ...window, start: "2026-01-01T00:00:00+00:00" };
    data.asOf = "2026-04-01T00:00:00.000Z";
    const report = buildAlertAttributionOutcomesReport(data);
    expect(report.ttlFloor).toBe(start);
    expect(report.windowBeforeTtlFloor).toBe(false);
  });
});
