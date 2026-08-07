# Phase 0C Forecast Evidence And Source Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore immutable, report-only GFS-Wave evidence capture and isolate the existing NOAA/Open-Meteo 72-hour handoff behind a deterministic policy boundary without changing displayed forecasts.

**Architecture:** Add a capture-run manifest plus append-only run/beach attempt, issuance-revision, and valid-time-candidate evidence, then route only pinned `ncep_gfswave016` shadow data into it under a default-off double latch. Keep the display path on a pure, injected-anchor `legacy-72h.v1` policy; monitoring and policy-shadow flags may emit evidence and alerts but cannot select GFS or alter serving values. Provider-cycle identity remains nullable, and retrievals with unknown provider cycles never count as independent issue cycles.

**Tech Stack:** Node.js 22, TypeScript, Next.js server services, Supabase/PostgreSQL migrations and RPCs, Jest, ESLint, `tsx` operator scripts.

## Global Constraints

- This plan implements only P0-C. P0-A recommendation holds, P0-B attribution, and P0-D observation matching/scoring remain separate workstreams.
- Do not show a confidence badge, low-confidence copy, warning, or any other confidence-derived client behavior.
- Do not change beach decay, shoaling, offsets, ML correction, `enhanced_forecasts` formulas, or displayed physical heights.
- GFS-Wave is capture-only in P0-C and may not enter a serving source decision.
- The serving source policy remains `legacy-72h.v1`: NOAA/NWS at or before 72 hours, Open-Meteo after 72 hours when present, NOAA fallback when it is absent, and Open-Meteo extension beyond NOAA range.
- `FORECAST_SOURCE_REVISION_CAPTURE_ENABLED=true` and `GFS_WAVE_SHADOW_CAPTURE_ENABLED=true` are both required for GFS evidence writes. Both default to false when absent.
- `FORECAST_SOURCE_POLICY_SHADOW_ENABLED` defaults to false and controls only structured shadow summaries. It never changes the selected source.
- `FORECAST_SOURCE_POLICY_MODE` accepts only `legacy_72h` in P0-C; missing or invalid values resolve to `legacy_72h`.
- The pinned source model is exactly `ncep_gfswave016`; the upstream proxy source is `open_meteo`.
- `source_issued_at` and `source_cycle_id` stay null when the upstream response does not expose a provider cycle. `source_cycle_resolution='unknown'` rows do not contribute to independent-cycle counts.
- Unknown-cycle issuance identity is stable per source/model/beach and exact raw/parsed payloads are deduplicated across runs. The current run is represented only by its immutable attempt link; capture-run IDs never masquerade as model-cycle identity.
- A beach is capture-due at most once per six hours. This bounds the default 90-day Phase 0 collection campaign to roughly four 57-point revisions per observable beach per day before deduplication; the flags must be disabled at the campaign boundary pending a reviewed storage/retention decision.
- Provider or parser corrections create a new immutable `issuance_revision_id` and may point to `supersedes_revision_id`; prior revisions and candidates are never updated.
- QA-only forecaster snapshots may alert and create review cases, but may not alter forecasts, source selection, recommendations, or event state.
- P0-C may collect evidence but cannot pass a serving-promotion gate until P0-D supplies approved nearest-time observation matches with exact station, tolerance, issue-cycle, and candidate lineage.
- Use Node 22 and Yarn 1.22 for every JavaScript command.
- Do not apply `supabase/migrations/20260717172000_create_forecast_source_evidence.sql` to any database until the migration plan is explicitly approved. A linked or production apply requires a second explicit release approval.
- Production rollout and rollback are flag operations; the additive evidence tables remain in place on rollback.
- Preserve all unrelated dirty worktree changes and stage only files named by the current task.
- Do not create commits unless the user separately and explicitly authorizes commits; every commit step below is conditional.

---

## File Structure

Files marked **new** do not exist at plan-writing time.

| Path | State | Responsibility |
|---|---|---|
| `supabase/migrations/20260717172000_create_forecast_source_evidence.sql` | **new** | Add capture runs, immutable run/beach attempt links, issuance revisions, exact valid-time candidates, service-role RLS, atomic revision/attempt RPC, run finalization RPC, and explicit legacy-row classification. |
| `__tests__/migrations/forecast-source-evidence.test.ts` | **new** | Lock schema identity, append-only behavior, RLS, RPC safety, and display-table isolation. |
| `lib/services/noaa-wavewatch/api-client.ts` | existing | Export one canonical Open-Meteo URL builder while preserving the existing display fetch response contract. |
| `lib/services/noaa-wavewatch/open-meteo-evidence-client.ts` | **new** | Fetch raw pinned-model bytes, hash them before parsing, fingerprint the request, and preserve nullable provider-cycle identity. |
| `__tests__/lib/services/noaa-wavewatch/open-meteo-evidence-client.test.ts` | **new** | Prove byte-stable hashes, request identity, abort/error classification, and unknown-cycle semantics. |
| `lib/services/noaa-wavewatch/forecast-source-evidence.ts` | **new** | Define registry contracts and perform service-role capture-run/revision/finalization writes. |
| `__tests__/lib/services/noaa-wavewatch/forecast-source-evidence.test.ts` | **new** | Prove exact RPC payloads, idempotent retry contract, rejected-attempt persistence, and no display-table access. |
| `lib/services/noaa-wavewatch/gfs-wave-shadow.ts` | existing | Replace the hard disable with the double latch; parse raw evidence into a revision and candidate payload; stop writing the legacy flat table. |
| `__tests__/lib/services/noaa-wavewatch/gfs-wave-shadow.test.ts` | existing | Characterize the double latch, parser quality states, immutable identity, nullable cycles, and pinned-model request. |
| `lib/services/enhanced-forecast-service.ts` | existing | Freeze and persist serving output, then invoke the separate evidence runner with selected beach IDs and a fresh deadline. |
| `lib/utils/forecast-server-utils.ts` | existing | Carry the cron execution ID into the capture-run context. |
| `app/api/cron/enhanced-forecast-sync/_shared.ts` | existing | Pass `executionId` as `captureRunId`; do not change the API response. |
| `lib/services/noaa-wavewatch/forecast-source-capture-runner.ts` | **new** | Own post-serving scope selection, fetch, attempt/revision persistence, bounded deadline, and finalization without entering `ForecastBuilder`. |
| `__tests__/lib/services/noaa-wavewatch/forecast-source-capture-runner.test.ts` | **new** | Prove ordering, frozen scope anchor, deadline isolation, exact attempts, and serving-result invariance. |
| `__tests__/lib/services/enhanced-forecast-service.test.ts` | existing | Prove default-off scope behavior, one run per shard, timeout classification, and non-blocking failures. |
| `__tests__/app/api/cron/enhanced-forecast-sync.test.ts` | existing | Prove propagation of `executionId` without response-contract changes. |
| `lib/services/noaa-wavewatch/source-policy.ts` | **new** | Implement the pure `legacy-72h.v1` selection policy and shadow-summary flag helpers. |
| `__tests__/lib/services/noaa-wavewatch/source-policy.test.ts` | **new** | Characterize exact seam, fallback, extension, injected anchor, and shadow-flag invariants. |
| `lib/services/noaa-wavewatch/noaa-wavewatch-service.ts` | existing | Delegate source choice to the pure policy while preserving Open-Meteo co-location and output ordering. |
| `__tests__/lib/services/noaa-wavewatch/merge-preserves-om.test.ts` | existing | Keep end-to-end merge characterization around 72 hours and missing slots. |
| `lib/services/noaa-wavewatch/forecast-source-health.ts` | **new** | Build deterministic freshness, expected-coverage, nonzero, rejection, seam, and independent-cycle health summaries. |
| `__tests__/lib/services/noaa-wavewatch/forecast-source-health.test.ts` | **new** | Prove blocker codes and that unknown retrieval cycles are never counted as independent. |
| `scripts/validate-gfs-wave-shadow.ts` | **new** | Read the registry, optionally probe upstream without writing, print JSON/Markdown, and exit nonzero in strict mode. |
| `__tests__/scripts/validate-gfs-wave-shadow.test.ts` | **new** | Prove CLI argument and exit-code behavior without network or database access. |
| `scripts/validate-wavecast-calibration.ts` | existing | Add machine-readable summary, strict blockers, source-seam metrics, and GFS health without changing forecast serving. |
| `__tests__/scripts/validate-wavecast-calibration.test.ts` | **new** | Prove stale scrape, failed source, critical discrepancy, seam, and GFS blockers. |
| `lib/services/noaa-wavewatch/ARCHITECTURE.md` | existing | Document the registry, flags, legacy policy, and P0-D promotion dependency. |
| `docs/deployment/forecast-source-evidence-runbook.md` | **new** | Record the migration approval gate, deploy-off sequence, enablement checks, and flag-only rollback. |

### Stable cross-task contracts

Later tasks must use these names exactly:

```ts
export type SourceCycleResolution = "provider" | "inferred" | "unknown";

export type ForecastSourceRevisionQualityStatus =
  | "ok"
  | "all_zero_wave_height"
  | "missing_wave_height"
  | "http_error"
  | "network_error"
  | "parse_error"
  | "aborted"
  | "timed_out";

export interface ForecastSourceCaptureContext {
  captureRunId: string;
  anchorTime: Date;
}

export interface GfsWaveEvidenceFetchResult {
  status:
    | "ok"
    | "http_error"
    | "network_error"
    | "parse_error"
    | "aborted"
    | "timed_out";
  payload: import("./types").OpenMeteoMarineResponse | null;
  retrievedAt: string;
  requestFingerprint: string;
  rawPayloadHash: string | null;
  sourceIssuedAt: null;
  sourceCycleId: null;
  sourceCycleResolution: "unknown";
  httpStatus: number | null;
}

export type ForecastSourcePolicyMode = "legacy_72h";
export type ForecastSourcePolicyVersion = "legacy-72h.v1";
```

### Task 1: Create The Append-Only Forecast Evidence Schema

**Files:**
- Create: `supabase/migrations/20260717172000_create_forecast_source_evidence.sql`
- Create: `__tests__/migrations/forecast-source-evidence.test.ts`
- Create: `scripts/db/forecast-source-evidence-smoke.sql`

**Interfaces:**
- Consumes: existing `public.beaches(id,region,lat,lon)` and legacy `public.gfs_wave_shadow_forecasts`.
- Produces: tables `forecast_source_capture_runs`, `forecast_source_capture_scope`, `forecast_source_capture_attempts`, `forecast_source_issuance_revisions`, and `forecast_source_candidates`; RPCs `start_forecast_source_capture_run_v1(jsonb)`, `record_forecast_source_revision(uuid,text,uuid,timestamptz,timestamptz,text,text,timestamptz,text,text,integer,text,text,text,text,text,jsonb)`, and `finalize_forecast_source_capture_run(uuid,text)`.

- [ ] **Step 1: Write the failing migration contract test**

Create `__tests__/migrations/forecast-source-evidence.test.ts` with tests that load the exact timestamped migration and assert the five evidence levels plus immutable run-scope geography and horizon membership, nullable-cycle checks, immutable uniqueness, supersession FK, service-role-only RLS, all three RPCs, legacy classification, and absence of any `enhanced_forecasts` or `ml_predictions_log` mutation:

