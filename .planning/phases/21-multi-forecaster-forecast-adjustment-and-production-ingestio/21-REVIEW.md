---
phase: 21-multi-forecaster-forecast-adjustment-and-production-ingestio
status: issues_found
depth: deep
files_reviewed: 9
findings:
  critical: 4
  warning: 2
  info: 0
  total: 6
reviewed_at: 2026-07-28
---

# Phase 21 Draft Code Review

## Scope

- `lib/services/forecast/trusted-forecast-adjustment.ts`
- `lib/services/forecast/forecast-builder.ts`
- `lib/services/forecast/log-display-prediction.ts`
- `supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql`
- Their five modified or new Jest suites

## Findings

### CR-01 — Decisions do not enforce one beach-local day or one claim per slot

The decision engine groups rows by exact UTC `valid_start|valid_end` strings. Overlapping windows can therefore produce multiple decisions that claim and mutate the same forecast slot, allowing cumulative movement beyond the ±0.50 ft cap. The schema has no daily-decision or slot-application uniqueness constraint.

Required correction: group by beach IANA local date, select one authority decision per local day, persist one append-only application per forecast slot, and reject or exactly reuse conflicting durable claims.

### CR-02 — Conflict and authority semantics do not match the approved contract

Independent providers are combined with midpoint spread and a unioned min/max range. This can hide separated ranges, lets corroborators change the primary authority range, and has no provider-lineage or exposure compatibility model.

Required correction: preserve the selected primary range, deduplicate shared lineage, apply coverage/exposure precedence, and block only when independent nearest-edge separation exceeds 1.00 ft.

### CR-03 — Persistence violates append-only and first-write snapshot invariants

`trusted_forecast_adjustments` is mutable through service-role `UPDATE` and client-side upsert. `syncTrustedForecastApplications` updates existing `ml_predictions_log` rows after an ignored duplicate insert, changing first-write prediction history.

Required correction: use immutable issues, decisions, applications, alert evidence, and receipts; block update/delete; and link applications to existing or newly inserted first-write snapshots without changing existing snapshot bytes.

### CR-04 — Adjusted output can be served without atomic durable proof

The builder persists decisions, mutates public forecast output, and later calls a snapshot writer that intentionally swallows failures. Decisions, applications, snapshots, and a build receipt are not committed atomically, and ambiguous transport outcomes cannot be reconciled.

Required correction: persist the complete build through one service-role RPC, insert a canonical receipt last, reconcile ambiguous outcomes by receipt hash/count, and return adjusted output only after matching durable proof.

### WR-01 — Exact adjustment and horizon boundaries are incomplete

`Math.round()` is asymmetric for negative half steps, so the current algorithm does not implement mirrored 0.500/0.749/0.750 bands. Slots are also not filtered by raw elapsed horizon before decision generation, allowing negative or over-168-hour slots to be adjusted.

Required correction: use explicit magnitude branches with sign applied separately and filter raw horizons to `0 <= hours <= 168`.

### WR-02 — Schema and tests cover only the narrow draft

The provider enum supports only WaveCast and NWS, the schema omits full lineage, measurement basis, ingest outcomes, applications, alerts, and receipts, and the migration tests are string-presence checks rather than runtime privilege/idempotency tests.

Required correction: implement the normalized 17-source contract and add local Postgres/pgTAP coverage for least privilege, append-only behavior, canonical hashing, exact replay, atomic rollback, daily/slot uniqueness, and first-write preservation.

## Disposition

Do not commit or deploy the Phase 21 implementation draft. Execute plans 21-01 through 21-05, then rerun focused Jest, local Postgres/pgTAP, full unit/typecheck, privacy scans, and the approval-gated production verification sequence.
