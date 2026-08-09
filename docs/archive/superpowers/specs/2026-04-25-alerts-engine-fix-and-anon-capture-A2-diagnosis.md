# Alerts Engine — A2 Forensic Diagnosis

**Date:** 2026-04-25
**Author:** Data Researcher (read-only investigation)
**Question answered:** Why have the backfilled `alert_rules` produced ZERO `alert_queue` rows in 30 days, despite the `condition-alert-evaluate` cron running daily at 09:00 UTC?

## Summary

**Most likely root cause: the `condition-alert-evaluate` cron is not executing successfully in production.** Confidence: **medium-high**. Multiple rules — most notably the two `mellow_session` rules on Malibu Third Point — would produce queue rows today against live `enhanced_forecasts` data using the evaluator's own logic, yet `alert_queue` is empty for the entire history of the table and `alert_rules.last_matched_at` is `NULL` for all 10 rules (with `updated_at` byte-equal to `created_at`, meaning no row has ever been touched by the evaluator's `update last_matched_at` path). Given that sibling crons in `vercel.json` are firing on schedule (welcome, first-session-nudge, reengagement, weekly-recap all have rows in `email_send_log` from the past 14 days), the failure is specific to this route — most plausibly an early-return/exception in the route handler before the queue insert (PostgREST relationship resolution, env-var auth mismatch, or an uncaught error inside the user loop). A secondary, narrower bug — silent unit confusion — exists regardless and should be patched in A4 even if the primary cause is purely "cron didn't run."

## Evidence

### The 10 backfilled / seeded rules

10 enabled rules, 1 per user. Spec says 8; production has 10 (8 from `20260417134921_backfill_default_alert_rules.sql` + 1 organic 4/24 + 1 founder seed). All are `enabled=true`, all have `notif_forecast_alerts=true` on `profiles`, all have valid email/push channel flags, all attached beaches have `lat/lon/timezone`. All `last_matched_at IS NULL`; all `updated_at == created_at` byte-equal — the evaluator has never written `last_matched_at` for any row.

| Rule | Beach | Preset | Conditions |
|---|---|---|---|
| 175e2d29 | Jacksonville Beach Pier (NY tz) | mellow_session | swell 1–4 ft, wind ≤8 kt |
| 47ab884d | Ocean Beach Pier (LA tz) | clean_groundswell | period ≥12 s, wind ≤10 kt |
| 12d627f8 | Ocean Beach (LA tz) | mellow_session | swell 1–4 ft, wind ≤8 kt |
| ef4f4f3c | Huntington Beach Pier | mellow_session | swell 1–4 ft, wind ≤8 kt |
| 8d27593f | Mission Beach | mellow_session | swell 1–4 ft, wind ≤8 kt |
| 792f677b | Malibu Third Point | mellow_session | swell 1–4 ft, wind ≤8 kt |
| 7f056282 | Oceanside Harbor | mellow_session | swell 1–4 ft, wind ≤8 kt |
| 07fe481b | Blacks Beach | clean_groundswell | period ≥12 s, wind ≤10 kt |
| f3475493 | Ocean Beach SF – Middle | clean_groundswell | period ≥12 s, wind ≤10 kt |
| 5fc1c30d | Malibu Third Point | mellow_session | swell 1–4 ft, wind ≤8 kt, tide 2–5 ft |

### Forecast coverage

All 9 distinct beaches have ~150 `enhanced_forecasts` rows in the last 7 days, extending out 14 days. Schema is the legacy text-with-units shape: `wave_height='1.2 ft'`, `wind_speed='6 mph'`, `swell_1_period='4s'`, `swell_1_direction='W'`. The evaluator strips suffixes via `parseFloat(...)` / `replace("s","")`. No coverage gap.

### The evaluator's own logic, re-run by hand against today's data

The evaluator's window for an LA-tz rule today is `getUtcDayBounds("2026-04-25", "America/Los_Angeles")` → `2026-04-25T07:00:00Z` to `2026-04-26T06:59:59Z`. After `filterToDaylight()` against Malibu (sunrise ≈13:11 UTC, sunset ≈02:36 UTC next day), the surviving hours are 15:00, 18:00, 21:00, 00:00 UTC.

| forecast_at (UTC) | wave_height | wind_speed | period | mellow_session match? |
|---|---|---|---|---|
| 15:00 | 1.9 ft | 5 mph→5 | 15 s | **MATCH** (1.9 in 1–4, 5 ≤ 8) |
| 18:00 | 1 ft | 5 | 9 s | **MATCH** (1 in 1–4, 5 ≤ 8) |
| 21:00 | 1.1 ft | 9 | 11 s | fail (9 > 8) |
| 00:00 | 1 ft | 12 | 12 s | fail (12 > 8) |

