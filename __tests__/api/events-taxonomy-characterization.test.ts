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
  PRE_AUTH_ONLY_EVENTS as REGISTRY_PRE_AUTH_ONLY_EVENTS,
  VALID_EVENTS as REGISTRY_VALID_EVENTS,
} from "@/lib/analytics/event-taxonomy";
import { EVENT_WEIGHTS } from "@/types/implicit-preferences";

const CURRENT_EVENT_SET_HASHES = {
  valid: "76f90019ca44981b9817d29ad08338c3921b3591edf4681093ab37d3b1e6167c",
  anonymousAllowed:
    "ffa8bf877cdca97526bc1ee26b6e5705e9c168a6088e70fd8bdb3d8c81aec2a9",
  preAuthOnly:
    "3a16cb4ecd871469db54bad8b25b440242a07c04e21f66bc69a70abfe5ae6e08",
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
  it("keeps the current event sets unchanged before registry extraction", () => {
    expect(sortedEventSetHash(VALID_EVENTS)).toBe(CURRENT_EVENT_SET_HASHES.valid);
    expect(sortedEventSetHash(ANONYMOUS_ALLOWED_EVENTS)).toBe(
      CURRENT_EVENT_SET_HASHES.anonymousAllowed
    );
    expect(sortedEventSetHash(PRE_AUTH_ONLY_EVENTS)).toBe(
      CURRENT_EVENT_SET_HASHES.preAuthOnly
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

  it("wires the API route exports to the shared registry arrays", () => {
    expect(VALID_EVENTS).toBe(REGISTRY_VALID_EVENTS);
    expect(ANONYMOUS_ALLOWED_EVENTS).toBe(REGISTRY_ANONYMOUS_ALLOWED_EVENTS);
    expect(PRE_AUTH_ONLY_EVENTS).toBe(REGISTRY_PRE_AUTH_ONLY_EVENTS);
  });
});
