# Surf Zone Intelligence — Phase A (Tier-1 Numeric Spine) — Codex Implementation Plan

> **Spec:** `docs/archive/superpowers/specs/2026-06-20-surf-zone-intelligence-design.md`. Read it first.
> **Executor:** Codex, cold. Every path/column/helper below is verified against the repo at HEAD.
> **Run from:** repo root `quiver/`. **No commits, no push.** Work off committed `main` — the working tree is dirty with an unrelated native-scoring refactor; do not stage or sweep it in.

## What Phase A delivers
The Tier-1 **numeric spine** of the scorecard: per-beach, per-dimension forecast accuracy (wave height vs user sessions; wind vs **observed** obs) + Tier-1 condition flags (tide window, closeout threshold), **demand-ranked (mock-excluded)**, behind an admin-gated, flag-gated internal page. **No AI** (Phase B), **no Tier-2 rip/drift** (Phase C), **no production forecast/suggestion change.**

---

## Sub-agent execution model (REQUIRED)

Implement in this order. The dependency graph is designed so 4 workstreams run in parallel without colliding:

```
Task 0  (foundation: shared types + flag)         ── one agent, BLOCKING. Defines the contract.
   ├─ Task 1  demand-rank        ┐
   ├─ Task 2  observed-wind      │  ── FOUR agents IN PARALLEL. Each imports only from
   ├─ Task 3  accuracy-deltas    │     lib/zone-intel/types.ts (Task 0). They never import
   └─ Task 4  condition-flags    ┘     each other. T3 codes against the ObservedWindFetcher
                                       TYPE, not T2's implementation (dependency injection).
Task 5  (integration: scorecard + API + admin page) ── one agent, AFTER 1–4 all land.
Task 6  (verify: typecheck/lint/tests/acceptance)   ── one agent, last.
```

**Contract rule for the parallel agents:** the interfaces in `lib/zone-intel/types.ts` (Task 0) are the single source of truth. Do **not** redefine or widen them in a workstream. If a workstream needs a new shared type, it goes in `types.ts` and is the integrator's problem to reconcile — flag it, don't fork it.

---

## Verified anchors

| Thing | Location | Note |
|---|---|---|
| Predicted-vs-reported pairs | `session_forecast_snapshots` | `forecast_snapshot` (full forecast JSON: `wave_height` **string**, `wind_speed_mph` number, `wind_direction_deg` number, `forecast_at`), `actual_conditions` (`wave_height_ft` number, etc.), `forecast_vs_actual` (precomputed diffs — wind here is vs USER, ignore it), `user_id`, `beach_id`, `session_date` |
| Snapshot field shapes | `lib/utils/forecast-snapshot-utils.ts:31-71` | exact `EnhancedForecast` + `actual_conditions` keys |
| Stats helpers (REUSE) | `lib/services/preference-learning-service.ts` | `percentile(arr,p)`, `findModes(arr,0.2)`, `calculateConfidence(n)` (`1/(1+e^(-0.2(n-5)))`), `normalizeTideStatus` |
| Service-role client | `createSupabaseServiceRoleClient` from `@/lib/supabase/server` | sync factory (`createSupabaseServiceRoleClient()`); used across `lib/services` |
| Admin API wrapper (gates + service-role) | `withAdminAuth(async (req,{user,supabase})=>…)` from `@/lib/middleware/api-wrappers` | example: `app/api/admin/broadcast-push/route.ts` |
| Admin page section (+ gating layout) | `app/admin/` (`layout.tsx`, sibling pages `intel/`, `forecasts/`) | scorecard page mirrors siblings; layout enforces admin |
| Demand inputs | `user_events` (`event_type`,`beach_id`,`user_id`,`created_at`, 90-day expiry), `favorite_beaches` (`beach_id` nullable, `user_id`), `profiles.home_beach_id`, `sessions` | `get_popular_beaches` exists but does **NOT** exclude mock — build fresh |
| Real-user exclusion | `profiles.is_mock`, `analytics_is_real_user`, `is_system_account` | fail **closed** on unknown |
| Beach geometry | `beaches`: `lat`,`lon`,`swell_window_{min,center,max}_deg`,`preferred_tide_ft_{min,max}`,`preferred_tide_direction` | for closeout/tide |
| sessions columns | `wave_height_ft`,`wave_quality`,`rating`,`tide_height_ft`,`tide_status`,`wave_characteristics`(string[]),`status`,`deleted_at`,`beach_id`,`user_id` | `status='completed'`, `deleted_at IS NULL` |
| Unit-test supabase mock | `__tests__/services/preference-learning-service.test.ts` | chainable builder + `.then` |
| API route test | `__tests__/api/cam-resolve.test.ts` | `@jest-environment node`, mock the wrapper to pass-through |
| Test runner | `yarn test:unit <path>` (Jest) / `yarn typecheck` (Node 22) / `NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 <files>` | per `quiver/CLAUDE.md` |

