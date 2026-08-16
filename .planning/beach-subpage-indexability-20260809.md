# Beach sub-page indexability: align with the forecast contract

**Date:** 2026-08-09
**Status:** Ready for Codex
**Origin:** GSC "Excluded by 'noindex' tag" drilldown, 588 pages, 2026-08-09

---

## Goal

Stop the live sitemap from submitting 692 URLs that the pages themselves serve as
`noindex`. Beach `tides` and `water-temp` sub-pages must earn indexability from the
same live-forecast contract their parent hub and the sitemap already use, instead of
the editorial review queue.

## Why this is a bug fix, not a policy change

`2a42b2443 feat: establish public forecast authority` (2026-08-09, on `origin/main`
and on prod) moved two of the three places that decide beach indexability onto the
forecast contract:

| Surface | Decider | Source |
|---|---|---|
| Beach hub `/ca/la-jolla/windansea` | `evaluateBeachForecastIndexability` | `app/[intent]/[city]/[beachSlug]/page.tsx:478` |
| Sitemap entry for hub **and both sub-pages** | `isBeachForecastIndexableForSitemap` | `app/sitemap.ts:359-381` |
| **Sub-page `/…/tides`, `/…/water-temp`** | **`evaluateBeachIndexability` (editorial)** | **`lib/utils/beach-sub-page-utils.tsx:479`** |

The third was left behind. The result is a self-contradiction that is live right now:

```
$ curl -s https://www.quiversurf.app/sitemap.xml | grep -c '\(tides\|water-temp\)</loc>'
692

$ curl -s https://www.quiversurf.app/nj/ocean-city/1st-street-jetty-ocean-city-nj/tides \
    | grep -o '<meta name="robots" content="[^"]*"'
<meta name="robots" content="noindex, follow"
```

The sitemap tells Google to index 692 URLs; each one answers `noindex`. That is the
mechanism behind the GSC report (its own metadata reads `Sitemap: All known pages`),
and it is why the count stepped 31 → 372 → 550 → 588 as the gate rolled out.

## Why the editorial route is the wrong fix

The editorial gate (`lib/seo/indexability.ts:186`) requires, per beach:
`editorial_reviewed_at` + `seo_indexable = true` + at least one `editorial_sources`
entry with url/publisher/retrievedAt + `description` + one of
`crowd_tips`/`wave_tips`/`best_conditions_prose`.

Measured against production on 2026-08-09:

- 346 beaches total
- 336 already satisfy the **content** half (description + ≥1 tip)
- **7** have any valid `editorial_sources` row — `alfonsos`, `el-morro-point-k375`,
  `k-38`, `las-gaviotas`, `renes`, `rosarito-beach`, `teresas`. All Baja California,
  all reviewed 2026-07-20.
- 0 US beaches are editorially approved.

So the only missing ingredient for the other 329 is a **citation**. Backfilling that
column means writing 329 source attributions that nobody retrieved — fabricated
provenance in the one field whose entire purpose is to attest that a human checked a
real source. Not doing that. It is also unnecessary:

- `tide_forecasts` has next-24h rows for **346 / 346** beaches
- `enhanced_forecasts.water_temp` has today's rows for **346 / 346** beaches

These are data pages backed by real measurements. They should earn indexability the
way `lib/seo/indexability.ts:293` already argues forecast pages do — *"Forecast pages
earn indexability from the live forecast contract, not from the editorial review
queue. Editorial quality is enforced separately so a bad paragraph cannot take a
useful, current forecast out of the catalog."*

## Scope

### In scope
Beach `tides` and `water-temp` sub-pages for US and Mexico beaches — 357 of the 588
reported URLs (191 tides + 166 water-temp).

### Out of scope — with reasons

| Bucket | Count | Why it stays |
|---|---|---|
| Beach hubs | 39 | Already fixed live by `2a42b2443`; verified `index, follow`. Stale GSC rows, clear on recrawl. |
| Mexico pages | 5 | Already `index, follow` live. Stale GSC rows. |
| `/map?search=`, `/map?lat=` | 26 | Deliberate — `app/map/page.tsx:44` noindexes parameterized views. Correct. |
| City-intent (`/longboard/lihue`, `/beginner/*`, `/best-time-to-surf/*`) | 115 | Real editorial gap: `city_editorial_content` has 9 rows, 1 approved. Needs written intros + local guidance + sources. Separate track, not a backfill. |
| State/city hubs (`/ca/bodega-bay`) | 38 | Same city-editorial gap. |
| `/beaches/**` geo hubs | 6 | Separate route family. |

