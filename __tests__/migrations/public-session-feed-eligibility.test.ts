import { readFileSync } from "fs";
import { join } from "path";

describe("public session feed eligibility migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260709123000_public_session_feed_eligibility.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("creates the feed eligibility and activation report views", () => {
    expect(normalizedSQL).toContain(
      "create or replace view public.public_session_feed_eligibility",
    );
    expect(normalizedSQL).toContain(
      "create or replace view public.session_activation_report",
    );
    expect(normalizedSQL).toContain("with (security_invoker = true)");
  });

  it("classifies thin, warning, informative, and strong public sessions", () => {
    expect(normalizedSQL).toContain("(not has_context and not has_media) as thin");
    expect(normalizedSQL).toContain(
      "(rating is not null and rating <= 2 and (has_context or has_media)) as warning",
    );
    expect(normalizedSQL).toContain("(has_context or has_media) as informative");
    expect(normalizedSQL).toContain(
      "(rating is not null and rating >= 4 and (has_context or has_media)) as strong",
    );
  });

  it("uses only visible feed-card fields as public-session context", () => {
    expect(normalizedSQL).toContain("length(btrim(coalesce(s.notes, ''))) >= 12");
    expect(normalizedSQL).toContain("s.source is distinct from 'auto_title'");
    expect(normalizedSQL).toContain("length(btrim(coalesce(s.description, ''))) >= 12");
    expect(normalizedSQL).toContain("s.wave_quality is not null");
    expect(normalizedSQL).toContain("coalesce(array_length(s.wave_characteristics, 1), 0) > 0");
    expect(normalizedSQL).toContain("s.tide_height_ft is not null");
    expect(normalizedSQL).toContain("s.rip_current_observed is not null");
    expect(normalizedSQL).toContain("s.crowd_level is not null");
    expect(normalizedSQL).not.toContain("s.board_id is not null");
    expect(normalizedSQL).not.toContain("s.session_decomposition");
  });

  it("uses completed non-deleted sessions as the activation source of truth", () => {
    expect(normalizedSQL).toContain("from public.sessions s");
    expect(normalizedSQL).toContain("where s.status = 'completed'");
    expect(normalizedSQL).toContain("and s.deleted_at is null");
    expect(normalizedSQL).toContain("as days_to_first_session");
    expect(normalizedSQL).toContain("as has_second_session_within_14d");
  });

  it("excludes non-real users from activation reporting and backfill", () => {
    for (const exclusion of [
      "coalesce(p.is_mock, false) = false",
      "coalesce(p.is_system_account, false) = false",
      "coalesce(p.is_admin, false) = false",
      "coalesce(p.analytics_is_real_user, true) = true",
      "coalesce(p.email, '') not ilike '%test%'",
      "coalesce(p.email, '') not ilike '%@local.test'",
      "coalesce(p.email, '') not ilike '%@example.invalid'",
      "p.deleted_at is null",
    ]) {
      expect(normalizedSQL).toContain(exclusion);
    }
  });

  it("protects the session_created backfill with a unique session index", () => {
    expect(normalizedSQL).toContain(
      "create unique index if not exists user_events_session_created_session_id_uidx",
    );
    expect(normalizedSQL).toContain("on public.user_events ((metadata->>'session_id'))");
    expect(normalizedSQL).toContain("where event_type = 'session_created'");
    expect(normalizedSQL).toContain("on conflict do nothing");
  });
});