```ts
import { readFileSync } from "fs";
import { join } from "path";

describe("forecast source evidence migration", () => {
  const path = join(
    __dirname,
    "../../supabase/migrations/20260717172000_create_forecast_source_evidence.sql",
  );
  const sql = readFileSync(path, "utf8");
  const normalized = sql.replace(/\s+/g, " ").toLowerCase();

  it("creates immutable evidence and exact run-scope membership", () => {
    expect(normalized).toContain("create table public.forecast_source_capture_runs");
    expect(normalized).toContain("create table public.forecast_source_capture_scope");
    expect(normalized).toContain("create table public.forecast_source_capture_attempts");
    expect(normalized).toContain("create table public.forecast_source_issuance_revisions");
    expect(normalized).toContain("create table public.forecast_source_candidates");
    expect(normalized).toContain("manifest_hash text not null");
    expect(normalized).toContain("region_snapshot text not null");
    expect(normalized).toContain("latitude_snapshot numeric");
    expect(normalized).toContain("longitude_snapshot numeric");
    expect(normalized).toContain("scope_horizon_anchor_at timestamptz not null");
    expect(normalized).toContain("scope_row_hash text not null");
    expect(normalized).toContain("unique (capture_run_id, scope_ordinal)");
    expect(normalized).toContain(
      "foreign key (capture_run_id, beach_id) references public.forecast_source_capture_scope",
    );
    expect(normalized).toContain("unique (capture_run_id, beach_id)");
    expect(normalized).toContain("attempt_payload_hash text not null");
    expect(normalized).toContain("raw_payload_hash text");
    expect(normalized).toContain("http_status integer");
    expect(normalized).toContain("parsed_payload_hash text not null");
    expect(normalized).toContain("supersedes_revision_id uuid");
    expect(normalized).toContain(
      "unique (issuance_identity, raw_payload_hash, adapter_version, parser_version)",
    );
    expect(normalized).toContain("unique (candidate_id, issuance_revision_id)");
  });

  it("does not invent a provider cycle for unknown-cycle rows", () => {
    expect(normalized).toContain(
      "source_cycle_resolution = 'unknown' and source_cycle_id is null",
    );
    expect(normalized).toContain("source_issued_at timestamptz");
    expect(normalized).toContain("horizon_basis_at timestamptz not null");
  });

  it("uses service-role-only policies and atomic RPCs", () => {
    expect(normalized).toContain("start_forecast_source_capture_run_v1");
    expect(normalized).toContain("record_forecast_source_revision");
    expect(normalized).toContain("finalize_forecast_source_capture_run");
    expect(normalized).toContain("revoke all on function");
    expect(normalized).toContain("grant execute on function");
    expect(normalized).toContain("(select auth.jwt()) ->> 'role' = 'service_role'");
  });

  it("blocks evidence rewrites and guards the only run-state transition", () => {
    expect(normalized).toContain("reject_forecast_source_evidence_mutation");
    expect(normalized).toMatch(/before update or delete on public\.forecast_source_issuance_revisions/);
    expect(normalized).toMatch(/before update or delete on public\.forecast_source_candidates/);
    expect(normalized).toMatch(/before update or delete on public\.forecast_source_capture_attempts/);
    expect(normalized).toMatch(/before update or delete on public\.forecast_source_capture_scope/);
    expect(normalized).toMatch(/before delete on public\.forecast_source_capture_runs/);
    expect(normalized).toContain("capture run finalization collision");
    expect(normalized).toContain(
      "successful_beach_count + rejected_beach_count = attempted_beach_count",
    );
    expect(normalized).toContain("from public.forecast_source_capture_attempts");
    expect(normalized).toContain("from public.forecast_source_capture_scope");
    expect(normalized).toContain("revoke insert, update, delete on public.forecast_source_capture_runs");
  });

  it("derives coverage from persisted scope and candidates", () => {
    expect(normalized).toContain("forecast source capture beach is outside the immutable run scope");
    expect(normalized).toContain("select count(*)::integer");
    expect(normalized).toContain("from public.forecast_source_candidates");
    expect(normalized).not.toContain("jsonb_array_length(p_candidates),");
    expect(normalized).toContain("already claimed inside six-hour cadence");
  });

  it("marks old flat rows as legacy and never touches serving tables", () => {
    expect(normalized).toContain("legacy_identity_incomplete");
    expect(normalized).not.toMatch(/alter table public\.enhanced_forecasts/);
    expect(normalized).not.toMatch(/alter table public\.ml_predictions_log/);
  });
});
```

- [ ] **Step 2: Run the migration test and verify the red state**

Run:

```bash
source ~/.nvm/nvm.sh
nvm use 22
yarn test:unit --runInBand __tests__/migrations/forecast-source-evidence.test.ts
```

Expected: FAIL with `ENOENT` for `20260717172000_create_forecast_source_evidence.sql`.

- [ ] **Step 3: Add the complete additive migration**

Create `supabase/migrations/20260717172000_create_forecast_source_evidence.sql`. The migration must contain these exact columns and constraints; keep all five tables service-role-only, make run creation plus scope insertion one transaction, and make the revision/candidate/attempt RPC one transaction:

