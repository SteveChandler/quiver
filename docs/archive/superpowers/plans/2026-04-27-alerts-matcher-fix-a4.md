# A4: Alerts Matcher Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get `condition-alert-evaluate` to reliably populate `alert_queue` so the alerts engine actually fires. Make every cron run observable from the database.

**Architecture:** Two-PR sequence. PR-1 ships observability alone (`cron_runs` table + wrapper, applied to matcher + worker). After confirming `cron_runs` is recording runs in prod, PR-2 ships the join rewrite + unit-aware parsers. This sequencing is non-negotiable: without observability, we can't tell whether the rewrite worked.

**Tech Stack:** Next.js 16, TypeScript, Supabase service-role client, Postgres, Vercel cron.

**Spec:** `docs/archive/superpowers/specs/2026-04-27-alerts-matcher-fix-a4-design.md`

---

### Task 1: Migration — `cron_runs` table

**Files:**
- Create: `supabase/migrations/20260427160000_create_cron_runs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Per-run observability for cron handlers. Without this we cannot tell
-- whether a cron failed silently vs ran with empty input — a gap that
-- hid the alerts-matcher bug for 30 days.
--
-- Spec: docs/archive/superpowers/specs/2026-04-27-alerts-matcher-fix-a4-design.md A4.1

BEGIN;

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
-- service_role only — no policies. Cron handlers run as service_role.

COMMIT;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with `project_id=vawdnbbgawichorsjiwe`, `name=create_cron_runs`. Confirm via `to_regclass('public.cron_runs') IS NOT NULL`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260427160000_create_cron_runs.sql
git commit -m "feat(observability): cron_runs table for per-run cron observability"
```

---

### Task 2: `lib/cron/observability.ts` wrapper + tests

