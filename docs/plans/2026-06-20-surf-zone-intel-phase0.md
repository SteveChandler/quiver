# Surf Zone Intel — Phase 0 (Validation Slice) Implementation Plan

> **For the executing agent (Codex):** Implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax. Every file path, column name, and helper below has been verified against the repo at HEAD — do not invent alternatives. Run from the repo root `quiver/`. Commit after each task with the given message. Do **not** push.

**Goal:** Prove surfers want spot-level "what this spot tends to like" intelligence before building any satellite imagery, AI vision, private storage, background workers, or native UI — by surfacing condition bands derived entirely from existing `sessions` + the existing preference-learning math, behind a beta-gated `Zones` tab on 5 San Diego pilot beaches.

**Architecture:** One server-side aggregator (`buildSpotConditionProfile`) reads completed, real-user `sessions` for a beach via the service-role client and reuses the **already-shipped** statistics helpers in `lib/services/preference-learning-service.ts` (percentile bands, mode detection, sigmoid confidence) to emit anonymized condition bands with a `ready | learning | unavailable` status ladder. A `withAuth`-protected GET route exposes it, gated by a beta flag + a hardcoded pilot-beach allowlist. A lazy-loaded `ZonesTab` renders it through the existing beach-detail tab system. No new analytics event — reuse the existing `tab_view`.

**Tech Stack:** Next.js 16 App Router (RSC + client components), TypeScript (strict), Supabase JS (service-role for cross-user aggregation), Jest (`yarn test:unit`), Playwright (`yarn test`), Tailwind.

**Hard constraints (do NOT cross these — they are the whole point of Phase 0):**
- Web only. **No** changes under `../quiver-native`, **no** changes under `../seaside`.
- **No** satellite/imagery code, **no** AI/LLM provider calls, **no** Supabase Storage buckets, **no** background/cron worker, **no** new DB table or migration.
- **No** new analytics event type — reuse `tab_view`.
- The API must return **only** aggregate bands/counts — never raw session rows, `user_id`, or `email`.
- Flag defaults **OFF**. With the flag off, the tab is invisible and the API 404s.

---

## Verified Anchors (already confirmed in the codebase — trust these)

| Thing | Location | Note |
|---|---|---|
| Tab-key union | `components/beach-detail/beach-tabs.tsx:7` `BeachTabValue` | add `\| "zones"` |
| Prefetch map (typed `Record<BeachTabValue,…>`) | `components/beach-detail/beach-tabs.tsx:15` `prefetchTabModules` | add `zones` entry or TS errors |
| `BeachTabsProps.beachId` | `beach-tabs.tsx:23` | already optional; consumed only by `tab_view` |
| `tab_view` fire | `beach-tabs.tsx:73` `track('tab_view', { beachId, metadata:{ tab, previous_tab, time_on_previous_ms }, debounceMs:300 })` | `beachId` is the prop — **currently undefined because parent omits it** |
| `BeachTabs` call site | `components/beach-detail.tsx:962` | does **not** pass `beachId` — must add `beachId={beach.id}` |
| `defaultTab` prop union | `components/beach-detail.tsx:234` | hand-maintained; add `"zones"` |
| Runtime `?tab=` allowlist | `components/beach-detail.tsx:355` | string array gating deep-links; add `"zones"` |
| Tab content blocks | `components/beach-detail.tsx:~965-1055` rendered as `<BeachTabContent value="…">` children | add a `zones` block before `</BeachTabs>` |
| Tab content template | `components/beach-detail/tabs/sessions-tab.tsx` | `"use client"`, `py-6` container; mirror it |
| Suspense fallback | `components/beach-detail/tab-loading-skeleton.tsx` `TabLoadingSkeleton` | reuse |
| Auth API wrapper | `lib/middleware/api-wrappers` → `withAuth(async (req,{user,supabase,params})=>…,{errorMessage})` | params resolved/awaited by wrapper |
| UUID param check | `validateUuidParam(params.id,"beach")` → `{value}` or `{error}` (`if("error" in r) return r.error`) | from same index |
| Raw route param shape (reference) | `app/api/beaches/[id]/sun-times/route.ts` | `{ params }: { params: Promise<{id:string}> }`, `export const dynamic="force-dynamic"`, returns `NextResponse.json(...)` |
| Service-role client | `createSupabaseServiceRoleClient` from `@/lib/supabase/server` (`lib/supabase/server.ts:6`) | RLS-bypass for cross-user aggregation |
| Stats helpers (REUSE, do not rewrite) | `lib/services/preference-learning-service.ts` exports `percentile`, `findModes`, `findModeDirections`, `calculateConfidence`, `parseWindDirection`, `normalizeTideStatus` | bands = `[percentile(arr,10), percentile(arr,90)]`; ceiling = `percentile(arr,90)`; modes = `findModes(arr,0.2)`; `calculateConfidence(n)=1/(1+e^(-0.2(n-5)))` |
| Thresholds (match these exactly) | `preference-learning-service.ts:149-152` | `MIN_SIGNAL_SAMPLE_SIZE=5`, `ENJOYED_RATING_MIN=3`, `POSITIVE_WAVE_QUALITY_MIN=4` |
| Eligibility filter (mirror exactly) | `supabase/migrations/20260520120000_forecast_personalization_learning.sql:565-580` | `status='completed' AND deleted_at IS NULL AND profiles.is_mock=false AND email NOT ILIKE '%test%' AND NOT LIKE '%@local.test' AND NOT LIKE '%@example.invalid'` |
| sessions→profiles FK (for is_mock join) | `profiles!sessions_user_id_profiles_fkey ( is_mock, email )` | confirmed in `actions/admin/sessions.ts` |
| sessions columns (exact, nullability) | `types/database.generated.ts:6918-6962` | `beach_id:string`, `user_id:string`, `rating:number\|null`, `wave_quality:number\|null`, `wave_height_ft:number\|null`, `wind_direction:string\|null` (compass label, **not** degrees), `wind_speed_mph:number\|null`, `tide_height_ft:number\|null`, `tide_status:string\|null`, `wave_characteristics:string[]\|null`, `status:string\|null`, `deleted_at:string\|null` |
| `profiles.is_mock` | `types/database.generated.ts:131` `boolean\|null` | the established mock filter; **no** `founder`/`is_internal`/`test_user` column exists |
| Client fetch hook | `useDataFetcher<T>(fetchFn, options?)` from `@/hooks/use-data-fetcher` → `{ data, loading, error, refetch }`, `immediate` defaults true | use a `useCallback`-memoized `fetchFn` |
| Flag idiom | `lib/flags/app-first-landing.ts` (`process.env.X` check) | Phase 0 flag defaults **OFF** and is `NEXT_PUBLIC_` so the client tab check can read it |
| Unit-test supabase mock pattern | `__tests__/services/preference-learning-service.test.ts` | mock `@/lib/supabase/server` `createSupabaseServiceRoleClient` with a chainable query-builder + `.then` |
| API route test pattern | `__tests__/api/cam-resolve.test.ts` (`@jest-environment node`, mock the api-wrapper to pass-through, build `NextRequest`) | |
| E2E beach pattern | `e2e/beach-amenities.spec.ts` (`./fixtures/auth-fixture`, `navigateToBeach`, `setupErrorDetection`/`assertNoErrors`, `getByRole('tab',{name:/…/i})`) | |