Also stale and self-clearing: **61** of the 588 are in
`lib/seo/gsc-performance-protection.v1.json` and already serve `index, follow` live.
No action.

---

## Task 1 — Share one predicate between sitemap and sub-page

**Files**
- Modify: `lib/seo/forecast-indexability.ts`
- Modify: `app/sitemap.ts:388-400`
- Test: `__tests__/lib/seo/forecast-indexability.test.ts`

The sitemap and the page must never disagree again. Extract the sitemap's predicate
into one exported helper and have both call it.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/lib/seo/forecast-indexability.test.ts`:

```ts
import { isBeachSubPageIndexable } from "@/lib/seo/forecast-indexability";

describe("isBeachSubPageIndexable", () => {
  const fresh = {
    forecastAvailable: true,
    selectedStateComplete: true,
    forecastFresh: true,
  };

  it("indexes a tides sub-page when the forecast contract passes and tide data exists", () => {
    expect(
      isBeachSubPageIndexable(fresh, "/ca/la-jolla/windansea/tides", {
        hasSubPageData: true,
      }),
    ).toBe(true);
  });

  it("does not index when the sub-page has no data of its own", () => {
    expect(
      isBeachSubPageIndexable(fresh, "/ca/la-jolla/windansea/tides", {
        hasSubPageData: false,
      }),
    ).toBe(false);
  });

  it("does not index when the forecast is stale", () => {
    expect(
      isBeachSubPageIndexable(
        { ...fresh, forecastFresh: false },
        "/ca/la-jolla/windansea/tides",
        { hasSubPageData: true },
      ),
    ).toBe(false);
  });

  it("does not index a legacy /beach/ canonical", () => {
    expect(
      isBeachSubPageIndexable(fresh, "/beach/windansea/tides", {
        hasSubPageData: true,
      }),
    ).toBe(false);
  });

  it("returns false when there is no snapshot", () => {
    expect(
      isBeachSubPageIndexable(undefined, "/ca/la-jolla/windansea/tides", {
        hasSubPageData: true,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn test:unit __tests__/lib/seo/forecast-indexability.test.ts
```

Expected: FAIL — `isBeachSubPageIndexable is not a function`.

- [ ] **Step 3: Implement the shared helper**

In `lib/seo/forecast-indexability.ts`:

```ts
import { evaluateBeachForecastIndexability } from "./indexability";

export interface SubPageDataAvailability {
  /** The sub-page's own dataset resolved to a real value this render. */
  hasSubPageData: boolean;
}

/**
 * One predicate for beach tides/water-temp sub-pages, called by BOTH the sitemap
 * and generateMetadata. Keeping a single decider is the point: a sitemap entry
 * whose page answers `noindex` is the bug this replaces.
 */
export function isBeachSubPageIndexable(
  snapshot: ForecastIndexabilitySnapshot | undefined,
  canonicalPath: string,
  availability: SubPageDataAvailability,
): boolean {
  if (!snapshot) return false;
  if (!availability.hasSubPageData) return false;

  return evaluateBeachForecastIndexability({
    canonicalValid: !canonicalPath.startsWith("/beach/"),
    forecastAvailable: snapshot.forecastAvailable,
    selectedStateComplete: snapshot.selectedStateComplete,
    forecastFresh: snapshot.forecastFresh,
  }).indexable;
}
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
yarn test:unit __tests__/lib/seo/forecast-indexability.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/seo/forecast-indexability.ts __tests__/lib/seo/forecast-indexability.test.ts
git commit -m "feat(seo): add shared beach sub-page indexability predicate"
```

---

## Task 2 — Route sub-page metadata through the forecast contract

**Files**
- Modify: `lib/utils/beach-sub-page-utils.tsx:472-499`
- Test: `__tests__/lib/utils/beach-sub-page-indexability.test.ts` (create)

**Interfaces**
- Consumes: `isBeachSubPageIndexable` from Task 1;
  `getForecastIndexabilityForBeaches` (existing, `lib/seo/forecast-indexability.ts:125`)
- Produces: nothing new — this is the call-site swap

The function already fetches `tideMeta` / `tempMeta` for the title and description
(lines 436-470). Reuse those values for `hasSubPageData` — they are `React.cache()`d,
so no extra query.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/utils/beach-sub-page-indexability.test.ts`. Mock the Supabase
service-role client and the two meta helpers; assert on the returned `robots`.

```ts
import { generateBeachSubPageMetadata } from "@/lib/utils/beach-sub-page-utils";

jest.mock("@/lib/seo/tide-meta-data", () => ({
  getTideMetaData: jest.fn(),
}));
jest.mock("@/lib/seo/forecast-indexability", () => ({
  ...jest.requireActual("@/lib/seo/forecast-indexability"),
  getForecastIndexabilityForBeaches: jest.fn(),
}));

// Beach fixture deliberately has NO editorial_sources and seo_indexable = false —
// the exact shape of all 339 US beaches in production. It must still index.
const UNREVIEWED_BEACH = {
  id: "beach-1",
  slug: "windansea",
  name: "Windansea",
  city: "La Jolla",
  state: "California",
  country: "USA",
  lat: 32.83,
  lon: -117.28,
  description: "A reef break in La Jolla.",
  wave_tips: "Best on a west swell.",
  crowd_tips: null,
  best_conditions_prose: null,
  seo_indexable: false,
  editorial_reviewed_at: null,
  editorial_sources: null,
};

it("indexes an unreviewed beach's tides page when the forecast contract passes", async () => {
  // arrange: fresh snapshot + real tide times
  const meta = await generateBeachSubPageMetadata({
    beachSlug: "windansea",
    pageType: "tides",
    beachPath: "/ca/la-jolla/windansea",
  });
  expect(meta.robots).toBeUndefined();
});

it("noindexes when the beach has no tide data", async () => {
  // arrange: snapshot fresh, getTideMetaData returns all nulls
  const meta = await generateBeachSubPageMetadata({
    beachSlug: "windansea",
    pageType: "tides",
    beachPath: "/ca/la-jolla/windansea",
  });
  expect(meta.robots).toMatchObject({ index: false, follow: true });
});
```

Follow the mocking style already used in
`__tests__/app/generic-beach-detail-resolution.test.ts` — match it rather than
inventing a new harness.

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn test:unit __tests__/lib/utils/beach-sub-page-indexability.test.ts
```

Expected: FAIL on the first case — `robots` is `{ index: false }` because the
editorial evaluator rejects the unreviewed beach. That failure *is* the production bug.

- [ ] **Step 3: Swap the evaluator**

In `lib/utils/beach-sub-page-utils.tsx`, replace lines 479-483:

```ts
    const decision = evaluateBeachIndexability(
      toBeachEditorialInput(beach as BeachEditorialDatabaseRecord),
      subPagePath,
    );
    return applyIndexabilityToMetadata(metadata, decision);
```

with:

```ts
    const snapshots = await getForecastIndexabilityForBeaches([
      { id: beach.id, timezone: beach.timezone ?? null },
    ]);
    const hasSubPageData =
      pageType === "tides"
        ? Boolean(tideMetaForIndexing?.nextHighTime || tideMetaForIndexing?.nextLowTime)
        : tempMetaForIndexing?.tempF != null;

    const indexable = isBeachSubPageIndexable(
      snapshots.get(beach.id),
      subPagePath,
      { hasSubPageData },
    );
    return applyIndexabilityToMetadata(metadata, {
      indexable,
      reason: indexable ? "forecast-approved" : "forecast-missing",
    });
```

Hoist `tideMeta` / `tempMeta` out of the `try` block at lines 436-470 into
`tideMetaForIndexing` / `tempMetaForIndexing` declared alongside `title` and
`description` so they are in scope here. On the catch path they stay `null`, which
correctly yields `hasSubPageData: false` → noindex.

Update the imports: drop `evaluateBeachIndexability`, `toBeachEditorialInput`, and
`BeachEditorialDatabaseRecord` if nothing else in the file uses them; add
`isBeachSubPageIndexable` and `getForecastIndexabilityForBeaches`.

Leave the `config.fallbackMetadata` branch at lines 486-499 exactly as it is — a beach
that does not resolve should stay `noindex`.

- [ ] **Step 4: Run the test — expect PASS**

```bash
yarn test:unit __tests__/lib/utils/beach-sub-page-indexability.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/utils/beach-sub-page-utils.tsx __tests__/lib/utils/beach-sub-page-indexability.test.ts
git commit -m "fix(seo): index beach sub-pages on the forecast contract, not editorial review"
```

---

## Task 3 — Make the sitemap use the same predicate

**Files**
- Modify: `app/sitemap.ts:326-400`
- Test: `__tests__/app/sitemap.test.ts`

Today `buildBeachRoutes` emits both sub-pages whenever the hub is forecast-indexable,
with no per-sub-page data condition. After Task 2 a beach with a fresh forecast but no
tide rows would be in the sitemap and `noindex` on the page — the same class of bug,
just rarer. Close it.

Precedent for the shape: `app/sitemap.ts:632` already does
`if (intent === "water-temp" && cityRecord.hasWaterTempData === false) continue;`
for city pages.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/app/sitemap.test.ts`:

```ts
it("omits a tides sub-page when the beach has no tide coverage", () => {
  const routes = buildBeachRoutes(
    [BEACH_WITH_FRESH_FORECAST],
    new Map([[BEACH_WITH_FRESH_FORECAST.id, FRESH_SNAPSHOT]]),
    { tideCoverage: new Set<string>(), waterTempCoverage: new Set([BEACH_WITH_FRESH_FORECAST.id]) },
  );
  const urls = routes.map((r) => r.url);
  expect(urls).not.toContain(
    "https://www.quiversurf.app/ca/la-jolla/windansea/tides",
  );
  expect(urls).toContain(
    "https://www.quiversurf.app/ca/la-jolla/windansea/water-temp",
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn test:unit __tests__/app/sitemap.test.ts
```

Expected: FAIL — `buildBeachRoutes` takes two arguments and emits both sub-pages.

- [ ] **Step 3: Implement**

Add a third parameter to `buildBeachRoutes` carrying per-beach sub-page coverage,
default it so existing callers keep compiling, and gate each sub-page on
`isBeachSubPageIndexable(snapshot, subPagePath, { hasSubPageData })`.

Populate the coverage sets in `sitemap()` alongside the existing
`getForecastIndexabilityForBeaches(...)` call at line 165: one query for distinct
`tide_forecasts.beach_id` in the next 24h, one for distinct
`enhanced_forecasts.beach_id` with a non-null `water_temp` today. Both tables
currently cover 346/346 beaches, so this is a guard, not a filter.

Keep `isBeachForecastIndexableForSitemap` for the hub route — the hub does not have a
sub-page dataset.

- [ ] **Step 4: Run the test — expect PASS**

```bash
yarn test:unit __tests__/app/sitemap.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts __tests__/app/sitemap.test.ts
git commit -m "fix(seo): gate sitemap sub-page entries on sub-page data coverage"
```

---

## Verification before handing back

```bash
yarn typecheck
yarn test:unit __tests__/lib/seo __tests__/lib/utils __tests__/app/sitemap.test.ts
npx eslint --max-warnings=0 lib/seo/forecast-indexability.ts lib/utils/beach-sub-page-utils.tsx app/sitemap.ts
yarn build
```

Then, on a local prod build, prove the contradiction is gone. This is the acceptance
check — a sitemap URL and its page must agree:

```bash
yarn start &
BASE=http://127.0.0.1:3000
curl -s $BASE/sitemap.xml | grep -o '<loc>[^<]*tides</loc>' | head -3
curl -s $BASE/nj/ocean-city/1st-street-jetty-ocean-city-nj/tides \
  | grep -o '<meta name="robots" content="[^"]*"'
```

Expected: the URL appears in the sitemap **and** the page returns
`index, follow`. Today it returns `noindex, follow`.

Also confirm nothing regressed on the editorial side — the 7 Baja beaches must stay
indexable, and an unresolvable beach slug must stay `noindex`.

## Definition of done

- [ ] Three commits on `codex/seo-subpage-indexability-20260809`, branched from `origin/main`
- [ ] `yarn typecheck`, scoped eslint, and the three unit suites green
- [ ] Local prod build shows sitemap and page agreeing for a US beach sub-page
- [ ] No change to `beaches.seo_indexable`, `editorial_reviewed_at`, or
      `editorial_sources` — **no database writes in this task at all**
- [ ] No new `editorial_sources` values invented anywhere

## Hard constraints

- **Do not write to the database.** No migration, no backfill script, no seed.
- **Do not invent `editorial_sources`.** That field attests a human retrieved a real
  source. Fabricating it is the failure mode this plan exists to avoid.
- Do not touch the city-intent or state/city editorial path — that is a separate track
  with a real content gap.
- Do not weaken `evaluateBeachIndexability` itself; other callers still rely on it.
- Do not push, open a PR, or merge. Leave the branch local for review.
