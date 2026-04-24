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

  for (let i = files.length - 1; i >= 0; i--) {
    const content = fs.readFileSync(path.join(dir, files[i]), "utf8");
    if (!content.includes("user_events_event_type_check")) continue;

    const arrayMatch = content.match(/CHECK\s*\(\s*event_type\s*=\s*ANY\s*\(\s*ARRAY\s*\[([\s\S]*?)\]\s*\)\s*\)/);
    if (!arrayMatch) continue;

    const names = [...arrayMatch[1].matchAll(/'([^']+)'::text/g)].map(m => m[1]);
    return new Set(names);
  }
  throw new Error("No user_events_event_type_check migration found");
}

describe("user_events allowlist / DB CHECK sync", () => {
  it("every VALID_EVENTS entry is present in the latest CHECK migration", () => {
    const dbAllowed = latestCheckMigrationEventTypes();
    const missing = VALID_EVENTS.filter(e => !dbAllowed.has(e));
    expect(missing).toEqual([]);
  });
});
