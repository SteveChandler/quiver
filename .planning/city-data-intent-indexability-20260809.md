# City data-intent indexability + the city editorial track

**Date:** 2026-08-09
**Status:** Task 1-3 ready for Codex; Track B is a decision, not a task
**Origin:** GSC "Excluded by 'noindex'" drilldown (588 pages), city-intent remainder

---

## What the research found

### 1. The gate needs one row per (city, intent)

`city_editorial_content` is keyed by `country_slug / state_slug / city_slug / intent`
(`cityEditorialKey`, `lib/seo/indexability.ts:160`). `evaluateCityEditorialQuality`
requires an **exact intent match** — a `general` row does not satisfy `/beginner/…`.

Per row the gate demands: `editorial_reviewed_at` + `seo_indexable = true` + ≥1
`editorial_sources` entry (url + publisher + retrievedAt) + `description[]` with text
+ `seo_intro` + `seo_local_guidance`. Plus runtime `dataRich`.

Production today: **9 rows, 1 approved** — `rosarito / general`, reviewed 2026-07-20,
3 real sources (Baja California Tourism, Surfline travel, Surf-Forecast).

So the authoring unit is *city × intent*, not city. Covering the 115 noindexed
city-intent pages means 115 hand-written, individually sourced rows.

### 2. The traffic is overwhelmingly water-temp

From `lib/seo/gsc-performance-protection.v1.json` (real GSC, 2026-07-04 → 07-31,
269 protected paths, 105,338 impressions, 965 clicks):

| Family | Impressions | Clicks | Pages | CTR |
|---|---:|---:|---:|---:|
| city-intent | 32,867 | 427 | 48 | 1.30% |
| beach-water-temp | 29,232 | 304 | 90 | 1.04% |
| best-time-city | 28,169 | **105** | 52 | **0.37%** |
| beach | 6,317 | 51 | 26 | 0.81% |
| beach-tides | 5,008 | 37 | 36 | 0.74% |
| city-location | 3,745 | 41 | 17 | 1.09% |

Within city-intent:

| Intent | Impressions | Clicks | Pages | CTR |
|---|---:|---:|---:|---:|
| water-temp | 28,227 | 383 | 18 | 1.36% |
| longboard | 970 | 19 | 7 | 1.96% |
| tide | 2,139 | 9 | 9 | 0.42% |
| beginner | 567 | 8 | 7 | 1.41% |
| dawn-patrol | 779 | 6 | 5 | 0.77% |
| least-crowded | 170 | 1 | 1 | 0.59% |
| sunset | 15 | 1 | 1 | 6.67% |

**Water-temp pages earn 687 of 965 clicks — 71% of all protected organic clicks.**
This independently confirms plan 064's 74% figure.

The five *recommendation* intents (beginner, longboard, dawn-patrol, least-crowded,
sunset) together produced **35 clicks across 21 already-indexed pages** in four weeks.
Authoring 53 more rows of that type is the lowest-yield work available.

### 3. The noindexed data pages already have their data

Live titles on production, 2026-08-09:

```
water-temp/corolla        :: Corolla Water Temperature Today: 76°F
water-temp/pacific-grove  :: Pacific Grove Water Temperature Today: 60°F
water-temp/aguadilla      :: Aguadilla Water Temperature Today: 84°F
tide/monterey             :: Monterey Tide Chart Today: Next High 08:00 PM
tide/isla-vista           :: Isla Vista Tide Chart Today: Next Low 03:00 AM
```

**15 of 18** noindexed `/water-temp/{city}` pages and **9 of 12** noindexed
`/tide/{city}` pages render a real, current measurement — and serve `noindex`.

The 3 + 3 that do not are state-level aggregations (`/water-temp/ma`,
`/water-temp/pr`, `/water-temp/tx`, `/tide/ca`, `/tide/ga`, `/tide/nh`) titled
"Water Temperature Spots in Massachusetts". They have no single reading, so they
correctly stay out. Leave them.

### 4. Conclusion

A `/water-temp/{city}` page is a **data readout**, not an editorial recommendation.
Gating "Corolla Water Temperature Today: 76°F" on hand-written local guidance is the
same category error `2a42b2443` already fixed for beach pages, whose comment at
`lib/seo/indexability.ts:293` states the principle: *forecast pages earn indexability
from the live forecast contract, not from the editorial review queue.*

A `/beginner/{city}` page **is** an editorial recommendation and should keep needing a
human behind it. That distinction is the whole plan.

---

## Scope

**Track A (Tasks 1-3, Codex):** `tide` and `water-temp` city intents earn indexability
from live city data. Unlocks 24 pages now and every future city automatically.

