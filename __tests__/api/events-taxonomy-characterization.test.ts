/**
 * @jest-environment node
 *
 * Characterization tests for the current /api/events taxonomy.
 * These tests intentionally freeze the current event sets before the
 * event-taxonomy refactor moves constants into a shared registry.
 */

import { createHash } from "node:crypto";

import {
  ANONYMOUS_ALLOWED_EVENTS,
  PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS,
} from "@/app/api/events/route";
import {
  ANONYMOUS_ALLOWED_EVENTS as REGISTRY_ANONYMOUS_ALLOWED_EVENTS,
  BFR_ANONYMOUS_EVENT_TYPES,
  BFR_WEB_EVENT_TYPES,
  NATIVE_DIRECT_INSERT_EVENTS,
  PRE_AUTH_ONLY_EVENTS as REGISTRY_PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS as REGISTRY_VALID_EVENTS,
} from "@/lib/analytics/event-taxonomy";
import { EVENT_WEIGHTS } from "@/types/implicit-preferences";

const PRE_F28_EVENT_SET_HASHES = {
  valid: "8467b024faec9153133f45a4ef731dd1eed06e4e3d69f9e8e448787e06e4fac0",
  anonymousAllowed:
    "557074b0e225c9c9d73bd1b356f5ef830b0c85d8a5bd8f994b451773bf36421a",
  preAuthOnly:
    "5dd180d5cf7456630a1696e77eee57970eb8c527e925e4714f39707518fca92a",
} as const;

const PHASE_20_MEASUREMENT_EVENTS = [
  "surf_window_impression",
  "surf_window_click",
  "why_this_call_opened",
  "app_deeplink_clicked",
  "forecast_accuracy_table_viewed",
  "save_alert_clicked",
  "seo_intent_page_window_clicked",
] as const;

const SESSION_CUSTOM_SPOT_EVENTS = [
  "session_spot_search_no_results",
  "session_custom_spot_cta_tapped",
  "session_custom_spot_returned",
] as const;

const DISCOVER_USER_EVENTS = [
  "discover_page_view",
  "discover_suggested_users_impression",
  "discover_profile_open",
  "discover_follow_attempt",
] as const;

const HISTORICAL_SESSION_EVENTS = [
  "session_log_rating_set",
  "session_prefill_shown",
  "session_log_submit",
] as const;

const BFR_NATIVE_EVENTS = [
  "watched_call_exposed",
  "watched_call_created",
  "watched_call_already_exists",
  "watched_call_update_eligible",
  "watched_call_update_suppressed",
  "watched_call_update_delivered",
  "watched_call_update_opened",
  "watched_call_manual_reopened",
  "watched_call_context_resolved",
  "home_mode_restored",
  "home_mode_expired",
  "home_recommendation_changed",
] as const;
const BFR_ANONYMOUS_RESOLUTION_EVENT = "watched_call_context_resolved";

function sortedEventSetHash(eventTypes: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([...eventTypes].sort()))
    .digest("hex");
}

function duplicateEventTypes(eventTypes: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const eventType of eventTypes) {
    if (seen.has(eventType)) {
      duplicates.add(eventType);
      continue;
    }

    seen.add(eventType);
  }

  return [...duplicates].sort();
}

