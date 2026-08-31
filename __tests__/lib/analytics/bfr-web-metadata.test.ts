import {
  BFR_WEB_EVENT_TYPES,
  buildBfrWebEventMetadata,
  type BfrWebEventMetadataMap,
  type BfrWebEventType,
} from "@/lib/analytics/event-taxonomy";
import { FollowTopic } from "@/types/beach-follow";

const EXPERIMENT = {
  experiment_key: "bfr-follow-holdout-v1",
  experiment_arm: "treatment",
} as const;

const VALID_METADATA = {
  beach_follow_started: {
    audience_class: "general_utility",
    page_type: "beach_water_temp",
    topic: FollowTopic.WaterTemp,
    ...EXPERIMENT,
  },
  beach_follow_saved_local: {
    audience_class: "general_utility",
    page_type: "beach_water_temp",
    topic: FollowTopic.WaterTemp,
    ...EXPERIMENT,
  },
  beach_follow_sync_started: {
    audience_class: "existing_web_user",
    page_type: "my_coast",
    ...EXPERIMENT,
  },
  beach_follow_sync_completed: {
    audience_class: "existing_web_user",
    page_type: "my_coast",
    ...EXPERIMENT,
  },
  follow_topic_changed: {
    audience_class: "existing_web_user",
    page_type: "my_coast",
    topic: FollowTopic.Tide,
    ...EXPERIMENT,
  },
  visitor_intent_selected: {
    audience_class: "general_utility",
    page_type: "beach_detail",
    intent_state: "explicit",
    intent_reason: "explicit_non_surf",
    ...EXPERIMENT,
  },
  surf_intent_qualified: {
    audience_class: "surf_qualified",
    page_type: "beach_detail",
    intent_state: "explicit",
    intent_reason: "explicit_surfing",
    ...EXPERIMENT,
  },
  my_coast_viewed: {
    audience_class: "surf_qualified",
    page_type: "my_coast",
    intent_state: "inferred",
    intent_reason: "high_intent_action",
    ...EXPERIMENT,
  },
  my_coast_beach_opened: {
    audience_class: "surf_qualified",
    page_type: "my_coast",
    intent_state: "inferred",
    intent_reason: "multiple_surf_signals",
    topic: FollowTopic.Surf,
    ...EXPERIMENT,
  },
} as const satisfies {
  [EventType in BfrWebEventType]: BfrWebEventMetadataMap[EventType];
};

const INVALID_METADATA: Record<BfrWebEventType, object> = {
  beach_follow_started: {
    ...VALID_METADATA.beach_follow_started,
    topic: "secret-break",
  },
  beach_follow_saved_local: {
    ...VALID_METADATA.beach_follow_saved_local,
    page_type: "profile",
  },
  beach_follow_sync_started: {
    ...VALID_METADATA.beach_follow_sync_started,
    audience_class: "general_utility",
  },
  beach_follow_sync_completed: {
    ...VALID_METADATA.beach_follow_sync_completed,
    experiment_arm: "variant-c",
  },
  follow_topic_changed: {
    ...VALID_METADATA.follow_topic_changed,
    topic: "surfer@example.com",
  },
  visitor_intent_selected: {
    ...VALID_METADATA.visitor_intent_selected,
    intent_reason: "high_intent_action",
  },
  surf_intent_qualified: {
    ...VALID_METADATA.surf_intent_qualified,
    intent_state: "unknown",
    intent_reason: "no_evidence",
  },
  my_coast_viewed: {
    ...VALID_METADATA.my_coast_viewed,
    page_type: "beach_detail",
  },
  my_coast_beach_opened: {
    ...VALID_METADATA.my_coast_beach_opened,
    topic: "Bearer secret-token",
  },
};

describe("BFR web event metadata contract", () => {
  it("accepts one complete bounded shape for every BFR web event", () => {
    expect(Object.keys(VALID_METADATA)).toEqual([...BFR_WEB_EVENT_TYPES]);

    for (const eventType of BFR_WEB_EVENT_TYPES) {
      expect(buildBfrWebEventMetadata(
        VALID_METADATA[eventType] as never,
        eventType,
      ))
        .toEqual(VALID_METADATA[eventType]);
    }
  });

  it("rejects one invalid event-specific shape for every BFR web event", () => {
    for (const eventType of BFR_WEB_EVENT_TYPES) {
      expect(buildBfrWebEventMetadata(
        INVALID_METADATA[eventType] as never,
        eventType,
      )).toBeNull();
    }
  });

  it.each(BFR_WEB_EVENT_TYPES)("rejects arbitrary keys for %s", (eventType) => {
    expect(buildBfrWebEventMetadata({
      ...VALID_METADATA[eventType],
      arbitrary_key: "unreviewed",
    } as never, eventType)).toBeNull();
  });

  it.each([
    ["email", "surfer@example.com"],
    ["handoff_token", "secret-token"],
    ["lat", 32.1],
    ["coordinates", "32.1,-117.2"],
  ] as const)("rejects forbidden %s metadata", (key, value) => {
    expect(buildBfrWebEventMetadata({
      ...VALID_METADATA.visitor_intent_selected,
      [key]: value,
    } as never, "visitor_intent_selected")).toBeNull();
  });
});