**Observed wind (the one new dependency):** Open-Meteo Archive — `GET https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&timezone=UTC`. Returns `{ hourly: { time: string[], wind_speed_10m: number[], wind_direction_10m: number[] } }` with `time` like `"2026-06-01T14:00"`. Archive lags ~5 days, so very recent sessions may return null — that is acceptable (they're excluded as no-truth).

---

## Task 0 — Foundation: shared types + flag (BLOCKING, do first)

**Files:** Create `lib/zone-intel/types.ts`, `lib/zone-intel/ARCHITECTURE.md`, `lib/flags/zone-intel.ts`. Test: `__tests__/lib/zone-intel/types.test.ts`.

- [ ] **Step 1: types**

`lib/zone-intel/types.ts`:
```ts
export type ConfidenceTier = "ready" | "learning" | "withheld";

export const N_READY = 5;
export const N_LEARNING = 3;

export function tierForN(n: number): ConfidenceTier {
  if (n >= N_READY) return "ready";
  if (n >= N_LEARNING) return "learning";
  return "withheld";
}

export type AccuracyDimension =
  | "wave_height_ft"
  | "wind_speed_mph"
  | "wind_direction_deg";

export interface DimensionAccuracy {
  dimension: AccuracyDimension;
  /** signed mean delta, forecast - truth (positive = we over-forecast). null when withheld. */
  bias: number | null;
  mae: number | null;
  n: number;
  confidence: number;
  tier: ConfidenceTier;
}

export interface DemandRank {
  beachId: string;
  score: number;
  rank: number; // 1 = highest demand
  components: { homeBeach: number; favorites: number; recentViewers: number; sessionUsers: number };
}

export interface ObservedWind {
  windSpeedMph: number | null;
  windDirectionDeg: number | null;
  source: string;
}

/** T2 implements this; T3 depends only on this type (dependency injection). */
export type ObservedWindFetcher = (
  lat: number,
  lon: number,
  isoHourUtc: string,
) => Promise<ObservedWind | null>;

export interface TideFlag {
  preferredTideBandFt: { min: number; max: number } | null;
  preferredStatuses: string[] | null;
  n: number;
  tier: ConfidenceTier;
}

export interface CloseoutFlag {
  /** wave height (ft) at/above which sessions report closeout/walled or quality collapses */
  closeoutThresholdFt: number | null;
  risk: "low" | "elevated" | "high" | null;
  rationale: string;
  n: number;
  tier: ConfidenceTier;
}

export interface ConditionFlags {
  tide: TideFlag;
  closeout: CloseoutFlag;
}

export interface BeachScorecardRow {
  beachId: string;
  beachName: string;
  demand: DemandRank;
  accuracy: DimensionAccuracy[];
  flags: ConditionFlags;
  /** demand-weighted "fix-list" ordering: high demand x (high error OR low n) floats up */
  priorityScore: number;
}

export interface ZoneIntelScorecard {
  generatedForIso: string; // stamped by the caller/route, not pure code
  rows: BeachScorecardRow[];
}

/** Minimal beach shape the spine needs. */
export interface ZoneIntelBeach {
  id: string;
  name: string;
  lat: number;
  lon: number;
  swell_window_min_deg: number | null;
  swell_window_center_deg: number | null;
  swell_window_max_deg: number | null;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
}
```

- [ ] **Step 2: flag** (server-only, default OFF)

`lib/flags/zone-intel.ts`:
```ts
import "server-only";

/** Surf Zone Intel (internal/admin). Default OFF. Set SURF_ZONE_INTEL_ENABLED=true.
 * Server-only: the surface is admin-gated, never a public client. */
export function isSurfZoneIntelEnabled(): boolean {
  return process.env.SURF_ZONE_INTEL_ENABLED === "true";
}
```

- [ ] **Step 3: dir note**

`lib/zone-intel/ARCHITECTURE.md`:
```md
# zone-intel — Surf Zone Intelligence, Phase A (Tier-1 numeric spine)

Per-beach, per-dimension forecast accuracy (wave vs user sessions; wind vs observed obs)
+ tide/closeout flags, demand-ranked (mock-excluded), surfaced on an admin-gated page.
No AI (Phase B), no rip/drift (Phase C). Reuses preference-learning-service stats helpers
and session_forecast_snapshots. See docs/plans/2026-06-20-surf-zone-intel-phaseA.md.
```

- [ ] **Step 4: test the tier ladder**

`__tests__/lib/zone-intel/types.test.ts`:
```ts
import { tierForN } from "@/lib/zone-intel/types";

describe("tierForN", () => {
  it("withheld below 3, learning 3-4, ready 5+", () => {
    expect(tierForN(0)).toBe("withheld");
    expect(tierForN(2)).toBe("withheld");
    expect(tierForN(3)).toBe("learning");
    expect(tierForN(4)).toBe("learning");
    expect(tierForN(5)).toBe("ready");
    expect(tierForN(20)).toBe("ready");
  });
});
```

- [ ] **Step 5: run + commit**

Run: `yarn test:unit __tests__/lib/zone-intel/types.test.ts` → PASS.
```bash
git add lib/zone-intel/types.ts lib/zone-intel/ARCHITECTURE.md lib/flags/zone-intel.ts __tests__/lib/zone-intel/types.test.ts
git commit -m "feat(zone-intel): phase A foundation — shared types and flag"
```

---

## Task 1 — Demand rank (parallel) — `lib/zone-intel/demand-rank.ts`

Mock-excluded per-beach demand. Reuse nothing from `get_popular_beaches` (it counts mock profiles). Service-role queries, aggregate in TS.

**Files:** Create `lib/zone-intel/demand-rank.ts`. Test: `__tests__/lib/zone-intel/demand-rank.test.ts`.

- [ ] **Step 1: test first**

`__tests__/lib/zone-intel/demand-rank.test.ts`:
```ts
import { computeDemandRanks } from "@/lib/zone-intel/demand-rank";

// chainable supabase mock: each .from(table) returns a builder resolving that table's rows
function makeSupabase(tables: Record<string, any[]>) {
  const builder = (rows: any[]) => {
    const b: any = {
      select: jest.fn(() => b),
      eq: jest.fn(() => b),
      gte: jest.fn(() => b),
      in: jest.fn(() => b),
      not: jest.fn(() => b),
      is: jest.fn(() => b),
      then: jest.fn((res: any) => { const r = { data: rows, error: null }; res(r); return Promise.resolve(r); }),
    };
    return b;
  };
  return { from: jest.fn((t: string) => builder(tables[t] ?? [])) };
}

describe("computeDemandRanks", () => {
  it("ranks beaches by mock-excluded home/favorite/view/session signal", async () => {
    const supabase = makeSupabase({
      profiles: [{ id: "u1", home_beach_id: "A", is_mock: false, analytics_is_real_user: true, is_system_account: false },
                 { id: "u2", home_beach_id: "A", is_mock: false, analytics_is_real_user: true, is_system_account: false },
                 { id: "u3", home_beach_id: "B", is_mock: true,  analytics_is_real_user: false, is_system_account: false }],
      favorite_beaches: [{ beach_id: "A", user_id: "u1" }, { beach_id: "B", user_id: "u2" }],
      user_events: [{ beach_id: "A", user_id: "u1" }, { beach_id: "A", user_id: "u2" }],
      sessions: [{ beach_id: "A", user_id: "u1" }],
    });
    const ranks = await computeDemandRanks(supabase as any, { now: new Date("2026-06-20T00:00:00Z") });
    expect(ranks[0].beachId).toBe("A");
    expect(ranks[0].rank).toBe(1);
    expect(ranks.find((r) => r.beachId === "B")?.components.homeBeach ?? 0).toBe(0); // u3 is mock → excluded
  });
});
```

- [ ] **Step 2: run → fail (module missing).**

- [ ] **Step 3: implement**

`lib/zone-intel/demand-rank.ts`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type { DemandRank } from "./types";

const RECENT_VIEW_DAYS = 90;
const W = { homeBeach: 3, favorites: 2, recentViewers: 1, sessionUsers: 1 };

interface ProfileRow {
  id: string;
  home_beach_id: string | null;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
}

function isReal(p: ProfileRow | undefined): boolean {
  if (!p) return false; // fail closed
  if (p.is_mock === true) return false;
  if (p.analytics_is_real_user === false) return false;
  if (p.is_system_account === true) return false;
  return true;
}

interface Options { now?: Date; client?: SupabaseClient<Database> }

export async function computeDemandRanks(
  client: SupabaseClient<Database>,
  options: Options = {},
): Promise<DemandRank[]> {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - RECENT_VIEW_DAYS * 86400000).toISOString();

  const [{ data: profiles }, { data: favorites }, { data: events }, { data: sessions }] =
    await Promise.all([
      client.from("profiles").select("id,home_beach_id,is_mock,analytics_is_real_user,is_system_account"),
      client.from("favorite_beaches").select("beach_id,user_id").not("beach_id", "is", null),
      client.from("user_events").select("beach_id,user_id").in("event_type", ["beach_view", "forecast_check"]).gte("created_at", since),
      client.from("sessions").select("beach_id,user_id").eq("status", "completed").is("deleted_at", null),
    ]);

  const realById = new Map<string, ProfileRow>();
  for (const p of (profiles ?? []) as ProfileRow[]) if (isReal(p)) realById.set(p.id, p);
  const real = (uid: string | null | undefined): boolean => !!uid && realById.has(uid);

  type Acc = { homeBeach: number; favorites: Set<string>; recentViewers: Set<string>; sessionUsers: Set<string> };
  const acc = new Map<string, Acc>();
  const get = (b: string): Acc => {
    let a = acc.get(b);
    if (!a) { a = { homeBeach: 0, favorites: new Set(), recentViewers: new Set(), sessionUsers: new Set() }; acc.set(b, a); }
    return a;
  };

  for (const p of realById.values()) if (p.home_beach_id) get(p.home_beach_id).homeBeach += 1;
  for (const f of (favorites ?? []) as { beach_id: string; user_id: string }[]) if (f.beach_id && real(f.user_id)) get(f.beach_id).favorites.add(f.user_id);
  for (const e of (events ?? []) as { beach_id: string | null; user_id: string }[]) if (e.beach_id && real(e.user_id)) get(e.beach_id).recentViewers.add(e.user_id);
  for (const s of (sessions ?? []) as { beach_id: string; user_id: string }[]) if (s.beach_id && real(s.user_id)) get(s.beach_id).sessionUsers.add(s.user_id);

  const ranks: DemandRank[] = Array.from(acc.entries()).map(([beachId, a]) => {
    const components = { homeBeach: a.homeBeach, favorites: a.favorites.size, recentViewers: a.recentViewers.size, sessionUsers: a.sessionUsers.size };
    const score = components.homeBeach * W.homeBeach + components.favorites * W.favorites + components.recentViewers * W.recentViewers + components.sessionUsers * W.sessionUsers;
    return { beachId, score, rank: 0, components };
  });

  ranks.sort((x, y) => y.score - x.score);
  ranks.forEach((r, i) => { r.rank = i + 1; });
  return ranks;
}
```

- [ ] **Step 4: run → PASS. Commit**
```bash
git add lib/zone-intel/demand-rank.ts __tests__/lib/zone-intel/demand-rank.test.ts
git commit -m "feat(zone-intel): mock-excluded per-beach demand rank"
```

---

## Task 2 — Observed wind (parallel) — `lib/zone-intel/observed-wind.ts`

Implements `ObservedWindFetcher` against Open-Meteo Archive, with per-(lat,lon,date) caching.

**Files:** Create `lib/zone-intel/observed-wind.ts`. Test: `__tests__/lib/zone-intel/observed-wind.test.ts`.

- [ ] **Step 1: test first**

`__tests__/lib/zone-intel/observed-wind.test.ts`:
```ts
import { createOpenMeteoObservedWind } from "@/lib/zone-intel/observed-wind";

