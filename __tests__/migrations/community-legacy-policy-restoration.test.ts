import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("community legacy policy restoration", () => {
  const restorationPath =
    "scripts/db/restore-community-legacy-photo-writes.sql";
  const integrationPath =
    "supabase/tests/community_legacy_policy_restoration_integration.sql";
  const runnerPath =
    "scripts/db/run-community-legacy-policy-restoration-smoke.sh";

  it("restores every frozen policy with the original command and predicate", () => {
    const sql = read(restorationPath).replace(/\s+/g, " ").toLowerCase();

    expect(sql).toContain(
      "create policy bps_insert_own on public.beach_photo_submissions for insert with check (auth.uid() = submitted_by and status = 'pending')",
    );
    expect(sql).toContain(
      "create policy bps_update_own on public.beach_photo_submissions for update using (auth.uid() = submitted_by and status = 'pending') with check (auth.uid() = submitted_by and status = 'pending')",
    );
    expect(sql).toContain(
      "create policy bpsv_insert_own on public.beach_photo_submission_votes for insert with check (auth.uid() = voter_id)",
    );
    expect(sql).toContain(
      "create policy bpsv_delete_own on public.beach_photo_submission_votes for delete using (auth.uid() = voter_id)",
    );
  });

  it("restores exactly the legacy table privileges removed by the freeze", () => {
    const sql = read(restorationPath).replace(/\s+/g, " ").toLowerCase();

    expect(sql).toContain(
      "grant insert, update, delete on public.beach_photo_submissions to anon, authenticated",
    );
    expect(sql).toContain(
      "grant insert, update, delete on public.beach_photo_submission_votes to anon, authenticated",
    );
    expect(sql).not.toMatch(
      /\b(insert into|update public\.|delete from|truncate|storage\.objects)\b/,
    );
  });

  it("executes the exact freeze and restoration in one disposable PostgreSQL session", () => {
    const integration = read(integrationPath);
    const migration = read(
      "supabase/migrations/20260725230000_create_community_spot_photos.sql",
    );

    for (const statement of [
      "DROP POLICY IF EXISTS bps_insert_own ON public.beach_photo_submissions",
      "DROP POLICY IF EXISTS bps_update_own ON public.beach_photo_submissions",
      "REVOKE INSERT, UPDATE, DELETE ON public.beach_photo_submissions FROM anon, authenticated",
      "DROP POLICY IF EXISTS bpsv_insert_own ON public.beach_photo_submission_votes",
      "DROP POLICY IF EXISTS bpsv_delete_own ON public.beach_photo_submission_votes",
      "REVOKE INSERT, UPDATE, DELETE ON public.beach_photo_submission_votes FROM anon, authenticated",
    ]) {
      expect(migration).toContain(statement);
      expect(integration).toContain(statement);
    }

    expect(integration).toContain(
      "\\ir ../migrations/20260701205008_beach_photo_submissions.sql",
    );
    expect(integration).toContain(
      "\\ir ../../scripts/db/restore-community-legacy-photo-writes.sql",
    );
    expect(integration).toMatch(/pg_policies[\s\S]*pre_freeze_policies/i);
    expect(integration).toMatch(/aclexplode[\s\S]*pre_freeze_grants/i);
    expect(integration).toMatch(
      /community_spot_photos[\s\S]*community_photo_votes[\s\S]*community_photo_moderation_events[\s\S]*community_photo_investigation_holds[\s\S]*storage\.objects/i,
    );
    expect(integration).toMatch(
      /set role authenticated[\s\S]*insert into public\.beach_photo_submissions[\s\S]*update public\.beach_photo_submissions[\s\S]*insert into public\.beach_photo_submission_votes[\s\S]*delete from public\.beach_photo_submission_votes/i,
    );
    expect(integration).toMatch(
      /set role anon[\s\S]*anonymous submission insert unexpectedly succeeded/i,
    );
  });

  it("refuses to create a smoke database on a non-local PostgreSQL host", () => {
    const runner = read(runnerPath);

    expect(runner).toContain("127.0.0.1");
    expect(runner).toContain("localhost");
    expect(runner).toContain("Refusing to create a disposable");
    expect(runner).toContain(
      "supabase/tests/community_legacy_policy_restoration_integration.sql",
    );
  });
});