**Pilot beach UUIDs (resolved from the [dated beach-table snapshot](../../../Brand-Vault/marketing/growth-ops/data/beaches-table-2026-06-19.json), all San Diego, CA):**
- `d291411d-d331-4bf1-ad1a-302da3c69de0` — La Jolla Shores
- `4b0cf129-c706-4e24-8210-2219defc5ea7` — Scripps
- `65809772-20bc-4009-b9b2-89c8ef3c4127` — Pacific Beach
- `17628f35-9ed1-4257-aad6-070c4bd73bb8` — Tourmaline Beach
- `91df193c-f2c8-4e6c-984e-b859bd741061` — Tourmaline Surf Park
- `15c7337e-5258-4339-9dc3-c435c666926b` — Ocean Beach (San Diego; **not** Ocean Beach Pier `65d177de…`, and **not** the SF Ocean Beaches)

---

## File Structure

**Create:**
- `lib/surf-zone-intel/types.ts` — `SpotProfileStatus`, `SpotConditionBands`, `SpotConditionProfile`, `UNAVAILABLE_PROFILE`.
- `lib/surf-zone-intel/pilot-beaches.ts` — `PILOT_BEACH_IDS`, `isPilotBeach`.
- `lib/flags/surf-zone-intel.ts` — `isSurfZoneIntelEnabled` (default OFF, `NEXT_PUBLIC_`).
- `lib/surf-zone-intel/build-spot-profile.ts` — `buildSpotConditionProfile(beachId)`.
- `lib/surf-zone-intel/ARCHITECTURE.md` — one-paragraph dir note (codebase convention).
- `app/api/beaches/[id]/surf-zone-intel/route.ts` — gated GET.
- `components/beach-detail/tabs/zones-tab.tsx` — `ZonesTab`.
- `__tests__/services/build-spot-profile.test.ts`
- `__tests__/api/surf-zone-intel.test.ts`
- `__tests__/components/beach-detail/zones-tab.test.tsx`
- `e2e/surf-zone-intel.spec.ts`

**Modify:**
- `components/beach-detail/beach-tabs.tsx` — union + prefetch + gated `Zones` trigger.
- `components/beach-detail.tsx` — pass `beachId`, extend the two allowlists, add `zones` content block.
- `CHANGELOG.md` — `[Unreleased]` bullet.

---

## Task 1: Pilot-beach allowlist + beta flag

**Files:**
- Create: `lib/surf-zone-intel/pilot-beaches.ts`
- Create: `lib/flags/surf-zone-intel.ts`
- Test: `__tests__/services/build-spot-profile.test.ts` (started here; reused in Task 3)

- [ ] **Step 1: Create the pilot list**

`lib/surf-zone-intel/pilot-beaches.ts`:
```ts
/** Phase 0 surf-zone-intel pilot beaches (San Diego demand cluster). Hardcoded
 * by id because this is a founder-selected pilot, not a data-derived ranking. */
export const PILOT_BEACH_IDS: readonly string[] = [
  "d291411d-d331-4bf1-ad1a-302da3c69de0", // La Jolla Shores
  "4b0cf129-c706-4e24-8210-2219defc5ea7", // Scripps
  "65809772-20bc-4009-b9b2-89c8ef3c4127", // Pacific Beach
  "17628f35-9ed1-4257-aad6-070c4bd73bb8", // Tourmaline Beach
  "91df193c-f2c8-4e6c-984e-b859bd741061", // Tourmaline Surf Park
  "15c7337e-5258-4339-9dc3-c435c666926b", // Ocean Beach (San Diego)
] as const;

export function isPilotBeach(beachId: string): boolean {
  return PILOT_BEACH_IDS.includes(beachId);
}
```

- [ ] **Step 2: Create the flag** (default OFF, readable on client + server)

`lib/flags/surf-zone-intel.ts`:
```ts
/** Surf Zone Intel (Phase 0) beta flag. Default OFF. Set
 * NEXT_PUBLIC_SURF_ZONE_INTEL_ENABLED=true to reveal the gated Zones tab on
 * pilot beaches and enable the aggregation API.
 *
 * NEXT_PUBLIC_ on purpose: the client tab-visibility check reads it. This is a
 * non-sensitive beta on/off switch, not discovery logic — so it does NOT fall
 * under the server-only flag convention in lib/constants/feature-flags.ts. The
 * API route re-checks it server-side as defense-in-depth. */
export function isSurfZoneIntelEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SURF_ZONE_INTEL_ENABLED === "true";
}
```

