import {
  buildPushTelemetryReport,
  finalPushOutcome,
  matchPushOpen,
  permissionEvidenceAt,
  platformSetAt,
  PUSH_TELEMETRY_SCHEMA_VERSION,
  type PushTelemetryInput,
} from "@/lib/analytics/push-telemetry-v1";
import { profileExclusionReason } from "@/lib/analytics/report-guards";

const start = "2026-01-01T00:00:00.000Z";
const end = "2026-01-02T00:00:00.000Z";
const recipient = "user-a";
const excludedId = "73040cff-afe9-4fa0-a874-2016203fc015";
const attempt = (id: string, eventId: string, createdAt: string, status: string, channel = "push") => ({
  id, notification_event_id: eventId, created_at: createdAt, status, channel,
  provider_response: status === "sent" ? { success: 1, failed: 0, invalidTokenCount: 0 } : null,
});
const event = (id: string, userId = recipient) => ({
  id, recipient_user_id: userId, type: "forecast_alert", entity_type: "beach",
  entity_id: "beach", created_at: start, status: "processed",
});
const userEvent = (id: string, userId: string, eventType: string, createdAt: string, metadata: Record<string, unknown> = {}) => ({
  id, user_id: userId, event_type: eventType, created_at: createdAt, metadata,
});
const input = (): PushTelemetryInput => ({
  window: { start, end, startDate: "2026-01-01", endDate: "2026-01-02", timeZone: "UTC" },
  asOf: "2026-01-03T00:00:00.000Z", openHorizonHours: 24, decisionHorizonMinutes: 60,
  attempts: [], allChannelAttempts: [], notificationEvents: [], devices: [], userEvents: [],
  orphanCandidateOpens: [], knownPushAttemptIds: new Set(), alertDeliveryAttempts: [],
  exclusions: new Map(), deliveryTargetRows: [],
});