```sql
BEGIN;

CREATE TABLE public.forecast_source_capture_runs (
  capture_run_id UUID PRIMARY KEY,
  source TEXT NOT NULL CHECK (source = 'open_meteo'),
  source_model TEXT NOT NULL CHECK (source_model = 'ncep_gfswave016'),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'partial', 'failed')),
  shard_index INTEGER,
  shard_count INTEGER,
  scope_snapshot_hash TEXT NOT NULL CHECK (scope_snapshot_hash ~ '^[0-9a-f]{64}$'),
  manifest_hash TEXT NOT NULL CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  expected_beach_count INTEGER NOT NULL CHECK (expected_beach_count >= 0),
  expected_candidate_count INTEGER NOT NULL CHECK (expected_candidate_count >= 0),
  attempted_beach_count INTEGER NOT NULL DEFAULT 0 CHECK (attempted_beach_count >= 0),
  successful_beach_count INTEGER NOT NULL DEFAULT 0 CHECK (successful_beach_count >= 0),
  rejected_beach_count INTEGER NOT NULL DEFAULT 0 CHECK (rejected_beach_count >= 0),
  candidate_count INTEGER NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  adapter_version TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  code_version TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((shard_index IS NULL AND shard_count IS NULL) OR
         (shard_index >= 0 AND shard_count > 0 AND shard_index < shard_count)),
  CHECK (successful_beach_count + rejected_beach_count = attempted_beach_count),
  CHECK (attempted_beach_count <= expected_beach_count),
  CHECK (candidate_count <= expected_candidate_count),
  CHECK (
    (status = 'started'
      AND attempted_beach_count = 0
      AND successful_beach_count = 0
      AND rejected_beach_count = 0
      AND candidate_count = 0
      AND completed_at IS NULL)
    OR
    (status <> 'started' AND completed_at IS NOT NULL)
  ),
  CHECK (status <> 'completed' OR attempted_beach_count = expected_beach_count)
);

CREATE TABLE public.forecast_source_capture_scope (
  capture_run_id UUID NOT NULL
    REFERENCES public.forecast_source_capture_runs(capture_run_id) ON DELETE RESTRICT,
  beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE RESTRICT,
  scope_ordinal INTEGER NOT NULL CHECK (scope_ordinal > 0),
  region_snapshot TEXT NOT NULL,
  latitude_snapshot NUMERIC(9,6) NOT NULL CHECK (latitude_snapshot BETWEEN -90 AND 90),
  longitude_snapshot NUMERIC(9,6) NOT NULL CHECK (longitude_snapshot BETWEEN -180 AND 180),
  scope_horizon_anchor_at TIMESTAMPTZ NOT NULL,
  scope_row_hash TEXT NOT NULL CHECK (scope_row_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (capture_run_id, beach_id),
  UNIQUE (capture_run_id, scope_ordinal)
);

CREATE TABLE public.forecast_source_issuance_revisions (
  issuance_revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_identity TEXT NOT NULL,
  capture_run_id UUID NOT NULL REFERENCES public.forecast_source_capture_runs(capture_run_id),
  evidence_class TEXT NOT NULL DEFAULT 'serving_model_evidence'
    CHECK (evidence_class = 'serving_model_evidence'),
  beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source = 'open_meteo'),
  source_model TEXT NOT NULL CHECK (source_model = 'ncep_gfswave016'),
  source_issued_at TIMESTAMPTZ,
  horizon_basis_at TIMESTAMPTZ NOT NULL,
  source_cycle_id TEXT,
  source_cycle_resolution TEXT NOT NULL
    CHECK (source_cycle_resolution IN ('provider', 'inferred', 'unknown')),
  retrieved_at TIMESTAMPTZ NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  raw_payload_hash TEXT CHECK (raw_payload_hash IS NULL OR raw_payload_hash ~ '^[0-9a-f]{64}$'),
  adapter_version TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  parsed_payload_hash TEXT NOT NULL CHECK (parsed_payload_hash ~ '^[0-9a-f]{64}$'),
  quality_status TEXT NOT NULL CHECK (quality_status IN (
    'ok', 'all_zero_wave_height', 'missing_wave_height'
  )),
  supersedes_revision_id UUID REFERENCES public.forecast_source_issuance_revisions(issuance_revision_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issuance_revision_id, beach_id, quality_status),
  UNIQUE (issuance_identity, raw_payload_hash, adapter_version, parser_version),
  CHECK (
    (source_cycle_resolution = 'unknown' AND source_cycle_id IS NULL) OR
    (source_cycle_resolution IN ('provider', 'inferred') AND source_cycle_id IS NOT NULL)
  ),
  CHECK (raw_payload_hash IS NOT NULL)
);

CREATE TABLE public.forecast_source_candidates (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_revision_id UUID NOT NULL
    REFERENCES public.forecast_source_issuance_revisions(issuance_revision_id) ON DELETE RESTRICT,
  valid_at TIMESTAMPTZ NOT NULL,
  forecast_horizon_hours INTEGER NOT NULL CHECK (forecast_horizon_hours BETWEEN 0 AND 168),
  measurement_basis TEXT NOT NULL DEFAULT 'offshore_significant_height'
    CHECK (measurement_basis = 'offshore_significant_height'),
  height_unit TEXT NOT NULL DEFAULT 'meters' CHECK (height_unit = 'meters'),
  period_unit TEXT NOT NULL DEFAULT 'seconds' CHECK (period_unit = 'seconds'),
  direction_unit TEXT NOT NULL DEFAULT 'degrees' CHECK (direction_unit = 'degrees'),
  candidate_quality TEXT NOT NULL CHECK (candidate_quality IN ('ok', 'missing_wave_height')),
  wave_height_m NUMERIC(6,3),
  wave_period_s NUMERIC(6,2),
  wave_direction_deg NUMERIC(6,2),
  wave_peak_period_s NUMERIC(6,2),
  swell_height_m NUMERIC(6,3),
  swell_period_s NUMERIC(6,2),
  swell_direction_deg NUMERIC(6,2),
  swell_wave_peak_period_s NUMERIC(6,2),
  wind_wave_height_m NUMERIC(6,3),
  wind_wave_period_s NUMERIC(6,2),
  wind_wave_direction_deg NUMERIC(6,2),
  wind_wave_peak_period_s NUMERIC(6,2),
  secondary_swell_height_m NUMERIC(6,3),
  secondary_swell_period_s NUMERIC(6,2),
  secondary_swell_direction_deg NUMERIC(6,2),
  tertiary_swell_height_m NUMERIC(6,3),
  tertiary_swell_period_s NUMERIC(6,2),
  tertiary_swell_direction_deg NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, issuance_revision_id),
  UNIQUE (issuance_revision_id, valid_at),
  CHECK (candidate_quality <> 'ok' OR wave_height_m IS NOT NULL)
);

CREATE TABLE public.forecast_source_capture_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_run_id UUID NOT NULL
    REFERENCES public.forecast_source_capture_runs(capture_run_id) ON DELETE RESTRICT,
  beach_id UUID NOT NULL REFERENCES public.beaches(id) ON DELETE RESTRICT,
  issuance_revision_id UUID,
  quality_status TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  raw_payload_hash TEXT CHECK (raw_payload_hash IS NULL OR raw_payload_hash ~ '^[0-9a-f]{64}$'),
  http_status INTEGER CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  candidate_count INTEGER NOT NULL CHECK (candidate_count >= 0),
  attempt_payload_hash TEXT NOT NULL CHECK (attempt_payload_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capture_run_id, beach_id),
  CHECK (
    (quality_status IN ('ok', 'all_zero_wave_height', 'missing_wave_height')
      AND issuance_revision_id IS NOT NULL
      AND raw_payload_hash IS NOT NULL
      AND http_status BETWEEN 200 AND 299)
    OR
    (quality_status = 'http_error'
      AND issuance_revision_id IS NULL AND candidate_count = 0
      AND raw_payload_hash IS NOT NULL
      AND http_status BETWEEN 400 AND 599)
    OR
    (quality_status = 'parse_error'
      AND issuance_revision_id IS NULL AND candidate_count = 0
      AND raw_payload_hash IS NOT NULL
      AND http_status BETWEEN 200 AND 299)
    OR
    (quality_status IN ('network_error', 'aborted', 'timed_out')
      AND issuance_revision_id IS NULL AND candidate_count = 0
      AND raw_payload_hash IS NULL AND http_status IS NULL)
  ),
  FOREIGN KEY (capture_run_id, beach_id)
    REFERENCES public.forecast_source_capture_scope(
      capture_run_id, beach_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (issuance_revision_id, beach_id, quality_status)
    REFERENCES public.forecast_source_issuance_revisions(
      issuance_revision_id, beach_id, quality_status
    ) ON DELETE RESTRICT
);

CREATE INDEX idx_forecast_source_runs_started
  ON public.forecast_source_capture_runs(started_at DESC);
CREATE INDEX idx_forecast_source_scope_beach
  ON public.forecast_source_capture_scope(beach_id, capture_run_id);
CREATE INDEX idx_forecast_source_revisions_beach_retrieved
  ON public.forecast_source_issuance_revisions(beach_id, retrieved_at DESC);
CREATE INDEX idx_forecast_source_revisions_cycle
  ON public.forecast_source_issuance_revisions(source_cycle_id, source_cycle_resolution);
CREATE INDEX idx_forecast_source_attempts_run
  ON public.forecast_source_capture_attempts(capture_run_id, retrieved_at DESC);
CREATE INDEX idx_forecast_source_candidates_valid
  ON public.forecast_source_candidates(valid_at DESC);
CREATE INDEX idx_forecast_source_candidates_horizon
  ON public.forecast_source_candidates(forecast_horizon_hours, valid_at DESC);

ALTER TABLE public.forecast_source_capture_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_source_capture_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_source_capture_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_source_issuance_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_source_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY forecast_source_capture_runs_service_role
  ON public.forecast_source_capture_runs FOR ALL
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY forecast_source_capture_scope_service_role
  ON public.forecast_source_capture_scope FOR ALL
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY forecast_source_capture_attempts_service_role
  ON public.forecast_source_capture_attempts FOR ALL
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY forecast_source_issuance_revisions_service_role
  ON public.forecast_source_issuance_revisions FOR ALL
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');
CREATE POLICY forecast_source_candidates_service_role
  ON public.forecast_source_candidates FOR ALL
  USING ((SELECT auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((SELECT auth.jwt()) ->> 'role' = 'service_role');

CREATE OR REPLACE FUNCTION public.reject_forecast_source_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'forecast source evidence is append-only: %', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER reject_forecast_source_revision_mutation
  BEFORE UPDATE OR DELETE ON public.forecast_source_issuance_revisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_source_evidence_mutation();
CREATE TRIGGER reject_forecast_source_attempt_mutation
  BEFORE UPDATE OR DELETE ON public.forecast_source_capture_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_source_evidence_mutation();
CREATE TRIGGER reject_forecast_source_scope_mutation
  BEFORE UPDATE OR DELETE ON public.forecast_source_capture_scope
  FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_source_evidence_mutation();
CREATE TRIGGER reject_forecast_source_candidate_mutation
  BEFORE UPDATE OR DELETE ON public.forecast_source_candidates
  FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_source_evidence_mutation();

CREATE OR REPLACE FUNCTION public.reject_forecast_source_capture_run_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'forecast source capture runs cannot be deleted';
END;
$$;

CREATE TRIGGER reject_forecast_source_capture_run_delete
  BEFORE DELETE ON public.forecast_source_capture_runs
  FOR EACH ROW EXECUTE FUNCTION public.reject_forecast_source_capture_run_delete();

REVOKE ALL ON public.forecast_source_capture_runs,
  public.forecast_source_capture_scope,
  public.forecast_source_capture_attempts,
  public.forecast_source_issuance_revisions,
  public.forecast_source_candidates FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.forecast_source_capture_runs,
  public.forecast_source_capture_scope FROM service_role;
REVOKE INSERT, UPDATE, DELETE ON public.forecast_source_issuance_revisions,
  public.forecast_source_capture_attempts,
  public.forecast_source_candidates FROM service_role;
GRANT SELECT ON public.forecast_source_capture_runs,
  public.forecast_source_capture_scope,
  public.forecast_source_issuance_revisions,
  public.forecast_source_capture_attempts,
  public.forecast_source_candidates TO service_role;

CREATE OR REPLACE FUNCTION public.start_forecast_source_capture_run_v1(
  p_manifest JSONB
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_allowed_keys CONSTANT TEXT[] := ARRAY[
    'capture_run_id', 'shard_index', 'shard_count',
    'observable_beach_ids', 'scope_horizon_anchor_at',
    'expected_candidate_count', 'started_at',
    'code_version', 'adapter_version', 'parser_version'
  ];
  v_capture_run_id UUID;
  v_beach_ids UUID[];
  v_beach_id UUID;
  v_expected_beach_count INTEGER;
  v_scope_horizon_anchor_at TIMESTAMPTZ;
  v_scope_rows JSONB;
  v_scope_snapshot_hash TEXT;
  v_manifest_hash TEXT;
  v_existing public.forecast_source_capture_runs%ROWTYPE;
  v_existing_scope JSONB;
BEGIN
  IF jsonb_typeof(p_manifest) <> 'object'
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(p_manifest) AS k(key)
         WHERE NOT (k.key = ANY (v_allowed_keys))
      ) THEN
    RAISE EXCEPTION 'forecast source capture manifest has unknown keys';
  END IF;
  IF jsonb_typeof(p_manifest->'observable_beach_ids') <> 'array' THEN
    RAISE EXCEPTION 'observable_beach_ids must be an array';
  END IF;

  v_capture_run_id := (p_manifest->>'capture_run_id')::UUID;
  SELECT array_agg(beach_id ORDER BY beach_id::TEXT), count(*)::INTEGER
    INTO v_beach_ids, v_expected_beach_count
    FROM (
      SELECT (value #>> '{}')::UUID AS beach_id
        FROM jsonb_array_elements(p_manifest->'observable_beach_ids') AS e(value)
    ) AS parsed;
  IF v_expected_beach_count = 0
      OR v_expected_beach_count <> (
        SELECT count(DISTINCT scoped.beach_id)::INTEGER
          FROM unnest(v_beach_ids) AS scoped(beach_id)
      ) THEN
    RAISE EXCEPTION 'capture scope must contain distinct beach IDs';
  END IF;
  IF (p_manifest->>'expected_candidate_count')::INTEGER
      <> v_expected_beach_count * 57 THEN
    RAISE EXCEPTION 'capture manifest candidate denominator mismatch';
  END IF;

  v_scope_horizon_anchor_at :=
    (p_manifest->>'scope_horizon_anchor_at')::TIMESTAMPTZ;
  IF v_scope_horizon_anchor_at <> date_trunc('hour', v_scope_horizon_anchor_at)
      OR v_scope_horizon_anchor_at >
        (p_manifest->>'started_at')::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'capture scope horizon anchor is invalid';
  END IF;

  PERFORM 1
    FROM public.beaches
   WHERE id = ANY(v_beach_ids)
   FOR SHARE;
  SELECT jsonb_agg(
    jsonb_build_object(
      'beach_id', b.id,
      'region_snapshot', COALESCE(NULLIF(btrim(b.region), ''), 'unknown'),
      'latitude_snapshot', round(b.lat::NUMERIC, 6),
      'longitude_snapshot', round(b.lon::NUMERIC, 6),
      'scope_horizon_anchor_at', v_scope_horizon_anchor_at
    ) ORDER BY b.id::TEXT
  )
    INTO v_scope_rows
    FROM public.beaches b
   WHERE b.id = ANY(v_beach_ids);
  IF v_scope_rows IS NULL
      OR jsonb_array_length(v_scope_rows) <> v_expected_beach_count THEN
    RAISE EXCEPTION 'capture scope contains a missing beach';
  END IF;

  v_scope_snapshot_hash := encode(
    digest(v_scope_rows::TEXT, 'sha256'), 'hex'
  );
  v_manifest_hash := encode(digest(
    jsonb_build_object(
      'capture_run_id', v_capture_run_id,
      'source', 'open_meteo',
      'source_model', 'ncep_gfswave016',
      'shard_index', p_manifest->'shard_index',
      'shard_count', p_manifest->'shard_count',
      'observable_beach_ids', to_jsonb(v_beach_ids),
      'scope_horizon_anchor_at', v_scope_horizon_anchor_at,
      'scope_snapshot_hash', v_scope_snapshot_hash,
      'expected_candidate_count', v_expected_beach_count * 57,
      'started_at', (p_manifest->>'started_at')::TIMESTAMPTZ,
      'code_version', p_manifest->'code_version',
      'adapter_version', p_manifest->>'adapter_version',
      'parser_version', p_manifest->>'parser_version'
    )::TEXT,
    'sha256'
  ), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(v_capture_run_id::TEXT, 0));
  SELECT * INTO v_existing
    FROM public.forecast_source_capture_runs
   WHERE capture_run_id = v_capture_run_id;
  IF FOUND THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'beach_id', beach_id,
        'region_snapshot', region_snapshot,
        'latitude_snapshot', latitude_snapshot,
        'longitude_snapshot', longitude_snapshot,
        'scope_horizon_anchor_at', scope_horizon_anchor_at
      ) ORDER BY beach_id::TEXT
    )
      INTO v_existing_scope
      FROM public.forecast_source_capture_scope
     WHERE capture_run_id = v_capture_run_id;
    IF v_existing.manifest_hash = v_manifest_hash
        AND v_existing_scope = v_scope_rows THEN
      RETURN v_existing.manifest_hash;
    END IF;
    RAISE EXCEPTION 'forecast source capture run idempotency collision';
  END IF;

  IF abs(extract(epoch FROM (
       (p_manifest->>'started_at')::TIMESTAMPTZ - transaction_timestamp()
     ))) > 300 THEN
    RAISE EXCEPTION 'new capture run started_at is outside the five-minute admission window';
  END IF;
  FOR v_beach_id IN
    SELECT beach_id FROM unnest(v_beach_ids) AS due(beach_id)
    ORDER BY beach_id::TEXT
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended('gfs-wave-cadence:' || v_beach_id::TEXT, 0)
    );
  END LOOP;
  IF EXISTS (
    SELECT 1
      FROM public.forecast_source_capture_scope prior_scope
     WHERE prior_scope.beach_id = ANY(v_beach_ids)
       AND prior_scope.created_at > transaction_timestamp() - interval '6 hours'
  ) THEN
    RAISE EXCEPTION 'forecast source capture beach is already claimed inside six-hour cadence';
  END IF;

  INSERT INTO public.forecast_source_capture_runs (
    capture_run_id, source, source_model, status, shard_index, shard_count,
    scope_snapshot_hash, manifest_hash, expected_beach_count,
    expected_candidate_count, adapter_version, parser_version, code_version,
    started_at
  ) VALUES (
    v_capture_run_id, 'open_meteo', 'ncep_gfswave016', 'started',
    NULLIF(p_manifest->>'shard_index', '')::INTEGER,
    NULLIF(p_manifest->>'shard_count', '')::INTEGER,
    v_scope_snapshot_hash, v_manifest_hash, v_expected_beach_count,
    v_expected_beach_count * 57, p_manifest->>'adapter_version',
    p_manifest->>'parser_version', p_manifest->>'code_version',
    (p_manifest->>'started_at')::TIMESTAMPTZ
  );
  INSERT INTO public.forecast_source_capture_scope (
    capture_run_id, beach_id, scope_ordinal, region_snapshot,
    latitude_snapshot, longitude_snapshot, scope_horizon_anchor_at,
    scope_row_hash
  )
  SELECT
    v_capture_run_id,
    (scope_row->>'beach_id')::UUID,
    ordinality::INTEGER,
    scope_row->>'region_snapshot',
    (scope_row->>'latitude_snapshot')::NUMERIC,
    (scope_row->>'longitude_snapshot')::NUMERIC,
    (scope_row->>'scope_horizon_anchor_at')::TIMESTAMPTZ,
    encode(digest(scope_row::TEXT, 'sha256'), 'hex')
  FROM jsonb_array_elements(v_scope_rows)
    WITH ORDINALITY AS scoped(scope_row, ordinality);

  RETURN v_manifest_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_forecast_source_revision(
  p_capture_run_id UUID,
  p_issuance_identity TEXT,
  p_beach_id UUID,
  p_source_issued_at TIMESTAMPTZ,
  p_horizon_basis_at TIMESTAMPTZ,
  p_source_cycle_id TEXT,
  p_source_cycle_resolution TEXT,
  p_retrieved_at TIMESTAMPTZ,
  p_request_fingerprint TEXT,
  p_raw_payload_hash TEXT,
  p_http_status INTEGER,
  p_adapter_version TEXT,
  p_parser_version TEXT,
  p_parsed_payload_hash TEXT,
  p_quality_status TEXT,
  p_attempt_payload_hash TEXT,
  p_candidates JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_revision_id UUID;
  v_supersedes_revision_id UUID;
  v_existing_parsed_payload_hash TEXT;
  v_existing_beach_id UUID;
  v_existing_source_issued_at TIMESTAMPTZ;
  v_existing_horizon_basis_at TIMESTAMPTZ;
  v_existing_source_cycle_id TEXT;
  v_existing_source_cycle_resolution TEXT;
  v_existing_quality_status TEXT;
  v_revision_created BOOLEAN := false;
  v_persisted_candidate_count INTEGER := 0;
  v_existing_attempt RECORD;
  v_run public.forecast_source_capture_runs%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_capture_run_id::TEXT || ':' || p_beach_id::TEXT, 0)
  );

  SELECT issuance_revision_id, attempt_payload_hash
    INTO v_existing_attempt
    FROM public.forecast_source_capture_attempts
   WHERE capture_run_id = p_capture_run_id
     AND beach_id = p_beach_id;

  IF FOUND THEN
    IF v_existing_attempt.attempt_payload_hash = p_attempt_payload_hash THEN
      RETURN v_existing_attempt.issuance_revision_id;
    END IF;
    RAISE EXCEPTION 'forecast source capture attempt idempotency collision';
  END IF;

  SELECT * INTO v_run
    FROM public.forecast_source_capture_runs
   WHERE capture_run_id = p_capture_run_id
   FOR UPDATE;

  IF NOT FOUND OR v_run.status <> 'started' THEN
    RAISE EXCEPTION 'forecast source capture run is not active';
  END IF;
  IF v_run.adapter_version <> p_adapter_version
      OR v_run.parser_version <> p_parser_version THEN
    RAISE EXCEPTION 'forecast source capture version mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.forecast_source_capture_scope
     WHERE capture_run_id = p_capture_run_id
       AND beach_id = p_beach_id
  ) THEN
    RAISE EXCEPTION 'forecast source capture beach is outside the immutable run scope';
  END IF;
  IF jsonb_typeof(p_candidates) <> 'array' THEN
    RAISE EXCEPTION 'forecast source candidates must be an array';
  END IF;
  IF p_attempt_payload_hash IS NULL
      OR p_attempt_payload_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'forecast source attempt hash must be lowercase SHA-256';
  END IF;

  IF p_quality_status IN (
    'http_error', 'network_error', 'parse_error', 'aborted', 'timed_out'
  ) THEN
    IF p_parsed_payload_hash IS NOT NULL
        OR p_horizon_basis_at IS NOT NULL
        OR p_issuance_identity IS NOT NULL
        OR p_source_issued_at IS NOT NULL
        OR p_source_cycle_id IS NOT NULL
        OR p_source_cycle_resolution IS NOT NULL
        OR jsonb_array_length(p_candidates) <> 0 THEN
      RAISE EXCEPTION 'fetch failures must be attempt-only evidence';
    END IF;
    IF (p_quality_status = 'http_error' AND (
          p_raw_payload_hash IS NULL OR p_http_status NOT BETWEEN 400 AND 599
        ))
        OR (p_quality_status = 'parse_error' AND (
          p_raw_payload_hash IS NULL OR p_http_status NOT BETWEEN 200 AND 299
        ))
        OR (p_quality_status IN ('network_error', 'aborted', 'timed_out') AND (
          p_raw_payload_hash IS NOT NULL OR p_http_status IS NOT NULL
        )) THEN
      RAISE EXCEPTION 'fetch failure body identity is inconsistent with status';
    END IF;
    INSERT INTO public.forecast_source_capture_attempts (
      capture_run_id, beach_id, issuance_revision_id, quality_status,
      retrieved_at, request_fingerprint, raw_payload_hash, http_status,
      candidate_count, attempt_payload_hash
    ) VALUES (
      p_capture_run_id, p_beach_id, NULL, p_quality_status,
      p_retrieved_at, p_request_fingerprint, p_raw_payload_hash, p_http_status,
      0, p_attempt_payload_hash
    );
    RETURN NULL;
  END IF;

  IF p_quality_status NOT IN ('ok', 'all_zero_wave_height', 'missing_wave_height')
      OR p_raw_payload_hash IS NULL OR p_horizon_basis_at IS NULL
      OR p_issuance_identity IS NULL
      OR p_parsed_payload_hash IS NULL
      OR p_parsed_payload_hash !~ '^[0-9a-f]{64}$'
      OR p_source_cycle_resolution NOT IN ('provider', 'inferred', 'unknown')
      OR p_http_status NOT BETWEEN 200 AND 299 THEN
    RAISE EXCEPTION 'parsed source revisions require raw payload identity';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_candidates) AS c(
        valid_at TIMESTAMPTZ,
        forecast_horizon_hours INTEGER
      )
     WHERE c.valid_at IS NULL
        OR c.forecast_horizon_hours IS NULL
        OR c.valid_at <> p_horizon_basis_at
          + c.forecast_horizon_hours * INTERVAL '1 hour'
  ) THEN
    RAISE EXCEPTION 'candidate horizon is inconsistent with immutable horizon basis';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_issuance_identity, 0));

  SELECT issuance_revision_id, parsed_payload_hash, beach_id,
         source_issued_at, horizon_basis_at, source_cycle_id, source_cycle_resolution,
         quality_status
    INTO v_revision_id, v_existing_parsed_payload_hash, v_existing_beach_id,
         v_existing_source_issued_at, v_existing_horizon_basis_at,
         v_existing_source_cycle_id,
         v_existing_source_cycle_resolution, v_existing_quality_status
    FROM public.forecast_source_issuance_revisions
   WHERE issuance_identity = p_issuance_identity
     AND raw_payload_hash IS NOT DISTINCT FROM p_raw_payload_hash
     AND adapter_version = p_adapter_version
     AND parser_version = p_parser_version
   LIMIT 1;

  IF v_revision_id IS NOT NULL
      AND (v_existing_parsed_payload_hash IS DISTINCT FROM p_parsed_payload_hash
        OR v_existing_beach_id IS DISTINCT FROM p_beach_id
        OR v_existing_source_issued_at IS DISTINCT FROM p_source_issued_at
        OR v_existing_horizon_basis_at IS DISTINCT FROM p_horizon_basis_at
        OR v_existing_source_cycle_id IS DISTINCT FROM p_source_cycle_id
        OR v_existing_source_cycle_resolution IS DISTINCT FROM p_source_cycle_resolution
        OR v_existing_quality_status IS DISTINCT FROM p_quality_status) THEN
    RAISE EXCEPTION 'forecast source revision lineage collision';
  END IF;

  IF v_revision_id IS NULL THEN
    SELECT issuance_revision_id
      INTO v_supersedes_revision_id
      FROM public.forecast_source_issuance_revisions
     WHERE issuance_identity = p_issuance_identity
     ORDER BY retrieved_at DESC, created_at DESC
     LIMIT 1;

    INSERT INTO public.forecast_source_issuance_revisions (
      issuance_identity, capture_run_id, beach_id, source, source_model,
      source_issued_at, horizon_basis_at, source_cycle_id, source_cycle_resolution, retrieved_at,
      request_fingerprint, raw_payload_hash, adapter_version, parser_version,
      parsed_payload_hash, quality_status, supersedes_revision_id
    ) VALUES (
      p_issuance_identity, p_capture_run_id, p_beach_id, 'open_meteo',
      'ncep_gfswave016', p_source_issued_at, p_horizon_basis_at, p_source_cycle_id,
      p_source_cycle_resolution, p_retrieved_at, p_request_fingerprint,
      p_raw_payload_hash, p_adapter_version, p_parser_version,
      p_parsed_payload_hash, p_quality_status, v_supersedes_revision_id
    ) RETURNING issuance_revision_id INTO v_revision_id;
    v_revision_created := true;
  END IF;

  IF v_revision_created THEN
    INSERT INTO public.forecast_source_candidates (
    issuance_revision_id, valid_at, forecast_horizon_hours,
    measurement_basis, height_unit, period_unit, direction_unit,
    candidate_quality, wave_height_m, wave_period_s, wave_direction_deg,
    wave_peak_period_s, swell_height_m, swell_period_s, swell_direction_deg,
    swell_wave_peak_period_s, wind_wave_height_m, wind_wave_period_s,
    wind_wave_direction_deg, wind_wave_peak_period_s,
    secondary_swell_height_m, secondary_swell_period_s,
    secondary_swell_direction_deg, tertiary_swell_height_m,
    tertiary_swell_period_s, tertiary_swell_direction_deg
  )
  SELECT
    v_revision_id, c.valid_at, c.forecast_horizon_hours,
    'offshore_significant_height', 'meters', 'seconds', 'degrees',
    c.candidate_quality, c.wave_height_m, c.wave_period_s,
    c.wave_direction_deg, c.wave_peak_period_s, c.swell_height_m,
    c.swell_period_s, c.swell_direction_deg, c.swell_wave_peak_period_s,
    c.wind_wave_height_m, c.wind_wave_period_s, c.wind_wave_direction_deg,
    c.wind_wave_peak_period_s, c.secondary_swell_height_m,
    c.secondary_swell_period_s, c.secondary_swell_direction_deg,
    c.tertiary_swell_height_m, c.tertiary_swell_period_s,
    c.tertiary_swell_direction_deg
  FROM jsonb_to_recordset(COALESCE(p_candidates, '[]'::jsonb)) AS c(
    valid_at TIMESTAMPTZ,
    forecast_horizon_hours INTEGER,
    candidate_quality TEXT,
    wave_height_m NUMERIC,
    wave_period_s NUMERIC,
    wave_direction_deg NUMERIC,
    wave_peak_period_s NUMERIC,
    swell_height_m NUMERIC,
    swell_period_s NUMERIC,
    swell_direction_deg NUMERIC,
    swell_wave_peak_period_s NUMERIC,
    wind_wave_height_m NUMERIC,
    wind_wave_period_s NUMERIC,
    wind_wave_direction_deg NUMERIC,
    wind_wave_peak_period_s NUMERIC,
    secondary_swell_height_m NUMERIC,
    secondary_swell_period_s NUMERIC,
    secondary_swell_direction_deg NUMERIC,
    tertiary_swell_height_m NUMERIC,
    tertiary_swell_period_s NUMERIC,
    tertiary_swell_direction_deg NUMERIC
  )
    ;
  END IF;

  SELECT count(*)::INTEGER
    INTO v_persisted_candidate_count
    FROM public.forecast_source_candidates
   WHERE issuance_revision_id = v_revision_id;

  INSERT INTO public.forecast_source_capture_attempts (
    capture_run_id, beach_id, issuance_revision_id, quality_status,
    retrieved_at, request_fingerprint, raw_payload_hash, http_status,
    candidate_count, attempt_payload_hash
  ) VALUES (
    p_capture_run_id, p_beach_id, v_revision_id, p_quality_status,
    p_retrieved_at, p_request_fingerprint, p_raw_payload_hash, p_http_status,
    v_persisted_candidate_count,
    p_attempt_payload_hash
  );

  RETURN v_revision_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_forecast_source_capture_run(
  p_capture_run_id UUID,
  p_status TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run public.forecast_source_capture_runs%ROWTYPE;
  v_attempted_beach_count INTEGER;
  v_scoped_beach_count INTEGER;
  v_successful_beach_count INTEGER;
  v_rejected_beach_count INTEGER;
  v_candidate_count INTEGER;
BEGIN
  IF p_status NOT IN ('completed', 'partial', 'failed') THEN
    RAISE EXCEPTION 'invalid capture-run terminal status: %', p_status;
  END IF;

  SELECT * INTO v_run
    FROM public.forecast_source_capture_runs
   WHERE capture_run_id = p_capture_run_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'capture run not found: %', p_capture_run_id;
  END IF;

  SELECT count(*)::INTEGER
    INTO v_scoped_beach_count
    FROM public.forecast_source_capture_scope
   WHERE capture_run_id = p_capture_run_id;
  IF v_scoped_beach_count <> v_run.expected_beach_count THEN
    RAISE EXCEPTION 'capture run scope denominator mismatch';
  END IF;

  SELECT
    count(*)::INTEGER,
    count(*) FILTER (WHERE quality_status = 'ok')::INTEGER,
    count(*) FILTER (WHERE quality_status <> 'ok')::INTEGER,
    COALESCE(sum(candidate_count), 0)::INTEGER
    INTO
      v_attempted_beach_count,
      v_successful_beach_count,
      v_rejected_beach_count,
      v_candidate_count
    FROM public.forecast_source_capture_attempts
   WHERE capture_run_id = p_capture_run_id;

  IF v_attempted_beach_count > v_run.expected_beach_count
      OR v_candidate_count > v_run.expected_candidate_count THEN
    RAISE EXCEPTION 'capture run counts exceed manifest expectations';
  END IF;

  IF p_status = 'completed'
      AND v_attempted_beach_count <> v_scoped_beach_count THEN
    RAISE EXCEPTION 'completed capture run must attempt its full beach scope';
  END IF;

  IF v_run.status <> 'started' THEN
    IF v_run.status = p_status
        AND v_run.attempted_beach_count = v_attempted_beach_count
        AND v_run.successful_beach_count = v_successful_beach_count
        AND v_run.rejected_beach_count = v_rejected_beach_count
        AND v_run.candidate_count = v_candidate_count THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'capture run finalization collision';
  END IF;

  UPDATE public.forecast_source_capture_runs
     SET status = p_status,
         attempted_beach_count = v_attempted_beach_count,
         successful_beach_count = v_successful_beach_count,
         rejected_beach_count = v_rejected_beach_count,
         candidate_count = v_candidate_count,
         completed_at = now()
   WHERE capture_run_id = p_capture_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_forecast_source_capture_run_v1(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_forecast_source_capture_run_v1(JSONB)
  TO service_role;
REVOKE ALL ON FUNCTION public.record_forecast_source_revision(
  UUID, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_forecast_source_revision(
  UUID, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_forecast_source_capture_run(
  UUID, TEXT
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_forecast_source_capture_run(
  UUID, TEXT
)
  TO service_role;

ALTER TABLE public.gfs_wave_shadow_forecasts
  ADD COLUMN IF NOT EXISTS evidence_identity_status TEXT NOT NULL
  DEFAULT 'legacy_identity_incomplete'
  CHECK (evidence_identity_status = 'legacy_identity_incomplete');

COMMENT ON TABLE public.forecast_source_capture_runs IS
  'Operational manifest for report-only source capture. A run is mutable only from started to one terminal status.';
COMMENT ON TABLE public.forecast_source_capture_scope IS
  'Immutable, database-enforced beach membership and denominator for one capture run.';
COMMENT ON TABLE public.forecast_source_capture_attempts IS
  'Append-only scoped run/beach retrieval outcomes. Fetch failures are attempt-only and retain body identity when available without inventing issuance revisions.';
COMMENT ON TABLE public.forecast_source_issuance_revisions IS
  'Append-only source issuance revisions. Provider and parser corrections create new rows and never rewrite history.';
COMMENT ON TABLE public.forecast_source_candidates IS
  'Append-only valid-time offshore source candidates tied to one exact issuance revision.';
COMMENT ON COLUMN public.forecast_source_issuance_revisions.source_cycle_id IS
  'Nullable provider/inferred cycle identity. Null unknown-cycle retrievals are not independent issue cycles.';
COMMENT ON COLUMN public.gfs_wave_shadow_forecasts.evidence_identity_status IS
  'Legacy flat rows lack immutable issuance revision identity and are excluded from promotion evidence.';

COMMIT;
```