describe("createOpenMeteoObservedWind", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns observed wind for the matching UTC hour and caches by lat/lon/date", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ hourly: { time: ["2026-06-01T13:00", "2026-06-01T14:00"], wind_speed_10m: [5, 11], wind_direction_10m: [200, 270] } }),
    }));
    (global as any).fetch = fetchMock;
    const fetcher = createOpenMeteoObservedWind();

    const a = await fetcher(32.85, -117.25, "2026-06-01T14:00:00Z");
    expect(a).toEqual({ windSpeedMph: 11, windDirectionDeg: 270, source: "open-meteo-archive" });

    const b = await fetcher(32.85, -117.25, "2026-06-01T13:00:00Z");
    expect(b?.windSpeedMph).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1); // same day → cached
  });

  it("returns null on fetch error", async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const fetcher = createOpenMeteoObservedWind();
    expect(await fetcher(0, 0, "2026-06-01T14:00:00Z")).toBeNull();
  });
});
```

- [ ] **Step 2: run → fail.**

- [ ] **Step 3: implement**

`lib/zone-intel/observed-wind.ts`:
```ts
import "server-only";
import type { ObservedWind, ObservedWindFetcher } from "./types";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const SOURCE = "open-meteo-archive";

interface HourlyArchive { time: string[]; wind_speed_10m: number[]; wind_direction_10m: number[] }