- [ ] **Step 3: Write the pilot-list test** (this file grows in Task 3)

`__tests__/services/build-spot-profile.test.ts`:
```ts
import { isPilotBeach, PILOT_BEACH_IDS } from "@/lib/surf-zone-intel/pilot-beaches";

describe("isPilotBeach", () => {
  it("accepts a San Diego pilot beach id", () => {
    expect(isPilotBeach("d291411d-d331-4bf1-ad1a-302da3c69de0")).toBe(true);
  });
  it("rejects a non-pilot id (Ocean Beach Pier)", () => {
    expect(isPilotBeach("65d177de-e75a-4ad8-aa0d-48a67c0851b0")).toBe(false);
  });
  it("has exactly the 5 named pilot spots (6 ids incl. both Tourmaline rows)", () => {
    expect(PILOT_BEACH_IDS).toHaveLength(6);
  });
});
```

- [ ] **Step 4: Run it**

Run: `yarn test:unit __tests__/services/build-spot-profile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/surf-zone-intel/pilot-beaches.ts lib/flags/surf-zone-intel.ts __tests__/services/build-spot-profile.test.ts
git commit -m "feat: add surf-zone-intel pilot allowlist and beta flag"
```

---

## Task 2: Profile types

**Files:**
- Create: `lib/surf-zone-intel/types.ts`

- [ ] **Step 1: Define the types**

`lib/surf-zone-intel/types.ts`:
```ts
export type SpotProfileStatus = "ready" | "learning" | "unavailable";

export interface Range {
  min: number;
  max: number;
}

export interface SpotConditionBands {
  waveHeightFt: Range | null;
  tideHeightFt: Range | null;
  maxWindMph: number | null;
  tideStatuses: string[] | null;
  windDirections: string[] | null;
  waveCharacteristics: string[] | null;
}

export interface SpotSignalSampleCounts {
  waveHeight: number;
  tideHeight: number;
  windSpeed: number;
  tideStatus: number;
  windDirection: number;
  waveCharacteristics: number;
}

/** Anonymized, spot-level. NEVER contains user_id / email / raw sessions. */
export interface SpotConditionProfile {
  status: SpotProfileStatus;
  sampleSize: number; // evidence count = good sessions backing the profile
  confidence: number; // 0..1 (calculateConfidence)
  bands: SpotConditionBands;
  signalSampleCounts: SpotSignalSampleCounts;
  summary: string;
}

export const EMPTY_BANDS: SpotConditionBands = {
  waveHeightFt: null,
  tideHeightFt: null,
  maxWindMph: null,
  tideStatuses: null,
  windDirections: null,
  waveCharacteristics: null,
};

export const UNAVAILABLE_PROFILE: SpotConditionProfile = {
  status: "unavailable",
  sampleSize: 0,
  confidence: 0,
  bands: EMPTY_BANDS,
  signalSampleCounts: {
    waveHeight: 0,
    tideHeight: 0,
    windSpeed: 0,
    tideStatus: 0,
    windDirection: 0,
    waveCharacteristics: 0,
  },
  summary: "",
};
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck` (use Node 22)
Expected: no new errors from `lib/surf-zone-intel/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/surf-zone-intel/types.ts
git commit -m "feat: add surf-zone-intel profile types"
```

---

## Task 3: Spot-profile aggregator (the core)

Mirrors the `preference-learning-service` convention exactly, but aggregates **across all real users at one beach** instead of one user across beaches. Reuse its exported helpers — do not reimplement percentile/mode/confidence math.

**Files:**
- Create: `lib/surf-zone-intel/build-spot-profile.ts`
- Create: `lib/surf-zone-intel/ARCHITECTURE.md`
- Test: `__tests__/services/build-spot-profile.test.ts` (extend Task 1's file)

- [ ] **Step 1: Extend the test with the aggregator's behavior** (write first; it will fail to import)

Append to `__tests__/services/build-spot-profile.test.ts`:
```ts
import { buildSpotConditionProfile } from "@/lib/surf-zone-intel/build-spot-profile";

// ---- Supabase service-role mock (mirrors preference-learning-service.test.ts) ----
let mockRows: any[] = [];
let mockError: any = null;

const queryBuilder = () => {
  const result = () => ({ data: mockRows, error: mockError });
  const b: any = {
    select: jest.fn(() => b),
    eq: jest.fn(() => b),
    is: jest.fn(() => b),
    then: jest.fn((resolve: any) => {
      const r = result();
      resolve(r);
      return Promise.resolve(r);
    }),
  };
  return b;
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => queryBuilder()),
  })),
}));

const real = (over: Partial<any> = {}) => ({
  rating: 4,
  wave_quality: 5,
  wave_height_ft: 3,
  wind_direction: "W",
  wind_speed_mph: 6,
  tide_height_ft: 2.5,
  tide_status: "rising",
  wave_characteristics: ["clean"],
  profiles: { is_mock: false, email: "real@surfer.com" },
  ...over,
});

const BEACH = "d291411d-d331-4bf1-ad1a-302da3c69de0";

beforeEach(() => {
  mockRows = [];
  mockError = null;
});

describe("buildSpotConditionProfile", () => {
  it("returns unavailable when there are no eligible sessions", async () => {
    mockRows = [];
    const p = await buildSpotConditionProfile(BEACH);
    expect(p.status).toBe("unavailable");
    expect(p.sampleSize).toBe(0);
  });

  it("excludes mock and test-email profiles before aggregating", async () => {
    mockRows = [
      ...Array.from({ length: 6 }, () => real({ profiles: { is_mock: true, email: "x@surfer.com" } })),
      ...Array.from({ length: 2 }, () => real({ profiles: { is_mock: false, email: "qa+test@surfer.com" } })),
    ];
    const p = await buildSpotConditionProfile(BEACH);
    expect(p.status).toBe("unavailable"); // all filtered out
    expect(p.sampleSize).toBe(0);
  });

  it("is 'learning' between 3 and 4 good sessions (no firm bands)", async () => {
    mockRows = Array.from({ length: 3 }, () => real());
    const p = await buildSpotConditionProfile(BEACH);
    expect(p.status).toBe("learning");
    expect(p.bands.waveHeightFt).toBeNull(); // per-signal gate is 5
  });

  it("is 'ready' with wave + categorical bands at >= 5 good sessions", async () => {
    mockRows = [
      real({ wave_height_ft: 2 }),
      real({ wave_height_ft: 3 }),
      real({ wave_height_ft: 3 }),
      real({ wave_height_ft: 4 }),
      real({ wave_height_ft: 5 }),
    ];
    const p = await buildSpotConditionProfile(BEACH);
    expect(p.status).toBe("ready");
    expect(p.bands.waveHeightFt).not.toBeNull();
    expect(p.bands.waveHeightFt!.min).toBeLessThanOrEqual(p.bands.waveHeightFt!.max);
    expect(p.bands.tideStatuses).toContain("rising");
    expect(p.confidence).toBeGreaterThan(0);
  });

  it("never leaks user identifiers", async () => {
    mockRows = Array.from({ length: 5 }, () => real());
    const p = await buildSpotConditionProfile(BEACH);
    expect(JSON.stringify(p)).not.toMatch(/email|user_id|@surfer\.com/);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `yarn test:unit __tests__/services/build-spot-profile.test.ts`
Expected: FAIL — `Cannot find module '@/lib/surf-zone-intel/build-spot-profile'`.

- [ ] **Step 3: Implement the aggregator**

`lib/surf-zone-intel/build-spot-profile.ts`:
```ts
import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  percentile,
  findModes,
  calculateConfidence,
  normalizeTideStatus,
} from "@/lib/services/preference-learning-service";
import {
  EMPTY_BANDS,
  UNAVAILABLE_PROFILE,
  type SpotConditionBands,
  type SpotConditionProfile,
} from "./types";