- [ ] **Step 4: Run the migration test and verify green**

Run:

```bash
yarn test:unit --runInBand __tests__/migrations/forecast-source-evidence.test.ts __tests__/migrations/gfs-wave-shadow-forecasts.test.ts
```

Expected: PASS. The old migration test remains green because the legacy table is retained.

- [ ] **Step 5: Add transactional database behavior smoke coverage**

Create `scripts/db/forecast-source-evidence-smoke.sql` as an idempotent
transaction that rolls back. It must select two seeded beach IDs, `SET LOCAL
ROLE service_role`, and use exception assertions to prove all of the following
against actual PostgreSQL functions and constraints:

1. direct inserts into runs, scope, attempts, revisions, and candidates are denied;
2. `start_forecast_source_capture_run_v1` inserts the exact sorted membership and returns the same manifest hash on an exact retry;
3. changed scalar fields, duplicate scope IDs, changed membership or snapshotted geography/anchor under the same run ID, an off-scope attempt, and a 58-candidate-per-beach denominator are rejected;
4. a normal parsed revision derives attempt `candidate_count` from persisted candidate rows, and a retry cannot inflate it with a different candidate array;
5. separate `network_error` and `timed_out` runs create null-revision, zero-candidate attempts without colliding; `http_error` and `parse_error` retain exact raw-body hash and HTTP status but no issuance, horizon, parsed hash, or candidates; body-less failures reject a forged raw hash;
6. two concurrent new run IDs with an overlapping beach are serialized by sorted per-beach locks; only the first can claim it inside six hours, while 5:59 is rejected and exactly 6:00 is admitted; and
7. `completed` is rejected until every scope member has an attempt, exact repeated finalization is idempotent, and a different terminal status is rejected.

