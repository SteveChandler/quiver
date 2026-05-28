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
  valid: "5835e0bb44a06917e232c13ee8868890d355edc0d5e750a3d8f57be77302c16f",
  anonymousAllowed:
    "42d47b00b43837466f479edfad4278583ef87d9cac9a12166839a4fbb2a73030",
  preAuthOnly:
    "f55c47e91fb773e725b6ef914a93099aeb5e963f3f7d88cc34bf4a0023e99367",
} as const;

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

  it("wires the API route exports to the shared registry arrays", () => {
    expect(VALID_EVENTS).toBe(REGISTRY_VALID_EVENTS);
    expect(ANONYMOUS_ALLOWED_EVENTS).toBe(REGISTRY_ANONYMOUS_ALLOWED_EVENTS);
    expect(PRE_AUTH_ONLY_EVENTS).toBe(REGISTRY_PRE_AUTH_ONLY_EVENTS);
  });
});