describe("push telemetry v1", () => {
  it("resolves deferred then sent once and excludes a first attempt outside the window", () => {
    const data = input();
    data.attempts = [
      attempt("a", "m1", start, "deferred_quiet_hours"),
      attempt("b", "m1", "2026-01-02T02:00:00.000Z", "sent"),
      attempt("c", "m2", "2025-12-31T23:00:00.000Z", "deferred_quiet_hours"),
      attempt("d", "m2", start, "sent"),
    ];
    data.notificationEvents = [event("m1"), event("m2")];
    data.exclusions = new Map([[recipient, null]]);
    expect(finalPushOutcome(data.attempts.slice(0, 2)).outcome).toBe("provider_accepted");
    expect(buildPushTelemetryReport(data).stages).toMatchObject({
      messages: 1, attempted: 1, providerAccepted: 1,
      finalOutcome: { provider_accepted: 1, deferred_unresolved: 0 },
    });
  });

  it("keeps a wrong-user tap out, and removes immature messages from the open denominator", () => {
    const data = input();
    data.asOf = "2026-01-02T01:00:00.000Z";
    data.attempts = [attempt("a", "m1", "2026-01-01T12:00:00.000Z", "sent"),
      attempt("b", "m2", "2026-01-01T23:00:00.000Z", "sent")];
    data.notificationEvents = [event("m1"), event("m2")];
    data.exclusions = new Map([[recipient, null]]);
    data.userEvents = [userEvent("open", "wrong-user", "native_open_from_push", "2026-01-01T13:00:00.000Z", { notification_event_id: "m1" })];
    expect(matchPushOpen(data.userEvents, { messageId: "m1", recipientId: recipient, from: "2026-01-01T12:00:00.000Z", horizonHours: 24 })).toBeNull();
    expect(buildPushTelemetryReport(data).stages).toMatchObject({
      openUserMismatch: 1, opened: { numerator: 0, denominator: 0, rate: null }, immatureForOpen: 2,
    });
  });

  it("classifies historical device activity and signal order", () => {
    const devices = [
      { user_id: recipient, platform: "ios", device_token: "i", installation_id: null, created_at: start, updated_at: start, retired_at: null, retired_reason: null },
      { user_id: recipient, platform: "android", device_token: "a", installation_id: null, created_at: start, updated_at: start, retired_at: "2026-01-01T12:00:00.000Z", retired_reason: "logout" },
    ];
    expect(platformSetAt(devices, "2026-01-01T06:00:00.000Z")).toBe("mixed");
    expect(platformSetAt(devices, "2026-01-01T12:00:00.000Z")).toBe("ios_only");
    expect(platformSetAt(devices, "2025-12-31T23:00:00.000Z")).toBe("none_active");
    const signals = [
      userEvent("a", recipient, "push_device_registered", "2026-01-01T01:00:00.000Z"),
      userEvent("b", recipient, "push_permission_denied", "2026-01-01T02:00:00.000Z"),
    ];
    expect(permissionEvidenceAt(signals, "2026-01-01T03:00:00.000Z")).toBe("last_signal_denied");
    expect(permissionEvidenceAt(signals, "2026-01-01T02:00:00.000Z")).toBe("last_signal_registered");
  });

  it("joins an exact tap, a later decision, server stages, and an orphan without inventing a receipt", () => {
    const data = input();
    data.attempts = [{ ...attempt("a", "m1", start, "sent"), provider_response: { success: 2, failed: 1, invalidTokens: ["bad"] } }];
    data.allChannelAttempts = data.attempts;
    data.notificationEvents = [event("m1")];
    data.exclusions = new Map([[recipient, null]]);
    data.userEvents = [
      userEvent("tap", recipient, "native_open_from_push", "2026-01-01T00:10:00.000Z", { notification_event_id: "m1", _platform: "native-android" }),
      userEvent("decision", recipient, "decision_loop_completed", "2026-01-01T00:20:00.000Z"),
      userEvent("server", recipient, "alert_decision_action", "2026-01-01T00:30:00.000Z", { message_instance_id: "m1", delivery_channel: "push", action: "watch_call" }),
    ];
    data.orphanCandidateOpens = [
      userEvent("orphan", recipient, "native_open_from_push", "2026-01-01T01:00:00.000Z", { notification_event_id: "unknown", notification_type: "watched_call_update" }),
    ];
    data.knownPushAttemptIds = new Set(["m1"]);
    const report = buildPushTelemetryReport(data);
    expect(report.schemaVersion).toBe(PUSH_TELEMETRY_SCHEMA_VERSION);
    expect(report.stages).toMatchObject({
      tokenOutcomes: { success: 2, failed: 1, invalidTokenCount: 1 },
      opened: { numerator: 1, denominator: 1, rate: 1 },
      pushDrivenAppReturn: { numerator: 1, denominator: 1, rate: 1 },
      decisionAfterOpen: { numerator: 1, denominator: 1, rate: 1 },
      serverStages: { alert_decision_action: 1 },
    });
    expect(report.breakdowns.platformSet.none_active.opened.numerator).toBe(1);
    expect(report.breakdowns.permissionEvidence.no_signal_within_ttl.messages).toBe(1);
    expect(report.opensByPlatform).toEqual({ "native-android": 1 });
    expect(report.orphanOpens).toEqual({ count: 1, byNotificationType: { watched_call_update: 1 } });
    expect(report.deviceReceipt.captured).toBe(false);
  });

  it("counts internal recipient in excluded and separates legacy ledgers", () => {
    const data = input();
    data.attempts = [attempt("a", "m1", start, "sent"), attempt("b", "internal", start, "sent"), attempt("d", "m2", start, "sent")];
    data.allChannelAttempts = [...data.attempts, attempt("c", "m1", start, "sent", "in_app")];
    data.notificationEvents = [event("m1"), event("m2"), event("internal", excludedId), event("other")];
    data.alertDeliveryAttempts = [{ id: "legacy", user_id: recipient, channel: "push", status: "sent", attempted_at: start, message_instance_id: "other" }];
    data.exclusions = new Map([[recipient, null], [excludedId, profileExclusionReason(undefined, excludedId)]]);
    const report = buildPushTelemetryReport(data);
    expect(report.excluded).toEqual({ internal_account: 1 });
    expect(report.legacy.allChannelAttemptRows).toMatchObject({ push: { sent: 3 }, in_app: { sent: 1 } });
    expect(report.legacy.sentPushEventIds).toBe(2);
    expect(report.legacy.alertLedgerSentPushMessageInstances).toEqual({ count: 1, inNotificationEvents: 1 });
  });
});