Two consecutive daylight hours (15:00 and 18:00) match → `findMatchingWindows` returns **one window**. That window should produce **one** `alert_queue` row for both Malibu mellow_session rules (`792f677b`, `5fc1c30d`). It produces zero. Huntington Beach Pier shows the same pattern (1.2 ft @ 15:00, 1.3 ft @ 18:00, both with 6 mph wind) — also expected to match, also zero.

### Cron infrastructure is otherwise healthy

`email_send_log` has 88 rows in the last 14 days across `welcome`, `first_session_nudge`, `reengagement`, `weekly_recap`. The Vercel cron platform is firing schedules. There is no DB-side "cron heartbeat" log for `condition-alert-evaluate` — the route's only persistent side effects are `alert_queue` upsert and `last_matched_at` update — so I cannot directly observe its execution from the database. **I do not have access to the Vercel MCP `get_logs` schema in this session and the Sentry MCP server is not configured in `.mcp.json`** (only Figma, Supabase, Vercel HTTP MCP — and the Vercel MCP returns deferred tools I haven't called). Vercel cron-log inspection is the next obvious step but is out of read-only-SQL scope.

### Unit drift in the data (independent of root cause)

`enhanced_forecasts.wind_speed` is text **with `mph` units** (`"6 mph"`, `"15 mph"`). The evaluator does `parseFloat(f.wind_speed)` → numeric value treated as **knots** (the rule's `wind_speed_max_kt`). 1 mph = 0.87 kt. The evaluator therefore over-includes by ~15%: a forecast `"9 mph"` = 7.8 kt is correctly accepted under an 8 kt cap, but the comparison is structurally wrong — it would also accept `"9 kt"` if the data were ever in knots. This drift is permissive (more matches than expected), not the cause of zero matches, but it should be fixed in A4 by either parsing units explicitly or normalizing the column. The same drift exists for all `wind_speed_max_kt` rules.

`swell_1_direction` is the cardinal text `"W"`/`"WNW"`/`"S"`. `parseFloat("W")` = `NaN`. Rules that depend on `swell_direction_min_deg`/`swell_direction_max_deg` (the `clean_groundswell` rules with non-null `swell_window_center_deg` on the beach) cannot match because `isWithinArc(NaN, …)` returns false. Only one of the three `clean_groundswell` rules has these fields populated by `presets.ts`, but the rule conditions stored in the DB don't actually include the direction bounds (they were inserted from the broad migration JSON `{"swell_period_min": 12, "wind_speed_max_kt": 10}`, not via the TS preset builder). So this is **not currently blocking** the existing rules but is a latent landmine for any future rule that uses direction.

## Hypotheses considered

### H1 (most likely, ~60%): the cron route is failing before the queue-insert path

**Supports:** zero `alert_queue` rows ever (`COUNT(*)=0`), zero `last_matched_at` writes ever, zero `alert_deliveries` ever, and live forecast data that should produce matches today using the evaluator's own functions. Other crons in the same `vercel.json` are firing.

**Plausible failure modes inside the route:**
- The PostgREST relationship `profiles!inner(...)` requires that PostgREST resolve the `alert_rules.user_id → auth.users.id ← profiles.id` two-hop chain via the FK metadata. The route file carries an `@ts-nocheck` and a comment acknowledging the chain "works at runtime" — but if a recent migration changed the `profiles` PK / FK relationship (or if PostgREST schema cache is stale), the rules query throws and `summary` returns with `evaluated=0`. The two FKs on `profiles` are both for `home_beach_id`; `profiles.id` is the PK referencing `auth.users.id` implicitly. PostgREST resolution of the alert_rules→profiles two-hop is fragile.
- `CRON_SECRET` env var mismatch in production. A 401 from `validateCronRequest` would early-return without writing anything observable. Other crons that share `CRON_SECRET` work, but Vercel uses `x-vercel-cron` for scheduled invocations rather than `Authorization`, so this is unlikely.
- An uncaught throw inside the per-user `try/catch` block masks itself by incrementing `summary.errors` — but the outer try/catch returns 500 only on a fatal error before the loop. A 500 wouldn't leave a DB trace.

**Refutes:** the route's join logic, when re-run as a plain SQL join, returns all 10 rules cleanly with no NULLs. So the join itself isn't the issue — it's PostgREST's translation of it.

### H2 (~25%): cron is running, query returns zero rules, so it silently no-ops

If PostgREST returns `null` or `[]` for the rules query (e.g. due to a permissions issue under the service-role client, or a schema-cache miss), the route hits the `if (!rules || rules.length === 0)` branch and logs `"No enabled alert rules found"`. No rows written, no errors thrown. Same DB shape as H1.

**Refutes:** straight SQL with a service-role-equivalent join returns 10 rows. The PostgREST equivalent should also return 10 rows. But schema cache can lag DDL — the `enabled` column was likely added in `20260408163000_add_condition_alerts.sql`; if a more recent migration touched the table, PostgREST might be selecting from a stale cache that lacks `enabled`, breaking `.eq("enabled", true)`.

### H3 (~15%): cron is running, matching, but `alert_queue` upserts are silently failing

The upsert uses `onConflict: "rule_id,alert_date,window_start"` with `ignoreDuplicates: true`. If the unique index doesn't actually exist on those columns (or has a different name), the upsert errors. The `insertError` is caught and logged but doesn't fail the cron — it increments `summary.errors`. **However**, if it consistently errors, `last_matched_at` would still be written by the subsequent `update` call after the for-loop. **It is not.** This rules out H3 alone — the `update last_matched_at` path is unconditional (it's outside the per-window loop) so if any rule had matched, `last_matched_at` would have moved.

Unless: the matching loop completes 0 windows (no match found) for every rule on every day for 30 days. That's extraordinarily improbable given today's Malibu data alone.

### H4 (rejected): rule conditions are too tight

Refuted above. Mellow_session at 1–4 ft / ≤8 kt should match almost every fair-weather day at half the LA-area beaches. The Malibu data today proves a match exists.

### H5 (rejected): timezone bound is wrong

`getUtcDayBounds` looks correct. For LA on 2026-04-25 it returns `2026-04-25T07:00:00Z` to `2026-04-26T06:59:59Z` — a 24h window aligned to local midnight. Forecast rows fall inside it. Refuted.

## Recommended fix (for A4)

Three concrete actions, in priority order:

1. **Add observability before fixing.** Today the route logs to console only. A4's first commit should:
   - Add a single `INSERT INTO cron_runs (route, ran_at, summary)` (or write a row to a new `alert_evaluator_runs` table) at the **start** of the handler and at the **end** with the final summary. This converts "cron didn't run vs ran-with-zero-matches" from "we don't know" to "we know in one query." This must land before any logic change so the next failure mode is visible.
   - Wrap the `from("alert_rules").select(...)` query in an explicit try/catch and log/persist the error string. The `@ts-nocheck` comment hints this query has historical fragility.

2. **Replace the PostgREST two-hop join with explicit queries.** Drop the `profiles!inner(...)` and `user_entitlements(...)` embeds; do the rules query, then a second batched query for profiles by `user_id IN (...)`, then another for entitlements. Three round-trips, but each is a flat single-table select. Eliminates the PostgREST relationship-resolution failure mode entirely.

3. **Patch the silent unit/format issues in the parser** (`route.ts:113-124`):
   - `parseFloat(f.wind_speed)` blindly assumes the numeric prefix is in the rule's unit (knots). Either: parse the unit suffix and convert mph→kt, or normalize `enhanced_forecasts.wind_speed` to a numeric kt column (the OM columns already include `wind_wave_height_om` etc. as `real`). This is the Phase 2-validation gate: until the parser is unit-aware, the chain is operating on a 15% bias.
   - `parseFloat(String(f.swell_1_direction))` returns NaN for cardinal strings. Convert via a cardinal-to-degrees lookup, or migrate the column. Latent bug for any future direction-bound rule.

4. **Don't migrate the existing 10 rules until step 1 lands.** Per the design doc's A4 sequencing — adjust thresholds only after the engine is observably matching. A loosened rule against a broken evaluator just adds noise.

## Out-of-scope flags

- **`enhanced_forecasts.wind_speed` is mph, not kt.** This is a separate ticket — it affects the conditions-alert-email cron, the daily intel pipeline, and any other consumer that does naive `parseFloat`. The fix probably belongs at the ingest layer or via a new `wind_speed_kt` numeric column.
- **`enhanced_forecasts` schema is text-with-units across the wave/wind/tide columns** while the OM-derived columns (`wave_height_om`, `wind_wave_height_om`, etc.) are `real`. The two flavors coexist and the evaluator reads only the legacy text columns. A4 (or a follow-up) should consider switching the alert path to the OM numeric columns when present.
- **PostgREST schema cache risk.** The `@ts-nocheck` + comment on the route file flags an existing fragile join. A schema migration that touches `profiles` or `alert_rules` could break the route again silently. Worth an integration test that hits the route in CI.
- **No cron-execution log.** The infra-wide gap that allowed this bug to hide for 30 days is the absence of any signal that a cron ran at all when it produces no DB writes. Consider a tiny `cron_runs(route, ran_at, ok, summary jsonb)` table that every cron handler writes to as its first/last action.
- **Spec count mismatch.** The design doc says "8 backfilled rules"; production has 10 (8 backfill + 1 organic 4/24 + 1 founder 4/24 seed via onboarding). Worth updating the spec or the seed script's claims to match reality.