describe("events taxonomy characterization", () => {
  it("pins the current event registry sets", () => {
    expect(sortedEventSetHash(
      VALID_EVENTS.filter(eventType => eventType !== BFR_ANONYMOUS_RESOLUTION_EVENT)
    )).toBe(PRE_F28_EVENT_SET_HASHES.valid);
    expect(sortedEventSetHash(
      ANONYMOUS_ALLOWED_EVENTS.filter(
        eventType => eventType !== BFR_ANONYMOUS_RESOLUTION_EVENT
      )
    )).toBe(
      PRE_F28_EVENT_SET_HASHES.anonymousAllowed
    );
    expect(sortedEventSetHash(PRE_AUTH_ONLY_EVENTS)).toBe(
      PRE_F28_EVENT_SET_HASHES.preAuthOnly
    );
  });

  it("keeps event group membership internally consistent", () => {
    const validEvents = new Set(VALID_EVENTS);
    const anonymousEventsOutsideValid = ANONYMOUS_ALLOWED_EVENTS.filter(
      (eventType) => !validEvents.has(eventType)
    );
    const preAuthEventsOutsideValid = PRE_AUTH_ONLY_EVENTS.filter(
      (eventType) => !validEvents.has(eventType)
    );
    const anonymousEvents = new Set(ANONYMOUS_ALLOWED_EVENTS);
    const preAuthEventsOutsideAnonymous = PRE_AUTH_ONLY_EVENTS.filter(
      (eventType) => !anonymousEvents.has(eventType)
    );

    expect(duplicateEventTypes(VALID_EVENTS)).toEqual([]);
    expect(duplicateEventTypes(ANONYMOUS_ALLOWED_EVENTS)).toEqual([]);
    expect(duplicateEventTypes(PRE_AUTH_ONLY_EVENTS)).toEqual([]);
    expect(anonymousEventsOutsideValid).toEqual([]);
    expect(preAuthEventsOutsideValid).toEqual([]);
    expect(preAuthEventsOutsideAnonymous).toEqual([]);
  });

  it("keeps preference weights aligned with accepted event types", () => {
    expect(Object.keys(EVENT_WEIGHTS).sort()).toEqual([...VALID_EVENTS].sort());
  });

  it("accepts Phase 20 public measurement events without making them pre-auth-only", () => {
    expect(VALID_EVENTS).toEqual(
      expect.arrayContaining([...PHASE_20_MEASUREMENT_EVENTS])
    );
    expect(ANONYMOUS_ALLOWED_EVENTS).toEqual(
      expect.arrayContaining([...PHASE_20_MEASUREMENT_EVENTS])
    );
    expect(PRE_AUTH_ONLY_EVENTS).toEqual(
      expect.not.arrayContaining([...PHASE_20_MEASUREMENT_EVENTS])
    );

    for (const eventType of PHASE_20_MEASUREMENT_EVENTS) {
      expect(EVENT_WEIGHTS[eventType]).toBe(0);
    }
  });

  it("accepts native session custom spot funnel events without preference scoring", () => {
    expect(VALID_EVENTS).toEqual(
      expect.arrayContaining([...SESSION_CUSTOM_SPOT_EVENTS])
    );
    expect(ANONYMOUS_ALLOWED_EVENTS).toEqual(
      expect.not.arrayContaining([...SESSION_CUSTOM_SPOT_EVENTS])
    );
    expect(PRE_AUTH_ONLY_EVENTS).toEqual(
      expect.not.arrayContaining([...SESSION_CUSTOM_SPOT_EVENTS])
    );

    for (const eventType of SESSION_CUSTOM_SPOT_EVENTS) {
      expect(EVENT_WEIGHTS[eventType]).toBe(0);
    }
  });

  it("accepts authenticated discover user events without anonymous or preference scoring", () => {
    expect(VALID_EVENTS).toEqual(expect.arrayContaining([...DISCOVER_USER_EVENTS]));
    expect(ANONYMOUS_ALLOWED_EVENTS).toEqual(
      expect.not.arrayContaining([...DISCOVER_USER_EVENTS])
    );
    expect(PRE_AUTH_ONLY_EVENTS).toEqual(
      expect.not.arrayContaining([...DISCOVER_USER_EVENTS])
    );

    for (const eventType of DISCOVER_USER_EVENTS) {
      expect(EVENT_WEIGHTS[eventType]).toBe(0);
    }
  });

  it("wires the API route exports to the shared registry arrays", () => {
    expect(VALID_EVENTS).toBe(REGISTRY_VALID_EVENTS);
    expect(ANONYMOUS_ALLOWED_EVENTS).toBe(REGISTRY_ANONYMOUS_ALLOWED_EVENTS);
    expect(PRE_AUTH_ONLY_EVENTS).toBe(REGISTRY_PRE_AUTH_ONLY_EVENTS);
  });

  it("registers the public BFR family with explicit anonymous membership", () => {
    expect(VALID_EVENTS).toEqual(expect.arrayContaining([...BFR_WEB_EVENT_TYPES]));
    expect(ANONYMOUS_ALLOWED_EVENTS).toEqual(
      expect.arrayContaining([...BFR_ANONYMOUS_EVENT_TYPES])
    );
    expect(PRE_AUTH_ONLY_EVENTS).toEqual(
      expect.not.arrayContaining([...BFR_WEB_EVENT_TYPES])
    );
  });

  it("keeps native BFR events direct-insert-only except anonymous resolution", () => {
    const directOnlyEvents = BFR_NATIVE_EVENTS.filter(
      (eventType) => eventType !== BFR_ANONYMOUS_RESOLUTION_EVENT
    );

    expect(NATIVE_DIRECT_INSERT_EVENTS).toEqual(
      expect.arrayContaining(directOnlyEvents)
    );
    expect(NATIVE_DIRECT_INSERT_EVENTS).not.toContain(
      BFR_ANONYMOUS_RESOLUTION_EVENT
    );
    expect(VALID_EVENTS).toContain(BFR_ANONYMOUS_RESOLUTION_EVENT);
    expect(ANONYMOUS_ALLOWED_EVENTS).toContain(
      BFR_ANONYMOUS_RESOLUTION_EVENT
    );
    expect(VALID_EVENTS).toEqual(expect.not.arrayContaining(directOnlyEvents));
  });

  it("keeps historical session events registered under their existing names", () => {
    for (const eventType of HISTORICAL_SESSION_EVENTS) {
      expect([...VALID_EVENTS, ...NATIVE_DIRECT_INSERT_EVENTS]).toContain(eventType);
    }
    expect(BFR_WEB_EVENT_TYPES).toEqual(
      expect.not.arrayContaining([...HISTORICAL_SESSION_EVENTS])
    );
    expect(VALID_EVENTS).not.toContain("home_quick_log_tapped");
  });
});
