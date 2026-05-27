import fs from "node:fs";
import path from "node:path";
import { VALID_EVENTS } from "@/app/api/events/route";

/**
 * Parses the most recent user_events_event_type_check migration file and
 * extracts the ARRAY literal. Compares it to the code-level VALID_EVENTS
 * export. Any code-level event name not in the latest migration's ARRAY
 * will 500 at insert time — this test catches that drift in CI.
 */
function latestCheckMigrationEventTypes(): Set<string> {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".sql"))
    .sort(); // timestamps sort lexicographically

  const dbAllowed = new Set<string>();
  let found = false;

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    if (!content.includes("user_events_event_type_check")) continue;

    const names = [
      ...content.matchAll(/ARRAY\s*\[([\s\S]*?)\]/g),
    ].flatMap(([, arrayBody]) =>
      [...arrayBody.matchAll(/'([^']+)'::text/g)].map(m => m[1]),
    );

    for (const [, name] of content.matchAll(/'([a-z][a-z0-9_]+)'/g)) {
      names.push(name);
    }

    if (names.length === 0) continue;

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
  it("every VALID_EVENTS entry is present in the latest CHECK migration", () => {
    const dbAllowed = latestCheckMigrationEventTypes();
    const missing = VALID_EVENTS.filter(e => !dbAllowed.has(e));
    expect(missing).toEqual([]);
  });
});
