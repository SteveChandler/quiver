import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260904140000_create_swell_watch_provider_run_receipts.sql"), "utf8");

describe("swell watch provider receipt migration contract", () => {
  it("keeps issuance global, freezes scopes, and derives the completed identity in SQL", () => {
    expect(sql).toContain("UNIQUE (transport_provider, model, run_utc)");
    expect(sql).toContain("expected_component_count");
    expect(sql).toContain("swell_watch_provider_run_batch_scopes");
    expect(sql).toContain("swell_watch_provider_run_revision_sets");
    expect(sql).toContain("swell_watch_provider_run_revision_raw_responses");
    expect(sql).toContain("canonicalSemanticPayload");
    expect(sql).toContain("extensions.digest(coalesce(v_receipt->>'rawResponse',''),'sha256')");
    expect(sql).toContain("'genuine_completed:' || v_batch");
    expect(sql).not.toContain("evaluation_id text NOT NULL");
    expect(sql).toContain("provider receipt does not satisfy the frozen batch scope");
    expect(sql).toContain("active accepted attestation is required");
  });

  it("keeps generic service ingestion fixture-only and routes genuine data through a verified batch", () => {
    expect(sql).toContain("generic swell watch ingestion is fixture-only");
    expect(sql).toContain("ingest_swell_watch_evaluation_internal");
    expect(sql).toContain("ingest_verified_swell_watch_evaluation");
    expect(sql).toContain("genuine completed observations require a verified provider batch");
    expect(sql).toContain("provider_evidence_unavailable");
    expect(sql).toContain("v_current_supporting_evidence_count IS DISTINCT FROM 2");
    expect(sql).toContain("v_supporting_issuance_count IS DISTINCT FROM 2");
    expect(sql).toContain("swell_watch_validate_notification_release_internal");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.ingest_swell_watch_evaluation(");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });
});