function dayKey(lat: number, lon: number, date: string): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)},${date}`;
}

/** "2026-06-01T14:00:00Z" -> "2026-06-01" and "2026-06-01T14:00" (archive's time format). */
function isoParts(isoHourUtc: string): { date: string; hourKey: string } | null {
  const d = new Date(isoHourUtc);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toISOString().slice(0, 10);
  const hourKey = `${date}T${String(d.getUTCHours()).padStart(2, "0")}:00`;
  return { date, hourKey };
}

export function createOpenMeteoObservedWind(): ObservedWindFetcher {
  const cache = new Map<string, HourlyArchive | null>();

  return async (lat, lon, isoHourUtc) => {
    const parts = isoParts(isoHourUtc);
    if (!parts) return null;
    const key = dayKey(lat, lon, parts.date);

    let hourly = cache.get(key);
    if (hourly === undefined) {
      try {
        const url = `${ARCHIVE_URL}?latitude=${lat}&longitude=${lon}&start_date=${parts.date}&end_date=${parts.date}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&timezone=UTC`;
        const res = await fetch(url);
        hourly = res.ok ? ((await res.json()).hourly ?? null) : null;
      } catch {
        hourly = null;
      }
      cache.set(key, hourly);
    }
    if (!hourly) return null;

    const idx = hourly.time.indexOf(parts.hourKey);
    if (idx < 0) return null;
    const speed = hourly.wind_speed_10m?.[idx];
    const dir = hourly.wind_direction_10m?.[idx];
    const observed: ObservedWind = {
      windSpeedMph: Number.isFinite(speed) ? speed : null,
      windDirectionDeg: Number.isFinite(dir) ? dir : null,
      source: SOURCE,
    };
    return observed;
  };
}
```

- [ ] **Step 4: run → PASS. Commit**
```bash
git add lib/zone-intel/observed-wind.ts __tests__/lib/zone-intel/observed-wind.test.ts
git commit -m "feat(zone-intel): observed wind via Open-Meteo archive (ObservedWindFetcher)"
```

---

## Task 3 — Accuracy deltas (parallel) — `lib/zone-intel/accuracy-deltas.ts`

Per-beach per-dimension accuracy from `session_forecast_snapshots`. Wave = forecast vs **user-reported** (trusted). Wind = forecast vs **observed** (injected `ObservedWindFetcher` — NOT `actual_conditions` wind).

**Files:** Create `lib/zone-intel/accuracy-deltas.ts`. Test: `__tests__/lib/zone-intel/accuracy-deltas.test.ts`.

- [ ] **Step 1: test first**

`__tests__/lib/zone-intel/accuracy-deltas.test.ts`:
```ts
import { computeBeachAccuracy } from "@/lib/zone-intel/accuracy-deltas";
import type { ObservedWindFetcher, ZoneIntelBeach } from "@/lib/zone-intel/types";

const beach: ZoneIntelBeach = {
  id: "A", name: "Test", lat: 32.85, lon: -117.25,
  swell_window_min_deg: 240, swell_window_center_deg: 270, swell_window_max_deg: 300,
  preferred_tide_ft_min: 1, preferred_tide_ft_max: 4,
};

// 6 snapshots: forecast wave 3ft, reported 4.2ft (we run ~1.2 low); forecast wind 8mph WNW.
const snap = (over: any = {}) => ({
  user_id: "u1",
  forecast_snapshot: { wave_height: "3 ft", wind_speed_mph: 8, wind_direction_deg: 292, forecast_at: "2026-06-01T14:00:00Z" },
  actual_conditions: { wave_height_ft: 4.2, wind_speed_mph: 99, wind_direction: "calm" }, // user wind is junk — must be ignored
  profiles: { is_mock: false, analytics_is_real_user: true, is_system_account: false, email: "a@b.com" },
  ...over,
});

function supabaseWith(rows: any[]) {
  const b: any = { select: jest.fn(() => b), eq: jest.fn(() => b), is: jest.fn(() => b),
    then: jest.fn((r: any) => { const x = { data: rows, error: null }; r(x); return Promise.resolve(x); }) };
  return { from: jest.fn(() => b) };
}

const observed: ObservedWindFetcher = async () => ({ windSpeedMph: 12, windDirectionDeg: 270, source: "test" });

describe("computeBeachAccuracy", () => {
  it("computes wave bias from user reports and wind bias from observed (not user) wind", async () => {
    const rows = Array.from({ length: 6 }, () => snap());
    const acc = await computeBeachAccuracy(supabaseWith(rows) as any, beach, observed);

    const wave = acc.find((a) => a.dimension === "wave_height_ft")!;
    expect(wave.n).toBe(6);
    expect(wave.tier).toBe("ready");
    expect(wave.bias).toBeCloseTo(3 - 4.2, 5); // forecast - truth = -1.2 (we run low)

    const windSpd = acc.find((a) => a.dimension === "wind_speed_mph")!;
    expect(windSpd.bias).toBeCloseTo(8 - 12, 5); // forecast 8 vs OBSERVED 12, not user 99
  });

  it("withholds dimensions below the n floor", async () => {
    const acc = await computeBeachAccuracy(supabaseWith([snap(), snap()]) as any, beach, observed);
    expect(acc.find((a) => a.dimension === "wave_height_ft")!.tier).toBe("withheld");
    expect(acc.find((a) => a.dimension === "wave_height_ft")!.bias).toBeNull();
  });

  it("excludes mock/system profiles", async () => {
    const rows = [snap({ profiles: { is_mock: true } }), snap({ profiles: { is_system_account: true } })];
    const acc = await computeBeachAccuracy(supabaseWith(rows) as any, beach, observed);
    expect(acc.every((a) => a.n === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: run → fail.**

- [ ] **Step 3: implement**

`lib/zone-intel/accuracy-deltas.ts`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { calculateConfidence } from "@/lib/services/preference-learning-service";
import {
  tierForN,
  type AccuracyDimension,
  type DimensionAccuracy,
  type ObservedWindFetcher,
  type ZoneIntelBeach,
} from "./types";

interface SnapshotRow {
  user_id: string | null;
  forecast_snapshot: any;
  actual_conditions: any;
  profiles: { is_mock: boolean | null; analytics_is_real_user: boolean | null; is_system_account: boolean | null; email: string | null } | null;
}

function isReal(p: SnapshotRow["profiles"]): boolean {
  if (!p) return false; // fail closed
  if (p.is_mock === true || p.analytics_is_real_user === false || p.is_system_account === true) return false;
  const e = p.email?.toLowerCase();
  if (e && (e.includes("test") || e.endsWith("@local.test") || e.endsWith("@example.invalid"))) return false;
  return true;
}

function angularDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

function summarize(dimension: AccuracyDimension, signed: number[], absVals: number[]): DimensionAccuracy {
  const n = signed.length;
  const tier = tierForN(n);
  if (tier === "withheld") {
    return { dimension, bias: null, mae: null, n, confidence: calculateConfidence(n), tier };
  }
  const bias = signed.reduce((s, v) => s + v, 0) / n;
  const mae = absVals.reduce((s, v) => s + v, 0) / n;
  return {
    dimension,
    bias: Math.round(bias * 100) / 100,
    mae: Math.round(mae * 100) / 100,
    n,
    confidence: calculateConfidence(n),
    tier,
  };
}

export async function computeBeachAccuracy(
  client: SupabaseClient<Database>,
  beach: ZoneIntelBeach,
  observedWind: ObservedWindFetcher,
): Promise<DimensionAccuracy[]> {
  const { data, error } = await client
    .from("session_forecast_snapshots")
    .select("user_id, forecast_snapshot, actual_conditions, profiles!session_forecast_snapshots_user_id_fkey ( is_mock, analytics_is_real_user, is_system_account, email )")
    .eq("beach_id", beach.id);

  if (error) throw new Error(`computeBeachAccuracy(${beach.id}): ${error.message}`);

  const rows = ((data ?? []) as unknown as SnapshotRow[]).filter((r) => isReal(r.profiles));

  const waveSigned: number[] = [], waveAbs: number[] = [];
  const spdSigned: number[] = [], spdAbs: number[] = [];
  const dirSigned: number[] = [], dirAbs: number[] = [];

  for (const r of rows) {
    const fc = r.forecast_snapshot ?? {};
    const actual = r.actual_conditions ?? {};

    // Wave height: forecast (string) vs USER-reported (trusted).
    const fcWave = parseFloat(String(fc.wave_height ?? ""));
    const acWave = typeof actual.wave_height_ft === "number" ? actual.wave_height_ft : NaN;
    if (Number.isFinite(fcWave) && Number.isFinite(acWave)) {
      waveSigned.push(fcWave - acWave);
      waveAbs.push(Math.abs(fcWave - acWave));
    }

    // Wind: forecast vs OBSERVED (never actual_conditions wind).
    const fcSpd = typeof fc.wind_speed_mph === "number" ? fc.wind_speed_mph : NaN;
    const fcDir = typeof fc.wind_direction_deg === "number" ? fc.wind_direction_deg : NaN;
    const when = fc.forecast_at;
    if (when && (Number.isFinite(fcSpd) || Number.isFinite(fcDir))) {
      const obs = await observedWind(beach.lat, beach.lon, when);
      if (obs) {
        if (Number.isFinite(fcSpd) && obs.windSpeedMph != null) {
          spdSigned.push(fcSpd - obs.windSpeedMph);
          spdAbs.push(Math.abs(fcSpd - obs.windSpeedMph));
        }
        if (Number.isFinite(fcDir) && obs.windDirectionDeg != null) {
          const d = angularDelta(fcDir, obs.windDirectionDeg);
          dirSigned.push(d); // direction error is unsigned magnitude
          dirAbs.push(d);
        }
      }
    }
  }

  return [
    summarize("wave_height_ft", waveSigned, waveAbs),
    summarize("wind_speed_mph", spdSigned, spdAbs),
    summarize("wind_direction_deg", dirSigned, dirAbs),
  ];
}
```
> If the FK alias `session_forecast_snapshots_user_id_fkey` does not resolve at typecheck, read the actual constraint name from `types/database.generated.ts` (search `session_forecast_snapshots` → `foreignKeyName`) and substitute it. The join must filter on the snapshot's `user_id` → `profiles`.

