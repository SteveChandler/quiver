import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261014220000_create_community_photo_terms_acceptances.sql",
  ),
  "utf8",
);

describe("community photo terms acceptances migration", () => {
  it("creates one acceptance per user and version without pinning a specific version", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.community_photo_terms_acceptances/);
    expect(migration).toMatch(
      /user_id uuid NOT NULL DEFAULT auth\.uid\(\) REFERENCES public\.profiles\(id\) ON DELETE CASCADE/,
    );
    expect(migration).toMatch(/terms_version text NOT NULL CHECK \([\s\S]*char_length\(terms_version\) BETWEEN 1 AND 64/);
    expect(migration).toMatch(/terms_version ~ '\^\[A-Za-z0-9\]/);
    expect(migration).not.toMatch(/terms_version\s*=\s*'\d{4}-\d{2}-\d{2}'/);
    expect(migration).toMatch(/accepted_at timestamptz NOT NULL DEFAULT now\(\)/);
    expect(migration).toMatch(/PRIMARY KEY \(user_id, terms_version\)/);
    expect(migration).toMatch(/COMMENT ON TABLE public\.community_photo_terms_acceptances[\s\S]*community_photo_consents/);
  });

  it("allows authenticated clients to select and insert only their own immutable records", () => {
    expect(migration).toMatch(/ALTER TABLE public\.community_photo_terms_acceptances ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/CREATE POLICY community_photo_terms_acceptances_select_own[\s\S]*FOR SELECT TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
    expect(migration).toMatch(/CREATE POLICY community_photo_terms_acceptances_insert_own[\s\S]*FOR INSERT TO authenticated\s+WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\)/);
    expect(migration).not.toMatch(/FOR (?:UPDATE|DELETE) TO authenticated/);
    expect(migration).toMatch(/REVOKE ALL ON public\.community_photo_terms_acceptances FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT SELECT, INSERT ON public\.community_photo_terms_acceptances TO authenticated/);
    expect(migration).toMatch(/GRANT ALL ON public\.community_photo_terms_acceptances TO service_role/);
    expect(migration).not.toMatch(/GRANT [^;]*(?:UPDATE|DELETE)[^;]* TO authenticated/);
  });
});
