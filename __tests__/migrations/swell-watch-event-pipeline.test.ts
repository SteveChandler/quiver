import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260824120000_create_swell_watch_event_pipeline.sql",
  ),
  "utf8",
);

describe("swell watch event pipeline migration contract", () => {
  it("creates append-only evaluation, regional identity, recipient claim, and fail-closed control state", () => {
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
    expect(sql).toContain(
      "UNIQUE (evaluation_id, source_point_id, provider, forecast_at, source_slot)",
    );
    expect(sql).toContain("UNIQUE (regional_event_id, evaluation_id)");
    expect(sql).toContain("UNIQUE (regional_event_id, recipient_id)");
    expect(sql).toContain("swell watch evidence is append-only");
    expect(sql).toContain("'phase_26_initial_fail_closed'");
    expect(sql).toContain("'phase_26_initial_fail_closed'");
    expect(sql).toContain("state IN ('disabled', 'armed')");
  });

  it("uses service-role-only atomic transitions and claims with no client policy", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain(
      "ON CONFLICT (regional_event_id, evaluation_id) DO NOTHING",
    );
    expect(sql).toContain("identity_kind IN ('genuine_completed', 'synthetic_fixture')");
    expect(sql).toContain("impact_hash text NOT NULL");
    expect(sql).toContain("stable transitions require evidence advancement");
    expect(sql).toContain("p_evaluation_id !~ '^(genuine_completed|synthetic_fixture):");
    expect(sql).toContain("UNIQUE (regional_event_id, alias_key)");
    expect(sql).not.toContain("UNIQUE (region_key, physical_key)");
    expect(sql).not.toContain("swell-watch-state:");
    expect(sql).toContain("conflicting observation retry");
    expect(sql).toContain("conflicting impact retry");
    expect(sql).toContain("conflicting event evaluation retry");
    expect(sql).toContain("p_height_m IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)");
    expect(sql).toContain("p_period_s IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)");
    expect(sql).toContain("p_projected_face_height_ft IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)");
    const ingestFunction = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.ingest_swell_watch_evaluation"),
      sql.indexOf("CREATE OR REPLACE FUNCTION public.append_swell_watch_state_transition"),
    );
    const observationLock = ingestFunction.indexOf("'swell-watch-observation:'");
    const eventLock = ingestFunction.indexOf("'swell-watch-event:' || p_regional_event_id::text");
    const eventLookup = ingestFunction.indexOf("WHERE id = p_regional_event_id");
    expect(observationLock).toBeGreaterThanOrEqual(0);
    expect(eventLock).toBeGreaterThan(observationLock);
    expect(eventLookup).toBeGreaterThan(eventLock);
    expect(sql).toContain("v_cycle_started_at");
    expect(sql).toContain("observation.source_point_id = p_source_point_id");
    expect(sql).toContain("observation.source_slot = p_source_slot");
    expect(sql).toContain(
      "ON CONFLICT (regional_event_id, recipient_id) DO NOTHING",
    );
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.swell_watch_observations");
    expect(sql).not.toContain(
      "REVOKE INSERT, UPDATE, DELETE ON public.swell_watch_observations",
    );
    expect(sql).not.toContain("ON ALL TABLES IN SCHEMA public");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.advance_swell_watch_event",
    );
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.advance_swell_watch_event",
    );
  });
});