- [ ] **Step 4: run → PASS. Commit**
```bash
git add lib/zone-intel/accuracy-deltas.ts __tests__/lib/zone-intel/accuracy-deltas.test.ts
git commit -m "feat(zone-intel): per-dimension accuracy (wave vs sessions, wind vs observed)"
```

---

## Task 4 — Condition flags (parallel) — `lib/zone-intel/condition-flags.ts`

Tier-1 flags from real-user completed sessions: tide window + closeout threshold. Reuse `percentile`, `findModes`, `normalizeTideStatus`.

**Files:** Create `lib/zone-intel/condition-flags.ts`. Test: `__tests__/lib/zone-intel/condition-flags.test.ts`.

- [ ] **Step 1: test first**

`__tests__/lib/zone-intel/condition-flags.test.ts`:
```ts
import { computeConditionFlags } from "@/lib/zone-intel/condition-flags";
import type { ZoneIntelBeach } from "@/lib/zone-intel/types";

const beach: ZoneIntelBeach = {
  id: "A", name: "Test", lat: 0, lon: 0,
  swell_window_min_deg: 240, swell_window_center_deg: 270, swell_window_max_deg: 300,
  preferred_tide_ft_min: 1, preferred_tide_ft_max: 4,
};

const sess = (over: any = {}) => ({
  rating: 4, wave_quality: 4, wave_height_ft: 3, tide_height_ft: 2, tide_status: "Rising",
  wave_characteristics: ["clean"],
  profiles: { is_mock: false, analytics_is_real_user: true, is_system_account: false, email: "a@b.com" },
  ...over,
});

function supabaseWith(rows: any[]) {
  const b: any = { select: jest.fn(() => b), eq: jest.fn(() => b), is: jest.fn(() => b),
    then: jest.fn((r: any) => { const x = { data: rows, error: null }; r(x); return Promise.resolve(x); }) };
  return { from: jest.fn(() => b) };
}

describe("computeConditionFlags", () => {
  it("derives a tide band from good sessions and a closeout threshold from walled/closeout reports", async () => {
    const good = Array.from({ length: 6 }, (_, i) => sess({ tide_height_ft: 1.5 + i * 0.3 }));
    const bigCloseouts = Array.from({ length: 5 }, () => sess({ wave_height_ft: 6, wave_quality: 2, wave_characteristics: ["walled", "closeout"] }));
    const flags = await computeConditionFlags(supabaseWith([...good, ...bigCloseouts]) as any, beach);
    expect(flags.tide.tier).toBe("ready");
    expect(flags.tide.preferredTideBandFt).not.toBeNull();
    expect(flags.closeout.closeoutThresholdFt).not.toBeNull();
    expect(flags.closeout.closeoutThresholdFt!).toBeGreaterThanOrEqual(5);
    expect(["elevated", "high"]).toContain(flags.closeout.risk);
  });

  it("withholds when sparse", async () => {
    const flags = await computeConditionFlags(supabaseWith([sess(), sess()]) as any, beach);
    expect(flags.tide.tier).toBe("withheld");
    expect(flags.closeout.closeoutThresholdFt).toBeNull();
  });
});
```

