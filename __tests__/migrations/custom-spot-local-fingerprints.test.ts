import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260828120000_add_custom_spot_local_fingerprints.sql",
  ),
  "utf8",
);

describe("custom spot local fingerprint schema", () => {
  it("is additive and transaction wrapped", () => {
    expect(migration).toMatch(/^BEGIN;/m);
    expect(migration).toMatch(/^COMMIT;/m);
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS swell_access_factors real[72]");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS wind_exposure_factors real[72]");
    expect(migration).not.toMatch(/DROP TABLE public\.custom_spots/i);
  });

  it("constrains directional arrays and scientific states", () => {
    expect(migration).toContain("array_length(p_values, 1) = 72");
    expect(migration).toContain("value < 0 OR value > 1");
    expect(migration).toContain("custom_spots_swell_access_factors_valid");
    expect(migration).toContain("custom_spots_wind_exposure_factors_valid");
    expect(migration).toContain(
      "'unset', 'modeled', 'independently_reviewed', 'user_corrected', 'failed'",
    );
  });

  it("queues analysis without exposing jobs through RLS", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.custom_spot_analysis_jobs",
    );
    expect(migration).toContain(
      "ALTER TABLE public.custom_spot_analysis_jobs ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.custom_spot_analysis_jobs FROM anon, authenticated",
    );
    expect(migration).toMatch(/AFTER INSERT OR UPDATE OF lat, lon, break_type/i);
  });

  it("claims bounded disjoint batches idempotently", () => {
    expect(migration).toContain("p_batch_size < 1 OR p_batch_size > 25");
    expect(migration).toContain("FOR UPDATE OF jobs SKIP LOCKED");
    expect(migration).toContain("ON CONFLICT (custom_spot_id) DO UPDATE SET");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.claim_custom_spot_analysis_jobs(integer) TO service_role");
  });

  it("marks authenticated directional changes as user corrections", () => {
    expect(migration).toContain("auth.uid() IS NOT NULL");
    expect(migration).toContain(
      "jsonb_set(fields, '{facing_direction_deg}', '\"user_corrected\"'::jsonb, true)",
    );
    expect(migration).toContain("NEW.fingerprint_provenance_state := 'user_corrected'");
    expect(migration).toContain("NEW.swell_access_factors := OLD.swell_access_factors");
    expect(migration).toContain("NEW.terrain_analysis_debug := OLD.terrain_analysis_debug");
    expect(migration).toContain("NEW.fingerprint_model_version := OLD.fingerprint_model_version");
  });

  it("finishes worker writes atomically under the claimed lease", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.complete_custom_spot_analysis_job");
    expect(migration).toContain("AND locked_at = p_claimed_at");
    expect(migration).toContain("AND updated_at = p_spot_updated_at");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.fail_custom_spot_analysis_job");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.complete_custom_spot_analysis_job");
  });

  it("does not enqueue existing rows during the migration", () => {
    expect(migration).toContain(
      "Existing rows are intentionally not enqueued by the migration",
    );
    expect(migration).not.toMatch(
      /INSERT INTO public\.custom_spot_analysis_jobs[\s\S]*SELECT[\s\S]*FROM public\.custom_spots/i,
    );
  });
});
