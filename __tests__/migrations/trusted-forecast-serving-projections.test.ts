import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260831190000_create_trusted_forecast_serving_projections.sql",
  ),
  "utf8",
);

describe("trusted forecast serving projection migration", () => {
  it("keeps mutable serving state private and tied to immutable applications", () => {
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain(
      "REFERENCES public.trusted_forecast_applications (beach_id, forecast_at)",
    );
    expect(sql).toContain(
      "ALTER TABLE public.trusted_forecast_serving_projections ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).not.toMatch(/TO\s+(anon|authenticated)\b/i);
  });
});