- [ ] **Step 2: run → fail.**

- [ ] **Step 3: implement**

`lib/zone-intel/condition-flags.ts`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { percentile, findModes, normalizeTideStatus } from "@/lib/services/preference-learning-service";
import { tierForN, type CloseoutFlag, type ConditionFlags, type TideFlag, type ZoneIntelBeach } from "./types";

const ENJOYED_RATING_MIN = 3;
const POSITIVE_WAVE_QUALITY_MIN = 4;
const CLOSEOUT_LABELS = ["walled", "closeout", "closed out", "close out", "top to bottom", "dumpy"];

interface SessionRow {
  rating: number | null;
  wave_quality: number | null;
  wave_height_ft: number | null;
  tide_height_ft: number | null;
  tide_status: string | null;
  wave_characteristics: string[] | null;
  profiles: { is_mock: boolean | null; analytics_is_real_user: boolean | null; is_system_account: boolean | null; email: string | null } | null;
}

function isReal(p: SessionRow["profiles"]): boolean {
  if (!p) return false;
  if (p.is_mock === true || p.analytics_is_real_user === false || p.is_system_account === true) return false;
  const e = p.email?.toLowerCase();
  if (e && (e.includes("test") || e.endsWith("@local.test") || e.endsWith("@example.invalid"))) return false;
  return true;
}

function isCloseoutSession(r: SessionRow): boolean {
  const chars = (r.wave_characteristics ?? []).map((c) => c.toLowerCase());
  if (chars.some((c) => CLOSEOUT_LABELS.some((l) => c.includes(l)))) return true;
  return false;
}

export async function computeConditionFlags(
  client: SupabaseClient<Database>,
  beach: ZoneIntelBeach,
): Promise<ConditionFlags> {
  const { data, error } = await client
    .from("sessions")
    .select("rating, wave_quality, wave_height_ft, tide_height_ft, tide_status, wave_characteristics, profiles!sessions_user_id_profiles_fkey ( is_mock, analytics_is_real_user, is_system_account, email )")
    .eq("beach_id", beach.id)
    .eq("status", "completed")
    .is("deleted_at", null);

  if (error) throw new Error(`computeConditionFlags(${beach.id}): ${error.message}`);
  const rows = ((data ?? []) as unknown as SessionRow[]).filter((r) => isReal(r.profiles));

  // Tide window from enjoyed sessions.
  const goodGeneral = rows.filter((r) => (r.rating ?? 0) >= ENJOYED_RATING_MIN);
  const tideHeights = goodGeneral.map((r) => r.tide_height_ft).filter((v): v is number => v != null);
  const tideStatuses = goodGeneral.map((r) => (r.tide_status ? normalizeTideStatus(r.tide_status) : null)).filter((v): v is string => !!v);
  const tideTier = tierForN(tideHeights.length);
  const tide: TideFlag = {
    preferredTideBandFt: tideTier === "withheld" ? null : { min: percentile(tideHeights, 10), max: percentile(tideHeights, 90) },
    preferredStatuses: tideStatuses.length >= 5 ? findModes(tideStatuses, 0.2) : null,
    n: tideHeights.length,
    tier: tideTier,
  };

  // Closeout threshold: smallest wave height among sessions flagged closeout (or low-quality big days).
  const closeoutSessions = rows.filter((r) => isCloseoutSession(r) || ((r.wave_quality ?? 5) <= 2 && (r.wave_height_ft ?? 0) >= 4));
  const closeoutHeights = closeoutSessions.map((r) => r.wave_height_ft).filter((v): v is number => v != null);
  const coTier = tierForN(closeoutHeights.length);
  const goodWaveHeights = rows.filter((r) => (r.wave_quality ?? 0) >= POSITIVE_WAVE_QUALITY_MIN).map((r) => r.wave_height_ft).filter((v): v is number => v != null);
  let closeoutThresholdFt: number | null = null;
  let risk: CloseoutFlag["risk"] = null;
  let rationale = "Not enough closeout-tagged sessions yet.";
  if (coTier !== "withheld") {
    closeoutThresholdFt = Math.round(percentile(closeoutHeights, 25) * 10) / 10; // lower-quartile height where it starts closing out
    const goodMedian = goodWaveHeights.length ? percentile(goodWaveHeights, 50) : null;
    risk = goodMedian != null && closeoutThresholdFt - goodMedian <= 1 ? "high" : "elevated";
    rationale = `Sessions report closeout/walled at ~${closeoutThresholdFt}ft+ (${closeoutHeights.length} reports).`;
  }
  const closeout: CloseoutFlag = { closeoutThresholdFt, risk, rationale, n: closeoutHeights.length, tier: coTier };

  return { tide, closeout };
}
```
> Confirm the FK alias `sessions_user_id_profiles_fkey` (it is the one used in `actions/admin/sessions.ts`). If typecheck rejects it, substitute the real constraint name from `types/database.generated.ts`.

- [ ] **Step 4: run → PASS. Commit**
```bash
git add lib/zone-intel/condition-flags.ts __tests__/lib/zone-intel/condition-flags.test.ts
git commit -m "feat(zone-intel): tier-1 tide + closeout condition flags from sessions"
```

---

## Task 5 — Integration: scorecard + API + admin page (after 1–4)

**Files:** Create `lib/zone-intel/build-scorecard.ts`, `app/api/admin/zone-intel/route.ts`, `app/admin/zone-intel/page.tsx`. Test: `__tests__/lib/zone-intel/build-scorecard.test.ts`, `__tests__/api/admin-zone-intel.test.ts`.

- [ ] **Step 1: scorecard assembly test first**

`__tests__/lib/zone-intel/build-scorecard.test.ts`:
```ts
import { assembleScorecard } from "@/lib/zone-intel/build-scorecard";
import type { BeachScorecardRow, DemandRank, DimensionAccuracy, ConditionFlags } from "@/lib/zone-intel/types";

