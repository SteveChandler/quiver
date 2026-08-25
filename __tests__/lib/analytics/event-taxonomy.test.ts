import {
  ANONYMOUS_ALLOWED_EVENTS,
  BFR_FALLBACK_CLASSIFICATIONS,
  BFR_EXACT_CALL_HANDOFF_EVENTS,
  BFR_HANDOFF_CONTEXTS,
  BFR_HANDOFF_RESOLUTION_REASONS,
  BFR_INTENT_REASONS,
  BFR_INTENT_STATES,
  BFR_WEB_AUDIENCE_CLASSES,
  BFR_WEB_EXPERIMENT_ARMS,
  BFR_WEB_EXPERIMENT_KEY,
  BFR_PAGE_TYPES,
  BFR_TOPICS,
  EXTERNAL_ANALYTICS_ONLY_EVENTS,
  PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS,
  buildBfrWebEventMetadata,
  type BfrWebEventMetadataMap,
  type EventType,
} from "@/lib/analytics/event-taxonomy";
import { FollowTopic } from "@/types/beach-follow";
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
  it("exposes only bounded BFR property vocabularies", () => {
    expect(BFR_INTENT_STATES).toEqual(["explicit", "inferred", "unknown"]);
    expect(BFR_WEB_AUDIENCE_CLASSES).toEqual([
      "general_utility",
      "surf_qualified",
      "existing_web_user",
    ]);
    expect(BFR_WEB_EXPERIMENT_KEY).toBe("bfr-follow-holdout-v1");
    expect(BFR_WEB_EXPERIMENT_ARMS).toEqual(["holdout", "treatment"]);
    expect(BFR_INTENT_REASONS).toEqual([
      "explicit_surfing",
      "explicit_non_surf",
      "high_intent_action",
      "multiple_surf_signals",
      "insufficient_surf_signals",
      "utility_only",
      "no_evidence",
    ]);
    expect(BFR_TOPICS).toEqual(Object.values(FollowTopic));
    expect(BFR_TOPICS).toEqual([
      "surf",
      "water_temp",
      "tide",
      "water_quality",
      "wind",
      "general",
    ]);
    expect(BFR_PAGE_TYPES).toEqual([
      "beach_detail",
      "beach_water_temp",
      "city_water_temp",
      "my_coast",
      "other",
    ]);
    expect(BFR_FALLBACK_CLASSIFICATIONS).toEqual([
      "exact",
      "replaced",
      "beach_only",
      "invalid",
    ]);
    expect(BFR_HANDOFF_RESOLUTION_REASONS).toEqual([
      "window_replaced",
      "expired",
      "window_removed",
      "malformed",
      "unsupported_version",
      "beach_removed",
    ]);
    expect(BFR_HANDOFF_CONTEXTS).toEqual(["exact_call"]);
    expect(BFR_EXACT_CALL_HANDOFF_EVENTS).toEqual({
      started: "app_handoff_link_opened",
      nativeOpened: "app_handoff_native_open",
      resolved: "watched_call_context_resolved",
    });
    expect(new Set(Object.values(BFR_EXACT_CALL_HANDOFF_EVENTS)).size).toBe(3);
    expect(JSON.stringify({
      BFR_INTENT_STATES,
      BFR_INTENT_REASONS,
      BFR_WEB_AUDIENCE_CLASSES,
      BFR_WEB_EXPERIMENT_KEY,
      BFR_WEB_EXPERIMENT_ARMS,
      BFR_TOPICS,
      BFR_PAGE_TYPES,
      BFR_FALLBACK_CLASSIFICATIONS,
      BFR_HANDOFF_RESOLUTION_REASONS,
      BFR_HANDOFF_CONTEXTS,
      BFR_EXACT_CALL_HANDOFF_EVENTS,
    })).not.toMatch(/email|search|query|lat|lon|coordinate|notes|token/i);
  });

  it("limits visitor_intent_selected to explicit user choices", () => {
    const invalidMetadata = {
      audience_class: "surf_qualified",
      page_type: "beach_detail",
      experiment_key: "bfr-follow-holdout-v1",
      experiment_arm: "treatment",
      intent_state: "inferred",
      intent_reason: "high_intent_action",
    } as const;

    expect(buildBfrWebEventMetadata(
      invalidMetadata as never,
      "visitor_intent_selected",
    )).toBeNull();

    const impossibleType: BfrWebEventMetadataMap["visitor_intent_selected"] = {
      ...invalidMetadata,
      // @ts-expect-error selection events require explicit intent state
      intent_state: "inferred",
    };
    expect(impossibleType.intent_state).toBe("inferred");
  });

  it("allows app handoff funnel events for anonymous and signed-in users", () => {
    for (const event of appHandoffEvents) {
      expect(VALID_EVENTS).toContain(event);
      expect(ANONYMOUS_ALLOWED_EVENTS).toContain(event);
      expect(PRE_AUTH_ONLY_EVENTS).not.toContain(event);
      expect(EXTERNAL_ANALYTICS_ONLY_EVENTS).not.toContain(event);
      expect(EVENT_WEIGHTS[event]).toBe(0);
    }
  });

  it("allows the bounded watched-call resolution event for anonymous and signed-in users", () => {
    const event = BFR_EXACT_CALL_HANDOFF_EVENTS.resolved;

    expect(VALID_EVENTS).toContain(event);
    expect(ANONYMOUS_ALLOWED_EVENTS).toContain(event);
    expect(PRE_AUTH_ONLY_EVENTS).not.toContain(event);
    expect(EVENT_WEIGHTS[event]).toBe(0);
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
