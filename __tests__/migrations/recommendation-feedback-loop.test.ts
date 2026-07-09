import fs from "fs";
import path from "path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260709090000_recommendation_feedback_loop.sql"
);

describe("recommendation feedback loop migration", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("creates recommendation_impressions with RLS, keys, and policies", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.recommendation_impressions");
    expect(sql).toContain("recommendation_id text NOT NULL");
    expect(sql).toContain("beach_id uuid NOT NULL");
    expect(sql).toContain("impression_key text NOT NULL");
    expect(sql).toContain("recommendation_impressions_key_idx");
    expect(sql).toContain("ALTER TABLE public.recommendation_impressions ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("recommendation_impressions_insert_own");
    expect(sql).toContain("recommendation_impressions_select_own");
    expect(sql).toContain("recommendation_impressions_service_role_all");
  });

  it("adds recommendation attribution and feedback columns to sessions", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS recommendation_id text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS recommendation_call_accuracy text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS forecast_wave_height_ft numeric");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS forecast_tide_status text");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS wave_height_correct boolean");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS tide_status_correct boolean");
    expect(sql).toContain("sessions_recommendation_call_accuracy_check");
    expect(sql).toContain("'right', 'partly', 'wrong', 'not_sure'");
    expect(sql).toContain("recommendation_session_contexts_source_surface_check");
    expect(sql).toContain("'discover_list'");
    expect(sql).toContain("'home_top_spots'");
  });

  it("widens event taxonomy and creates forward-looking reporting view", () => {
    expect(sql).toContain("recommendation_impression");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.recommendation_feedback_summary");
    expect(sql).toContain("WITH (security_invoker = true)");
    expect(sql).toContain("public.recommendation_impressions ri");
    expect(sql).toContain("s.recommendation_id = ri.recommendation_id");
  });
});