describe("assembleScorecard", () => {
  it("orders rows by priority (high demand x error/low-n first) and stamps the iso", () => {
    const demand: DemandRank[] = [
      { beachId: "A", score: 30, rank: 1, components: { homeBeach: 5, favorites: 5, recentViewers: 5, sessionUsers: 5 } },
      { beachId: "B", score: 5, rank: 2, components: { homeBeach: 1, favorites: 0, recentViewers: 1, sessionUsers: 0 } },
    ];
    const acc = (n: number, bias: number): DimensionAccuracy[] => [
      { dimension: "wave_height_ft", bias, mae: Math.abs(bias), n, confidence: 0.5, tier: "ready" },
      { dimension: "wind_speed_mph", bias: 0, mae: 0, n, confidence: 0.5, tier: "ready" },
      { dimension: "wind_direction_deg", bias: 0, mae: 0, n, confidence: 0.5, tier: "ready" },
    ];
    const flags: ConditionFlags = { tide: { preferredTideBandFt: null, preferredStatuses: null, n: 0, tier: "withheld" }, closeout: { closeoutThresholdFt: null, risk: null, rationale: "", n: 0, tier: "withheld" } };
    const rows: BeachScorecardRow[] = [
      { beachId: "A", beachName: "A", demand: demand[0], accuracy: acc(8, -2.5), flags, priorityScore: 0 },
      { beachId: "B", beachName: "B", demand: demand[1], accuracy: acc(8, -2.5), flags, priorityScore: 0 },
    ];
    const card = assembleScorecard(rows, "2026-06-20T00:00:00Z");
    expect(card.generatedForIso).toBe("2026-06-20T00:00:00Z");
    expect(card.rows[0].beachId).toBe("A"); // higher demand, same error → higher priority
    expect(card.rows[0].priorityScore).toBeGreaterThan(card.rows[1].priorityScore);
  });
});
```

- [ ] **Step 2: implement scorecard + the orchestrator that wires Tasks 1/3/4**

`lib/zone-intel/build-scorecard.ts`:
```ts
import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { computeDemandRanks } from "./demand-rank";
import { computeBeachAccuracy } from "./accuracy-deltas";
import { computeConditionFlags } from "./condition-flags";
import { createOpenMeteoObservedWind } from "./observed-wind";
import type { BeachScorecardRow, ZoneIntelBeach, ZoneIntelScorecard } from "./types";

const DEFAULT_TOP_N = 30;

/** Pure ordering step — testable without IO. */
export function assembleScorecard(rows: BeachScorecardRow[], generatedForIso: string): ZoneIntelScorecard {
  const scored = rows.map((r) => {
    const wave = r.accuracy.find((a) => a.dimension === "wave_height_ft");
    const errorMag = wave?.mae ?? 0;
    const lowNPenalty = (wave?.tier ?? "withheld") === "ready" ? 0 : 2; // unknown error is itself a priority
    const priorityScore = r.demand.score * (errorMag + lowNPenalty + 1);
    return { ...r, priorityScore: Math.round(priorityScore * 100) / 100 };
  });
  scored.sort((a, b) => b.priorityScore - a.priorityScore);
  return { generatedForIso, rows: scored };
}

export async function buildZoneIntelScorecard(
  generatedForIso: string,
  options: { topN?: number } = {},
): Promise<ZoneIntelScorecard> {
  const supabase = createSupabaseServiceRoleClient();
  const observedWind = createOpenMeteoObservedWind();
  const topN = options.topN ?? DEFAULT_TOP_N;

  const demand = await computeDemandRanks(supabase);
  const top = demand.slice(0, topN);
  const beachIds = top.map((d) => d.beachId);
  if (beachIds.length === 0) return { generatedForIso, rows: [] };

  const { data: beachRows, error } = await supabase
    .from("beaches")
    .select("id,name,lat,lon,swell_window_min_deg,swell_window_center_deg,swell_window_max_deg,preferred_tide_ft_min,preferred_tide_ft_max")
    .in("id", beachIds);
  if (error) throw new Error(`buildZoneIntelScorecard beaches: ${error.message}`);

  const beachById = new Map((beachRows ?? []).map((b: any) => [b.id, b as ZoneIntelBeach]));

  const rows: BeachScorecardRow[] = [];
  for (const d of top) {
    const beach = beachById.get(d.beachId);
    if (!beach || beach.lat == null || beach.lon == null) continue;
    const [accuracy, flags] = await Promise.all([
      computeBeachAccuracy(supabase, beach, observedWind),
      computeConditionFlags(supabase, beach),
    ]);
    rows.push({ beachId: beach.id, beachName: beach.name, demand: d, accuracy, flags, priorityScore: 0 });
  }

  return assembleScorecard(rows, generatedForIso);
}
```

- [ ] **Step 3: API route test first**

`__tests__/api/admin-zone-intel.test.ts`:
```ts
/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAdminAuth: (handler: any) => (req: any, ctx: any) => handler(req, ctx ?? {}),
}));
jest.mock("@/lib/flags/zone-intel", () => ({ isSurfZoneIntelEnabled: jest.fn(() => true) }));
jest.mock("@/lib/zone-intel/build-scorecard", () => ({
  buildZoneIntelScorecard: jest.fn(async (iso: string) => ({ generatedForIso: iso, rows: [{ beachId: "A", beachName: "A", demand: { beachId: "A", score: 1, rank: 1, components: {} }, accuracy: [], flags: {}, priorityScore: 1 }] })),
}));

import { GET } from "@/app/api/admin/zone-intel/route";
import { isSurfZoneIntelEnabled } from "@/lib/flags/zone-intel";

