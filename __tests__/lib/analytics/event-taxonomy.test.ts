import {
  ANONYMOUS_ALLOWED_EVENTS,
  EXTERNAL_ANALYTICS_ONLY_EVENTS,
  PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS,
  type EventType,
} from "@/lib/analytics/event-taxonomy";
import { EVENT_WEIGHTS } from "@/types/implicit-preferences";

const appHandoffEvents = [
  "app_handoff_view",
  "app_handoff_qr_rendered",
  "app_handoff_email_submit",
  "app_handoff_email_sent",
  "app_handoff_email_failed",
  "app_handoff_link_opened",
  "app_handoff_native_open",
] as const satisfies readonly EventType[];

const acquisitionSourceSelfReportedEvent =
  "acquisition_source_self_reported" as const satisfies EventType;
const appleOrphanPrecheckEvents = [
  "apple_orphan_precheck_indeterminate",
  "apple_orphan_prevented",
] as const satisfies readonly EventType[];
const appleOrphanRecoveryFlaggedEvent =
  "apple_orphan_recovery_flagged" as const satisfies EventType;

describe("event taxonomy", () => {
  it("allows app handoff funnel events for anonymous and signed-in users", () => {
    for (const event of appHandoffEvents) {
      expect(VALID_EVENTS).toContain(event);
      expect(ANONYMOUS_ALLOWED_EVENTS).toContain(event);
      expect(PRE_AUTH_ONLY_EVENTS).not.toContain(event);
      expect(EXTERNAL_ANALYTICS_ONLY_EVENTS).not.toContain(event);
      expect(EVENT_WEIGHTS[event]).toBe(0);
    }
  });

  it("keeps acquisition self-report authenticated-only and zero-weight", () => {
    expect(VALID_EVENTS).toContain(acquisitionSourceSelfReportedEvent);
    expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(
      acquisitionSourceSelfReportedEvent
    );
    expect(PRE_AUTH_ONLY_EVENTS).not.toContain(
      acquisitionSourceSelfReportedEvent
    );
    expect(EXTERNAL_ANALYTICS_ONLY_EVENTS).not.toContain(
      acquisitionSourceSelfReportedEvent
    );
    expect(EVENT_WEIGHTS[acquisitionSourceSelfReportedEvent]).toBe(0);
  });
  it("keeps Apple orphan recovery flags authenticated-only and zero-weight", () => {
    expect(VALID_EVENTS).toContain(appleOrphanRecoveryFlaggedEvent);
    expect(ANONYMOUS_ALLOWED_EVENTS).not.toContain(
      appleOrphanRecoveryFlaggedEvent,
    );
    expect(PRE_AUTH_ONLY_EVENTS).not.toContain(
      appleOrphanRecoveryFlaggedEvent,
    );
    expect(EXTERNAL_ANALYTICS_ONLY_EVENTS).not.toContain(
      appleOrphanRecoveryFlaggedEvent,
    );
    expect(EVENT_WEIGHTS[appleOrphanRecoveryFlaggedEvent]).toBe(0);
  });

  it("keeps Apple orphan precheck outcomes anonymous, pre-auth-only, and zero-weight", () => {
    for (const event of appleOrphanPrecheckEvents) {
      expect(VALID_EVENTS).toContain(event);
      expect(ANONYMOUS_ALLOWED_EVENTS).toContain(event);
      expect(PRE_AUTH_ONLY_EVENTS).toContain(event);
      expect(EXTERNAL_ANALYTICS_ONLY_EVENTS).not.toContain(event);
      expect(EVENT_WEIGHTS[event]).toBe(0);
    }
  });
});