// Match the established session-learning thresholds exactly.
const MIN_SIGNAL_SAMPLE_SIZE = 5; // per-signal gate to emit a band
const LEARNING_FLOOR = 3; // below this => unavailable
const ENJOYED_RATING_MIN = 3; // general-condition cohort
const POSITIVE_WAVE_QUALITY_MIN = 4; // wave-size cohort

interface EligibleRow {
  rating: number | null;
  wave_quality: number | null;
  wave_height_ft: number | null;
  wind_direction: string | null;
  wind_speed_mph: number | null;
  tide_height_ft: number | null;
  tide_status: string | null;
  wave_characteristics: string[] | null;
  profiles: { is_mock: boolean | null; email: string | null } | null;
}

function isRealProfile(p: EligibleRow["profiles"]): boolean {
  if (!p || p.is_mock === true) return false;
  const email = p.email?.toLowerCase();
  if (!email) return true;
  if (email.includes("test")) return false;
  if (email.endsWith("@local.test")) return false;
  if (email.endsWith("@example.invalid")) return false;
  return true;
}

const nums = (xs: (number | null)[]): number[] =>
  xs.filter((v): v is number => v != null);
const strs = (xs: (string | null)[]): string[] =>
  xs.filter((v): v is string => !!v);

export async function buildSpotConditionProfile(
  beachId: string,
): Promise<SpotConditionProfile> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "rating, wave_quality, wave_height_ft, wind_direction, wind_speed_mph, tide_height_ft, tide_status, wave_characteristics, profiles!sessions_user_id_profiles_fkey ( is_mock, email )",
    )
    .eq("beach_id", beachId)
    .eq("status", "completed")
    .is("deleted_at", null);

  if (error) {
    throw new Error(`buildSpotConditionProfile(${beachId}): ${error.message}`);
  }

  const rows = ((data ?? []) as unknown as EligibleRow[]).filter((r) =>
    isRealProfile(r.profiles),
  );

  // Two cohorts, kept separate per the convention.
  const waveCohort = rows.filter(
    (r) => (r.wave_quality ?? 0) >= POSITIVE_WAVE_QUALITY_MIN,
  );
  const generalCohort = rows.filter(
    (r) => (r.rating ?? 0) >= ENJOYED_RATING_MIN,
  );
  const evidenceCount = Math.max(waveCohort.length, generalCohort.length);

  if (evidenceCount < LEARNING_FLOOR) {
    return { ...UNAVAILABLE_PROFILE };
  }

  const waveHeights = nums(waveCohort.map((r) => r.wave_height_ft));
  const windSpeeds = nums(generalCohort.map((r) => r.wind_speed_mph));
  const tideHeights = nums(generalCohort.map((r) => r.tide_height_ft));
  const tideStatuses = strs(
    generalCohort.map((r) =>
      r.tide_status ? normalizeTideStatus(r.tide_status) : null,
    ),
  );
  const windDirections = strs(generalCohort.map((r) => r.wind_direction)); // compass labels
  const waveCharacteristics = strs(
    waveCohort.flatMap((r) => r.wave_characteristics ?? []),
  );

  const gate = (n: number) => n >= MIN_SIGNAL_SAMPLE_SIZE;

  const bands: SpotConditionBands = {
    waveHeightFt: gate(waveHeights.length)
      ? { min: percentile(waveHeights, 10), max: percentile(waveHeights, 90) }
      : null,
    tideHeightFt: gate(tideHeights.length)
      ? { min: percentile(tideHeights, 10), max: percentile(tideHeights, 90) }
      : null,
    maxWindMph: gate(windSpeeds.length) ? percentile(windSpeeds, 90) : null,
    tideStatuses: gate(tideStatuses.length) ? findModes(tideStatuses, 0.2) : null,
    windDirections: gate(windDirections.length)
      ? findModes(windDirections, 0.2)
      : null,
    waveCharacteristics: gate(waveCharacteristics.length)
      ? findModes(waveCharacteristics, 0.2)
      : null,
  };

  const status = evidenceCount >= MIN_SIGNAL_SAMPLE_SIZE ? "ready" : "learning";

  return {
    status,
    sampleSize: evidenceCount,
    confidence: calculateConfidence(evidenceCount),
    bands: status === "learning" ? EMPTY_BANDS : bands,
    signalSampleCounts: {
      waveHeight: waveHeights.length,
      tideHeight: tideHeights.length,
      windSpeed: windSpeeds.length,
      tideStatus: tideStatuses.length,
      windDirection: windDirections.length,
      waveCharacteristics: waveCharacteristics.length,
    },
    summary: buildSummary(status, bands),
  };
}