Use this assertion helper in the file rather than comments standing in for
checks:

```sql
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_pattern text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ p_pattern THEN
      RAISE EXCEPTION 'unexpected error: %', SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'expected error matching %, statement succeeded', p_pattern;
END;
$$;
```

- [ ] **Step 6: Stop for migration approval, then validate locally only if approved**

Present the exact migration diff, RLS/grant model, expected row volume, and
rollback behavior. Do not run a database command until the user explicitly
approves applying this migration to the disposable local stack.

Compute the candidate-row ceiling as
`observable_beaches × 57 × 4 captures/day × 90 days`. Record both the live
observable count and projected bytes before approval; at 200 beaches the
underdeduplicated ceiling is 4,104,000 candidate rows. If the projection or
available database headroom is not accepted, keep both latches false and stop.

Run only against the local Supabase stack:

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/db/forecast-source-evidence-smoke.sql
```

Expected: both commands PASS; the smoke transaction prints its terminal
assertion marker and rolls back. If Docker/Supabase is unavailable, record
that environment blocker; do not substitute a linked database.

- [ ] **Step 7: Commit the schema unit only if commits were explicitly authorized**

```bash
git add supabase/migrations/20260717172000_create_forecast_source_evidence.sql __tests__/migrations/forecast-source-evidence.test.ts scripts/db/forecast-source-evidence-smoke.sql
git commit -m "feat(forecast): add immutable source evidence registry"
```

**Mandatory release checkpoint:** Stop before any linked or production migration command. Obtain a second explicit approval for this exact migration file and target project before continuing to rollout; code tasks may continue locally with flags default-off.

### Task 2: Capture Raw Open-Meteo Evidence Without Affecting Display Fetches

**Files:**
- Modify: `lib/services/noaa-wavewatch/api-client.ts:22-35,198-263`
- Create: `lib/services/noaa-wavewatch/open-meteo-evidence-client.ts`
- Modify: `__tests__/lib/services/noaa-wavewatch/api-client.test.ts`
- Create: `__tests__/lib/services/noaa-wavewatch/open-meteo-evidence-client.test.ts`

**Interfaces:**
- Consumes: `OpenMeteoFetchOptions` and `OpenMeteoMarineResponse`.
- Produces: `buildOpenMeteoMarineUrl(latitude: number, longitude: number, days: number, options?: OpenMeteoFetchOptions): string` and `fetchOpenMeteoEvidence(latitude: number, longitude: number, days: number, options?: OpenMeteoFetchOptions & { now?: () => Date; timeoutMs?: number }): Promise<GfsWaveEvidenceFetchResult>`.

- [ ] **Step 1: Add failing URL and raw-evidence tests**

Add a URL-builder assertion to `api-client.test.ts`, and create `open-meteo-evidence-client.test.ts` with a fixed `Uint8Array` response body. Assert SHA-256 of those exact response bytes, a stable request fingerprint, `sourceIssuedAt === null`, `sourceCycleId === null`, `sourceCycleResolution === "unknown"`, and explicit `parse_error`, `http_error`, caller-driven `aborted`, and owned-deadline `timed_out` results. Use fake timers to prove the timeout branch and assert its timer and abort listener are cleaned up.

```ts
expect(result).toEqual(
  expect.objectContaining({
    status: "ok",
    rawPayloadHash: "0b9c9959d8b60fb9e6f54b0b261f50d0d68a4154e273cffb3d85ab01b7428b66",
    sourceIssuedAt: null,
    sourceCycleId: null,
    sourceCycleResolution: "unknown",
    httpStatus: 200,
  }),
);
```

Compute the expected fixture hash once with Node and paste that exact value into the test; never hash decoded or reserialized JSON.

- [ ] **Step 2: Run the focused tests and verify the red state**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/api-client.test.ts __tests__/lib/services/noaa-wavewatch/open-meteo-evidence-client.test.ts
```

Expected: FAIL because `buildOpenMeteoMarineUrl` and `open-meteo-evidence-client.ts` do not exist.

- [ ] **Step 3: Export the canonical URL builder without changing the display contract**

Move the current `URLSearchParams` construction into this exact export and make `fetchOpenMeteoData` call it. Its return type remains `Promise<OpenMeteoMarineResponse | null>`.

```ts
export function buildOpenMeteoMarineUrl(
  latitude: number,
  longitude: number,
  days: number,
  options: OpenMeteoFetchOptions = {},
): string {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly: OPEN_METEO_HOURLY_FIELDS.join(","),
    timezone: options.timezone ?? "UTC",
    forecast_days: Math.min(days, FORECAST_CONFIG.OPEN_METEO_API_LIMIT).toString(),
  });
  if (options.model) params.set("models", options.model);
  if (options.timeformat) params.set("timeformat", options.timeformat);
  return `${API_ENDPOINTS.OPEN_METEO_MARINE_BASE}?${params.toString()}`;
}
```

Define `OPEN_METEO_HOURLY_FIELDS` from the exact 18 fields currently embedded in `fetchOpenMeteoData`; do not add or remove a requested field.

- [ ] **Step 4: Implement the evidence-only raw fetcher**

Create `open-meteo-evidence-client.ts` with the stable contract below. Read `response.arrayBuffer()` once, hash the exact bytes, decode once as UTF-8, then parse. This function owns its per-beach deadline and distinguishes that deadline from caller cancellation. Do not call this function from the normal display Open-Meteo wrapper.

```ts
import "server-only";
import { createHash } from "crypto";
import {
  buildOpenMeteoMarineUrl,
  type OpenMeteoFetchOptions,
} from "./api-client";
import type { OpenMeteoMarineResponse } from "./types";

export interface GfsWaveEvidenceFetchResult {
  status:
    | "ok"
    | "http_error"
    | "network_error"
    | "parse_error"
    | "aborted"
    | "timed_out";
  payload: OpenMeteoMarineResponse | null;
  retrievedAt: string;
  requestFingerprint: string;
  rawPayloadHash: string | null;
  sourceIssuedAt: null;
  sourceCycleId: null;
  sourceCycleResolution: "unknown";
  httpStatus: number | null;
}

export async function fetchOpenMeteoEvidence(
  latitude: number,
  longitude: number,
  days: number,
  options: OpenMeteoFetchOptions & {
    now?: () => Date;
    timeoutMs?: number;
  } = {},
): Promise<GfsWaveEvidenceFetchResult> {
  const url = buildOpenMeteoMarineUrl(latitude, longitude, days, options);
  const completedAt = () => (options.now?.() ?? new Date()).toISOString();
  const requestFingerprint = createHash("sha256").update(url, "utf8").digest("hex");
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("evidence fetch timed out", "TimeoutError"));
  }, options.timeoutMs ?? 8_000);
  const base = {
    requestFingerprint,
    sourceIssuedAt: null,
    sourceCycleId: null,
    sourceCycleResolution: "unknown" as const,
  };

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Quiver/1.0 (https://quiversurf.app)" },
      signal: controller.signal,
    });
    const rawBytes = new Uint8Array(await response.arrayBuffer());
    const retrievedAt = completedAt();
    const rawPayloadHash = createHash("sha256").update(rawBytes).digest("hex");
    const raw = new TextDecoder("utf-8").decode(rawBytes);
    if (!response.ok) {
      return { ...base, retrievedAt, status: "http_error", payload: null, rawPayloadHash, httpStatus: response.status };
    }
    try {
      return {
        ...base,
        retrievedAt,
        status: "ok",
        payload: JSON.parse(raw) as OpenMeteoMarineResponse,
        rawPayloadHash,
        httpStatus: response.status,
      };
    } catch {
      return { ...base, retrievedAt, status: "parse_error", payload: null, rawPayloadHash, httpStatus: response.status };
    }
  } catch (error) {
    const aborted = controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");
    return {
      ...base,
      retrievedAt: completedAt(),
      status: timedOut ? "timed_out" : aborted ? "aborted" : "network_error",
      payload: null,
      rawPayloadHash: null,
      httpStatus: null,
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
```

- [ ] **Step 5: Run the focused tests and typecheck**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/api-client.test.ts __tests__/lib/services/noaa-wavewatch/open-meteo-evidence-client.test.ts
yarn typecheck
```

Expected: both commands PASS; the original `fetchOpenMeteoData` URL assertions remain unchanged.

- [ ] **Step 6: Commit the fetch-envelope unit only if commits were explicitly authorized**

```bash
git add lib/services/noaa-wavewatch/api-client.ts lib/services/noaa-wavewatch/open-meteo-evidence-client.ts __tests__/lib/services/noaa-wavewatch/api-client.test.ts __tests__/lib/services/noaa-wavewatch/open-meteo-evidence-client.test.ts
git commit -m "feat(forecast): retain raw GFS evidence identity"
```

### Task 3: Build And Persist Immutable GFS Revisions

**Files:**
- Create: `lib/services/noaa-wavewatch/forecast-source-evidence.ts`
- Create: `__tests__/lib/services/noaa-wavewatch/forecast-source-evidence.test.ts`
- Modify: `lib/services/noaa-wavewatch/gfs-wave-shadow.ts:1-335`
- Modify: `__tests__/lib/services/noaa-wavewatch/gfs-wave-shadow.test.ts:1-269`

**Interfaces:**
- Consumes: `GfsWaveEvidenceFetchResult`, the Task 1 RPCs, and existing GFS point parsing.
- Produces: `GfsWaveShadowCapture`, `buildGfsWaveShadowCandidates(input: { horizonBasisAt: Date; forecastTimes: Date[]; capture: GfsWaveShadowCapture }): ForecastSourceCandidateInsert[]`, `recordGfsWaveShadowCapture(input: { context: ForecastSourceCaptureContext; beachId: string; forecastTimes: Date[]; capture: GfsWaveShadowCapture }): Promise<string | null>`, `startForecastSourceCaptureRun(input: ForecastSourceCaptureRunInput): Promise<boolean>`, and `finalizeForecastSourceCaptureRun(captureRunId: string, status: "completed" | "partial" | "failed"): Promise<boolean>`.

- [ ] **Step 1: Replace flat-row tests with failing revision tests**

Change the GFS tests to require:

```ts
expect(isGfsWaveShadowCaptureEnabled()).toBe(false);
process.env.GFS_WAVE_SHADOW_CAPTURE_ENABLED = "true";
expect(isGfsWaveShadowCaptureEnabled()).toBe(false);
process.env.FORECAST_SOURCE_REVISION_CAPTURE_ENABLED = "true";
expect(isGfsWaveShadowCaptureEnabled()).toBe(true);
```

Add tests proving an all-zero payload records revision quality `all_zero_wave_height` with an empty candidate array, a normal payload records exact valid-time candidates, unknown-cycle identity is stable across capture runs while `sourceCycleId` remains null, and retrieving the same raw payload six hours later produces the same horizon basis, candidate horizons, and parsed hash. In the writer test, assert the only Supabase operations are `.rpc("start_forecast_source_capture_run_v1", expectedManifest)`, `.rpc("record_forecast_source_revision", expectedPayload)`, and `.rpc("finalize_forecast_source_capture_run", expectedTerminalPayload)`; fail if direct table insertion or `enhanced_forecasts`, `ml_predictions_log`, or `gfs_wave_shadow_forecasts` is requested. Also prove:

1. an identical capture-manifest retry succeeds while a reused `captureRunId` with any changed scalar or beach membership fails closed;
2. an exact retry for the same run/beach returns the same revision, but a changed `attempt_payload_hash` reports an idempotency collision;
3. an unchanged known-cycle revision reused in a later run creates a new attempt link for that later run and contributes to its database-derived counts;
4. an exact already-recorded retry remains idempotent after finalization, while any new or changed run/beach write is rejected; and
5. repeated finalization with the same terminal status is idempotent, while a different terminal status reports a collision.
6. two separate transport failures for the same unknown-cycle beach create separate attempt-only rows without a revision-lineage collision.

- [ ] **Step 2: Run focused tests and verify the red state**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/gfs-wave-shadow.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-evidence.test.ts
```

