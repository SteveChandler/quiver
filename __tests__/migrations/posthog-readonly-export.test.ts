import { readFileSync } from "fs";
import { join } from "path";

describe("PostHog readonly export migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260516143107_create_posthog_readonly_export.sql",
    ),
    "utf8",
  );
  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("backfills the remote-only migration without committing credentials", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
    expect(normalizedSQL).toContain("create schema if not exists posthog_export");
    expect(normalizedSQL).toContain("create role posthog_readonly");
    expect(normalizedSQL).toContain("nologin");
    expect(normalizedSQL).not.toContain("login password");
    expect(normalizedSQL).not.toContain("alter role posthog_readonly with login");
  });

  it("recreates the expected export views", () => {
    for (const viewName of [
      "profiles",
      "sessions",
      "beaches",
      "user_follows",
      "user_events",
      "email_send_log",
    ]) {
      expect(normalizedSQL).toContain(
        `create or replace view posthog_export.${viewName}`,
      );
    }
  });

  it("keeps mock users and secrets out of export views", () => {
    expect(normalizedSQL).toContain("coalesce(profiles.is_mock, false) = false");
    expect(normalizedSQL).toContain("coalesce(p.is_mock, false) = false");
    expect(normalizedSQL).toContain("coalesce(follower.is_mock, false) = false");
    expect(normalizedSQL).toContain("coalesce(following.is_mock, false) = false");
    expect(normalizedSQL).toContain(
      "ue.metadata - 'email'::text - 'token'::text - 'secret'::text - 'password'::text",
    );
  });
});
