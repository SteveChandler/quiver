import { readFileSync } from "node:fs";
import { join } from "node:path";

const name = "20261122190007_shorten_cron_runs_retention";
const job = /SELECT cron\.schedule\(\s*'prune-cron-runs',\s*'45 11 \* \* \*',\s*\$cron\$([\s\S]+?)\$cron\$/;

function prune(days: number): string {
  return `DELETE FROM public.cron_runs WHERE id IN ( SELECT id FROM public.cron_runs WHERE started_at < now() - interval '${days} days' ORDER BY started_at LIMIT 50000 );`;
}

it("reschedules bounded 30-day pruning only when explicitly enabled", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations", `${name}.sql`), "utf8");
  const command = sql.match(job)?.[1].replace(/\s+/g, " ");

  expect(command).toContain(
    `IF current_setting('quiver.internal_log_reduction', true) = '1' THEN ${prune(30)} ELSE ${prune(60)} END IF;`,
  );
  expect(sql).toMatch(/^BEGIN;[\s\S]+COMMIT;\s*$/);
});

it("restores the same schedule with 60-day pruning regardless of the flag", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/rollbacks", `${name}_rollback.sql`), "utf8");

  expect(sql.match(job)?.[1].trim().replace(/\s+/g, " ")).toBe(prune(60));
  expect(sql).toMatch(/^BEGIN;[\s\S]+COMMIT;\s*$/);
});
