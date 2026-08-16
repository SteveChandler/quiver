# 21-02 Summary — Immutable Trusted-Forecast Storage

**Status: LOCAL WORK COMPLETE. PRODUCTION GATE PENDING — the push was aborted, not completed.**

Branch `feat/trusted-forecast-schema`, commit `986f90bb327a18b1e93310b828d75d1bf3c43965`, in
`quiver/.worktrees/p21-02-schema`. Nothing was written to production.

## Artifacts

| Path | State |
|---|---|
| `supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql` | written, applies cleanly locally |
| `supabase/tests/database/trusted_external_forecast_adjustments.test.sql` | 62 pgTAP assertions, all passing |
| `__tests__/migrations/trusted-external-forecast-adjustments.test.ts` | 18 tests, all passing |

```
supabase test db …trusted_external_forecast_adjustments.test.sql
  All tests successful. Files=1, Tests=62   Result: PASS
supabase test db (full):  Files=4, Tests=81
yarn test:unit …trusted-external-forecast-adjustments.test.ts  ->  18 passed
yarn typecheck  ->  clean (53.66s)
```

The two `Result: FAIL` entries in the full `supabase test db` run are `community_*_integration.sql`.
They are **not pgTAP files** (`grep -c "plan("` returns 0), were committed in July, and are unrelated.

## Objects created — all additive

Seven tables, all with RLS enabled and no policy: `trusted_forecast_ingest_runs`,
`trusted_forecast_ingest_source_results`, `trusted_forecast_issues`, `trusted_forecast_decisions`,
`trusted_forecast_applications`, `trusted_forecast_alerts`, `trusted_forecast_build_receipts`.

Functions: `reject_trusted_forecast_mutation`, `reject_trusted_forecast_alert_mutation`,
`trusted_forecast_snapshot_columns`, the `trusted_forecast_canonical_*` family,
`persist_trusted_forecast_build(jsonb)`, `get_trusted_forecast_build_receipt(text)`,
`acknowledge_trusted_forecast_alert(jsonb)`. Seven triggers (6 append-only + alert-acknowledgement).

**No `DROP`, `DELETE` or `TRUNCATE` anywhere.** Wrapped in `BEGIN; … COMMIT;` with a rollback block.

## 🚫 Production gate — ABORTED, and why

The D-25/D-26 authorization check was run read-only from a clean detached worktree at the candidate SHA.
The pending set is **not** the required singleton:

```
pending:  20260727231500  (ours)
          20260802160000, 20260802161000, 20260802162000,
          20260803120000, 20260803121000        (Apple-orphan work)
remote-only, no local file:  20260803120919, 20260803130817
```

1. **Six pending, not one.** Pushing would carry five unrelated migrations — the expanded set the plan forbids.
2. **`20260802162000` is syntactically broken.** It uses the reserved keyword `current_user` as a table
   alias (`current_user.created_at`, line 60): `ERROR: syntax error at or near "."`. It would abort the
   push **mid-way, after this migration had already applied.** Pre-existing on `origin/main`.
3. **`supabase db push --dry-run --linked` refuses**, because production carries two remote-only
   versions. The CLI requires `migration repair` / `db pull` first — the Drift Repair Protocol, a
   production `schema_migrations` mutation outside this plan's additive scope.

The operator authorization covered *this schema*, not a six-migration batch containing a broken
migration, and not a production history repair.

### To unblock

1. Fix `current_user.created_at` in `20260802162000` (quote it or rename the alias).
2. Classify `20260803120919` and `20260803130817` per the Drift Repair Protocol in `docs/MIGRATION_SAFETY.md`.
3. Decide whether the five Apple-orphan migrations land with this one or separately.

Once pending is genuinely `20260727231500` alone, this pushes with the artifacts above already proven.

## Truth → proving assertion

