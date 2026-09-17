# Daily Call and Swell Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this workspace tasks are dispatched as `codex exec` packets from the worktree named below; Claude reviews between tasks.

**Goal:** Replace the similarity-match and home-morning-call pushes with one go-only morning "daily call" at a user-chosen time, add an evening-before swell alert on top of the existing swell-watch detector, and enforce one surf push per user per morning across daily call and manual rules.

**Architecture:** Two new producers (`daily-call` hourly cron keyed to each user's local send time; `swell-alert` daily cron at 17:00 local) enqueue through the existing notification registry/worker. The surf-alert slot becomes per user per date. A driver-bounded window refiner and a tagged, rotating title pool are shared by both producers. Similarity and home-morning-call are deleted; manual rules stay and win the morning slot.

**Tech Stack:** Next.js route handlers (Node runtime), Supabase Postgres + SQL migrations, Zod payload schemas, Jest (`yarn test:unit --runTestsByPath`), React Native (Expo) for the client packets.

**Spec:** `docs/superpowers/specs/2026-09-17-daily-call-and-swell-alert-design.md`. Audit and copy research: `.planning/2026-09-17-push-alerts-audit/`.

## Global Constraints

- Work in worktree `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/issue-batch-20260916` on branch `feat/daily-call-and-swell-alert` (off `origin/main` at `7b4152216`). The spec, this plan, and `.planning/2026-09-17-push-alerts-audit/` are committed on that branch; read them from the worktree. Never touch the primary checkout at `~/Desktop/dev/quiver` (it is on an unrelated dirty branch).
- Node 22: `source ~/.nvm/nvm.sh && nvm use 22` before any `yarn`/`jest`. Run targeted tests only: `yarn test:unit --runTestsByPath <files>`. Never the full suite.
- Stage explicitly by path (`git add <file>`), never `git add -A` or `git add .`; run `git status` before committing to confirm scope. Commit atomically with a conventional message. Do NOT push.
- Push title ≤ 40 Unicode characters after substitution; no emoji; never the string "NOW FIRING"; safety copy carries no jokes.
- Send-time preference values: exactly `05:00`, `05:30`, `06:00`, `06:30`, `07:00`, `07:30`, `08:00`, `sunrise`. Default `06:00`.
- Quiet hours stay `22:00–04:00` local (`lib/notifications/quiet-hours.ts`); do not change them.
- A personal-match label must never promote a physical `maybe` to `go`.
- Flags read through `lib/flags/*` helpers; unset means OFF; allowlists are comma-separated user ids.
- Do not delete `compute_user_match_score*` RPCs or `lib/services/similarity-insights-service.ts` (Beach Detail still uses them).
- Migrations: one file per task under `supabase/migrations/2026091N_<slug>.sql`, idempotent (`IF NOT EXISTS`), with the matching hand edit to `types/database.generated.ts` in the same commit (follow the shape of neighbouring columns; do not run the generator against prod).

---

## File map

| Path | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20260918100000_daily_call_schema.sql` | profile prefs, `beaches.short_name`, `swell_event_alerts`, slot re-key, disable similarity rules | 1 |
| `lib/recommendations/canonical-decision/engine.ts` | verdict ceiling: personal label cannot beat physical `maybe` | 2 |
| `lib/flags/daily-call.ts`, `lib/flags/swell-alert.ts` | enable + allowlist flags | 3 |
| `lib/alerts/user-pool.ts` | pool builder extracted from the similarity cron | 4 |
| `lib/alerts/window-refiner.ts` | driver-bounded window edges | 5 |
| `lib/alerts/send-time.ts` | resolve a user's send hour from preference + timezone + sunrise | 5 |
| `lib/notifications/copy/surf-titles.v1.json`, `lib/notifications/copy/select-title.ts` | tagged title pool + selection/rotation | 6 |
| `lib/notifications/types/daily-call.ts`, `lib/notifications/registry.ts`, `lib/notifications/worker.ts` | `daily_call` type, `swell_watch` channels, per-user-date slot | 7 |
| `lib/cron/daily-call-runner.ts`, `app/api/cron/daily-call/route.ts`, `vercel.json` | daily call producer | 8 |
| `app/api/cron/similarity-alerts/*`, `app/api/cron/home-morning-call/*`, `lib/cron/home-beach-push-runner.ts`, `lib/alerts/similarity-best-pick.ts`, similarity branch of `app/api/cron/condition-alert-deliver/route.ts`, `lib/alerts/push-formatter.ts` (similarity formatter) | deletions | 9 |
| `lib/alerts/condition-evaluator.ts`, `lib/alerts/actionable-window-selector.ts` | manual-rule fixes | 10 |
| `lib/alerts/swell-rarity.ts`, `lib/cron/swell-alert-runner.ts`, `app/api/cron/swell-alert/route.ts`, `vercel.json` | swell alert producer | 11 |
| `__tests__/integration/surf-push-budget.test.ts` | one morning push + one evening push per user | 12 |
| native `src/screens/settings.tsx`, `src/hooks/use-update-profile.ts`, `src/types/profile.ts` | preferences | N1 |
| native `src/lib/push-notifications.ts`, `src/lib/alert-context.ts`, `src/components/alerts/alert-context-banner.tsx`, `src/screens/alert-center.tsx` | routing, banner drivers, hide similarity | N2 |

Dependency order: 1 → {2, 3, 4, 5, 6, 10} in parallel → 7 → 8 → {9, 11} in parallel → 12 → {N1, N2} in parallel (native, after 7 fixes the payload contract).

---

### Task 1: Schema

**Files:**
- Create: `supabase/migrations/20260918100000_daily_call_schema.sql`
- Modify: `types/database.generated.ts` (profiles Row/Insert/Update, beaches Row/Insert/Update, new `swell_event_alerts` table, `surf_alert_delivery_slots` Row, `claim_surf_alert_slot` Args)
- Test: `__tests__/migrations/daily-call-schema.test.ts`

**Interfaces:**
- Produces: `profiles.daily_call_time text NOT NULL DEFAULT '06:00'`, `profiles.notif_swell_alerts boolean NOT NULL DEFAULT true`, `beaches.short_name text NULL`, table `swell_event_alerts`, `surf_alert_delivery_slots` primary key `(recipient_user_id, alert_date)`, RPC `claim_surf_alert_slot(p_event_id uuid, p_recipient_user_id uuid, p_alert_date date, p_priority smallint) RETURNS boolean` (the `p_beach_id` parameter is removed).

- [ ] **Step 1: Write the failing test** (`__tests__/migrations/daily-call-schema.test.ts`)

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260918100000_daily_call_schema.sql"),
  "utf8",
);

describe("daily call schema migration", () => {
  it("adds daily_call_time with the 06:00 default and a value check", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS daily_call_time text NOT NULL DEFAULT '06:00'/);
    expect(sql).toMatch(/daily_call_time IN \('05:00','05:30','06:00','06:30','07:00','07:30','08:00','sunrise'\)/);
  });
  it("adds notif_swell_alerts default true and beaches.short_name", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS notif_swell_alerts boolean NOT NULL DEFAULT true/);
    expect(sql).toMatch(/ALTER TABLE public\.beaches ADD COLUMN IF NOT EXISTS short_name text/);
  });
  it("creates swell_event_alerts keyed on user + event", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.swell_event_alerts/);
    expect(sql).toMatch(/UNIQUE \(user_id, event_key\)/);
  });
  it("re-keys surf_alert_delivery_slots to user + date and drops beach from the RPC", () => {
    expect(sql).toMatch(/PRIMARY KEY \(recipient_user_id, alert_date\)/);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.claim_surf_alert_slot\(uuid, uuid, uuid, date, smallint\)/);
    expect(sql).toMatch(/FUNCTION public\.claim_surf_alert_slot\(\s*p_event_id uuid,\s*p_recipient_user_id uuid,\s*p_alert_date date,\s*p_priority smallint\s*\)/);
  });
  it("disables similarity rules without deleting them", () => {
    expect(sql).toMatch(/UPDATE public\.alert_rules SET enabled = false WHERE preset_type = 'similarity_match'/);
    expect(sql).not.toMatch(/DELETE FROM public\.alert_rules/);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `yarn test:unit --runTestsByPath __tests__/migrations/daily-call-schema.test.ts`
Expected: FAIL, `ENOENT` for the migration file.

- [ ] **Step 3: Write the migration**

```sql
-- Daily call + swell alert schema (spec: docs/superpowers/specs/2026-09-17-daily-call-and-swell-alert-design.md)
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_call_time text NOT NULL DEFAULT '06:00';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_daily_call_time_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_daily_call_time_check
  CHECK (daily_call_time IN ('05:00','05:30','06:00','06:30','07:00','07:30','08:00','sunrise'));
COMMENT ON COLUMN public.profiles.daily_call_time IS 'Local send time for the daily call push, or ''sunrise''. Spec 2026-09-17 D5.';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notif_swell_alerts boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.profiles.notif_swell_alerts IS 'Per-type pref for swell_watch pushes. Default true; free for all users.';

ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS short_name text;
COMMENT ON COLUMN public.beaches.short_name IS 'Approved short display name for push titles. NULL = use name.';

CREATE TABLE IF NOT EXISTS public.swell_event_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  peak_date date NOT NULL,
  lead_beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  notification_event_id uuid NULL REFERENCES public.notification_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  UNIQUE (user_id, event_key)
);
CREATE INDEX IF NOT EXISTS swell_event_alerts_user_created_idx ON public.swell_event_alerts (user_id, created_at DESC);
ALTER TABLE public.swell_event_alerts ENABLE ROW LEVEL SECURITY;

-- One surf push per user per local date, regardless of beach.
ALTER TABLE public.surf_alert_delivery_slots DROP CONSTRAINT IF EXISTS surf_alert_delivery_slots_pkey;
ALTER TABLE public.surf_alert_delivery_slots ALTER COLUMN beach_id DROP NOT NULL;
ALTER TABLE public.surf_alert_delivery_slots ADD PRIMARY KEY (recipient_user_id, alert_date);

DROP FUNCTION IF EXISTS public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint);
CREATE OR REPLACE FUNCTION public.claim_surf_alert_slot(
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_alert_date date,
  p_priority smallint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_event_id uuid;
  v_priority smallint;
  v_winner_status text;
BEGIN
  IF p_priority NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid surf alert priority: %', p_priority;
  END IF;

  INSERT INTO public.surf_alert_delivery_slots (recipient_user_id, alert_date, winner_notification_event_id, priority)
  VALUES (p_recipient_user_id, p_alert_date, p_event_id, p_priority)
  ON CONFLICT DO NOTHING;

  SELECT slot.winner_notification_event_id, slot.priority, event.status
  INTO v_winner_event_id, v_priority, v_winner_status
  FROM public.surf_alert_delivery_slots AS slot
  JOIN public.notification_events AS event ON event.id = slot.winner_notification_event_id
  WHERE slot.recipient_user_id = p_recipient_user_id AND slot.alert_date = p_alert_date
  FOR UPDATE OF slot, event;

  IF v_winner_event_id = p_event_id THEN RETURN true; END IF;
  IF v_winner_status IN ('processing', 'processed') THEN RETURN false; END IF;

  IF v_winner_status NOT IN ('pending') OR p_priority > v_priority THEN
    IF v_winner_status = 'pending' THEN
      UPDATE public.notification_events
      SET status = 'cancelled', skip_reason = 'surf_slot_replaced', updated_at = now()
      WHERE id = v_winner_event_id;
    END IF;
    UPDATE public.surf_alert_delivery_slots
    SET winner_notification_event_id = p_event_id, priority = p_priority, updated_at = now()
    WHERE recipient_user_id = p_recipient_user_id AND alert_date = p_alert_date;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, date, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, date, smallint) TO service_role;

-- Similarity retires. Rows stay for history; Alert Center stops rendering them.
UPDATE public.alert_rules SET enabled = false WHERE preset_type = 'similarity_match';

COMMIT;
```

Before writing the replacement RPC body, read the original at `supabase/migrations/20260713180000_add_surf_alert_delivery_slots.sql:23-155` and `supabase/migrations/20260714153500_restrict_claim_surf_alert_slot_grants.sql`; keep every side effect the original performs when replacing a pending winner (it also inserts an `alert_delivery_attempts` row for forecast-alert losers). Carry that block over verbatim, minus the beach column.

- [ ] **Step 4: Hand-edit `types/database.generated.ts`** for the new columns/table/RPC args, mirroring neighbouring entries. Run `yarn tsc --noEmit -p tsconfig.json 2>&1 | head -20` and fix only errors this task introduced.

- [ ] **Step 5: Run the test, confirm PASS, commit**

```bash
git add supabase/migrations/20260918100000_daily_call_schema.sql types/database.generated.ts __tests__/migrations/daily-call-schema.test.ts
git commit -m "feat(alerts): daily call schema, per-user surf slot, swell_event_alerts"
```

---

### Task 2: Personal label cannot promote a physical maybe to go

**Files:**
- Modify: `lib/recommendations/canonical-decision/engine.ts` (`personalMatchVerdict`, lines ~129–152 and selection ~255–325)
- Test: `__tests__/lib/recommendations/canonical-decision/engine.test.ts` (extend the existing file; if it lives elsewhere, `grep -rl "personalMatchVerdict\|canonical-decision/engine" __tests__` and extend that one)

**Interfaces:**
- Produces: unchanged exports. Behaviour: final verdict = `min(physicalVerdict, personalVerdict)` on the order `no < maybe < go`.

- [ ] **Step 1: Failing test**

```ts
it("does not let a GOOD personal label promote a physical maybe to go", () => {
  const decision = decideCanonicalSession(buildInput({
    candidates: [buildCandidate({
      candidateId: "pb-point:2026-09-16T18:00:00Z",
      utilityScore: 65,                // physical → maybe
      recommendationLabel: "Maybe",
      personalMatch: { score: 7.9, label: "GOOD", confidence: "high", sessionCount: 12, reasons: [] },
    })],
  }));
  expect(decision.verdict).toBe("maybe");
  expect(decision.reasonCode).not.toBe("selected_go");
});

it("keeps go when both physical and personal say go", () => {
  const decision = decideCanonicalSession(buildInput({
    candidates: [buildCandidate({ utilityScore: 82, recommendationLabel: "Worth it",
      personalMatch: { score: 9.1, label: "EPIC", confidence: "high", sessionCount: 12, reasons: [] } })],
  }));
  expect(decision.verdict).toBe("go");
});
```

Use the file's existing builders (`buildInput`, `buildCandidate` or equivalents). Read the test file first and match its helpers.

- [ ] **Step 2: Run, confirm the first test FAILS with `expected "maybe", received "go"`.**

- [ ] **Step 3: Implement** in `engine.ts`: after computing the learned verdict for the selected candidate, cap it with the physical verdict:

```ts
const VERDICT_RANK = { no: 0, maybe: 1, go: 2 } as const;
function capByPhysical(personal: "go" | "maybe" | "no", physical: "go" | "maybe" | "no"): "go" | "maybe" | "no" {
  return VERDICT_RANK[personal] <= VERDICT_RANK[physical] ? personal : physical;
}
```

Apply where the final verdict is chosen for a learned candidate (the branch that today maps `EPIC|GOOD → go`). Update the `reasonCode` to `selected_maybe` when capped. Do not change physical scoring.

- [ ] **Step 4: Run the engine test file and `__tests__/api/cron/condition-alert-deliver.test.ts`; fix any assertion that encoded the old override (there is one around the similarity branch at ~2759–2787; it is deleted in Task 9, so mark it `it.skip` with a comment `// removed in Task 9` if it blocks).**

- [ ] **Step 5: Commit** `fix(decision): personal match cannot promote a physical maybe to go`

---

### Task 3: Flags

**Files:**
- Create: `lib/flags/daily-call.ts`, `lib/flags/swell-alert.ts`
- Test: `lib/flags/__tests__/daily-call.test.ts` (this directory already holds flag tests; match its style)

**Interfaces:**
- Produces:
```ts
export const DAILY_CALL_ENABLED_FLAG = "DAILY_CALL_ENABLED";
export const DAILY_CALL_USER_ALLOWLIST_FLAG = "DAILY_CALL_USER_ALLOWLIST";
export function isDailyCallEnabled(): boolean;                 // env === "true"
export function getDailyCallAllowlist(): Set<string>;          // empty set = everyone
export function isDailyCallUserAllowed(userId: string): boolean;
```
Same three for swell: `SWELL_ALERT_ENABLED`, `SWELL_ALERT_USER_ALLOWLIST`, `isSwellAlertEnabled`, `getSwellAlertAllowlist`, `isSwellAlertUserAllowed`.

- [ ] **Step 1: Failing tests** covering: unset → disabled; `"true"` → enabled; `"TRUE"` → disabled (exact match, same as `isAlertsDeliveryEnabled`); allowlist `"a, b ,,c"` → `{a,b,c}`; empty allowlist allows any user; non-empty allowlist rejects an absent user.
- [ ] **Step 2: Run, FAIL. Step 3: implement (mirror `lib/flags/alerts-delivery.ts`). Step 4: PASS. Step 5: commit** `feat(flags): daily call and swell alert flags`

---

### Task 4: User pool

**Files:**
- Create: `lib/alerts/user-pool.ts`
- Read-only source: `app/api/cron/similarity-alerts/route.ts:680-801` (candidate builder; this file is deleted in Task 9, so copy logic, do not import from it)
- Test: `__tests__/lib/alerts/user-pool.test.ts`

**Interfaces:**
- Produces:
```ts
export type PoolRelation = "home" | "favorite" | "custom" | "nearby";
export interface PoolBeach { beach: Beach; relation: PoolRelation; distanceMiles: number | null; }
export interface LoadUserPoolArgs {
  supabase: SupabaseClient<Database>;
  userId: string;
  homeBeachId: string | null;
  location: { lat: number; lon: number } | null;   // latest user_location_snapshots row, ≤ 24h old, else null
  maxDriveMinutes: number | null;
}
export async function loadUserPool(args: LoadUserPoolArgs): Promise<PoolBeach[]>;
export function poolRadiusMiles(maxDriveMinutes: number | null): number; // min(100, max_drive_minutes*0.5) or 30
```
Order of the returned array is irrelevant; the ranker in Task 8 uses `relation`. Favorites and home are always included even if outside the radius (they are the user's stated intent); `nearby` comes from `get_weekend_scout_candidates` with the radius, only when `location` is non-null. Custom spots come from `favorite_beaches.custom_spot_id` joined to their forecast-capable row; skip custom spots with no `enhanced_forecasts` in the last 24h. Beaches with null/empty `slug` are dropped (same defensive rule as the similarity cron).

- [ ] **Step 1: Failing tests** with a mocked Supabase client (see `__tests__/api/cron/similarity-alerts.test.ts` for the mock pattern before it is deleted): (a) home + 2 favorites + 3 nearby → 6 entries with correct relations, home wins over favorite when the same id appears in both; (b) `location: null` → no nearby, favorites still present; (c) `poolRadiusMiles(null)` → 30, `(60)` → 30, `(400)` → 100; (d) beach with empty slug dropped.
- [ ] **Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: commit** `feat(alerts): extract user pool builder`

---

### Task 5: Window refiner and send-time resolver

**Files:**
- Create: `lib/alerts/window-refiner.ts`, `lib/alerts/send-time.ts`
- Reuse: `lib/services/discovery/window-selector/tide-boundary-calculator.ts` (`extractTideSchedule`), `lib/services/noaa-coops/tide-extrema-detector.ts` (`TideExtremaDetector`), `lib/alerts/sunrise.ts` (`getDaylightWindow`), `lib/utils/timezone-utils.ts` (`getLocalHour`, `getLocalDateString`)
- Test: `__tests__/lib/alerts/window-refiner.test.ts`, `__tests__/lib/alerts/send-time.test.ts`

**Interfaces:**
- Produces:
```ts
// window-refiner.ts
export type DriverKind = "tide" | "wind" | "swell" | "daylight";
export interface WindowDriver {
  kind: DriverKind;
  edge: "start" | "end";
  at: string;              // ISO
  approximate: boolean;    // true → render with "~"
  label: string;           // "rising to a 4.3ft high", "offshore till the wind turns", "sunrise"
}
export interface CoarseWindow { start: string; end: string; }            // hourly go span, ISO
export interface RefineWindowArgs {
  coarse: CoarseWindow;
  forecasts: EnhancedForecastEntity[];       // the beach's hourly rows for the day, sorted
  beach: Beach;
  tideSamples: { at: string; heightFt: number }[] | null;   // sub-hour curve when available
  daylight: { sunrise: string; sunset: string };
  verdictAt: (forecast: EnhancedForecastEntity) => "go" | "maybe" | "no";  // canonical per-hour verdict
}
export interface RefinedWindow { start: string; end: string; drivers: WindowDriver[]; minutes: number; }
export function refineWindow(args: RefineWindowArgs): RefinedWindow | null;  // null when < 60 min
export function roundToFiveMinutes(iso: string): string;

// send-time.ts
export type DailyCallTime = "05:00"|"05:30"|"06:00"|"06:30"|"07:00"|"07:30"|"08:00"|"sunrise";
export const DAILY_CALL_TIMES: readonly DailyCallTime[];
export const DEFAULT_DAILY_CALL_TIME: DailyCallTime; // "06:00"
export function parseDailyCallTime(value: unknown): DailyCallTime;   // invalid → default
export function resolveSendInstant(args: { pref: DailyCallTime; localDate: string; timezone: string; sunrise: Date | null }): Date;
export function isSendHour(args: { now: Date; pref: DailyCallTime; timezone: string; sunrise: Date | null }): boolean; // true when now is within [sendInstant, sendInstant+60min)
```

Refiner algorithm: for each edge, find the boundary hour pair (last go row inside, first non-go row outside). Ask which driver changed: tide (row height crossed the beach's tide range or `tide_status` flipped), wind (speed crossed the beach limit or direction class flipped to onshore), swell (direction left the beach window), daylight (outside `daylight`). Tide edge: if `tideSamples` exists, take the exact sample time of the crossing; else interpolate between the two rows and mark `approximate`. Wind/swell: interpolate linearly on the crossing quantity between the two rows, round to 5 minutes, `approximate: true`. Daylight: exact. If more than one driver flips on the same edge, keep the one whose crossing is earliest for `end` and latest for `start`. Discard if the refined span is under 60 minutes.

- [ ] **Step 1: Failing tests** (fixtures built inline; times in UTC with `America/Los_Angeles` beach): (a) coarse 15:00–18:00Z, wind onshore at the 18:00 row rising from 4 to 12 mph with limit 8 → end `~17:30`, driver wind approximate; (b) tide samples every 6 min, coarse start driven by tide crossing 2.0 ft at 15:36 → start `15:36`, not approximate; (c) daylight end at sunset 18:42 → exact; (d) refined span 50 min → null; (e) `roundToFiveMinutes("…T17:33:00Z")` → `17:35`. Send-time: (f) pref `06:00`, tz LA, now `2026-09-16T13:10Z` → true, `14:10Z` → false; (g) `sunrise` with sunrise `13:41Z`, now `13:50Z` → true; (h) `parseDailyCallTime("garbage")` → `"06:00"`.
- [ ] **Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: commit** `feat(alerts): driver-bounded window refiner and send-time resolver`

---

### Task 6: Title pool and selection

**Files:**
- Create: `lib/notifications/copy/surf-titles.v1.json`, `lib/notifications/copy/select-title.ts`
- Source: `.planning/2026-09-17-push-alerts-audit/COPY_RESEARCH.md` Parts 2–4 (import all 40 swell + 30 daily titles and bodies; the founder cuts later by deleting entries)
- Test: `__tests__/lib/notifications/copy/select-title.test.ts`

**Interfaces:**
- JSON shape:
```json
{ "version": 1,
  "daily": [ { "id": "d01", "title": "Here's the window. {beach} {start}–{end}", "body": "…", "tags": ["live","generic"], "film": false } ],
  "swell": [ { "id": "s09", "title": "Best in weeks: {beach1}", "body": "…", "tags": ["biggest-in-weeks","manageable"], "film": false } ] }
```
- Produces:
```ts
export type Pool = "daily" | "swell";
export interface TitleVars { [key: string]: string }   // beach, start, end, beach1..3, size, period, dir, peak_day, peak_part, rarity, tide, wind, high_time, turn_time, home_beach
export interface SelectTitleArgs {
  pool: Pool; tags: string[]; userId: string; eventKey: string;
  recentTitleIds: string[];            // ids sent to this user within the repeat window
  recentFilmCount: number;             // film titles among the user's last 3 swell sends
  vars: TitleVars;
}
export interface SelectedTitle { id: string; title: string; body: string; fallback: boolean; }
export function selectTitle(args: SelectTitleArgs): SelectedTitle;
export function renderTemplate(template: string, vars: TitleVars): string;
export const TITLE_MAX_CHARS = 40;
export const SWELL_TAG_PRIORITY: readonly string[]; // ["serious","hawaii","biggest-in-weeks","first-after-flat","weekend","weekday","long-period","south","northwest","manageable","generic"]
```
Rules (from COPY_RESEARCH Part 4): candidates = entries whose every tag is in `args.tags` (tag proof), minus `recentTitleIds`; if `"serious"` ∈ tags, candidates = entries tagged `serious` only; if `recentFilmCount >= 1` (i.e. would exceed one-in-three), drop `film: true`; rank by first matching tag in priority order; among the top rank pick by `hash(userId + eventKey) % n` (use `node:crypto` sha256, stable); render; count `[...title].length`; if > 40, try the next shortest candidate; if none fit, return the fallback (`{beach} {start}–{end}` for daily, `Swell peaks {peak_day}` for swell) with `fallback: true`. `renderTemplate` throws if a `{var}` is missing.

- [ ] **Step 1: Failing tests**: tag proof (entry needing `long-period` never chosen when tags lack it); serious override drops every non-serious entry; film cap; repeat exclusion; hash stability (same args → same id, different eventKey → may differ); 40-char fallback with a long beach name; `renderTemplate` missing var throws; JSON loads and every entry's rendered title with short vars is ≤ 40.
- [ ] **Step 2: FAIL. Step 3: implement and author the JSON from COPY_RESEARCH.md verbatim (titles, bodies, tags; `film: true` for the 12 film allusions). Step 4: PASS. Step 5: commit** `feat(notifications): tagged surf title pool with rotation`

---

### Task 7: Registry `daily_call`, `swell_watch` channels, per-user slot

**Files:**
- Create: `lib/notifications/types/daily-call.ts`
- Modify: `lib/notifications/registry.ts` (add `daily_call` after `forecast_alert`; set `swell_watch.channels = ["push","in_app"]`, `prefs.perType.push/in_app = "notif_swell_alerts"`, `surfAlertPriority: 1`; leave `similarity_match` and `home_morning_call` entries in place for Task 9 to delete), `lib/notifications/worker.ts` (`getSurfAlertSlot` no longer needs `beachId`; slot key `${user}:${alertDate}`; RPC call drops `p_beach_id`), `lib/notifications/types.ts` (`ProfilePrefColumn` union gains `"notif_swell_alerts"`)
- Test: `__tests__/notifications/registry.test.ts`, `__tests__/notifications/surf-alert-arbitration.test.ts`, `__tests__/notifications/worker.test.ts`, `__tests__/lib/notifications/daily-call.test.ts`

**Interfaces:**
- Produces:
```ts
// lib/notifications/types/daily-call.ts
export const DAILY_CALL_SCHEMA_VERSION = "daily-call.v1";
export const dailyCallPayloadSchema = z.object({
  schema_version: z.literal(DAILY_CALL_SCHEMA_VERSION),
  beach_id: z.string().uuid(), beach_slug: z.string().min(1), beach_name: z.string().min(1),
  alert_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window_start: z.string().datetime(), window_end: z.string().datetime(),
  window_local: z.string().min(1),                          // "7:15–9:40" or "7:15–~9:40"
  drivers: z.array(z.object({ kind: z.enum(["tide","wind","swell","daylight"]), edge: z.enum(["start","end"]), at: z.string().datetime(), approximate: z.boolean(), label: z.string() })),
  wave_height_ft: z.number(), wave_period_s: z.number(), swell_dir: z.string(),
  wind_label: z.string(), tide_label: z.string(),
  reason: z.string().min(1),                                // rendered body
  title: z.string().min(1).max(40), title_id: z.string(),
  comparison: z.string().nullable(),                        // "Cleaner than Blacks today" or null
  swell_event_key: z.string().nullable(),                   // set when a swell alert fired for this date
  decision_id: z.string(), session_decision: z.unknown(),
});
export type DailyCallPayload = z.infer<typeof dailyCallPayloadSchema>;
export function parseDailyCallPayload(input: unknown): DailyCallPayload;
```
- Registry entry: `channels: ["push","in_app"]`, `prefs.master.push = "notif_push_enabled"`, `prefs.perType.push = "notif_forecast_alerts"`, `perType.in_app = "notif_forecast_alerts"`, `surfAlertPriority: 2`, `quietHours: DEFAULT_QUIET`, `buildPushPayload` → `{ ...SURF_ALERT_PUSH_PRESENTATION, title: p.title, body: p.reason, data: { type: "daily_call", beach_id, beach_slug, alert_date, forecast_at: p.window_start, window_start, window_end, window_local, drivers: JSON.stringify(p.drivers), reason: p.reason, decision_id } }` (push `data` values must be strings: stringify `drivers`). `buildInAppPayload` → full payload.
- Worker: `SurfAlertSlot = { alertDate; priority }`; key `${recipient_user_id}:${alertDate}`; `supabase.rpc("claim_surf_alert_slot", { p_event_id, p_recipient_user_id, p_alert_date, p_priority })`.

- [ ] **Step 1: Failing tests**: (a) `daily_call` registry entry validates a good payload and rejects a 41-char title; push data contains `reason`, `window_start`, `drivers` as a JSON string; (b) `swell_watch` now has push + in_app channels gated by `notif_swell_alerts`, priority 1; (c) arbitration: two pending surf events for the same user and date at **different beaches** → one winner (manual priority 3 beats daily 2); (d) worker calls the RPC without `p_beach_id`; (e) a `daily_call` event with a missing `alert_date` is not treated as a surf slot (returns null → delivered normally; keep existing behaviour for malformed payloads).
- [ ] **Step 2: FAIL. Step 3: implement. Step 4: run the four test files, PASS. Step 5: commit** `feat(notifications): daily_call type, swell_watch delivery, per-user surf slot`

---

### Task 8: Daily call producer

**Files:**
- Create: `lib/cron/daily-call-runner.ts`, `app/api/cron/daily-call/route.ts`
- Modify: `vercel.json` (add `{ "path": "/api/cron/daily-call", "schedule": "0 * * * *" }` next to the other alert crons)
- Reuse: Task 3 flags, Task 4 pool, Task 5 refiner + send-time, Task 6 titles, Task 7 payload; `selectBestWindows` from `lib/services/discovery/window-selector`; canonical engine; `enqueueNotification`; `resolveBeachTimezone`; `getDaylightWindow`; `TideCache` for `tideSamples` (read from `tide_forecasts`; null if no rows).
- Test: `__tests__/lib/cron/daily-call-runner.test.ts`, `__tests__/api/cron/daily-call.test.ts`

**Interfaces:**
- Produces:
```ts
export interface DailyCallCandidate { pool: PoolBeach; window: RefinedWindow; physicalScore: number; personalFit: number; verdict: "go"; decisionId: string; sessionDecision: unknown; }
export interface DailyCallRunSummary { evaluated: number; sent: number; silent: number; skippedCounts: Record<string, number>; errors: number; durationMs: number; }
export async function runDailyCallCron(args: { now: Date; supabase?: SupabaseClient<Database>; deps?: Partial<DailyCallDeps> }): Promise<DailyCallRunSummary>;
export function rankCandidates(candidates: DailyCallCandidate[], homeBeachId: string | null): DailyCallCandidate[]; // physical desc, then personalFit desc, then relation favorite/custom > nearby, then home > other favorite, then earliest start, then beach id
export function buildComparisonLine(winner: DailyCallCandidate, home: DailyCallCandidate | null): string | null; // null when winner is home or home has no window; else "Cleaner than {home} today" / "Better tide than {home} today" / "Bigger than {home} today" chosen by the largest differing driver
```
Per tick: select profiles where `notif_push_enabled` and `notif_forecast_alerts` are true, `isDailyCallUserAllowed(id)`, and `isSendHour({now, pref: parseDailyCallTime(profile.daily_call_time), timezone, sunrise})` where timezone = profile.timezone ?? home beach timezone ?? location snapshot timezone. For each: pool → forecasts for today (local date) 05:00–20:00 per beach → per-hour canonical verdict → coarse go spans → `refineWindow` → candidates → `rankCandidates` → top. Skip reasons counted: `no_go_window`, `window_closing_within_30m` (skip that window and take the next), `already_sent_today` (a `daily_call` event for user+date exists), `disabled`, `allowlist`, `no_pool`, `no_forecast`. If the top window is already open, keep it and set `live: true` in tags. Title var `beach` = `beach.short_name ?? beach.name`; `home_beach` likewise. Tags for the title: `tide-driven`/`wind-driven` from the end driver kind, `early` if start < 07:00 local, `afternoon` if start ≥ 12:00, `home-beach`/`not-home`, `live`, always `generic`. Dedupe key `daily_call:{userId}:{alertDate}`. `swell_event_key` from `swell_event_alerts` where `user_id` and `peak_date = alert_date`; when set, add tag `swell-day` (Task 11 adds those titles; until then the tag is harmless). The route mirrors `app/api/cron/home-morning-call/route.ts` for auth (`validateCronRequest`), `withObservedCron`, and the Sentry monitor block.

- [ ] **Step 1: Failing tests** with mocked deps: (a) user pref 06:00 LA, `now = 13:00Z`, home Blacks maybe, favorite Osprey go 15:00–17:00Z with wind end → one enqueue with `beach_id` Osprey, title from pool, `comparison` "Cleaner than Blacks today", `window_local` "8:00–~9:40" (assert the en dash and tilde); (b) all beaches maybe → `silent` incremented, no enqueue; (c) pref 07:00 at 13:00Z → not this user's hour, skipped `not_send_hour`; (d) window already open → sent with `live` tag; (e) second tick same day → `already_sent_today`; (f) `rankCandidates` tie order: equal scores, favorite beats nearby, home beats other favorite; (g) window closing in 20 min → skipped, next go window used.
- [ ] **Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: commit** `feat(alerts): daily call producer`

---

### Task 9: Retire similarity and home-morning-call

**Files:**
- Delete: `app/api/cron/similarity-alerts/`, `app/api/cron/home-morning-call/`, `lib/cron/home-beach-push-runner.ts`, `lib/alerts/similarity-best-pick.ts`, `lib/alerts/auto-enable-similarity.ts`, `lib/notifications/home-morning-call-presentation.ts`, `lib/notifications/types/similarity-match.ts`, their tests (`__tests__/api/cron/similarity-alerts.test.ts`, `__tests__/condition-alert-deliver-similarity.test.ts`, `__tests__/lib/alerts/similarity-best-pick.test.ts`, `__tests__/lib/notifications/similarity-match.test.ts`, home-morning-call tests found by `grep -rl "home-morning-call\|home_morning_call\|similarity" __tests__`)
- Modify: `vercel.json` (remove both cron entries), `app/api/cron/condition-alert-deliver/route.ts` (delete the similarity branch ~1836–2320 and the `partition` that routes similarity rows; similarity queue rows still in `alert_queue` must be ignored: filter `conditions_snapshot->>'alert_type' != 'similarity_match'` in the due-rows query), `lib/alerts/push-formatter.ts` (delete the similarity formatter ~45–89), `lib/notifications/registry.ts` (delete `similarity_match` and `home_morning_call` entries), `lib/notifications/worker.ts` (any `similarity_match` special-casing), `app/api/alerts/rules/route.ts` and `app/api/alerts/seed-default/route.ts` (stop auto-creating similarity rules; grep `auto-enable-similarity`), `components/alerts/*` (stop rendering `similarity_match` rules on the web alerts page)
- Keep: `compute_user_match_score*` RPCs, `lib/services/similarity-insights-service.ts`, `notif_similarity_alerts` column (unused, harmless)

- [ ] **Step 1: `grep -rn "similarity_match\|similarity-alerts\|home_morning_call\|home-morning-call\|homeMorningCall\|similarityBestPick" lib app components vercel.json __tests__ | grep -v similarity-insights` and list every hit in the commit body.**
- [ ] **Step 2: Delete and edit. Step 3: `yarn tsc --noEmit -p tsconfig.json`; fix every error. Step 4: run `__tests__/api/cron/condition-alert-deliver.test.ts`, `__tests__/notifications/registry.test.ts`, `__tests__/notifications/worker.test.ts`, `__tests__/api/alerts/**` and the web alerts component tests; PASS. Step 5: commit** `refactor(alerts): retire similarity-match and home-morning-call producers`

---

### Task 10: Manual-rule fixes

**Files:**
- Modify: `lib/alerts/condition-evaluator.ts:24-26`, `lib/alerts/actionable-window-selector.ts:6-28`
- Test: `__tests__/lib/alerts/condition-evaluator.test.ts`, `__tests__/lib/alerts/actionable-window-selector.test.ts`

- [ ] **Step 1: Failing tests**: (a) rule `swell_period_min: 14`, forecast `wave_period: 15, swell_1_period: 9` → matches (today it fails); (b) `wave_period: 9, swell_1_period: 15` → does not match; (c) selector: `now` = best hour + 10 min → window is NOT actionable (today it is, up to +15).
- [ ] **Step 2: FAIL. Step 3: change the period source to `forecast.wave_period ?? forecast.swell_1_period` and the selector's eligibility to end at the best hour. Step 4: PASS plus `__tests__/api/cron/condition-alert-evaluate.test.ts`. Step 5: commit** `fix(alerts): compare period to the dominant wave train; stop late windows`

---

### Task 11: Swell alert producer

**Files:**
- Create: `lib/alerts/swell-rarity.ts`, `lib/cron/swell-alert-runner.ts`, `app/api/cron/swell-alert/route.ts`
- Modify: `vercel.json` (add `{ "path": "/api/cron/swell-alert", "schedule": "0 * * * *" }`; leave `swell-watch` and `swell-watch-acquire` untouched, the study keeps running), `lib/notifications/copy/surf-titles.v1.json` (add 4 `swell-day` daily titles: "Swell's here. {beach} {start}–{end}", "The one we warned you about. {beach} {start}–{end}", "Told you. {beach} {start}–{end}", "Swell day. {beach} {start}–{end}"), `lib/notifications/types/major-swell.ts` (extend the payload with `beaches: [{beach_id, beach_name, rank}]` ×3, `rarity: string`, `event_key: string`, `title_id: string`)
- Reuse: `lib/alerts/swell-watch-detector.ts` (`detectSwellWatchEvent` or the exported detector; read the file), `lib/recommendations/major-swell-awareness/shadow-evaluator.ts` for advisory cross-check, Task 4 pool, Task 6 titles, Task 3 flags, `swell_event_alerts` from Task 1
- Test: `__tests__/lib/alerts/swell-rarity.test.ts`, `__tests__/lib/cron/swell-alert-runner.test.ts`

**Interfaces:**
```ts
// swell-rarity.ts
export interface DayScore { localDate: string; bestScore: number; go: boolean; }
export interface RarityVerdict { rare: boolean; kind: "best-in-30" | "first-after-flat" | null; rarityLine: string | null; } // "Best since Aug 14" / "First real swell in 9 days"
export function assessRarity(args: { peakDate: string; history: DayScore[] /* trailing 30 local days for the pool, best score per day */; peakScore: number; peakGo: boolean; }): RarityVerdict;
export function buildEventKey(args: { peakDate: string; leadBeachId: string }): string; // `${leadBeachId}:${peakDate bucketed to ±1 day → the earlier of the two adjacent dates}`
// swell-alert-runner.ts
export async function runSwellAlertCron(args: { now: Date; supabase?: SupabaseClient<Database>; deps?: Partial<SwellAlertDeps> }): Promise<SwellAlertRunSummary>;
```
Per tick: users allowed by `isSwellAlertUserAllowed` with `notif_push_enabled` and `notif_swell_alerts`, whose local hour is 17. For each: pool → run the detector per pool beach over the next 10 days → keep events whose `eventStartDate` is tomorrow (local) → for the lead beach (highest peak score), `assessRarity` against the pool's trailing 30 days (best canonical score per day) → if rare: `event_key`, skip if `swell_event_alerts (user_id, event_key)` exists or any row for the user in the last 72 h → insert row → tags (`first-after-flat`/`biggest-in-weeks`, `weekend`/`weekday` from peak date, `long-period` if ≥16 s, `south`/`northwest` from direction, `serious` if peak ≥ 8 ft or the safety hold flags it, else `manageable`, `hawaii` if beach state is HI) → `selectTitle` → enqueue `swell_watch` with dedupe key `swell_watch:{userId}:{event_key}` → set `sent_at`, `notification_event_id`.

- [ ] **Step 1: Failing tests**: (a) history all ≤ 55, peak 78 go → rare `best-in-30`, line "Best since …" or "Best in 30 days" when nothing scored go; (b) history: 3 flat days then peak go → `first-after-flat`, "First real swell in 4 days"; (c) peak 70 with a 74 five days ago and no flat spell → not rare; (d) `buildEventKey` for peak dates D and D+1 with the same lead beach → same key; (e) runner: an event yesterday → skip `event_exists`; two events 48 h apart → second skipped `cooldown_72h`; (f) serious peak 9 ft → title from the serious tier only; (g) local hour 16 → `not_send_hour`.
- [ ] **Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: commit** `feat(alerts): swell alert producer on the swell-watch detector`

---

### Task 12: Integration: one morning push, one evening push

**Files:**
- Create: `__tests__/integration/surf-push-budget.test.ts`
- Reuse: fixtures from Tasks 8 and 11 tests (extract shared builders into `__tests__/fixtures/surf-push-fixtures.ts` if both files repeat them)

- [ ] **Step 1: Test**: fixed forecast fixture for one user (home Blacks, favorite Osprey), a manual rule on Blacks that matches 15:00–16:00Z, daily call pref 06:00, and a swell event starting tomorrow. Drive: (1) swell-alert tick at 17:00 local the day before → exactly one `swell_watch` event; (2) condition-alert-evaluate + deliver at 13:00Z → one pending `forecast_alert`; (3) daily-call tick at 13:00Z → one pending `daily_call`; (4) worker run → exactly one surf push delivered for the date, and it is the `forecast_alert`, the `daily_call` is cancelled with `surf_slot_replaced`; (5) daily-call tick again at 14:00Z → `already_sent_today`, nothing enqueued. Assert the delivered payload's beach and that the swell event from step 1 was not cancelled by step 4.
- [ ] **Step 2: Run, fix whatever the previous tasks left inconsistent, PASS. Step 3: commit** `test(alerts): surf push budget integration`

---

### Task N1 (native): preferences

**Repo:** `/Users/stevenchandler/Desktop/dev/quiver-native` — use a worktree under `.worktrees/` on branch `feat/daily-call-prefs` off `origin/main` (see `worktree-lifecycle`; the primary checkout is dirty). Jest ignores `/.claude/worktrees/`, so use `.worktrees/`.

**Files:**
- Modify: `src/types/profile.ts` (add `daily_call_time: string`, `notif_swell_alerts: boolean`), `src/hooks/use-update-profile.ts` (add both to `ProfileUpdate`), `src/screens/settings.tsx` (`NOTIFICATION_SETTINGS`: remove `notif_similarity_alerts`; add `{ key: 'notif_swell_alerts', label: 'Swell alerts', section: 'Types' }` and `{ key: 'notif_water_quality', label: 'Water quality', section: 'Types' }`; add a "Daily call time" row under Types that opens a picker with the eight values, default `06:00`, labels "5:00 AM"… "8:00 AM", "At sunrise")
- Test: `src/__tests__/settings-notifications.test.tsx` (create if absent; follow `src/__tests__/alert-center-screen.test.tsx` for render helpers)

- [ ] **Step 1: Failing tests**: renders "Swell alerts", "Water quality", "Daily call time" with "6:00 AM"; does not render "Similarity alerts"; choosing "At sunrise" calls `useUpdateProfile` with `{ daily_call_time: 'sunrise' }`.
- [ ] **Step 2: FAIL. Step 3: implement. Step 4: `npx jest --runTestsByPath src/__tests__/settings-notifications.test.tsx` (Node 22). Step 5: commit** `feat(settings): daily call time and swell alert preferences`

---

### Task N2 (native): routing and banner

**Files:**
- Modify: `src/lib/push-notifications.ts` (add `data.type === 'daily_call'` → BeachDetail with `buildBeachDetailParams(beach_id, data)` so `forecast_at`/`window_start` selects the window; replace the `similarity_match` branch with a no-op that routes Home for any legacy push; `swell_watch` → BeachDetail for `beach_id` with `peak_date` in params and `beaches` (JSON string of the top three) so Beach Detail can render beaches two and three as chips that navigate to their own Beach Detail; if the chips component does not exist yet, render them inside the alert banner), `src/lib/alert-context.ts` (`isAlertContextType` accepts `daily_call` and `swell_watch`; parse `data.drivers` JSON string into `drivers: WindowDriver[]`; carry `window_local`), `src/components/alerts/alert-context-banner.tsx` (render each driver label on its own line under the window when present), `src/screens/alert-center.tsx` and `src/components/alerts/alert-rule-group.tsx` (filter out `preset_type === 'similarity_match'`), `src/screens/beach-detail.tsx` (if `window_start` param is present, select that forecast hour on mount; read how `forecast_at` is handled today and reuse it)
- Test: `src/__tests__/push-routing-daily-call.test.ts`, `src/__tests__/alert-context-banner.test.tsx` (extend)

- [ ] **Step 1: Failing tests**: daily_call push → navigates BeachDetail with `beachId` and the window start; swell_watch push → BeachDetail with `peak_date`; legacy similarity_match → Home; banner shows two driver lines from a JSON-string `drivers`; Alert Center hides a similarity rule.
- [ ] **Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: commit** `feat(push): route daily call and swell alerts to Beach Detail with drivers`

---

## Ship checklist (after all tasks merge)

1. Apply the migration to prod via `psql -f` (memory: `quiver-prod-psql-connection`), then verify `list_migrations` and `pg_proc` for the new `claim_surf_alert_slot` signature.
2. Set Vercel env: `DAILY_CALL_ENABLED=true`, `DAILY_CALL_USER_ALLOWLIST=73040cff-afe9-4fa0-a874-2016203fc015,610a5745-1fac-429c-8f5a-8d085783a5ea,bcacdc51-b01b-4702-ac0b-fb492c0a926a,bb33a36a-466f-44d1-8ea3-9983e66efd3d`. Leave `SWELL_ALERT_ENABLED` unset.
3. Retire the 144 stale device rows on `610a5745…` before the flag week.
4. **Create the 14-day reminder for Steven** to set `DAILY_CALL_ENABLED` for everyone (clear the allowlist) and remove `ALERTS_DELIVERY_USER_ALLOWLIST`. Required; see memory `daily-call-rollout-reminder`.
5. Native: OTA the N1/N2 build; verify with `eas channel:view`.
6. Two weeks later: swell alert behind `SWELL_ALERT_ENABLED` with the same allowlist.
