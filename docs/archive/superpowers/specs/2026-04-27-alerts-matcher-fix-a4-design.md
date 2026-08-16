# A4: Alerts Matcher Fix — Design

**Date:** 2026-04-27
**Branch:** `fix/alerts-matcher-a4`
**Predecessors:**
- `2026-04-25-alerts-engine-fix-and-anon-capture-design.md` (parent spec, scope of A1-A4)
- `2026-04-25-alerts-engine-fix-and-anon-capture-A2-diagnosis.md` (forensic root-cause)
- PR #234 (Phase 1 worker hardening + Phase 3 anon capture, merged to main)
- PR #235 (release main → prod, in flight)

**Status:** Phase 1 + Phase 3 shipped. Phase 2 partial: `daily_check_in` preset added but *useless until matcher fires*. Phase 4 promotion (`ALERTS_DELIVERY_ENABLED=true`) attempted, but the queue stays empty because `condition-alert-evaluate` silently no-ops every run.

## Goal

Get `condition-alert-evaluate` to reliably populate `alert_queue` so the worker has rows to process. Confidence-of-firing must be observable from the database — no more "we don't know if the cron ran."

## Non-goals

- No re-architecting of the alert engine. Same matcher, same window logic.
- No changes to `findMatchingWindows` / `evaluateConditions` behavior beyond unit-correctness.
- No new presets. `daily_check_in` is the validation preset; everything else is post-A4.

## Current state (evidence)

From the A2 diagnosis + today's verification (2026-04-27 15:30 UTC):

| Signal | Value | Implication |
|---|---|---|
| `alert_queue` rows ever | 0 | Matcher has *never* enqueued |
| `alert_rules.last_matched_at` non-null | 0 of 11 | Matcher has *never* updated `last_matched_at` |
| `alert_deliveries` rows (7d) | 0 | Worker has nothing to deliver |
| `alert_delivery_attempts` rows | 0 | Worker is firing every 15min but queue is empty |
| Sibling crons (welcome, weekly-recap) | firing nightly | Vercel cron infra is healthy |
| `condition-alert-evaluate` HTTP probe | 401 (auth gate works) | Route is deployed |

The matcher returns `200 OK` with `summary={evaluated:0, matched:0, queued:0, ...}` — or it 500s — and we have no way to tell which. Console logs are not persistent.

## Root cause hypotheses (from A2)

1. **H1 (~60%):** PostgREST two-hop embed `profiles!inner(...)` on the `alert_rules` query throws (`@ts-nocheck` + the comment in `route.ts:1-5` flag this fragility). The catch block returns `summary={...errors:0}` because the error happens *before* the per-user loop, before `summary.errors` increments.
2. **H2 (~25%):** PostgREST returns 0 rules due to schema-cache lag on `enabled` column or service-role permissions, hits the `if (!rules || rules.length === 0)` branch, returns `"No rules to evaluate"`. No DB write.
3. **H3 (~15%):** Some other early-return / unhandled throw in the rules-fetch.

All three look identical in the database (zero writes). We must add observability *before* fixing, otherwise we're flying blind on whether the fix worked.

## Design

### Phase A4.1 — Observability first (one commit, ships alone)

**Goal:** Make every matcher run visible in the database, regardless of whether it threw.

New table:

```sql
CREATE TABLE cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('started', 'ok', 'error', 'timeout')),
  summary jsonb,
  error_message text,
  duration_ms integer
);

CREATE INDEX cron_runs_route_started_idx ON cron_runs (route, started_at DESC);
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
-- service_role only.
```

Wrapper helper `lib/cron/observability.ts`:

```ts
export async function withCronObservability<T>(
  route: string,
  handler: () => Promise<T>
): Promise<T> {
  const supabase = await createSupabaseServiceRoleClient();
  const start = Date.now();
  const { data: run } = await supabase
    .from("cron_runs")
    .insert({ route, status: "started" })
    .select("id")
    .single();

  try {
    const result = await handler();
    await supabase
      .from("cron_runs")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        summary: result as object,
      })
      .eq("id", run!.id);
    return result;
  } catch (err) {
    await supabase
      .from("cron_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("id", run!.id);
    throw err;
  }
}
```

Wrap the matcher (and the worker) in this helper. After deploy, *one query* tells us:
- Did the cron fire?
- Did it succeed?
- What did its summary look like?
- What error did it throw?

**Diagnostic queries deferred to runbook**, not the spec.

### Phase A4.2 — Replace PostgREST two-hop join (most-likely-cause fix)

In `app/api/cron/condition-alert-evaluate/route.ts`, replace the single embedded query:

```ts
// BEFORE (fragile two-hop)
const { data: rules } = await supabase.from("alert_rules").select(`
  id, user_id, beach_id, …,
  beaches!inner(…),
  profiles!inner(…),
  user_entitlements(…)
`).eq("enabled", true);
```

With three flat queries:

```ts
// AFTER (no embeds)
const { data: rules } = await supabase
  .from("alert_rules")
  .select("id, user_id, beach_id, name, conditions, notify_email, notify_push, preset_type, created_at")
  .eq("enabled", true);

const userIds = [...new Set(rules.map(r => r.user_id))];
const beachIds = [...new Set(rules.map(r => r.beach_id))];

const { data: profiles } = await supabase
  .from("profiles")
  .select("id, home_beach_id, notif_forecast_alerts, notif_email_enabled, notif_push_enabled")
  .in("id", userIds);

const { data: beaches } = await supabase
  .from("beaches")
  .select("id, name, slug, lat, lon, timezone, wind_offshore_deg, wind_offshore_tol_deg, aspect_deg, preferred_tide_ft_min, preferred_tide_ft_max, preferred_tide_direction, swell_window_center_deg, swell_window_halfwidth_deg")
  .in("id", beachIds);

const { data: entitlements } = await supabase
  .from("user_entitlements")
  .select("user_id, is_pro, is_trialing, billing_issue, expires_at")
  .in("user_id", userIds);
```

