import { readFileSync } from "node:fs";
import { join } from "node:path";

const report = readFileSync(join(process.cwd(), "scripts/report-swell-watch-closed-epoch-components.sql"), "utf8");

it("gates the inventory in a read-only transaction and reports without mutations", () => {
  expect(report).toMatch(/\\set archive_report false[\s\S]*\\if :archive_report\s+BEGIN READ ONLY;/);
  expect(report).toMatch(/ROLLBACK;\s+\\else/);
  expect(report).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|COPY)\b/);
});

it("measures only revisions whose owning sets are all linked to closed study epochs", () => {
  expect(report).toContain("authority.expires_at <= now() OR authority.epoch < latest.epoch");
  expect(report).toContain("authority.epoch < coalesce(public.swell_watch_study_cycle_start(latest.epoch), 1)");
  expect(report).toContain("closed_authorities.epoch = acceptance.authority_epoch");
  expect(report).toMatch(/WHERE NOT EXISTS \([\s\S]*other_member.revision_id = member.revision_id\s+AND other_closed_set.revision_set_id IS NULL/);
  expect(report).toContain("GROUP BY member.revision_id");
  expect(report).toContain("count(*) AS component_count");
  expect(report).toContain("sum(pg_column_size(component)) AS estimated_component_bytes");
});