describe("GET /api/admin/zone-intel", () => {
  beforeEach(() => (isSurfZoneIntelEnabled as jest.Mock).mockReturnValue(true));
  const call = () => GET(new NextRequest(new URL("http://localhost:3000/api/admin/zone-intel")), {} as any);

  it("404s when flag off", async () => {
    (isSurfZoneIntelEnabled as jest.Mock).mockReturnValue(false);
    expect((await call()).status).toBe(404);
  });
  it("returns the scorecard when on", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].beachId).toBe("A");
    expect(typeof body.generatedForIso).toBe("string");
  });
});
```

- [ ] **Step 4: implement the route** (admin-gated; stamps the iso here so pure code stays deterministic)

`app/api/admin/zone-intel/route.ts`:
```ts
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";
import { isSurfZoneIntelEnabled } from "@/lib/flags/zone-intel";
import { buildZoneIntelScorecard } from "@/lib/zone-intel/build-scorecard";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(
  async () => {
    if (!isSurfZoneIntelEnabled()) {
      return NextResponse.json({ generatedForIso: new Date().toISOString(), rows: [] }, { status: 404 });
    }
    const scorecard = await buildZoneIntelScorecard(new Date().toISOString());
    return NextResponse.json(scorecard);
  },
  { errorMessage: "Failed to build surf zone intel scorecard" },
);
```

- [ ] **Step 5: implement the admin page** (mirror a sibling under `app/admin/`; the `app/admin/layout.tsx` enforces admin — confirm it does, and if it does not, add a server-side admin guard mirroring the sibling pages)

`app/admin/zone-intel/page.tsx`:
```tsx
import { isSurfZoneIntelEnabled } from "@/lib/flags/zone-intel";
import { buildZoneIntelScorecard } from "@/lib/zone-intel/build-scorecard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ZoneIntelAdminPage() {
  if (!isSurfZoneIntelEnabled()) notFound();
  const card = await buildZoneIntelScorecard(new Date().toISOString());

  return (
    <main className="p-6 space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Surf Zone Intel — accuracy scorecard</h1>
        <p className="text-sm text-gray-500">Demand-ranked. Wave vs sessions; wind vs observed. n shown; low-n withheld.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="p-2">#</th><th className="p-2">Beach</th><th className="p-2">Demand</th>
              <th className="p-2">Wave bias (n)</th><th className="p-2">Wind spd bias (n)</th><th className="p-2">Wind dir err (n)</th>
              <th className="p-2">Tide</th><th className="p-2">Closeout</th><th className="p-2">Priority</th>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r, i) => {
              const a = (d: string) => r.accuracy.find((x) => x.dimension === d);
              const fmt = (x: { bias: number | null; n: number } | undefined) => (x && x.bias != null ? `${x.bias} (${x.n})` : `— (${x?.n ?? 0})`);
              return (
                <tr key={r.beachId} className="border-t">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">{r.beachName}</td>
                  <td className="p-2">{r.demand.score} (#{r.demand.rank})</td>
                  <td className="p-2">{fmt(a("wave_height_ft"))}</td>
                  <td className="p-2">{fmt(a("wind_speed_mph"))}</td>
                  <td className="p-2">{fmt(a("wind_direction_deg"))}</td>
                  <td className="p-2">{r.flags.tide.preferredTideBandFt ? `${r.flags.tide.preferredTideBandFt.min.toFixed(1)}–${r.flags.tide.preferredTideBandFt.max.toFixed(1)}ft` : "—"}</td>
                  <td className="p-2">{r.flags.closeout.closeoutThresholdFt != null ? `${r.flags.closeout.closeoutThresholdFt}ft+ (${r.flags.closeout.risk})` : "—"}</td>
                  <td className="p-2">{r.priorityScore}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {card.rows.length === 0 && <p className="p-4 text-gray-500">No demand beaches yet.</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: run tests → PASS. Commit**
```bash
git add lib/zone-intel/build-scorecard.ts app/api/admin/zone-intel/route.ts app/admin/zone-intel/page.tsx __tests__/lib/zone-intel/build-scorecard.test.ts __tests__/api/admin-zone-intel.test.ts
git commit -m "feat(zone-intel): assemble scorecard + admin API + admin page (flag-gated)"
```

---

## Task 6 — Verify + acceptance (last)

- [ ] **Step 1: full typecheck** — `yarn typecheck` (Node 22). Resolve any FK-alias mismatches (Tasks 3/4 notes) against `types/database.generated.ts`.
- [ ] **Step 2: lint touched files** — `NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 lib/zone-intel/*.ts lib/flags/zone-intel.ts app/api/admin/zone-intel/route.ts app/admin/zone-intel/page.tsx __tests__/lib/zone-intel/*.ts __tests__/api/admin-zone-intel.test.ts`
- [ ] **Step 3: full unit run** — `yarn test:unit __tests__/lib/zone-intel __tests__/api/admin-zone-intel.test.ts` → all PASS.
- [ ] **Step 4: acceptance checklist** (must all hold):
  - [ ] Wind accuracy uses **observed** wind (Open-Meteo archive), never `actual_conditions` wind or another forecast. (Grep `accuracy-deltas.ts` — it must call `observedWind(...)` and never read `actual_conditions.wind_*`.)
  - [ ] Demand, accuracy, and flags all exclude `is_mock`/`analytics_is_real_user=false`/`is_system_account`, and **fail closed** on unknown profiles.
  - [ ] Dimensions/flags below n=3 are `withheld` (bias null); 3–4 `learning`; 5+ `ready`.
  - [ ] Admin page + API are flag-gated (off → page `notFound`, API 404) and admin-only (`withAdminAuth` / `app/admin/layout.tsx`).
  - [ ] API response contains no `user_id`/`email`/raw session rows.
- [ ] **Step 5: data audit (manual, one-time):** with `SURF_ZONE_INTEL_ENABLED=true` and a local/service-role env, run the app and open `/admin/zone-intel`. Confirm the table renders, sanity-check wave bias sign against ≥2 hand-known beaches (incl. a known face-height-underread spot — bias should read negative = we run low), and confirm `n` looks honest. Also verify whether `update_beach_forecast_accuracy` is being kept current; if it is stale/wrong, note it (Phase A computes deltas fresh from snapshots, so the scorecard does not depend on it — but flag the staleness for the correction phase).
- [ ] **Step 6: final commit** (docs/changelog only)
```bash
# CHANGELOG.md → [Unreleased] → Added:
# - Surf Zone Intel Phase A (internal, flag-gated SURF_ZONE_INTEL_ENABLED): demand-ranked
#   per-dimension forecast-accuracy scorecard (wave vs sessions, wind vs observed) + tide/closeout
#   flags at /admin/zone-intel. No AI, no production forecast change.
git add CHANGELOG.md
git commit -m "docs(zone-intel): changelog for phase A accuracy scorecard"
```

---

## Guardrails (apply throughout)
- **No commits to a shared branch / no push.** Work on a feature branch off committed `main`.
- **Do not** touch the dirty native-scoring refactor in the working tree (`lib/scoring/native-condition-score.ts`, `window-selector/*`, `surf-discovery-orchestrator.ts`).
- **Reuse** `percentile`/`findModes`/`calculateConfidence`/`normalizeTideStatus` — do not reimplement.
- **Fail closed** on unknown profiles everywhere.
- **Observed wind only** for the wind dimension.
- Beach-level only. No rip/drift (Phase C). No AI (Phase B). No production forecast/suggestion change.