**Track B (no task):** the remaining 91 city-intent pages stay editorial-gated. See
"Track B" at the bottom — it is a decision for Steven, not work to dispatch.

---

## Task 1 — A data-intent indexability evaluator

**Files**
- Modify: `lib/seo/indexability.ts`
- Test: `__tests__/lib/seo/indexability.test.ts`

**Interfaces**
- Produces: `evaluateCityDataIntentIndexability(input, canonicalPath, availability)`
  → `IndexabilityDecision`, consumed by Tasks 2 and 3.

Editorial rejection must still win. A human who sets `seo_indexable = false` with a
review date is deliberately pulling a page; live data must not override that. Mirror
the ordering in `resolveIndexability` (`lib/seo/indexability.ts:257`), where
`editorialRejected` is checked before any approval path.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/seo/indexability.test.ts`:

```ts
import { evaluateCityDataIntentIndexability } from "@/lib/seo/indexability";

describe("evaluateCityDataIntentIndexability", () => {
  const noEditorial = null;

  it("indexes a water-temp city page with live data and no editorial row", () => {
    const decision = evaluateCityDataIntentIndexability(
      noEditorial,
      "/water-temp/corolla",
      { hasIntentData: true, dataRich: true },
    );
    expect(decision).toEqual({ indexable: true, reason: "forecast-approved" });
  });

  it("does not index when the city has no live reading", () => {
    expect(
      evaluateCityDataIntentIndexability(noEditorial, "/water-temp/ma", {
        hasIntentData: false,
        dataRich: true,
      }).indexable,
    ).toBe(false);
  });

  it("does not index when the city has no matching beaches", () => {
    expect(
      evaluateCityDataIntentIndexability(noEditorial, "/tide/nowhere", {
        hasIntentData: true,
        dataRich: false,
      }).indexable,
    ).toBe(false);
  });

  it("still honours an explicit editorial rejection", () => {
    const decision = evaluateCityDataIntentIndexability(
      {
        seoIndexable: false,
        seoReviewedAt: "2026-07-20T00:00:00Z",
        seoSources: [],
        description: null,
        intent: "water-temp",
        intro: null,
        localGuidance: null,
      },
      "/water-temp/corolla",
      { hasIntentData: true, dataRich: true },
    );
    expect(decision).toEqual({
      indexable: false,
      reason: "editorial-rejected",
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn test:unit __tests__/lib/seo/indexability.test.ts
```

Expected: FAIL — `evaluateCityDataIntentIndexability is not a function`.

- [ ] **Step 3: Implement**

In `lib/seo/indexability.ts`, after `evaluateCityEditorialIndexability`:

```ts
export interface CityDataIntentAvailability {
  /** The intent's own live dataset resolved to a real value this render. */
  hasIntentData: boolean;
  /** The city has beaches that make the intent meaningful. */
  dataRich: boolean;
}

/** Intents whose page value is a live measurement, not an editorial recommendation. */
export const DATA_BACKED_CITY_INTENTS = new Set(["tide", "water-temp"]);

export function isDataBackedCityIntent(intent: string | null | undefined): boolean {
  return Boolean(intent && DATA_BACKED_CITY_INTENTS.has(intent));
}

/**
 * Tide and water-temp city pages answer a question with a current number, so they
 * earn indexability from that number rather than from the editorial review queue.
 * An explicit editorial rejection still wins - a human pulling a page must not be
 * overridden by the presence of data.
 */
export function evaluateCityDataIntentIndexability(
  input: CityIntentEditorialInput | null,
  canonicalPath: string,
  availability: CityDataIntentAvailability,
): IndexabilityDecision {
  const rejected = Boolean(input?.seoReviewedAt && input.seoIndexable === false);
  if (rejected) {
    return { indexable: false, reason: "editorial-rejected" };
  }

  if (!availability.dataRich) {
    return { indexable: false, reason: "insufficient-data" };
  }

  if (!availability.hasIntentData) {
    return { indexable: false, reason: "forecast-missing" };
  }

  if (isGscPerformanceProtected(normalizeSeoPath(canonicalPath))) {
    return { indexable: true, reason: "gsc-protected" };
  }

  return { indexable: true, reason: "forecast-approved" };
}
```

Do not modify `evaluateCityEditorialIndexability` — the recommendation intents still
use it unchanged.

- [ ] **Step 4: Run the test — expect PASS**

```bash
yarn test:unit __tests__/lib/seo/indexability.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/seo/indexability.ts __tests__/lib/seo/indexability.test.ts
git commit -m "feat(seo): add data-backed city intent indexability evaluator"
```

---

## Task 2 — Route the intent page through it

**Files**
- Modify: `app/[intent]/[city]/page.tsx:368-385`
- Test: `__tests__/app/intent-city-indexability.test.ts` (create)

The page already fetches `tideDataForMeta` / `waterTempDataForMeta` at lines 308-322
and computes `dataRich` at 374-377. Reuse both — no new queries.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/intent-city-indexability.test.ts`. Follow the mocking style in
`__tests__/app/best-time-city-page.test.ts`.

```ts
it("indexes /water-temp/{city} with a live reading and no editorial row", async () => {
  // getCityWaterTempHistory -> { currentTemp: 76 }, getCityEditorialContent -> null
  const meta = await generateMetadata({
    params: Promise.resolve({ intent: "water-temp", city: "corolla" }),
  });
  expect(meta.robots).toBeUndefined();
});

it("keeps /beginner/{city} noindexed without an approved editorial row", async () => {
  const meta = await generateMetadata({
    params: Promise.resolve({ intent: "beginner", city: "corolla" }),
  });
  expect(meta.robots).toMatchObject({ index: false, follow: true });
});

it("noindexes /water-temp/{city} when no reading resolves", async () => {
  // getCityWaterTempHistory -> null, getCityIntentDataAvailability -> "missing"
  const meta = await generateMetadata({
    params: Promise.resolve({ intent: "water-temp", city: "ma" }),
  });
  expect(meta.robots).toMatchObject({ index: false, follow: true });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn test:unit __tests__/app/intent-city-indexability.test.ts
```

Expected: FAIL on the first case — the editorial evaluator rejects a city with no row.

- [ ] **Step 3: Implement**

Replace lines 378-385 of `app/[intent]/[city]/page.tsx`:

```ts
  const canonicalPath = `/${params.intent}/${canonicalCitySlug}`;
  const decision = isDataBackedCityIntent(params.intent)
    ? evaluateCityDataIntentIndexability(
        toCityEditorialInput(cityEditorial),
        canonicalPath,
        {
          hasIntentData:
            params.intent === "tide"
              ? tideDataForMeta != null
              : waterTempDataForMeta != null,
          dataRich,
        },
      )
    : evaluateCityEditorialIndexability(
        toCityEditorialInput(cityEditorial),
        params.intent,
        canonicalPath,
        dataRich,
      );

  return applyIndexabilityToMetadata(metadata, decision);
```

`hasIntentData` deliberately keys off the *resolved reading*, not
`intentDataAvailability` — the title already promises a number ("Corolla Water
Temperature Today: 76°F"), so the page should be indexable exactly when that number
exists.

- [ ] **Step 4: Run the test — expect PASS**

```bash
yarn test:unit __tests__/app/intent-city-indexability.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/\[intent\]/\[city\]/page.tsx __tests__/app/intent-city-indexability.test.ts
git commit -m "fix(seo): index tide and water-temp city pages on live data"
```

---

## Task 3 — Keep the sitemap in agreement

**Files**
- Modify: `app/sitemap.ts:621-647`
- Test: `__tests__/app/sitemap.test.ts`

`isCityRouteIndexable` currently sends every intent through the editorial evaluator, so
after Task 2 the sitemap would withhold pages the page now indexes — the inverse of the
sub-page bug. The record already carries `hasTideData` / `hasWaterTempData` (used at
lines 631-632), so the signal is in hand.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/app/sitemap.test.ts`:

```ts
it("includes a water-temp city page with data and no editorial row", async () => {
  const routes = await buildIntentRoutes(new Map());
  expect(routes.map((r) => r.url)).toContain(
    "https://www.quiversurf.app/water-temp/corolla",
  );
});

it("still withholds a beginner city page with no editorial row", async () => {
  const routes = await buildIntentRoutes(new Map());
  expect(routes.map((r) => r.url)).not.toContain(
    "https://www.quiversurf.app/beginner/corolla",
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn test:unit __tests__/app/sitemap.test.ts
```

- [ ] **Step 3: Implement**

In the `for (const intent of intents)` loop, branch on the intent kind:

```ts
          const canonicalPath = `/${intent}/${citySlug}`;
          const dataRich =
            cityRecord.beachCount >= 3 || cityRecord.hasEditorialContent;

          const indexable = isDataBackedCityIntent(intent)
            ? evaluateCityDataIntentIndexability(
                toCityEditorialInput(editorial),
                canonicalPath,
                {
                  hasIntentData:
                    intent === "tide"
                      ? cityRecord.hasTideData !== false
                      : cityRecord.hasWaterTempData !== false,
                  dataRich,
                },
              ).indexable
            : isCityRouteIndexable(editorial, intent, canonicalPath, dataRich);

          if (!indexable) continue;
```

The existing `continue` guards at lines 631-632 become redundant for these intents but
are harmless — leave them, they short-circuit earlier.

- [ ] **Step 4: Run the test — expect PASS**

```bash
yarn test:unit __tests__/app/sitemap.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts __tests__/app/sitemap.test.ts
git commit -m "fix(seo): include data-backed city intents in the sitemap"
```

---

## Verification before handing back

```bash
yarn typecheck
yarn test:unit __tests__/lib/seo __tests__/app/sitemap.test.ts __tests__/app/intent-city-indexability.test.ts
npx eslint --max-warnings=0 lib/seo/indexability.ts app/sitemap.ts "app/[intent]/[city]/page.tsx"
yarn build
```

Acceptance check on a local prod build — sitemap and page must agree, and the
recommendation intents must NOT move:

```bash
yarn start &
BASE=http://127.0.0.1:3000
curl -s $BASE/water-temp/corolla   | grep -o '<meta name="robots" content="[^"]*"'   # expect index, follow
curl -s $BASE/tide/monterey        | grep -o '<meta name="robots" content="[^"]*"'   # expect index, follow
curl -s $BASE/water-temp/ma        | grep -o '<meta name="robots" content="[^"]*"'   # expect noindex (state aggregation)
curl -s $BASE/beginner/corolla     | grep -o '<meta name="robots" content="[^"]*"'   # expect noindex (editorial, unchanged)
curl -s $BASE/sitemap.xml | grep -c 'water-temp/'                                    # expect an increase
```

## Definition of done

- [ ] Three commits on `codex/seo-city-data-intent-20260809`, branched from `origin/main`
- [ ] `yarn typecheck`, scoped eslint, and the three suites green
- [ ] `/water-temp/{city}` and `/tide/{city}` with live data index; sitemap agrees
- [ ] `/beginner`, `/longboard`, `/dawn-patrol`, `/least-crowded`, `/sunset` unchanged
- [ ] State-level aggregations (`/water-temp/ma`, `/tide/ca`) still noindex
- [ ] No database writes; no `editorial_sources` created or modified

## Hard constraints

- **No database writes.** No migration, no backfill, no seed.
- **Do not invent `editorial_sources`.** That column attests a human retrieved a real
  source.
- Do not change `evaluateCityEditorialIndexability` or the recommendation intents.
- Do not touch the beach sub-page path — a separate branch
  (`codex/seo-subpage-indexability-20260809`) is in flight there. Expect a conflict in
  `app/sitemap.ts` at merge; that is known and will be resolved at integration.
- Do not push, open a PR, or merge.

---

## Track B — the remaining 91 pages (decision, not a task)

After Track A, the still-noindexed city pages are:

| Bucket | Pages | Recommendation |
|---|---:|---|
| `/best-time-to-surf/{city}` | 30 | **Hold.** The 52 already-indexed ones drew 28,169 impressions and 105 clicks — 0.37% CTR, 27% of all impressions for 11% of clicks. `/best-time-to-surf/la-jolla` alone took 18,174 impressions at position 7.9 for **7 clicks** (0.04%). Indexing 30 more adds impressions to a surface that does not convert. The problem here is page quality and query match, not indexability. |
| Recommendation intents (beginner, longboard, dawn-patrol, least-crowded, sunset) | 53 | **Hold.** 21 indexed pages of this type produced 35 clicks in four weeks. 53 sourced editorial rows is days of authoring for a plausible few dozen clicks a month. |
| State aggregations (`/water-temp/ma`, `/tide/ca`, …) | 6 | **Leave noindex.** No single reading to stand behind. |
| State/city hubs (`/ca/bodega-bay`) | 38 | Separate `city-location` family; 17 indexed peers drew 3,745 impressions / 41 clicks. Low priority. |

If editorial authoring is wanted anyway, the honest unit of work is: one city × intent
row, with `seo_intro` and `seo_local_guidance` written for that specific place, and
`editorial_sources` containing URLs that were **actually opened and read** on the
recorded `retrievedAt` date. The `rosarito / general` row is the shape to copy. That is
a research task per city, not a generation task, and it cannot be batched by a model
without fabricating the provenance the column exists to record.

**The higher-value SEO work is not indexing more pages.** It is the 0.37% CTR on
best-time-to-surf — 28,169 impressions already being served that convert at a tenth of
the water-temp rate. That is a title, snippet, and content-match problem worth its own
investigation.
