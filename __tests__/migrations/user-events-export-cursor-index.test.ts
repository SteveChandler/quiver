import { readFileSync } from "node:fs";
import { join } from "node:path";

const fileName = "20261122201043_add_user_events_export_cursor_index";

function readStatement(directory: "migrations" | "rollbacks", name: string): string {
  return readFileSync(join(__dirname, "../../supabase", directory, `${name}.sql`), "utf8")
    .replace(/^\s*--[^\n]*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

it("creates a standalone concurrent index in export cursor order", () => {
  expect(readStatement("migrations", fileName)).toBe(
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_events_created_at_id ON public.user_events (created_at, id);"
  );
});

it("rolls back only the export index with a standalone concurrent drop", () => {
  expect(readStatement("rollbacks", `${fileName}_rollback`)).toBe(
    "DROP INDEX CONCURRENTLY IF EXISTS public.idx_user_events_created_at_id;"
  );
});
