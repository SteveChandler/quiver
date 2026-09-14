/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("binds qualification and coverage to the authority and stored scope revisions", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260914050000_amend_swell_watch_study_partition_coverage.sql"), "utf8");
  expect(sql).toContain("ADD COLUMN IF NOT EXISTS qualification_rule text NOT NULL DEFAULT 'complete_partitions.v1'");
  expect(sql).toContain("'qualificationRule',NEW.qualification_rule");
  expect(sql).toContain("'qualificationRule',a.qualification_rule");
  expect(sql).toContain("p_result->'derivation'->>'qualificationRule' IS DISTINCT FROM a.qualification_rule");
  expect(sql).toContain("c.unavailable_reason IS NOT NULL AND c.source_slot='s2'");
  expect(sql).toContain("s.source_point_id::text=scope->>'sourcePointId'");
  expect(sql).toContain("study result claims partial partition coverage under complete-partition rule");
  expect(sql).toContain("octet_length(p_result::text)>131072");
  expect(sql).toContain("s-'sourcePointId'-'status'-'reason'<>'{}'::jsonb");
  expect(sql).toContain("pg_get_functiondef");
  expect(sql).toContain("SET LOCAL lock_timeout = '5s'");
  expect(sql).toContain("SET LOCAL statement_timeout = '30s'");
  expect(sql).toContain("current_user <> 'postgres'");
  expect(sql.trim()).toMatch(/^--[\s\S]*BEGIN;[\s\S]*COMMIT;$/);
});
