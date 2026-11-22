import { readFileSync } from "node:fs";
import { join } from "node:path";

const name = "20261122190007_shorten_cron_runs_retention";
const job = /SELECT cron\.schedule\(\s*'prune-cron-runs',\s*'45 11 \* \* \*',\s*\$cron\$([\s\S]+?)\$cron\$/;

function prune(days: number): string {
  return `DELETE FROM public.cron_runs WHERE id IN ( SELECT id FROM public.cron_runs WHERE started_at < now() - interval '${days} days' ORDER BY started_at LIMIT 50000 );`;
}

it("reschedules the same job with bounded 30-day pruning", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations", `${name}.sql`), "utf8");

  expect(sql.match(job)?.[1].trim().replace(/\s+/g, " ")).toBe(prune(30));
  expect(sql).toMatch(/^BEGIN;[\s\S]+COMMIT;\s*$/);
});

it("restores the same schedule with 60-day pruning", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/rollbacks", `${name}_rollback.sql`), "utf8");

  expect(sql.match(job)?.[1].trim().replace(/\s+/g, " ")).toBe(prune(60));
  expect(sql).toMatch(/^BEGIN;[\s\S]+COMMIT;\s*$/);
});