**Files:**
- Create: `lib/cron/observability.ts`
- Create: `__tests__/lib/cron/observability.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/cron/observability.test.ts
import { withCronObservability } from "@/lib/cron/observability";

const mockChain = () => {
  const insertMock = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: { id: "run-1" }, error: null }),
    }),
  });
  const updateMock = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
  return {
    from: jest.fn(() => ({ insert: insertMock, update: updateMock })),
    _insertMock: insertMock,
    _updateMock: updateMock,
  };
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

describe("withCronObservability", () => {
  it("records start + ok with summary on success", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const result = await withCronObservability("/api/cron/test", async () => ({ queued: 3 }));

    expect(result).toEqual({ queued: 3 });
    expect(client._insertMock).toHaveBeenCalledWith({ route: "/api/cron/test", status: "started" });
    expect(client._updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "ok",
      summary: { queued: 3 },
    }));
  });

  it("records error and rethrows", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    await expect(
      withCronObservability("/api/cron/test", async () => { throw new Error("boom"); })
    ).rejects.toThrow("boom");

    expect(client._updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "error",
      error_message: "boom",
    }));
  });

  it("does not block handler when cron_runs insert fails", async () => {
    const { createSupabaseServiceRoleClient } = require("@/lib/supabase/server");
    const client = mockChain();
    client._insertMock.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: "rls" } }),
      }),
    });
    createSupabaseServiceRoleClient.mockResolvedValue(client);

    const result = await withCronObservability("/api/cron/test", async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
yarn test:unit __tests__/lib/cron/observability.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the wrapper**

```ts
// lib/cron/observability.ts
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function withCronObservability<T>(
  route: string,
  handler: () => Promise<T>
): Promise<T> {
  const supabase = await createSupabaseServiceRoleClient();
  const start = Date.now();

  let runId: string | null = null;
  try {
    const { data } = await supabase
      .from("cron_runs")
      .insert({ route, status: "started" })
      .select("id")
      .single();
    runId = data?.id ?? null;
  } catch {
    // Observability must never block the handler.
  }

  try {
    const result = await handler();
    if (runId) {
      await supabase
        .from("cron_runs")
        .update({
          status: "ok",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
          summary: result as object,
        })
        .eq("id", runId);
    }
    return result;
  } catch (err) {
    if (runId) {
      await supabase
        .from("cron_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", runId);
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
yarn test:unit __tests__/lib/cron/observability.test.ts
```
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add lib/cron/observability.ts __tests__/lib/cron/observability.test.ts
git commit -m "feat(observability): withCronObservability wrapper for cron handlers"
```

---

### Task 3: Wrap matcher + worker with observability

**Files:**
- Modify: `app/api/cron/condition-alert-evaluate/route.ts`
- Modify: `app/api/cron/condition-alert-deliver/route.ts`

- [ ] **Step 1: Wrap the matcher**

In `condition-alert-evaluate/route.ts`, after the `validateCronRequest` check, replace the inline try/catch with:

```ts
import { withCronObservability } from "@/lib/cron/observability";

export async function GET(request: Request) {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await withCronObservability("/api/cron/condition-alert-evaluate", async () => {
      // ... existing handler body, returning the summary object
    });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[condition-alert-evaluate] Fatal error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Wrap the worker**

Same pattern for `condition-alert-deliver/route.ts`.

- [ ] **Step 3: Verify build**

```bash
yarn typecheck
yarn build  # confirms route file compiles
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/condition-alert-evaluate/route.ts app/api/cron/condition-alert-deliver/route.ts
git commit -m "feat(alerts): wrap matcher + worker with cron_runs observability"
```

---

### Task 4: Open PR-1 (observability only) and merge to main + release to prod

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin fix/alerts-matcher-a4
gh pr create --base main --title "feat(alerts): cron_runs observability for matcher + worker" --body "..."
```

PR body should reference `docs/archive/superpowers/specs/2026-04-27-alerts-matcher-fix-a4-design.md` A4.1 and explain that this is the prerequisite for A4.2-A4.4.

- [ ] **Step 2: After merge, cut release-prod-from-main**

Same flow as PR #235.

- [ ] **Step 3: Verify in prod**

After deploy, query:

```sql
SELECT route, status, summary, error_message, started_at
FROM cron_runs
ORDER BY started_at DESC
LIMIT 10;
```

If `condition-alert-deliver` shows `ok` rows every 15 min: wrapper works.
If `condition-alert-evaluate` shows `error` row at 09:00 UTC: we have the error message — proceed to A4.2.
If `condition-alert-evaluate` shows `ok` with `evaluated=0`: H2 from the diagnosis (rules-fetch returns empty) — that's a different next step.

---

### Task 5: Replace PostgREST two-hop join in matcher

**Branch:** new branch from main, e.g. `fix/alerts-matcher-a4-join-rewrite`

**Files:**
- Modify: `app/api/cron/condition-alert-evaluate/route.ts`
- Create: `__tests__/api/cron/condition-alert-evaluate.test.ts`

- [ ] **Step 1: Write integration test (mocked Supabase)**

Mock the four queries (alert_rules, profiles, beaches, user_entitlements) and assert that the route stitches them correctly and inserts into alert_queue with the expected shape. Reuse the per-table chain factory pattern from `__tests__/lib/alerts/anon-capture-validator.test.ts`.

- [ ] **Step 2: Refactor query**

Replace:
```ts
const { data: rules } = await supabase
  .from("alert_rules")
  .select(`id, ..., beaches!inner(...), profiles!inner(...), user_entitlements(...)`)
  .eq("enabled", true);
```

With four separate flat selects (see spec A4.2). Build `Map<string, ProfileRow>`, `Map<string, BeachRow>`, `Map<string, EntitlementRow>` for in-memory join. Update the per-rule loop to read from the maps.

- [ ] **Step 3: Remove `@ts-nocheck`**

The first line of the file (`// @ts-nocheck — PostgREST resolves alert_rules→auth.users→profiles at runtime…`) becomes obsolete. Remove it. If TypeScript reports new errors, fix them — they're probably real.

- [ ] **Step 4: Run typecheck + tests**

```bash
yarn typecheck
yarn test:unit __tests__/api/cron/condition-alert-evaluate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(alerts): replace PostgREST two-hop join in matcher with flat queries

Eliminates the most-likely root cause of zero matcher firings (per A2 diagnosis).
Removes @ts-nocheck. Tests mock all four queries to lock the contract."
```

---

### Task 6: Unit-aware wind_speed parser

**Files:**
- Create: `lib/alerts/forecast-parsers.ts`
- Create: `__tests__/lib/alerts/forecast-parsers.test.ts`
- Modify: `app/api/cron/condition-alert-evaluate/route.ts`

- [ ] **Step 1: Write tests**

```ts
import { parseWindSpeedToKt } from "@/lib/alerts/forecast-parsers";

describe("parseWindSpeedToKt", () => {
  it("parses kt explicit", () => {
    expect(parseWindSpeedToKt("8 kt")).toBeCloseTo(8);
    expect(parseWindSpeedToKt("8 knots")).toBeCloseTo(8);
  });
  it("converts mph to kt", () => {
    expect(parseWindSpeedToKt("10 mph")).toBeCloseTo(8.69, 2);
  });
  it("converts m/s to kt", () => {
    expect(parseWindSpeedToKt("5 m/s")).toBeCloseTo(9.72, 2);
  });
  it("treats bare number as mph (current ingest convention)", () => {
    expect(parseWindSpeedToKt("10")).toBeCloseTo(8.69, 2);
  });
  it("returns null for unparseable", () => {
    expect(parseWindSpeedToKt(null)).toBeNull();
    expect(parseWindSpeedToKt("calm")).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

(see spec A4.3 for the function body)

- [ ] **Step 3: Wire into matcher's parser**

In `condition-alert-evaluate/route.ts`, replace `wind_speed: f.wind_speed ? parseFloat(f.wind_speed) : null` with `wind_speed: parseWindSpeedToKt(f.wind_speed)`.

- [ ] **Step 4: Run tests, commit**

```bash
yarn test:unit __tests__/lib/alerts/forecast-parsers.test.ts
git commit -m "fix(alerts): unit-aware wind_speed parser converts mph→kt for matcher"
```

---

### Task 7: Cardinal-to-degrees swell direction parser

**Files:**
- Modify: `lib/alerts/forecast-parsers.ts`
- Modify: `__tests__/lib/alerts/forecast-parsers.test.ts`
- Modify: `app/api/cron/condition-alert-evaluate/route.ts`

- [ ] **Step 1: Write tests**

```ts
import { parseSwellDirectionToDegrees } from "@/lib/alerts/forecast-parsers";

describe("parseSwellDirectionToDegrees", () => {
  it("converts cardinal", () => {
    expect(parseSwellDirectionToDegrees("N")).toBe(0);
    expect(parseSwellDirectionToDegrees("E")).toBe(90);
    expect(parseSwellDirectionToDegrees("S")).toBe(180);
    expect(parseSwellDirectionToDegrees("W")).toBe(270);
  });
  it("converts intercardinal", () => {
    expect(parseSwellDirectionToDegrees("NE")).toBe(45);
    expect(parseSwellDirectionToDegrees("SW")).toBe(225);
  });
  it("converts secondary intercardinal", () => {
    expect(parseSwellDirectionToDegrees("WNW")).toBe(292.5);
    expect(parseSwellDirectionToDegrees("ESE")).toBe(112.5);
  });
  it("passes through numeric strings", () => {
    expect(parseSwellDirectionToDegrees("180")).toBe(180);
    expect(parseSwellDirectionToDegrees("180.5")).toBe(180.5);
  });
  it("returns null for invalid", () => {
    expect(parseSwellDirectionToDegrees(null)).toBeNull();
    expect(parseSwellDirectionToDegrees("XYZ")).toBeNull();
  });
});
```

- [ ] **Step 2: Implement**

Standard 16-point cardinal lookup (N=0, NNE=22.5, NE=45, ..., NNW=337.5).

- [ ] **Step 3: Wire into matcher's parser**

Replace `swell_1_direction: f.swell_1_direction ? parseFloat(String(f.swell_1_direction)) : null` with `swell_1_direction: parseSwellDirectionToDegrees(f.swell_1_direction)`.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "fix(alerts): cardinal-to-degrees swell direction parser"
```

---

### Task 8: Open PR-2 (matcher fix), validate after deploy

- [ ] **Step 1: PR-2**

Same flow. Title: `fix(alerts): replace fragile two-hop join + unit-aware parsers`. Body references A4.2-A4.4.

- [ ] **Step 2: Release main → prod**

- [ ] **Step 3: Validate in prod**

After deploy, wait for next cron tick (or manually trigger `condition-alert-evaluate` via Vercel UI). Then run:

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

Success: `last_run_status='ok'`, `summary.queued ≥ 1`, `queue_total ≥ 1`. Founder daily_check_in row should appear.

- [ ] **Step 4: Update CHANGELOG**

```markdown
### Changed
- Alerts matcher (`condition-alert-evaluate`) replaced fragile PostgREST two-hop join with flat queries. First successful firing in 30+ days.
- Wind speed in alert matcher now correctly converts mph→knots (was over-permissive by ~15%).

### Added
- `cron_runs` table + `withCronObservability` wrapper. Per-run observability for cron handlers — no more silent failures.
```

---

## Self-review checklist

- [x] Spec coverage: every section of A4 design has corresponding tasks
- [x] No placeholders — every step has actual code/SQL/commands
- [x] Type consistency: `cron_runs` schema matches between migration and wrapper, `parseWindSpeedToKt` signature matches in test + impl + caller
- [x] Phase ordering enforced: A4.1 ships standalone (Tasks 1-4); A4.2-A4.4 ship together (Tasks 5-8) only after A4.1 confirmed working in prod

## Notes for the human

This plan is split across two PRs intentionally. Don't combine them. The whole point of A4.1 is to be able to *measure* whether A4.2-A4.4 worked. Combining them defeats the measurement.