Build local lookup Maps (`profilesById`, `beachesById`, `entitlementByUserId`) and stitch them in the per-rule loop. Three round-trips instead of one, but each is a flat single-table select — eliminates the PostgREST relationship-resolution failure mode entirely.

This also removes the need for `@ts-nocheck` on the route file. Generated types resolve cleanly for flat selects.

### Phase A4.3 — Unit-aware wind_speed parser

`enhanced_forecasts.wind_speed` is text with `mph` units (`"6 mph"`). The matcher does `parseFloat(f.wind_speed)` and compares against `conditions.wind_speed_max_kt` directly. This is a structural unit mismatch — currently latent (mph values are *smaller* than knots, so it over-includes by ~15%) but a landmine.

Add a unit-aware parser in `lib/alerts/forecast-parsers.ts`:

```ts
export function parseWindSpeedToKt(raw: string | null): number | null {
  if (!raw) return null;
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;
  if (raw.includes("kt") || raw.includes("knot")) return num;
  if (raw.includes("mph")) return num * 0.868976;  // mph → kt
  if (raw.includes("m/s")) return num * 1.9438;    // m/s → kt
  // Bare number = treat as mph (current ingest convention) — log a warning to fallback_events
  return num * 0.868976;
}
```

Use this in the route's `parsed.map(...)` instead of `parseFloat(f.wind_speed)`.

### Phase A4.4 — Cardinal-to-degrees swell direction parser

`swell_1_direction` is `"W"`/`"WNW"`/`"S"`. `parseFloat("W") = NaN`. Currently no rule uses direction bounds, but this is a latent landmine.

Add `parseCardinalToDegrees("WNW")` returning 292.5. Use in the route's parser. (Low priority — no rule exercises it today, but fixing now eliminates the gotcha for future presets.)

### Phase A4.5 — Validate against daily_check_in

Once A4.1 + A4.2 land, the founder's `daily_check_in` rule should produce a queue row on the next 09:00 UTC tick (or sooner if manually triggered). Validation query:

```sql
SELECT
  (SELECT status FROM cron_runs
   WHERE route = '/api/cron/condition-alert-evaluate'
   ORDER BY started_at DESC LIMIT 1) AS last_run_status,
  (SELECT summary FROM cron_runs
   WHERE route = '/api/cron/condition-alert-evaluate'
   ORDER BY started_at DESC LIMIT 1) AS last_run_summary,
  (SELECT COUNT(*) FROM alert_queue) AS queue_total,
  (SELECT COUNT(*) FROM alert_rules WHERE last_matched_at IS NOT NULL) AS rules_ever_matched;
```

If `last_run_status='error'`: read `error_message`, fix, redeploy.
If `last_run_status='ok'` and `summary.queued > 0`: matcher is firing.
If `summary.queued = 0`: `findMatchingWindows` is rejecting all rules — debug from there with rule-specific logs.

## Out of scope

- Migrating `enhanced_forecasts.wind_speed` to a numeric kt column (separate ticket — affects daily-intel pipeline, conditions-alert-email, etc.)
- Adding cron run observability to all 39 crons (start with the alerts engine, expand later)
- Switching the alert path to OM numeric forecast columns when present
- Re-running the historical backfill once the matcher works (post-A4 decision)
- Phase 5 (preset migration to looser rules) — only after the engine is observably matching

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `cron_runs` insert fails (e.g. table not yet migrated when wrapper deploys) | Migration ships in same PR as wrapper. Wrapper handles insert failure gracefully (try/catch around the insert; never block the actual handler). |
| Three-query rewrite introduces new bug | Keep the same in-memory data shape (rule + beach + profile + entitlement) so per-rule logic stays identical. Add a unit test that mocks the three queries and asserts queue insert with realistic input. |
| Wind unit conversion changes behavior of existing rules | All current rules use `wind_speed_max_kt` against mph data, so today's 8 kt cap effectively passes ~9 kt of true wind. After the fix, that loosens to a true 8 kt cap (stricter). Acceptable — the rules were tuned against the broken parser and should be re-tuned anyway in Phase 5. |
| Founder daily_check_in still doesn't fire after A4 | Means the bug is in `findMatchingWindows` or `filterToDaylight`, not the join. The cron_runs.summary will show `evaluated > 0, matched = 0`. Next step is per-rule debug logging. |

## Phase ordering

A4.1 (observability) **must** ship and prove it works before A4.2-A4.4. Otherwise the rewrite has no measurement signal and we'll be back to "did it work? we don't know."

```
A4.1 (cron_runs + wrapper)  →  deploy → confirm cron_runs has rows for both crons
A4.2 (replace embed)         →  deploy → confirm cron_runs.summary shows evaluated > 0
A4.3 (unit-aware parser)     →  ship in same PR as A4.2; isolated module change
A4.4 (cardinal direction)    →  ship in same PR as A4.2; isolated module change
A4.5 (validation)            →  manual via SQL on prod; documented in PR description
```

## Implementation plan

Subagent-driven, ~7 tasks. Each task is small enough to dispatch with full text inline. See `docs/archive/superpowers/plans/2026-04-27-alerts-matcher-fix-a4.md` (next file).