function buildSummary(
  status: "ready" | "learning",
  bands: SpotConditionBands,
): string {
  if (status === "learning") return "Still learning this spot.";
  const parts: string[] = [];
  if (bands.waveHeightFt) {
    parts.push(`${fmt(bands.waveHeightFt.min)}–${fmt(bands.waveHeightFt.max)} ft`);
  }
  if (bands.tideStatuses?.length) parts.push(`${bands.tideStatuses.join("/")} tide`);
  if (bands.windDirections?.length) parts.push(`${bands.windDirections.join("/")} wind`);
  return parts.length ? `Tends to like ${parts.join(", ")}.` : "Tends to like a range of conditions.";
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
```

- [ ] **Step 4: Add the dir ARCHITECTURE note** (repo convention)

`lib/surf-zone-intel/ARCHITECTURE.md`:
```md
# surf-zone-intel

Phase 0 validation slice. `build-spot-profile.ts` aggregates completed, real-user
`sessions` for one beach into anonymized condition bands ("what this spot tends to
like"), reusing the statistics helpers exported from
`lib/services/preference-learning-service.ts`. No satellite/AI/storage/worker — see
`docs/plans/2026-06-20-surf-zone-intel-phase0.md`. Naming note: distinct from the
unrelated `createSpotProfile()` in `lib/domains/spot-profile/`.
```

- [ ] **Step 5: Run the tests**

Run: `yarn test:unit __tests__/services/build-spot-profile.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add lib/surf-zone-intel/build-spot-profile.ts lib/surf-zone-intel/ARCHITECTURE.md __tests__/services/build-spot-profile.test.ts
git commit -m "feat: add session-derived surf-zone spot-profile aggregator"
```

---

## Task 4: Gated API route

**Files:**
- Create: `app/api/beaches/[id]/surf-zone-intel/route.ts`
- Test: `__tests__/api/surf-zone-intel.test.ts`

- [ ] **Step 1: Write the route test first**

`__tests__/api/surf-zone-intel.test.ts`:
```ts
/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

// Pass-through the auth wrapper; forward (request, context) to the handler.
jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth:
    (handler: any) =>
    (req: any, ctx: any) =>
      handler(req, ctx ?? {}),
  validateUuidParam: (value: string) => ({ value }),
}));

jest.mock("@/lib/flags/surf-zone-intel", () => ({
  isSurfZoneIntelEnabled: jest.fn(() => true),
}));

jest.mock("@/lib/surf-zone-intel/build-spot-profile", () => ({
  buildSpotConditionProfile: jest.fn(async () => ({
    status: "ready",
    sampleSize: 7,
    confidence: 0.61,
    bands: {
      waveHeightFt: { min: 2, max: 4 },
      tideHeightFt: null,
      maxWindMph: 9,
      tideStatuses: ["rising"],
      windDirections: ["W"],
      waveCharacteristics: ["clean"],
    },
    signalSampleCounts: {
      waveHeight: 7,
      tideHeight: 0,
      windSpeed: 6,
      tideStatus: 6,
      windDirection: 6,
      waveCharacteristics: 7,
    },
    summary: "Tends to like 2–4 ft, rising tide, W wind.",
  })),
}));

import { GET } from "@/app/api/beaches/[id]/surf-zone-intel/route";
import { isSurfZoneIntelEnabled } from "@/lib/flags/surf-zone-intel";

const PILOT = "d291411d-d331-4bf1-ad1a-302da3c69de0";
const NON_PILOT = "65d177de-e75a-4ad8-aa0d-48a67c0851b0";

function call(id: string) {
  const req = new NextRequest(
    new URL(`http://localhost:3000/api/beaches/${id}/surf-zone-intel`),
  );
  return GET(req, { params: { id } } as any);
}