Expected: FAIL because the new registry module and double-latch behavior do not exist.

- [ ] **Step 3: Add exact registry types and write functions**

Create `forecast-source-evidence.ts` with these public contracts:

```ts
export const FORECAST_SOURCE_ADAPTER_VERSION = "open-meteo-gfs-wave.v1";
export const FORECAST_SOURCE_PARSER_VERSION = "gfs-wave-parser.v2";

export interface ForecastSourceCaptureContext {
  captureRunId: string;
  anchorTime: Date;
}

export interface ForecastSourceCandidateInsert {
  valid_at: string;
  forecast_horizon_hours: number;
  candidate_quality: "ok" | "missing_wave_height";
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  wave_peak_period_s: number | null;
  swell_height_m: number | null;
  swell_period_s: number | null;
  swell_direction_deg: number | null;
  swell_wave_peak_period_s: number | null;
  wind_wave_height_m: number | null;
  wind_wave_period_s: number | null;
  wind_wave_direction_deg: number | null;
  wind_wave_peak_period_s: number | null;
  secondary_swell_height_m: number | null;
  secondary_swell_period_s: number | null;
  secondary_swell_direction_deg: number | null;
  tertiary_swell_height_m: number | null;
  tertiary_swell_period_s: number | null;
  tertiary_swell_direction_deg: number | null;
}

interface ForecastSourceWriteBase {
  captureRunId: string;
  beachId: string;
  retrievedAt: string;
  requestFingerprint: string;
}

export interface ParsedForecastSourceRevisionWrite extends ForecastSourceWriteBase {
  writeKind: "parsed_revision";
  issuanceIdentity: string;
  sourceIssuedAt: string | null;
  horizonBasisAt: string;
  sourceCycleId: string | null;
  sourceCycleResolution: "provider" | "inferred" | "unknown";
  rawPayloadHash: string;
  httpStatus: number;
  parsedPayloadHash: string;
  qualityStatus: "ok" | "all_zero_wave_height" | "missing_wave_height";
  candidates: ForecastSourceCandidateInsert[];
}

export interface ForecastSourceFetchFailureWrite extends ForecastSourceWriteBase {
  writeKind: "fetch_failure";
  issuanceIdentity: null;
  sourceIssuedAt: null;
  horizonBasisAt: null;
  sourceCycleId: null;
  sourceCycleResolution: null;
  rawPayloadHash: string | null;
  httpStatus: number | null;
  parsedPayloadHash: null;
  qualityStatus: "http_error" | "network_error" | "parse_error" | "aborted" | "timed_out";
  candidates: [];
}

export type ForecastSourceRevisionWrite =
  | ParsedForecastSourceRevisionWrite
  | ForecastSourceFetchFailureWrite;

export interface ForecastSourceCaptureRunInput {
  captureRunId: string;
  shardIndex: number | null;
  shardCount: number | null;
  observableBeachIds: string[];
  scopeHorizonAnchorAt: Date;
  expectedCandidateCount: number;
  startedAt: Date;
  codeVersion: string | null;
}

export function buildIssuanceIdentity(input: {
  beachId: string;
  sourceCycleId: string | null;
}): string {
  const suffix = input.sourceCycleId === null
    ? "cycle:unknown"
    : `cycle:${input.sourceCycleId}`;
  return `open_meteo:ncep_gfswave016:beach:${input.beachId}:${suffix}`;
}

export async function recordForecastSourceRevision(
  write: ForecastSourceRevisionWrite,
): Promise<string | null>;

export async function startForecastSourceCaptureRun(
  input: ForecastSourceCaptureRunInput,
): Promise<boolean>;

export async function finalizeForecastSourceCaptureRun(
  captureRunId: string,
  status: "completed" | "partial" | "failed",
): Promise<boolean>;
```

`recordForecastSourceRevision` must map the discriminated union to the exact
`p_*` RPC names and include both version constants. For parsed payloads, set
`horizonBasisAt` to provider issuance time when available, otherwise the
earliest valid timestamp contained in the raw response; never use the run
anchor or retrieval time. Canonically hash `{ issuanceIdentity, beachId,
sourceIssuedAt, horizonBasisAt, sourceCycleId, sourceCycleResolution,
rawPayloadHash, adapterVersion, parserVersion, qualityStatus,
candidatesSortedByValidAt }` as `p_parsed_payload_hash`; exclude retrieval/run
metadata so an unchanged raw issuance produces the same revision six hours
later. Then hash `{ captureRunId, beachId, retrievedAt, requestFingerprint,
rawPayloadHash, httpStatus, parsedPayloadHash, qualityStatus }` as
`p_attempt_payload_hash`; an application retry must reuse the original fetch
envelope.

For `http_error` and `parse_error`, retain the exact raw-body hash and HTTP
status while sending null issuance, horizon, cycle resolution, and parsed hash.
For `network_error`, `timed_out`, and `aborted`, send null raw hash and HTTP
status as well. Every failure sends an empty candidate tuple and creates only
an attempt row, so separate runs never collide under a made-up issuance. Tests
must assert the exact RPC payload for HTTP 500 bytes, HTTP-200 invalid JSON,
network failure, and timeout, plus rejection of a raw hash on a body-less
failure. The RPC rejects a different parsed hash for the same raw
payload/parser and never adds candidates to an existing revision. Return the
UUID or null from `data`, log-and-return-null on failure, and never throw into
display generation.

`startForecastSourceCaptureRun` calls only
`start_forecast_source_capture_run_v1` with sorted distinct beach IDs, the
injected UTC-hour `scopeHorizonAnchorAt`, and scalar manifest fields.
PostgreSQL first handles exact same-run retry, then takes sorted per-beach
cadence locks and rejects any beach already claimed by another immutable scope
inside six hours. This makes admission atomic across concurrent cron, retry,
and manual invocations. It then share-locks those beaches for the transaction, snapshots each
beach's region plus six-decimal latitude/longitude, derives each row hash, the
complete scope hash, scope count, manifest hash, and 57-slots-per-beach
denominator, then inserts the run plus memberships atomically. The scope anchor
is planning lineage only; parsed candidate horizons continue to use provider
issue time or earliest provider valid time. On retry the RPC compares every
scalar and the full frozen scope, not only caller IDs or a caller hash. A
collision is logged and returns false. `finalizeForecastSourceCaptureRun`
sends only run ID and terminal status. PostgreSQL derives all counters from
immutable in-scope attempts and persisted candidate rows, so caller arrays
cannot inflate coverage.

- [ ] **Step 4: Refactor GFS parsing around one capture envelope**

Keep the existing point fields, but replace the flat row contract with:

```ts
export interface GfsWaveShadowCapture {
  source_model: typeof GFS_WAVE_SHADOW_MODEL;
  source: typeof GFS_WAVE_SHADOW_SOURCE;
  quality_status: ForecastSourceRevisionQualityStatus;
  retrieved_at: string;
  request_fingerprint: string;
  raw_payload_hash: string | null;
  http_status: number | null;
  source_issued_at: string | null;
  source_cycle_id: string | null;
  source_cycle_resolution: SourceCycleResolution;
  forecast: GfsWaveShadowForecast | null;
}

export function isGfsWaveShadowCaptureEnabled(): boolean {
  return process.env.FORECAST_SOURCE_REVISION_CAPTURE_ENABLED === "true" &&
    process.env.GFS_WAVE_SHADOW_CAPTURE_ENABLED === "true";
}

export async function fetchGfsWaveShadowCapture(
  latitude: number,
  longitude: number,
  days: number,
  options: { signal?: AbortSignal } = {},
): Promise<GfsWaveShadowCapture>;

export function buildGfsWaveShadowCandidates(input: {
  horizonBasisAt: Date;
  forecastTimes: Date[];
  capture: GfsWaveShadowCapture;
}): ForecastSourceCandidateInsert[];

export async function recordGfsWaveShadowCapture(input: {
  context: ForecastSourceCaptureContext;
  beachId: string;
  forecastTimes: Date[];
  capture: GfsWaveShadowCapture;
}): Promise<string | null>;
```

Compute each `forecast_horizon_hours` from `valid_at - horizonBasisAt`; require
an exact whole-hour value from 0 through 168 and reject rather than round. The
run anchor remains cadence metadata only.

Map raw fetch states directly except that a successful parsed payload is classified `all_zero_wave_height`, `missing_wave_height`, or `ok`. Persist rejected attempts with no candidates. Remove `GFS_WAVE_SHADOW_CAPTURE_DISABLED`, `GFS_WAVE_SHADOW_TABLE`, `GfsWaveShadowRow`, `mapGfsWaveShadowRowsForInsert`, and `logGfsWaveShadowRows`; the old table remains read-only legacy evidence.

- [ ] **Step 5: Run the focused tests and verify green**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/gfs-wave-shadow.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-evidence.test.ts
yarn typecheck
```

Expected: PASS. The all-zero test proves the attempt is visible but has zero promotion candidates.

- [ ] **Step 6: Commit the immutable writer unit only if commits were explicitly authorized**

```bash
git add lib/services/noaa-wavewatch/forecast-source-evidence.ts lib/services/noaa-wavewatch/gfs-wave-shadow.ts __tests__/lib/services/noaa-wavewatch/forecast-source-evidence.test.ts __tests__/lib/services/noaa-wavewatch/gfs-wave-shadow.test.ts
git commit -m "feat(forecast): persist immutable GFS revisions"
```

### Task 4: Run Scoped Capture Only After Serving Work Is Durable

**Files:**
- Create: `lib/services/noaa-wavewatch/forecast-source-capture-runner.ts`
- Create: `__tests__/lib/services/noaa-wavewatch/forecast-source-capture-runner.test.ts`
- Modify: `lib/utils/forecast-server-utils.ts:16-38,95-107`
- Modify: `app/api/cron/enhanced-forecast-sync/_shared.ts:123-217`
- Modify: `lib/services/enhanced-forecast-service.ts:90-371,602-645,690-790`
- Modify: `__tests__/lib/services/enhanced-forecast-service.test.ts`
- Modify: `__tests__/app/api/cron/enhanced-forecast-sync.test.ts`

**Interfaces:**
- Consumes: Task 3 fetch envelopes and writer functions, the normal update's already-frozen selected-beach list, and a fresh evidence-only deadline.
- Produces: `ForecastUpdateOptions.captureRunId?: string` and `runForecastSourceCaptureAfterServing(input: ForecastSourceCaptureRunnerInput): Promise<ForecastSourceCaptureRunResult>`; exactly one immutable run manifest per eligible cron shard. It is never called by `ForecastBuilder` and never returns forecast values.

- [ ] **Step 1: Add failing scope, deadline, and ordering tests**

Add assertions that:

1. `_shared.ts` passes its generated `executionId` as `captureRunId`.
2. No evidence query occurs unless both latches are true.
3. The RPC receives the exact sorted intersection of selected, observable beach IDs with no immutable scope claim inside six hours; an off-scope beach is rejected.
4. A prior scope claim is authoritative even when its run has zero attempts: at 5 hours 59 minutes the beach is excluded, and at exactly 6 hours it is due.
5. If the intersection is empty, no run is created.
6. Display rows for every selected beach are built and durably persisted before the first evidence query or network fetch.
7. With a fixed serving deadline, selected beaches, and display fixtures, capture off, immediate capture, timed-out capture, and a capture promise that outlives the serving deadline yield deeply equal serving rows and identical processed/skipped beach IDs.
8. An evidence timeout records an attempt-only `timed_out` outcome when the RPC budget remains; if the whole evidence phase expires first, the run finalizes `partial` without changing the already-created serving result.
9. Reusing a run ID with altered scope fails closed, and no out-of-scope attempt can make a run complete.
10. Two concurrent provisional scopes sharing one beach produce one admitted run; the loser refetches scope claims on its next invocation and can then admit its remaining due beaches without the raced beach.

```ts
expect(displayPersistenceOrder).toEqual(["build", "persist", "capture-start"]);
expect(withTimedOutCapture.servingResult).toEqual(withCaptureOff.servingResult);
expect(withTimedOutCapture.processedBeachIds).toEqual(withCaptureOff.processedBeachIds);
expect(startRpcPayload.observable_beach_ids).toEqual([...expectedIds].sort());
expect(startRpcPayload.scope_horizon_anchor_at).toBe("2026-07-17T12:00:00.000Z");
```

- [ ] **Step 2: Run the focused tests and verify the red state**

```bash
yarn test:unit --runInBand __tests__/app/api/cron/enhanced-forecast-sync.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-capture-runner.test.ts
```

Expected: FAIL because the post-serving runner and ordering guarantee do not exist.

- [ ] **Step 3: Propagate only the server-owned run identity**

```ts
export type ForecastUpdateOptions = {
  deadlineMs?: number;
  shard?: number;
  shardCount?: number;
  captureRunId?: string;
};
```

Pass `executionId` as `captureRunId`. Do not add capture context to
`ForecastInputs`, `ForecastBuilder`, any client forecast row, or the success
response. Capture must not share the serving loop's per-beach deadline.

- [ ] **Step 4: Implement a bounded post-serving runner**

Define the exact runner contract:

```ts
export interface ForecastSourceCaptureRunnerInput {
  captureRunId: string;
  anchorTime: Date;
  shardIndex: number | null;
  shardCount: number | null;
  selectedBeaches: ReadonlyArray<Pick<Beach, "id">>;
  evidenceDeadlineMs: number;
}

