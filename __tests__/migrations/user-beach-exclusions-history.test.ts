import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260719110000_create_user_beach_exclusions.sql"
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, "utf8");
}

describe("user beach exclusions history migration", () => {
  it("reconstructs the production table before Weekend Scout references it", () => {
    const sql = readMigration();

    expect(sql).toMatch(/CREATE TABLE public\.user_beach_exclusions/i);
    expect(sql).toMatch(
      /user_id uuid NOT NULL REFERENCES public\.profiles\(id\) ON DELETE CASCADE/i
    );
    expect(sql).toMatch(
      /beach_id uuid NOT NULL REFERENCES public\.beaches\(id\) ON DELETE CASCADE/i
    );
    expect(sql).toMatch(/PRIMARY KEY \(user_id, beach_id\)/i);
    expect(sql).toMatch(/created_at timestamptz NOT NULL DEFAULT now\(\)/i);
    expect(sql).toMatch(/user_beach_exclusions_user_id_idx/i);
  });

  it("matches the production row-level security contract", () => {
    const sql = readMigration();

    expect(sql).toMatch(
      /ALTER TABLE public\.user_beach_exclusions ENABLE ROW LEVEL SECURITY/i
    );
    expect(sql).toMatch(/CREATE POLICY user_beach_exclusions_select_own/i);
    expect(sql).toMatch(/CREATE POLICY user_beach_exclusions_insert_own/i);
    expect(sql).toMatch(/CREATE POLICY user_beach_exclusions_delete_own/i);
    expect(sql).toMatch(/\(SELECT auth\.uid\(\)\) = user_id/i);
    expect(sql).toMatch(
      /GRANT ALL ON TABLE public\.user_beach_exclusions TO anon, authenticated, service_role/i
    );
  });
});
