import { readFileSync } from "node:fs";
import { join } from "node:path";

function readMigration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");
}

function normalize(sql: string): string {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

function finalSelectColumns(sql: string): string[] {
  const viewStart = sql.indexOf(
    "CREATE OR REPLACE VIEW public.growth_native_install_activation_v1",
  );
  const view = sql.slice(viewStart, sql.indexOf("FROM native_outcomes;", viewStart));
  const finalSelect = view.slice(view.lastIndexOf("\nSELECT\n"));
  return finalSelect
    .replace(/^\s*SELECT\s*/, "")
    .split(/,\s*\n/)
    .map((column) => column.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const migrationSQL = readMigration(
  "20261022190000_credit_native_install_post_install_handoff.sql",
);
const normalizedSQL = normalize(migrationSQL);

describe("credit native install post-install handoff migration", () => {
  it("recreates the install view as security invoker inside a transaction", () => {
    expect(normalizedSQL.startsWith("begin;")).toBe(true);
    expect(normalizedSQL.trim().endsWith("commit;")).toBe(true);
    expect(normalizedSQL).toContain(
      "create or replace view public.growth_native_install_activation_v1 with (security_invoker = true) as",
    );
  });

  it("keeps the published column list identical so CREATE OR REPLACE succeeds", () => {
    const original = readMigration(
      "20260725122000_add_growth_activation_semantic_views.sql",
    );
    expect(finalSelectColumns(migrationSQL)).toEqual(
      finalSelectColumns(original),
    );
  });

  it("credits the install from a handoff link opened in the app on the same install ID", () => {
    expect(normalizedSQL).toMatch(
      /left join lateral \( select lower\(ue\.metadata->>'handoff_id'\) as handoff_id from public\.user_events ue where ue\.event_type = 'app_handoff_native_open' and ue\.metadata \? 'native_install_id' and ue\.metadata->>'native_install_id' = ni\.native_install_id/,
    );
    expect(normalizedSQL).toContain(
      "ue.created_at < ni.cohort_anchor + interval '24 hours' order by ue.created_at, ue.id limit 1",
    );
    expect(normalizedSQL).toContain(
      "coalesce(ni.handoff_id, post_install_handoff.handoff_id) as handoff_id",
    );
    expect(normalizedSQL).toContain(
      "from native_installs_with_handoff ni )",
    );
  });

  it("applies the bot, emulator, test and canonical-ID filters to the handoff open", () => {
    const lateral = normalizedSQL.slice(
      normalizedSQL.indexOf("left join lateral ( select lower(ue.metadata->>'handoff_id')"),
      normalizedSQL.indexOf(") post_install_handoff on true"),
    );
    for (const filter of [
      "coalesce(ue.bot_flagged, false) = false",
      "coalesce(ue.metadata->>'is_emulator', 'false') not in ('true', '1')",
      "coalesce(ue.metadata->>'is_test', 'false') not in ('true', '1')",
      "nullif(ue.metadata->>'handoff_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'",
    ]) {
      expect(lateral).toContain(filter);
    }
  });

  it("still maps a handoff ID to the web_handoff source group", () => {
    expect(normalizedSQL).toContain(
      "when ni.handoff_id is not null then 'web_handoff'",
    );
  });

  it("revokes public roles and grants SELECT only to service_role", () => {
    expect(normalizedSQL).toContain(
      "revoke all on public.growth_native_install_activation_v1 from public, anon, authenticated",
    );
    expect(normalizedSQL).toContain(
      "grant select on public.growth_native_install_activation_v1 to service_role",
    );
  });
});
