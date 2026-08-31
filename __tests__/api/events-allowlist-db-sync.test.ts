import fs from "node:fs";
import path from "node:path";
import { VALID_EVENTS } from "@/app/api/events/route";
import {
  KNOWN_REJECTED_USER_EVENT_EMITTERS,
  NATIVE_DIRECT_INSERT_EVENTS,
  OWNERSHIP_GATED_USER_EVENTS,
} from "@/lib/analytics/event-taxonomy";

const ACQUISITION_SOURCE_SELF_REPORTED_EVENT =
  "acquisition_source_self_reported";

/**
 * Parses user_events_event_type_check migrations and extracts event names from
 * both full static CHECK arrays and additive dynamic migrations that preserve
 * the current CHECK before OR-ing in new event names.
 */
function userEventsCheckMigrationEventTypes(): Set<string> {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".sql"))
    .sort(); // timestamps sort lexicographically
  const dbAllowed = new Set<string>();
  let found = false;

  for (const file of files) {
    const contentWithComments = fs.readFileSync(path.join(dir, file), "utf8");
    if (!contentWithComments.includes("user_events_event_type_check")) continue;

    const content = contentWithComments.replace(/--.*$/gm, "");
    const names = new Set<string>();

    for (const arrayMatch of content.matchAll(/ARRAY\s*\[([\s\S]*?)\]/g)) {
      for (const name of arrayMatch[1].matchAll(/'([^']+)'(?:::text)?/g)) {
        if (/^[a-z][a-z0-9_]+$/.test(name[1])) {
          names.add(name[1]);
        }
      }
    }

    for (const formatMatch of content.matchAll(/EXECUTE\s+format\(([\s\S]*?)\);/g)) {
      for (const name of formatMatch[1].matchAll(/'([a-z][a-z0-9_]+)'/g)) {
        if (/^[a-z][a-z0-9_]+$/.test(name[1])) {
          names.add(name[1]);
        }
      }
    }

    if (names.size === 0) continue;

    found = true;
    const appendsExistingCheck =
      content.includes("pg_get_constraintdef") || content.includes("current_check");
    if (!appendsExistingCheck) {
      dbAllowed.clear();
    }

    for (const name of names) {
      dbAllowed.add(name);
    }
  }

  if (!found) {
    throw new Error("No user_events_event_type_check migration found");
  }

  return dbAllowed;
}

describe("user_events allowlist / DB CHECK sync", () => {
  it("every VALID_EVENTS entry is present in a CHECK migration", () => {
    const dbAllowed = userEventsCheckMigrationEventTypes();
    const missing = VALID_EVENTS.filter(e => !dbAllowed.has(e));
    expect(missing).toEqual([]);
  });

  it("keeps DB CHECK additions accepted by the API route or explicitly documented", () => {
    const validEvents = new Set<string>(VALID_EVENTS);
    const documentedRejectedEvents = new Set<string>(KNOWN_REJECTED_USER_EVENT_EMITTERS);
    // Native emitters insert straight into user_events and never transit
    // /api/events, so they belong in the CHECK without widening VALID_EVENTS.
    // Declaring them is still mandatory — an undeclared CHECK entry fails here.
    const nativeDirectInsertEvents = new Set<string>(NATIVE_DIRECT_INSERT_EVENTS);
    const ownershipGatedEvents = new Set<string>(OWNERSHIP_GATED_USER_EVENTS);
    const dbOnlyEvents = [...userEventsCheckMigrationEventTypes()]
      .filter(
        e =>
          !validEvents.has(e) &&
          !documentedRejectedEvents.has(e) &&
          !nativeDirectInsertEvents.has(e) &&
          !ownershipGatedEvents.has(e)
      )
      .sort();

    expect(dbOnlyEvents).toEqual([]);
  });

  it("keeps acquisition self-report synchronized across the API and DB CHECK", () => {
    expect(VALID_EVENTS).toContain(ACQUISITION_SOURCE_SELF_REPORTED_EVENT);
    expect(userEventsCheckMigrationEventTypes()).toContain(
      ACQUISITION_SOURCE_SELF_REPORTED_EVENT
    );
  });
});
