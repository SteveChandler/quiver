# Swell Watch native-timestep tracking — release evidence (2026-09-13/14)

No-send automated study repair. Sends stay disabled; no study authority, policy, cohort, freshness, matching threshold, or qualifying-day rule changed. No new migration.

## Reconciled production state before the change (read-only, 2026-09-14 02:10 UTC)

- Production alias `www.quiversurf.app` served deployment `dpl_3xmw2Y21LKoqxcdp89zSsJ8VjVBV` (prod branch `70dac2545`, created 2026-09-13 21:44 UTC), newer than the `6f2ff240c` / `dpl_6bkegVL9…` pair in the brief. PR #759/#760 (exact-360° normalization) and migration `20260913192652_normalize_swell_watch_provider_direction` were already live.
- Study authority epoch 2 active (policy hash `86616945…`, expires 2026-10-25, 12 h freshness). `read_swell_watch_study_health`: 0 evaluated runs, 7 suppressed attempts, 0/30 qualifying days. Automation control `disabled`; 0 production push authorities; 0 notification bindings; 0 shadow-demand runs.
- Every retained epoch-2 cohort (latest: provider batch `2a5c82cf-…`, issuance 2026-09-13T18:00Z) recorded `suppressed`. Scope outcomes: Waikiki–Canoes `2ac8b200-…` `unclosed_episode`; Cape Hatteras `d264fbf8-…` `incomplete_partition`; eight sources derived. Hourly cron rows `/api/cron/swell-watch-acquire` at :15 report `Study suppressed` with recovery `{processed: 1, failed: 0}`.
- Repair package `swell_watch_blocker_resolution_20260913.zip`: all eight baseline source files hash-identical to `origin/main a71b79445`; Waikiki and Hatteras `semanticPayload` values equal production's `read_swell_watch_attested_run` components for all 168 frames (checked against a fresh read-only export of batch `7aec200e-…`).

## Defect 1 — Waikiki `unclosed_episode` (resolved)

Open-Meteo GFS-Wave single runs are model-native hourly through forecast hour 120 and three-hourly afterwards; intermediate hours are provider-interpolated per ranked slot. The unchanged matcher recognises the native rank swap 138 h → 141 h as `[1, 0]` but cannot follow the interpolated hour 139. Fix: track on model-native frames only, bound to source identity.

- `lib/alerts/swell-watch/native-sampling.ts`: profile `ncep_gfswave016.native-1h-to-120h-3h-to-168h.v1` resolved from attested `source` (`open_meteo` / `open_meteo_single_runs` / `ncep_gfswave016` / `ncep`, 7 forecast days, 6-hour issuance). Native indices 0..120 hourly then 123..165 three-hourly (136 native, 32 interpolated). Witness `provider-linear-interpolation.v1`: each bracketed interpolated frame must sit within 1° of shortest-arc linear direction interpolation (long arc accepted at a ≥179° tie) and 0.02 m of linear height; period is not witnessed (provider interpolation is non-linear). Violation → `sampling_profile_mismatch` (fail closed). Empirical basis: all retained payloads and the ten-source historical cohort deviate ≤0.33° / ≤0.003 m.
- `lib/alerts/swell-watch/horizon-derivation.ts`: version `swell-watch-horizon-derivation.v2`; all 168 frames validated (complete tuples, frame times, witness); tracking over native frames with explicit `gapHoursBefore`; per-episode `arrivalWindow`, `peakWindow`, `closureWindow`; actionability evaluated on the whole arrival window — a window straddling the 2-day or 5-day boundary throws `arrival_window_crosses_actionability` (explicit suppression, never a silent pass or drop). Persisted `arrival_at` = latest onset bound (first native candidate frame), `peak_at` = native peak; matcher and the 6 h arrival/peak delta unchanged.
- `attested-run.ts` keeps the literal source schema and additionally binds the profile; `provider-impact-ingestion.ts` / `shadow-evaluation.ts` carry `derivation` at the top level of the study result (`scopeOutcomes` entries stay exactly `{sourcePointId,status,reason}` as `record_swell_watch_study_evaluation` requires).
- Retained Waikiki now derives one closed event at both recorded analysis clocks: arrival window 2026-09-18 15:00Z → 18:00Z (point estimate 18:00Z), closure window 2026-09-20 00:00Z → 03:00Z. Historical 2026-09-09T18:00Z cohort is unchanged (7 derived / 2 `incomplete_partition` / 1 `unbounded_episode`).

## Defect 2 — Hatteras `incomplete_partition` (precisely blocked)

See `swell-watch-partition-absence-decision-20260913.md` and `swell-watch-partition-absence-probe-20260913.json`. NCEP gfswave 0p16 inventories carry no partition-count field; at the Hatteras cell `SWELL:2` is bitmap-missing at f004 and f048 while HTSGW and `SWELL:1` decode with values. Bitmap-missing cannot distinguish an absent partition from an undefined value, and Open-Meteo's zero-fill discards the cause. Hatteras stays suppressed; the cohort cannot qualify under the current study definition until a separately reviewed amendment or a source-backed absence contract exists.

## Isolated integration evidence

`bash scripts/test-swell-watch-study-postgres.sh` (Docker `postgres:15`, `NODE_OPTIONS=--conditions=react-server`) runs the real receipt storage, `complete_swell_watch_study_run`, `evaluateSwellWatchShadow` (real attested reads, derivation, `ingest_swell_watch_cohort`, event history, audience, shadow demand) and `record_swell_watch_study_evaluation`. New labelled section `synthetic_time_shifted_retained_native_sampling`: nine flat synthetic sources plus retained Waikiki values with timestamps shifted to the current issuance; only a disposable `public.clock_timestamp()` is injected and production function bodies are hash-checked unchanged. Asserts: first run `evaluated` with `candidateCount` 1, one beach impact / event impact / regional event / shadow-demand run persisted, top-level `derivation` accepted and retained, extra keys inside `scopeOutcomes` rejected, 13 h run rejected as stale, four 00/06/12/18 issuances → `qualifyingDays` 1, retry adds no day, fifth Hatteras-style issuance suppressed and adds no day, sends/authorities/policy unchanged. Existing normalization, malicious-receipt, rollback, revocation and lease-concurrency checks still pass.

## Verification procedure for the deployed change (read-only)

```sql
select public.read_swell_watch_study_health();
select id, status, started_at, error_message, summary->'details'->'study'->>'reason' as reason,
       summary->'details'->'study'->'derivation'->>'version' as derivation
from public.cron_runs where route='/api/cron/swell-watch-acquire' order by started_at desc limit 6;
select id, status, recorded_at, result->>'reason', result->'derivation'->>'version'
from public.swell_watch_study_evaluations order by id desc limit 6;
select (select count(*) from public.swell_watch_production_approval_authority) as push_authorities,
       (select count(*) from public.swell_watch_notification_event_bindings) as bindings;
```

Milestone 4 requires a scheduled `:15` invocation whose study result is `evaluated` with `derivation.version = swell-watch-horizon-derivation.v2` for all ten sources. Milestone 5 requires `qualifyingDays` to rise to 1 for a UTC date with all four issuances evaluated. While Hatteras returns zero secondary tuples, expect `suppressed` / `incomplete_partition` with Waikiki now `derived`.