export interface ForecastSourceCaptureRunResult {
  status: "not_enabled" | "not_due" | "completed" | "partial" | "failed";
  attemptedBeachIds: string[];
}

export async function runForecastSourceCaptureAfterServing(
  input: ForecastSourceCaptureRunnerInput,
): Promise<ForecastSourceCaptureRunResult>;
```

`updateAllEnhancedForecasts()` must first finish its existing selection,
generation, and persistence path and freeze the serving return value. Only
then, in a separate guarded phase, call the runner with a fresh 20,000 ms
evidence budget. Await it so serverless work is not abandoned, but catch every
error and return the already-frozen serving result unchanged. The runner loads
observable membership and latest immutable scope claims (including started
runs with zero attempts), computes the sorted due intersection, and calls
`start_forecast_source_capture_run_v1` once with the full
scope array and the same UTC-hour `anchorTime` as
`scope_horizon_anchor_at`, then fetches and records each scoped beach. The
database, not the runner's potentially stale beach objects, freezes region and
coordinates and owns the final race-safe cadence decision. A cadence collision
creates no second run, returns `not_due`, and triggers a fresh scope-claim query
on the next invocation rather than partially proceeding. It uses 57 expected
slots per beach for 0 through 168 hours in three-hour increments.

Each scoped beach calls the atomic record RPC exactly once after a terminal
fetch state. Track only durable-write success, never coverage counters.
Finalize with run ID and terminal status only: `completed` only when every
scope member durably attempted, `partial` for phase timeout/early stop/write
failure, and `failed` for an unexpected runner-level exception. PostgreSQL
derives all counters from scope, attempts, and persisted candidate rows.

- [ ] **Step 5: Run the focused suite, lint, and typecheck**

```bash
yarn test:unit --runInBand __tests__/app/api/cron/enhanced-forecast-sync.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-capture-runner.test.ts __tests__/lib/services/noaa-wavewatch/gfs-wave-shadow.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-evidence.test.ts
npx eslint --max-warnings=0 app/api/cron/enhanced-forecast-sync/_shared.ts lib/utils/forecast-server-utils.ts lib/services/enhanced-forecast-service.ts lib/services/noaa-wavewatch/forecast-source-capture-runner.ts lib/services/noaa-wavewatch/gfs-wave-shadow.ts lib/services/noaa-wavewatch/forecast-source-evidence.ts
yarn typecheck
```

Expected: all three commands PASS, including identical processed/skipped
serving beaches across capture modes.

- [ ] **Step 6: Commit the orchestration unit only if commits were explicitly authorized**

```bash
git add app/api/cron/enhanced-forecast-sync/_shared.ts lib/utils/forecast-server-utils.ts lib/services/enhanced-forecast-service.ts lib/services/noaa-wavewatch/forecast-source-capture-runner.ts __tests__/app/api/cron/enhanced-forecast-sync.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-capture-runner.test.ts
git commit -m "feat(forecast): isolate GFS capture after serving writes"
```

### Task 5: Extract And Characterize The Pure Legacy Source Policy

**Files:**
- Create: `lib/services/noaa-wavewatch/source-policy.ts`
- Create: `__tests__/lib/services/noaa-wavewatch/source-policy.test.ts`
- Modify: `lib/services/noaa-wavewatch/noaa-wavewatch-service.ts:185-264`
- Modify: `__tests__/lib/services/noaa-wavewatch/merge-preserves-om.test.ts:61-204`

**Interfaces:**
- Consumes: `WaveWatchData` NOAA/Open-Meteo candidates and an injected anchor.
- Produces: `selectForecastSource(input: ForecastSourcePolicyInput): ForecastSourcePolicyDecision`; the only P0-C mode is `legacy_72h`.

- [ ] **Step 1: Write exact seam characterization tests first**

Create fixed tests for `71:59:59`, `72:00:00`, and `72:00:01`; NOAA fallback after 72 hours; Open-Meteo-only selection both before and after 72 hours; no candidate; and a changed anchor producing the corresponding changed horizon. Add end-to-end merge tests proving NOAA rows retain `om_values` at or before 72 hours and that both-source, NOAA-only, Open-Meteo-only, and neither-source branches preserve their pre-extraction outputs byte for byte.

```ts
expect(selectForecastSource({
  anchorTime: new Date("2026-07-17T00:00:00Z"),
  validTime: new Date("2026-07-20T00:00:00Z"),
  noaaCandidate,
  openMeteoCandidate,
  mode: "legacy_72h",
})).toEqual({
  selectedCandidate: noaaCandidate,
  selectedSource: "NOAA_NWS",
  reason: "noaa_at_or_before_72h",
  policyVersion: "legacy-72h.v1",
});
```

- [ ] **Step 2: Run policy tests and verify the red state**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/source-policy.test.ts __tests__/lib/services/noaa-wavewatch/merge-preserves-om.test.ts
```

Expected: FAIL because `source-policy.ts` does not exist and merge still reads `Date.now()` internally.

- [ ] **Step 3: Implement the pure selector and flag helpers**

Create this exact public contract:

```ts
import type { WaveWatchData } from "./types";

export type ForecastSourcePolicyMode = "legacy_72h";
export type ForecastSourcePolicyVersion = "legacy-72h.v1";
export type ForecastSourcePolicyReason =
  | "noaa_at_or_before_72h"
  | "open_meteo_after_72h"
  | "noaa_fallback_after_72h"
  | "open_meteo_only"
  | "no_candidate";

export interface ForecastSourcePolicyDecision {
  selectedCandidate: WaveWatchData | null;
  selectedSource: "NOAA_NWS" | "OPEN_METEO" | null;
  reason: ForecastSourcePolicyReason;
  policyVersion: ForecastSourcePolicyVersion;
}

export interface ForecastSourcePolicyInput {
  anchorTime: Date;
  validTime: Date;
  noaaCandidate: WaveWatchData | null;
  openMeteoCandidate: WaveWatchData | null;
  mode: ForecastSourcePolicyMode;
}

export function getForecastSourcePolicyMode(): ForecastSourcePolicyMode {
  return "legacy_72h";
}

export function isForecastSourcePolicyShadowEnabled(): boolean {
  return process.env.FORECAST_SOURCE_POLICY_SHADOW_ENABLED === "true";
}

export function selectForecastSource(
  input: ForecastSourcePolicyInput,
): ForecastSourcePolicyDecision;
```

The implementation computes horizon from `validTime - anchorTime`, never calls `Date.now()`, selects NOAA when `hoursAhead <= 72`, prefers Open-Meteo after 72 hours, falls back to the available source when its preferred source is absent, and never accepts a GFS candidate parameter. `getForecastSourcePolicyMode` intentionally returns the only serving mode even when the environment contains an invalid value; log the invalid value once from the service, not from the pure function.

- [ ] **Step 4: Delegate merge selection while preserving output bytes**

Preserve the existing seam instant: after `Promise.allSettled` resolves, capture `anchorTime = new Date()` immediately before the current source-choice block (the same point at which `mergeForecasts` currently calls `Date.now()`), then pass that one value through selection. Do not move the anchor ahead of network I/O. Route both-source, NOAA-only, Open-Meteo-only, and no-source decisions through `selectForecastSource`; the no-source branch supplies a deterministic sentinel valid time equal to the anchor solely to obtain `reason='no_candidate'` and still returns `null`. Keep the current three-hour `Math.round` slot key, chronological extension ordering, omission of unmatched Open-Meteo slots inside the NOAA-covered range, and NOAA `om_values` co-location. Add characterization assertions around each of those details before refactoring. When `FORECAST_SOURCE_POLICY_SHADOW_ENABLED=true`, aggregate reason counts and write one structured log per request containing only policy version, mode, counts, latitude, and longitude. The shadow flag must not choose an alternate source.

- [ ] **Step 5: Run policy and regression suites**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/source-policy.test.ts __tests__/lib/services/noaa-wavewatch/merge-preserves-om.test.ts __tests__/lib/services/noaa-wavewatch/horizon-fill.test.ts __tests__/lib/services/noaa-wavewatch/om-column-pipeline.test.ts
npx eslint --max-warnings=0 lib/services/noaa-wavewatch/source-policy.ts lib/services/noaa-wavewatch/noaa-wavewatch-service.ts
yarn typecheck
```

Expected: all commands PASS. Snapshot/fixture values before and after extraction are equal.

- [ ] **Step 6: Commit the policy-boundary unit only if commits were explicitly authorized**

```bash
git add lib/services/noaa-wavewatch/source-policy.ts lib/services/noaa-wavewatch/noaa-wavewatch-service.ts __tests__/lib/services/noaa-wavewatch/source-policy.test.ts __tests__/lib/services/noaa-wavewatch/merge-preserves-om.test.ts
git commit -m "refactor(forecast): isolate legacy source policy"
```

### Task 6: Add Strict GFS Capture Health And Read-Only Live Validation

**Files:**
- Create: `lib/services/noaa-wavewatch/forecast-source-health.ts`
- Create: `__tests__/lib/services/noaa-wavewatch/forecast-source-health.test.ts`
- Create: `scripts/validate-gfs-wave-shadow.ts`
- Create: `__tests__/scripts/validate-gfs-wave-shadow.test.ts`

**Interfaces:**
- Consumes: registry rows and optional `fetchOpenMeteoEvidence` live probe.
- Produces: `buildForecastSourceHealthReport(input: ForecastSourceHealthInput): ForecastSourceHealthReport`, stable blocker codes, `--json`, `--strict`, and `--live-probe=LAT,LON`.

- [ ] **Step 1: Write failing health and CLI tests**

Cover these blocker codes exactly:

```ts
export type ForecastSourceHealthBlocker =
  | "no_completed_capture_run"
  | "capture_stale"
  | "capture_scope_denominator_mismatch"
  | "capture_coverage_below_95pct"
  | "no_nonzero_candidates"
  | "rejected_source_attempts"
  | "missing_72h_seam_side"
  | "provider_cycle_unknown";
```

Assert that ten unknown-cycle revisions produce `independentIssueCycles: 0`, not 10. Assert `--strict` exits `2` for operational blockers, while `provider_cycle_unknown` blocks promotion evidence but does not mark otherwise healthy capture transport as failed. Assert `--live-probe` never instantiates a Supabase writer or calls an RPC.

- [ ] **Step 2: Run tests and verify the red state**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/forecast-source-health.test.ts __tests__/scripts/validate-gfs-wave-shadow.test.ts
```

Expected: FAIL because both implementation files are absent.

- [ ] **Step 3: Implement the pure report contract**

```ts
export interface ForecastSourceHealthThresholds {
  maxAgeMinutes: number;
  minCoveragePct: number;
}

export interface ForecastSourceHealthReport {
  generatedAt: string;
  latestCompletedRunAt: string | null;
  latestRetrievedAt: string | null;
  expectedCandidates: number;
  capturedCandidates: number;
  coveragePct: number;
  nonzeroCandidates: number;
  rejectedAttempts: number;
  independentIssueCycles: number;
  unknownCycleRevisions: number;
  hasAtOrBefore72h: boolean;
  hasAfter72h: boolean;
  operationalStatus: "healthy" | "blocked";
  promotionEvidenceStatus: "eligible_for_scoring" | "blocked";
  blockers: ForecastSourceHealthBlocker[];
}

export interface ForecastSourceHealthInput {
  runs: ForecastSourceCaptureRunHealthRow[];
  scope: ForecastSourceCaptureScopeHealthRow[];
  attempts: ForecastSourceCaptureAttemptHealthRow[];
  revisions: ForecastSourceRevisionHealthRow[];
  candidates: ForecastSourceCandidateHealthRow[];
  now: Date;
  thresholds: ForecastSourceHealthThresholds;
}

export function buildForecastSourceHealthReport(
  input: ForecastSourceHealthInput,
): ForecastSourceHealthReport;
```

Scope attempts to the latest completed run, require its immutable scope-row count to equal `expected_beach_count`, then join attempt revision IDs to candidates. Coverage uses the database-owned denominator `scope_count * 57` and the sum of immutable attempt counts that were themselves derived from persisted candidates; it must also equal the stored expected candidate count. Rejected attempt-only transport rows come from that same run. Nonzero means `wave_height_m > 0`; seam sides are `forecast_horizon_hours <= 72` and `> 72`; independent cycles include only non-null `source_cycle_id` with `provider` or approved `inferred` resolution. A revision's creating `capture_run_id` is never used as current-run coverage because unchanged revisions can be reused by later runs.

- [ ] **Step 4: Implement the read-only CLI**