| `must_haves.truth` | pgTAP |
|---|---|
| Quiver's migration is the sole ledger | static suite — no Seaside mirror |
| Append-only; `ml_predictions_log` stays first-write-wins (D-18) | 26/27 update+delete rejected, 30 refusal names the table, 31 all 7 tables carry the trigger, 44 pre-existing snapshot byte-for-byte unchanged |
| One strict RPC persists atomically, receipt last (D-19) | 33-37 rejection cases; 38-40 prove 0 decisions / 0 applications / 0 receipts after a mid-build failure |
| DB canonicalizes, recomputes SHA-256, replay accepted only on hash **and** every exact count (D-20) | 42, 33, 49/50 identical replay returns identical receipt, 51/52 collisions, 53-56 four independently isolated count drifts |
| Only the ack RPC may change status/actor/timestamp (D-22) | 58-62 |
| public/anon/authenticated cannot read tables or execute RPCs (D-23) | 1-17 |
| One decision per beach/local day, one claim per slot (D-13) | 47/48 plus `UNIQUE (beach_id, local_date)` / `UNIQUE (beach_id, forecast_at)` |
| Production push only for the singleton after local evidence (D-25/D-26) | **not satisfied — aborted before any mutation** |

## Carry-forward columns from 21-01 — all four present

`trusted_forecast_issues.day_part` (CHECK `all_day\|day\|night`), `.validity_basis`
(CHECK `stated\|derived_publication_day`); `trusted_forecast_ingest_source_results.degraded_failure_code`
(nullable), `.degraded_item_count` (NOT NULL DEFAULT 0). pgTAP 18-21 assert existence; 23 proves the
degraded CHECK mirrors `SourceResult.__post_init__`.

## Two anti-constraints deliberately avoided

Verified against 21-01's real emitted rows, not the brief. `region_key` is plain `text` with **no**
vocabulary CHECK — it carries chart spot slugs (`huntington-beach`) when `scope_type='spot'`, and a
region-enum CHECK would fail on the first insert of 264 socal rows. `exposure` is plain `text NOT NULL`
with **no** enum — values range over `kauai/NORTH`, `NNW`, `SSW`, `primary`, `dominant` and
surf.institute `summaries[].type`. pgTAP 24/25 pin both.

## Three findings the plan did not anticipate

1. **A foreign key on `ingest_run_id` would have broken every ingestion run.** The cron writes issues →
   source results → **run row last**. The FK was omitted deliberately, documented in the migration and
   pinned by a static test.
2. **`21-RESEARCH.md`'s snapshot example is wrong against the live schema.** It shows
   `on conflict (beach_id, predicted_at)`, but migration `20260618160000` dropped that unique index in
   favour of `(beach_id, predicted_at, forecast_horizon_bucket, display_source) NULLS NOT DISTINCT`. The
   research version fails with *"no unique or exclusion constraint matching the ON CONFLICT
   specification"* on first use. The live target was used instead.
3. The RPC snapshot carries the full **55-column** `log-display-prediction` contract from a single
   source of truth (`trusted_forecast_snapshot_columns()`), read by both validator and canonicalizer.

## Mutation checks — 4/4 RED

| Mutation | Result |
|---|---|
| remove the issues append-only trigger | 22, 26, 27, 30, 31, 32 RED |
| `ON CONFLICT … DO NOTHING` → `DO UPDATE` | 43, 44 RED |
| delete only the `expected_alert_count` comparison | 54 RED **alone** |
| delete `REVOKE ALL ON trusted_forecast_issues` | 1, 2, 3 RED |

Isolating each count required seeding a receipt with the correct digest and one drifted count across
four separate build keys, since counts are otherwise cross-validated against array lengths.

## Separate defect found — `yarn db:reset` does not complete on this repo

`20260618160000_phase0_forecast_accuracy_metrics.sql` hard-fails unless
`app.phase0_forecast_accuracy_migration_approved` is set in-session, and the CLI cannot supply it
(`ALTER ROLE` is wiped by reset, `ALTER SYSTEM` rejects the custom GUC, `PGOPTIONS` is not honored by the
Go client). The remaining 40 migrations were applied via `psql -c "SET app.…" -f <file>` per
`docs/research/2026-06-19-phase0-migration-approval-request.md`. **Worth its own fix** — anyone running
`yarn db:reset` today hits this.

## Deviations from the plan

1. The production push step is **not** completed. See the gate section above.
2. The local database now has every migration except `20260802162000`, which cannot apply.
