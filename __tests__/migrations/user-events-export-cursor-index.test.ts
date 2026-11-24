import { readFileSync } from "node:fs";
import { join } from "node:path";

const fileName = "20261122201043_add_user_events_export_cursor_index";

function readStatement(directory: "migrations" | "rollbacks", name: string): string {
  return readFileSync(join(__dirname, "../../supabase", directory, `${name}.sql`), "utf8")
    .replace(/^\s*--[^\n]*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

it("creates the export cursor index in a replayable transaction", () => {
  expect(readStatement("migrations", fileName)).toBe(
    "BEGIN; CREATE INDEX IF NOT EXISTS idx_user_events_created_at_id ON public.user_events (created_at, id); COMMIT;"
  );
});

it("rolls back only the export index in a replayable transaction", () => {
  expect(readStatement("rollbacks", `${fileName}_rollback`)).toBe(
    "BEGIN; DROP INDEX IF EXISTS public.idx_user_events_created_at_id; COMMIT;"
  );
});