The script queries only the five new registry tables, including exact run-scope membership. Defaults are `--max-age-minutes=420` (six-hour cadence plus one hour of delivery tolerance) and `--min-coverage-pct=95`. `--json` prints one JSON document; Markdown is the default. `--strict` returns `2` for operational blockers and `0` for a healthy capture even when promotion remains blocked solely by unknown provider cycles. `--live-probe=32.8328,-117.2713` performs one pinned-model raw fetch, prints status/hash/nonzero counts, and never calls a database writer.

- [ ] **Step 5: Run focused tests and a fixture-only CLI smoke test**

```bash
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch/forecast-source-health.test.ts __tests__/scripts/validate-gfs-wave-shadow.test.ts
npx tsx scripts/validate-gfs-wave-shadow.ts --help
npx eslint --max-warnings=0 lib/services/noaa-wavewatch/forecast-source-health.ts scripts/validate-gfs-wave-shadow.ts
yarn typecheck
```

Expected: all commands PASS; `--help` exits `0` without environment variables.

- [ ] **Step 6: Run the optional upstream probe and record its status honestly**

```bash
npx tsx scripts/validate-gfs-wave-shadow.ts --json --live-probe=32.8328,-117.2713
```

Expected when the upstream is reachable: exit `0`, model `ncep_gfswave016`, a 64-character raw hash, and at least one nonzero wave-height value. A network, proxy, or all-zero response is a live-validation blocker and must not be reported as fixture success.

- [ ] **Step 7: Commit the GFS health unit only if commits were explicitly authorized**

```bash
git add lib/services/noaa-wavewatch/forecast-source-health.ts scripts/validate-gfs-wave-shadow.ts __tests__/lib/services/noaa-wavewatch/forecast-source-health.test.ts __tests__/scripts/validate-gfs-wave-shadow.test.ts
git commit -m "feat(forecast): add GFS evidence health checks"
```

### Task 7: Make WaveCast Discrepancy Monitoring Machine-Readable And Strict

**Files:**
- Modify: `scripts/validate-wavecast-calibration.ts:1-607`
- Create: `__tests__/scripts/validate-wavecast-calibration.test.ts`

**Interfaces:**
- Consumes: local WaveCast snapshot, display provenance, seam transitions, and `ForecastSourceHealthReport`.
- Produces: `WaveCastCalibrationReport`, `--json`, `--strict`, and deterministic exit codes. It never writes to Supabase.

- [ ] **Step 1: Add failing summary and strict-mode tests**

Use in-memory rows and a fixed clock to cover aligned, under, over, jumpy, and missing counts; largest regional undercall; stale snapshot; nonzero `failed_sources`; NOAA→Open-Meteo seam timing/height jump; and propagated GFS operational blockers.

```ts
expect(report.statusCounts).toEqual({
  aligned: 1,
  under: 1,
  over: 1,
  jumpy: 1,
  missing: 1,
});
expect(strictExitCode(report)).toBe(2);
```

- [ ] **Step 2: Run the script test and verify the red state**

```bash
yarn test:unit --runInBand __tests__/scripts/validate-wavecast-calibration.test.ts
```

Expected: FAIL because the script has no exported report builder, argument parser, or strict exit function.

- [ ] **Step 3: Extract the deterministic report interface**

Export these contracts from the script while preserving existing Markdown content:

```ts
export interface WaveCastCalibrationReport {
  generatedAt: string;
  snapshotPath: string;
  snapshotAgeHours: number | null;
  failedSourceCount: number;
  statusCounts: {
    aligned: number;
    under: number;
    over: number;
    jumpy: number;
    missing: number;
  };
  largestRegionalUndercall: {
    region: string;
    beachName: string;
    dateLabel: string;
    undercallFt: number;
  } | null;
  seam: {
    transitionAt: string | null;
    heightJumpFt: number | null;
    fromSource: string | null;
    toSource: string | null;
  };
  gfs: ForecastSourceHealthReport;
  blockers: string[];
}

export function buildWaveCastCalibrationReport(input: WaveCastCalibrationInput): WaveCastCalibrationReport;
export function strictExitCode(report: WaveCastCalibrationReport): 0 | 2;
```

Default strict thresholds are snapshot age `30` hours and critical undercall `2` feet. Block on stale scrape, any failed scraper source, a critical undercall, a missing/large seam transition, or GFS operational blockers. A scraper/GFS failure only changes the script exit code and alert payload; normal forecast serving never imports or calls this script.

- [ ] **Step 4: Add CLI parsing and JSON output**

Support `--json`, `--strict`, `--max-snapshot-age-hours=N`, and `--critical-undercall-ft=N`. JSON mode prints exactly one JSON object. Markdown remains default. Set `process.exitCode = strictExitCode(report)` only when `--strict` is present.

- [ ] **Step 5: Run the monitor tests, lint, and typecheck**

```bash
yarn test:unit --runInBand __tests__/scripts/validate-wavecast-calibration.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-health.test.ts
npx eslint --max-warnings=0 scripts/validate-wavecast-calibration.ts
yarn typecheck
```

Expected: all commands PASS.

- [ ] **Step 6: Run the local monitor without claiming serving validation**

```bash
npx tsx scripts/validate-wavecast-calibration.ts --json --strict
```

Expected: exit `0` only when the local scrape is fresh, has zero failed sources, no critical discrepancy blocker exists, and GFS transport health is good. Exit `2` is an actionable monitoring result, not an application failure and not permission to alter forecasts.

- [ ] **Step 7: Commit the monitoring unit only if commits were explicitly authorized**

```bash
git add scripts/validate-wavecast-calibration.ts __tests__/scripts/validate-wavecast-calibration.test.ts
git commit -m "feat(forecast): add strict source discrepancy monitor"
```

### Task 8: Document, Run Full Gates, And Exercise Flag Rollback

**Files:**
- Modify: `lib/services/noaa-wavewatch/ARCHITECTURE.md`
- Create: `docs/deployment/forecast-source-evidence-runbook.md`

**Interfaces:**
- Consumes: all P0-C flags, health commands, and migration name.
- Produces: an operator sequence that cannot accidentally enable the stale legacy flag or promote a source policy.

- [ ] **Step 1: Write the deployment runbook before rollout**

Document this exact sequence:

1. Obtain explicit approval for `20260717172000_create_forecast_source_evidence.sql` and the named Supabase project.
2. Apply the approved additive migration before deploying writer code.
3. Verify `FORECAST_SOURCE_REVISION_CAPTURE_ENABLED=false` before deployment; the old `GFS_WAVE_SHADOW_CAPTURE_ENABLED` value is not trusted.
4. Deploy Quiver with `FORECAST_SOURCE_POLICY_MODE=legacy_72h` and `FORECAST_SOURCE_POLICY_SHADOW_ENABLED=false`.
5. Run the strict policy and unit gates.
6. Enable `GFS_WAVE_SHADOW_CAPTURE_ENABLED=true` while the new latch remains false and verify no capture run is created.
7. Enable `FORECAST_SOURCE_REVISION_CAPTURE_ENABLED=true` and invoke one normal forecast shard.
8. Verify a completed/partial run, fresh nonzero candidates, rejected-attempt visibility, and no GFS value in `enhanced_forecasts.data_source` or display provenance.
9. Enable `FORECAST_SOURCE_POLICY_SHADOW_ENABLED=true` only after capture health is good; verify serving output remains byte-equivalent under `legacy_72h` fixtures.
10. Exercise rollback by setting `FORECAST_SOURCE_REVISION_CAPTURE_ENABLED=false`, invoke the next shard, and prove no new capture run is created while normal display updates remain healthy.
11. Record the campaign start and automatic review date 90 days later; disable both capture flags at that boundary unless a separately approved retention/storage plan extends collection.

The runbook must state that unknown provider-cycle retrievals remain useful for transport/coverage diagnostics but contribute zero independent issue cycles. It must also state that no serving-policy proposal can proceed until P0-D is complete.

- [ ] **Step 2: Update architecture documentation**

Add the five evidence levels plus immutable run-scope geography/horizon membership, six-hour capture cadence, 90-day collection boundary, exact flag truth table, the `legacy-72h.v1` reason codes, and the P0-D dependency to `ARCHITECTURE.md`. Mark `gfs_wave_shadow_forecasts` as legacy identity-incomplete storage, not the active writer destination.

- [ ] **Step 3: Run all focused P0-C tests**

```bash
source ~/.nvm/nvm.sh
nvm use 22
yarn test:unit --runInBand __tests__/migrations/forecast-source-evidence.test.ts __tests__/migrations/gfs-wave-shadow-forecasts.test.ts __tests__/lib/services/noaa-wavewatch/api-client.test.ts __tests__/lib/services/noaa-wavewatch/open-meteo-evidence-client.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-evidence.test.ts __tests__/lib/services/noaa-wavewatch/gfs-wave-shadow.test.ts __tests__/lib/services/noaa-wavewatch/source-policy.test.ts __tests__/lib/services/noaa-wavewatch/merge-preserves-om.test.ts __tests__/lib/services/noaa-wavewatch/horizon-fill.test.ts __tests__/lib/services/noaa-wavewatch/om-column-pipeline.test.ts __tests__/lib/services/noaa-wavewatch/forecast-source-health.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/lib/services/forecast/forecast-builder.test.ts __tests__/app/api/cron/enhanced-forecast-sync.test.ts __tests__/scripts/validate-gfs-wave-shadow.test.ts __tests__/scripts/validate-wavecast-calibration.test.ts
```

Expected: PASS with no skipped P0-C characterization test.

- [ ] **Step 4: Run repository gates**

```bash
npx eslint --max-warnings=0 app/api/cron/enhanced-forecast-sync/_shared.ts lib/utils/forecast-server-utils.ts lib/services/enhanced-forecast-service.ts lib/services/forecast/forecast-builder.ts lib/services/noaa-wavewatch/api-client.ts lib/services/noaa-wavewatch/open-meteo-evidence-client.ts lib/services/noaa-wavewatch/forecast-source-evidence.ts lib/services/noaa-wavewatch/gfs-wave-shadow.ts lib/services/noaa-wavewatch/source-policy.ts lib/services/noaa-wavewatch/noaa-wavewatch-service.ts lib/services/noaa-wavewatch/forecast-source-health.ts scripts/validate-gfs-wave-shadow.ts scripts/validate-wavecast-calibration.ts
yarn typecheck
yarn test:unit --runInBand __tests__/lib/services/noaa-wavewatch __tests__/lib/services/forecast/forecast-builder.test.ts __tests__/lib/services/enhanced-forecast-service.test.ts __tests__/app/api/cron/enhanced-forecast-sync.test.ts
```

Expected: all commands PASS. No browser E2E is required because this plan changes no UI or response contract; the listed API/cron test is still required.

- [ ] **Step 5: Review the final diff for serving isolation**

Run:

```bash
git diff --check
git diff --stat
git diff -- lib/services/noaa-wavewatch lib/services/enhanced-forecast-service.ts lib/services/forecast/forecast-builder.ts lib/utils/forecast-server-utils.ts app/api/cron/enhanced-forecast-sync/_shared.ts scripts/validate-gfs-wave-shadow.ts scripts/validate-wavecast-calibration.ts supabase/migrations/20260717172000_create_forecast_source_evidence.sql
```

Expected: no whitespace errors; no GFS candidate is accepted by `selectForecastSource`; no evidence writer references `enhanced_forecasts`; no user-facing confidence treatment appears; unrelated dirty files are absent.

- [ ] **Step 6: Commit documentation separately only if commits were explicitly authorized**

```bash
git add lib/services/noaa-wavewatch/ARCHITECTURE.md docs/deployment/forecast-source-evidence-runbook.md
git commit -m "docs(forecast): add evidence rollout runbook"
```

## Completion Gate

P0-C is complete only when all of the following are evidenced:

- The exact approved migration is live before writer enablement.
- The new revision latch is default-off and the stale legacy flag cannot activate writes alone.
- A fresh capture run contains nonzero pinned GFS candidates and visible rejected attempts.
- Every revision carries request identity, retrieval time, raw hash when bytes exist, adapter/parser versions, quality status, and exact candidate lineage.
- Provider-cycle identity remains null when unavailable, and health output reports zero false independent cycles.
- GFS capture cannot write to or supply values for the display forecast path.
- The pure policy exactly preserves the 72-hour seam, fallback, extension, co-location, and ordering behavior under an injected anchor.
- Policy shadow mode changes only internal summaries.
- Strict GFS and WaveCast monitors produce machine-readable results and nonzero alert exits without affecting serving.
- Rollback has been exercised by disabling the new revision latch and verifying normal display health.
- P0-D remains an explicit blocker for trustworthy source scoring and any serving promotion.

## Self-Review Checklist

- [ ] Every P0-C source-handoff requirement maps to a task above.
- [ ] The migration filename is exactly `20260717172000_create_forecast_source_evidence.sql`.
- [ ] Every new file is marked **new** in the file map.
- [ ] No implementation task changes recommendations, user-visible confidence, beach transformation, or GFS serving.
- [ ] Types and function names match across task interfaces.
- [ ] The capture-run identity and unknown provider-cycle identity are distinct concepts.
- [ ] Migration application is separated from code implementation by an explicit approval gate.
- [ ] Every task starts with a failing test, reaches a passing focused test, and includes an atomic commit step that runs only when commits were explicitly authorized.
- [ ] Rollout starts flags off and rollback requires no destructive database operation.
