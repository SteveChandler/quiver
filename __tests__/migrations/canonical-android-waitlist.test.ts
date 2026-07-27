import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260726120000_create_canonical_android_waitlist.sql",
);
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("canonical Android waitlist migration", () => {
  it("creates private canonical entries, source links, and exactly-once events", () => {
    for (const table of [
      "android_waitlist_entries",
      "android_waitlist_source_links",
      "android_waitlist_events",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }

    expect(sql).toContain("event_type = 'android_waitlist_joined'");
    expect(sql).toContain("unique (entry_id, event_type)");
    const eventTable = sql.match(
      /create table public\.android_waitlist_events \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(eventTable).not.toMatch(/\bemail\b/);
  });

  it("resolves exact identities in the approved precedence without fuzzy matching", () => {
    const resolver = sql.match(
      /create or replace function public\.resolve_android_waitlist_entry\(([\s\S]*?)\n\$\$;/,
    )?.[0];

    expect(resolver).toContain("p_user_id");
    expect(resolver).toContain("p_normalized_email_sha256");
    expect(resolver).toContain("p_roster_entry_id");
    expect(resolver).toContain("p_source_kind");
    expect(resolver).toContain("p_source_id");
    expect(resolver).toMatch(
      /where entry\.user_id = p_user_id[\s\S]*where entry\.normalized_email_sha256 = p_normalized_email_sha256[\s\S]*link\.roster_entry_id = p_roster_entry_id[\s\S]*link\.source_kind = p_source_kind[\s\S]*link\.source_id = p_source_id/,
    );
    expect(resolver).not.toMatch(
      /similarity\(|levenshtein|soundex|metaphone|ilike/,
    );
  });

  it("provides service-role-only resolver, deterministic backfill, and non-PII operator projection", () => {
    expect(sql).toContain("backfill_android_waitlist_entries");
    expect(sql).toContain("order by p.android_waitlist_joined_at, p.id");
    expect(sql).toContain("order by l.created_at, l.id");
    expect(sql).toContain("order by r.eligibility_observed_at, r.id");
    expect(sql).toContain("get_android_waitlist_operator_projection");

    for (const functionName of [
      "resolve_android_waitlist_entry",
      "backfill_android_waitlist_entries",
      "get_android_waitlist_operator_projection",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `revoke all on function public\\.${functionName}\\([\\s\\S]*?grant execute on function public\\.${functionName}\\([\\s\\S]*?to service_role`,
        ),
      );
    }

    const projection = sql.match(
      /create or replace function public\.get_android_waitlist_operator_projection\(\)([\s\S]*?)\n\$\$;/,
    )?.[0];
    expect(projection).not.toMatch(/\bemail\b|normalized_email_sha256/);
    for (const stage of [
      "group_eligibility",
      "play_opt_in",
      "install",
      "first_open",
      "account_join",
    ]) {
      expect(projection).toContain(`'${stage}'`);
    }
  });

  it("keeps roster evidence independent while linking exact roster identities", () => {
    expect(sql).toContain("p_roster_entry_id");
    expect(sql).toContain("link.roster_entry_id = p_roster_entry_id");
    expect(sql).toContain("'roster_evidence'");
    expect(sql).not.toMatch(
      /play_opt_in[\s\S]{0,120}(?:install|first_open|account_join)\s*=/,
    );
  });
});