describe("GET /api/beaches/[id]/surf-zone-intel", () => {
  beforeEach(() => {
    (isSurfZoneIntelEnabled as jest.Mock).mockReturnValue(true);
  });

  it("404s when the flag is off", async () => {
    (isSurfZoneIntelEnabled as jest.Mock).mockReturnValue(false);
    const res = await call(PILOT);
    expect(res.status).toBe(404);
    expect((await res.json()).status).toBe("unavailable");
  });

  it("404s for a non-pilot beach", async () => {
    const res = await call(NON_PILOT);
    expect(res.status).toBe(404);
  });

  it("returns the aggregate profile for a pilot beach when enabled", async () => {
    const res = await call(PILOT);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.sampleSize).toBe(7);
    expect(JSON.stringify(body)).not.toMatch(/email|user_id/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `yarn test:unit __tests__/api/surf-zone-intel.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

`app/api/beaches/[id]/surf-zone-intel/route.ts`:
```ts
import { NextResponse } from "next/server";
import { withAuth, validateUuidParam } from "@/lib/middleware/api-wrappers";
import { isSurfZoneIntelEnabled } from "@/lib/flags/surf-zone-intel";
import { isPilotBeach } from "@/lib/surf-zone-intel/pilot-beaches";
import { buildSpotConditionProfile } from "@/lib/surf-zone-intel/build-spot-profile";
import { UNAVAILABLE_PROFILE } from "@/lib/surf-zone-intel/types";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (_request, { params }) => {
    const uuid = validateUuidParam(params?.id, "beach");
    if ("error" in uuid) return uuid.error;
    const beachId = uuid.value;

    // Defense-in-depth: even signed-in users only reach data for pilot beaches
    // while the beta flag is on. Tab is hidden otherwise, so this is the backstop.
    if (!isSurfZoneIntelEnabled() || !isPilotBeach(beachId)) {
      return NextResponse.json(UNAVAILABLE_PROFILE, { status: 404 });
    }

    const profile = await buildSpotConditionProfile(beachId);
    return NextResponse.json(profile);
  },
  { errorMessage: "Failed to load surf zone intel" },
);
```

- [ ] **Step 4: Run the tests**

Run: `yarn test:unit __tests__/api/surf-zone-intel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/beaches/'[id]'/surf-zone-intel/route.ts __tests__/api/surf-zone-intel.test.ts
git commit -m "feat: add gated surf-zone-intel API route"
```

---

## Task 5: ZonesTab component

**Files:**
- Create: `components/beach-detail/tabs/zones-tab.tsx`
- Test: `__tests__/components/beach-detail/zones-tab.test.tsx`

- [ ] **Step 1: Write the component test first**

`__tests__/components/beach-detail/zones-tab.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { ZonesTab } from "@/components/beach-detail/tabs/zones-tab";

const beach = { id: "d291411d-d331-4bf1-ad1a-302da3c69de0", name: "La Jolla Shores" } as any;

function mockFetch(body: any, ok = true, status = 200) {
  (global as any).fetch = jest.fn(async () => ({
    ok,
    status,
    json: async () => body,
  }));
}

afterEach(() => jest.restoreAllMocks());

describe("ZonesTab", () => {
  it("renders the ready state with bands", async () => {
    mockFetch({
      status: "ready",
      sampleSize: 8,
      confidence: 0.7,
      bands: {
        waveHeightFt: { min: 2, max: 4 },
        tideHeightFt: null,
        maxWindMph: 9,
        tideStatuses: ["rising"],
        windDirections: ["W"],
        waveCharacteristics: ["clean"],
      },
      signalSampleCounts: {},
      summary: "Tends to like 2–4 ft.",
    });
    render(<ZonesTab beach={beach} />);
    expect(await screen.findByText(/what this spot tends to like/i)).toBeInTheDocument();
    expect(screen.getByText(/2–4 ft/)).toBeInTheDocument();
  });

  it("renders the learning state", async () => {
    mockFetch({ status: "learning", sampleSize: 3, confidence: 0.4, bands: {}, signalSampleCounts: {}, summary: "" });
    render(<ZonesTab beach={beach} />);
    expect(await screen.findByText(/still learning this spot/i)).toBeInTheDocument();
  });

  it("renders a graceful empty state on 404/unavailable", async () => {
    mockFetch({ status: "unavailable", sampleSize: 0, confidence: 0, bands: {}, signalSampleCounts: {}, summary: "" }, false, 404);
    render(<ZonesTab beach={beach} />);
    await waitFor(() =>
      expect(screen.getByText(/still learning this spot/i)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `yarn test:unit __tests__/components/beach-detail/zones-tab.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

`components/beach-detail/tabs/zones-tab.tsx`:
```tsx
"use client";

import { useCallback } from "react";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { SpotConditionProfile } from "@/lib/surf-zone-intel/types";

interface ZonesTabProps {
  beach: Beach;
}

export function ZonesTab({ beach }: ZonesTabProps) {
  const fetchProfile = useCallback(async (): Promise<SpotConditionProfile> => {
    const res = await fetch(`/api/beaches/${beach.id}/surf-zone-intel`);
    // 404 = gated/unavailable; treat as a normal "not ready" payload.
    if (!res.ok && res.status !== 404) {
      throw new Error(`surf-zone-intel ${res.status}`);
    }
    return (await res.json()) as SpotConditionProfile;
  }, [beach.id]);

  const { data, loading, error } = useDataFetcher<SpotConditionProfile>(fetchProfile);

  if (loading) {
    return <div className="py-6 text-sm text-gray-500">Reading the lineup…</div>;
  }

  if (error || !data || data.status !== "ready") {
    const n = data?.sampleSize ?? 0;
    return (
      <div className="space-y-2 py-6">
        <h2 className="text-lg font-heading font-semibold text-dark-grey">
          Still learning this spot
        </h2>
        <p className="text-sm text-gray-600">
          {n > 0
            ? `We have ${n} logged session${n === 1 ? "" : "s"} here so far. A few more and we’ll show what ${beach.name} tends to like.`
            : `Once surfers start logging sessions at ${beach.name}, we’ll show what it tends to like.`}
        </p>
      </div>
    );
  }

  const { bands } = data;
  return (
    <div className="space-y-4 py-6">
      <header>
        <h2 className="text-lg font-heading font-semibold text-dark-grey">
          What this spot tends to like
        </h2>
        <p className="text-xs text-gray-500">
          From {data.sampleSize} logged sessions · {Math.round(data.confidence * 100)}% confidence
        </p>
      </header>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bands.waveHeightFt && (
          <Band label="Wave height" value={`${fmt(bands.waveHeightFt.min)}–${fmt(bands.waveHeightFt.max)} ft`} />
        )}
        {bands.tideStatuses?.length ? (
          <Band label="Tide" value={bands.tideStatuses.join(", ")} />
        ) : null}
        {bands.windDirections?.length ? (
          <Band label="Wind direction" value={bands.windDirections.join(", ")} />
        ) : null}
        {bands.maxWindMph != null && (
          <Band label="Wind speed" value={`up to ${Math.round(bands.maxWindMph)} mph`} />
        )}
        {bands.waveCharacteristics?.length ? (
          <Band label="Wave feel" value={bands.waveCharacteristics.join(", ")} />
        ) : null}
      </dl>
      <p className="text-[11px] leading-snug text-gray-400">
        Spot-level pattern from surfer-logged sessions — not a takeoff-by-takeoff call.
      </p>
    </div>
  );
}

function Band({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/95 p-4 shadow-sm">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-dark-grey">{value}</dd>
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
```

- [ ] **Step 4: Run the tests**

Run: `yarn test:unit __tests__/components/beach-detail/zones-tab.test.tsx`
Expected: PASS (3 tests). If `render` needs a wrapper, none is required here — `ZonesTab` uses only `useDataFetcher` + `fetch`, no router/context.

- [ ] **Step 5: Commit**

```bash
git add components/beach-detail/tabs/zones-tab.tsx __tests__/components/beach-detail/zones-tab.test.tsx
git commit -m "feat: add ZonesTab surf-zone-intel beach-detail tab"
```

---

## Task 6: Wire the gated tab into the tab system

Two files. The trigger (button) lives in `beach-tabs.tsx`; the content block lives in `beach-detail.tsx`.

**Files:**
- Modify: `components/beach-detail/beach-tabs.tsx`
- Modify: `components/beach-detail.tsx`

- [ ] **Step 1: `beach-tabs.tsx` — add imports** (after the existing import block at the top, around line 5)

Add:
```ts
import { isSurfZoneIntelEnabled } from "@/lib/flags/surf-zone-intel";
import { isPilotBeach } from "@/lib/surf-zone-intel/pilot-beaches";
```

- [ ] **Step 2: `beach-tabs.tsx:7` — extend the union**

Find:
```ts
export type BeachTabValue =
  | "overview"
  | "forecast"
  | "reviews"
  | "intel"
  | "sessions";
```
Replace the closing line `  | "sessions";` with:
```ts
  | "sessions"
  | "zones";
```

- [ ] **Step 3: `beach-tabs.tsx:15` — add the prefetch entry** (required: the map is typed `Record<BeachTabValue,…>`, so it won't compile otherwise)

In `prefetchTabModules`, add after the `sessions:` line:
```ts
  zones: () => import("@/components/beach-detail/tabs/zones-tab"),
```

- [ ] **Step 4: `beach-tabs.tsx` — compute visibility** (just before the `return (` that renders `<Tabs …>`, near the `stickyTop` const)

Add:
```ts
const showZones =
  !!beachId && isSurfZoneIntelEnabled() && isPilotBeach(beachId);
```

- [ ] **Step 5: `beach-tabs.tsx` — add the gated trigger** (inside `<TabsList>`, immediately after the `sessions` `<TabsTrigger>…</TabsTrigger>`)

Add:
```tsx
{showZones && (
  <TabsTrigger
    value="zones"
    className={tabTriggerClasses}
    onMouseEnter={() => handleTabHover("zones")}
  >
    Zones
  </TabsTrigger>
)}
```

- [ ] **Step 6: `beach-detail.tsx:962` — pass `beachId`** (also fixes `tab_view` carrying an undefined beachId today)

Find:
```tsx
<BeachTabs
  activeTab={activeTab}
  onTabChange={setActiveTab}
  actions={tabActions}
  publicMode={publicMode}
>
```
Replace with:
```tsx
<BeachTabs
  activeTab={activeTab}
  onTabChange={setActiveTab}
  actions={tabActions}
  publicMode={publicMode}
  beachId={beach.id}
>
```

- [ ] **Step 7: `beach-detail.tsx:234` — extend the `defaultTab` prop union**

Find:
```ts
  defaultTab?: "overview" | "forecast" | "reviews" | "intel" | "sessions";
```
Replace with:
```ts
  defaultTab?: "overview" | "forecast" | "reviews" | "intel" | "sessions" | "zones";
```

- [ ] **Step 8: `beach-detail.tsx:355` — allow `?tab=zones` deep-links only when gated-on**

Find:
```ts
    const tabQueryParam = searchParams.get("tab");
    if (
      tabQueryParam &&
      ["overview", "forecast", "reviews", "intel", "sessions"].includes(
        tabQueryParam,
      )
    ) {
```
Replace the array with a gated one:
```ts
    const tabQueryParam = searchParams.get("tab");
    const allowedTabs = [
      "overview",
      "forecast",
      "reviews",
      "intel",
      "sessions",
      ...(isSurfZoneIntelEnabled() && isPilotBeach(beach.id) ? ["zones"] : []),
    ];
    if (tabQueryParam && allowedTabs.includes(tabQueryParam)) {
```
Then add these imports to `beach-detail.tsx` (top, with the other imports):
```ts
import { isSurfZoneIntelEnabled } from "@/lib/flags/surf-zone-intel";
import { isPilotBeach } from "@/lib/surf-zone-intel/pilot-beaches";
```

- [ ] **Step 9: `beach-detail.tsx` — add the content block** (immediately after the `sessions` `</BeachTabContent>` and before `</BeachTabs>`, ~line 1055)

First add the import near the other tab imports:
```ts
import { ZonesTab } from "@/components/beach-detail/tabs/zones-tab";
```
Then add the block:
```tsx
{/* Surf Zone Intel Tab (Phase 0, beta-gated to pilot beaches) */}
{isSurfZoneIntelEnabled() && isPilotBeach(beach.id) && (
  <BeachTabContent value="zones">
    <Suspense fallback={<TabLoadingSkeleton />}>
      <ZonesTab beach={beach} />
    </Suspense>
  </BeachTabContent>
)}
```

- [ ] **Step 10: Typecheck + lint the touched files**

Run: `yarn typecheck`
Expected: no new errors. (If the prefetch map or union complains, you missed Step 2 or 3.)
Run: `NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 components/beach-detail/beach-tabs.tsx components/beach-detail.tsx components/beach-detail/tabs/zones-tab.tsx lib/surf-zone-intel/*.ts lib/flags/surf-zone-intel.ts app/api/beaches/'[id]'/surf-zone-intel/route.ts`
Expected: clean.

- [ ] **Step 11: Re-run the unit/component/api suites for blast radius**

Run: `yarn test:unit __tests__/services/build-spot-profile.test.ts __tests__/api/surf-zone-intel.test.ts __tests__/components/beach-detail/zones-tab.test.tsx`
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add components/beach-detail/beach-tabs.tsx components/beach-detail.tsx
git commit -m "feat: wire gated Zones tab into beach detail + pass beachId to tab_view"
```

---

## Task 7: E2E guard + CHANGELOG

**Files:**
- Create: `e2e/surf-zone-intel.spec.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write the E2E spec** (default = flag OFF → tab absent + no console errors; visible-state assertion only runs when the env flag is set)

`e2e/surf-zone-intel.spec.ts`:
```ts
import { test, expect } from "./fixtures/auth-fixture";
import { navigateToBeach } from "./utils/test-helpers";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from "./utils/error-detection";

// La Jolla Shores (pilot beach) slug.
const PILOT_SLUG = "la-jolla-shores";
const flagOn = process.env.NEXT_PUBLIC_SURF_ZONE_INTEL_ENABLED === "true";

test.describe("Surf Zone Intel — Zones tab gating", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    assertNoErrors(page, errorCapture);
  });

  test("pilot beach loads without errors; Zones tab respects the flag", async ({ page }) => {
    await navigateToBeach(page, PILOT_SLUG);
    const zonesTab = page.getByRole("tab", { name: /zones/i });
    if (flagOn) {
      await expect(zonesTab).toBeVisible({ timeout: 10000 });
      await zonesTab.click();
      await expect(page.getByRole("tabpanel", { name: /zones/i })).toBeVisible({
        timeout: 10000,
      });
    } else {
      await expect(zonesTab).toHaveCount(0);
    }
  });
});
```
> If `navigateToBeach`'s signature differs (e.g. takes a beach object from `./fixtures/test-data`), adapt the call to match the sibling spec `e2e/beach-amenities.spec.ts` — do not change the helper.

- [ ] **Step 2: Run the E2E spec**

Run: `npx playwright test e2e/surf-zone-intel.spec.ts`
Expected: PASS (flag-off path: Zones tab absent, no console errors).

- [ ] **Step 3: CHANGELOG**

In `CHANGELOG.md`, under `## [Unreleased]` → `### Added`, add:
```md
- Surf Zone Intel (Phase 0, beta): beta-gated "Zones" tab on 5 San Diego pilot beaches showing session-derived "what this spot tends to like" condition bands. Off by default (`NEXT_PUBLIC_SURF_ZONE_INTEL_ENABLED`). No imagery/AI/worker. Reuses `tab_view` analytics.
```

- [ ] **Step 4: Commit**

```bash
git add e2e/surf-zone-intel.spec.ts CHANGELOG.md
git commit -m "test: add surf-zone-intel e2e gating spec and changelog entry"
```

---

## Final verification

- [ ] `yarn typecheck` (Node 22) — clean.
- [ ] `yarn test:unit __tests__/services/build-spot-profile.test.ts __tests__/api/surf-zone-intel.test.ts __tests__/components/beach-detail/zones-tab.test.tsx` — all green.
- [ ] `npx playwright test e2e/surf-zone-intel.spec.ts` — green.
- [ ] Manual smoke (optional): create `.env.local` with `NEXT_PUBLIC_SURF_ZONE_INTEL_ENABLED=true`, `yarn dev`, open `/…/la-jolla-shores`, confirm the **Zones** tab appears and renders ready/learning; open a non-pilot beach and confirm it does **not** appear. Remove the env var afterward.
- [ ] `git log --oneline` shows 7 atomic commits; nothing pushed.

---

## Measurement & decision gate (post-merge, not code)

- **Instrumentation:** already covered — `tab_view` now fires with `beachId` + `metadata.tab="zones"` (Task 6, Step 6). No new event.
- **Primary metric:** Zones-tab open rate = `tab_view{tab="zones"}` ÷ pilot-beach detail views, among **signed-in** users, over 7 days.
- **Success bar:** ≥ 8% open rate on pilot beaches over 7 days.
- **Secondary:** dwell — users staying ≥ 12s before switching away, via the existing `metadata.time_on_previous_ms` on the *next* `tab_view`.
- **Gate:** only if the bar clears do we fund Phase 1 (persisted demand rankings + profile snapshots). Imagery/AI stays deferred to Phase 3 and must beat a forecast/session-only baseline before shipping anything.

## Out of scope (explicitly NOT in Phase 0)
Satellite/Sentinel-2, AI vision, `surf_zones`/observation/profile tables + migrations, Supabase Storage buckets, a background/cron worker, demand-ranking aggregate table, native UI, map overlay, time slider, polygon geometry. These are later phases, each gated on the prior one.

## Self-review notes (already reconciled in this plan)
- **No `founder` column exists** — eligibility uses `is_mock` + test-email heuristics only (the verified precedent), no `founder`/`is_internal` filter is referenced.
- **`wind_direction` is a string label**, not degrees — treated categorically via `findModes`, no degree math.
- **Service-role aggregation returns only bands/counts** — no `user_id`/`email`; a test asserts the absence.
- **Flag is `NEXT_PUBLIC_`** so the client tab check and server API check read the same switch; default OFF.
- **`createSuccessResponse` intentionally not used** — the route returns `NextResponse.json(...)` directly, matching the verified `sun-times` route (avoids depending on an unverified export).
