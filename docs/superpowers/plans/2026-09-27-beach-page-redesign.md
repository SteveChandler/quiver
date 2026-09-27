# Beach Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the public beach page (`/ca/san-diego/tourmaline` and every `/[state]/[city]/[beach]`) as a visual-first page. One page answers both surfers and beachgoers. It has a cam-first hero, a public surf call, Watch and Share, and a visual hourly chart, beach-day facts and week.

**Architecture:**
- **The page server** keeps loading the report, photo, cam URL, water quality and nearby beaches as today. It adds water temperature and tide meta for the hero, computes the public surf call on the server (hold-safe), and passes serializable props down.
- **`BeachDetail`** gains `layout="visual"`. In that mode the zine shell and its Overview and Forecast tabs give way to a visual shell:
  - page-provided top sections (hero, actions, hourly chart, beach day)
  - a week built from the client's existing 10-day forecast fetch
  - nearby spots
  - the community tabs (Reviews, Local intel, Sessions)
  - an About block with every piece of indexable text kept
- **Shared parts** (hero media options, the public call, Watch and Share) are built so the planning home can reuse them later.

**Tech Stack:** Next.js App Router (server page and client components), React, TypeScript, Tailwind, Supabase, Jest with React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-beach-page-redesign-design.md`. The companion spec `docs/superpowers/specs/2026-09-27-web-planning-home-design.md` shares the visual parts. Mockup: `docs/superpowers/specs/2026-09-27-beach-page-redesign/beach-page.jpg`.

**Deviations from the spec, decided while planning:**
1. **Where the call is computed.** The public call is computed on the server from the full report (`getPublicSurfCall`). `selectPublicForecastReportFacts` isn't widened, so nothing new crosses the server/client boundary.
2. **No window strip.** The hero's morning / midday / afternoon strip is deferred. The public page has one best window, not per-window tiers.
3. **No separate tide curve.** The beach-day column's tide curve folds into the hourly chart's tide line; the column shows the next low and high as text.
4. **Static week cards.** They aren't interactive, so there's no `beach_week_day_selected` event.
5. **Visible breadcrumb.** The visual layout renders the existing `BeachBreadcrumb`, which isn't rendered on the page today, so visitors get real crumbs with links.

**Out of this plan:** the native Watch action on the app's selected-window sheet. It gets its own plan in `quiver-native`. Until it ships, `NATIVE_SELECTED_WINDOW_WATCH` stays `false` and the signed-out button reads "Open in the app" (Task 7).

## Global Constraints

**Repo rules and process**
- Follow `soul.md`. Use TypeScript-first explicit types on exported function signatures, early returns, no empty `catch` blocks, 2-space indent, and double quotes in components.
- Branch from `origin/main` as `feat/beach-page-visual`. Reuse an existing clean worktree per `worktree-lifecycle` (budget of 2–3); don't create a new one if a clean one exists. Never push to `main` or `prod`.
- Commit messages are conventional (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`). Keep commits atomic. The executor commits per task; pushing and PRs need Steven.

**Tests**
- Mocked unit tests only. No live Supabase, Resend or paid APIs in unit tests.
- Run env-sensitive suites with `CI=true` and blank local env vars before calling them green (memory: CI has no local `.env`).

**Surf call and safety**
- The public surf call uses the same words as home: `getCanonicalVerdictCall` (`components/forecast/score-band-call.ts`), mapping `YES → go`, `MAYBE → maybe`, `NO → no`. It's labelled "for most surfers".
- When `recommendationAvailability.state === "none"`, show "No call today" plus a reason. Never a positive word.
- Never show "Clean" for water quality. Show only an advisory or closure (`lib/services/water-quality/current-status.ts:48`, `:79-80`).
- The week shows no per-day water temperature. Future rows carry the current reading or a latitude estimate.

**What to keep and what to retire**
- Keep unchanged: page title, description, canonical, `BeachPageStructuredData`, `BreadcrumbStructuredData`, `FAQSchema`, `WebPageSchema` and `LiveCamSchema`.
- The H1 keeps its words, `"{name} Surf Forecast"` plus ` for {Weekday, Month D, YYYY}` unless `?window` or `?date` is present.
- Every piece of indexable text stays in the server HTML: the forecast answer facts, provenance lines, editorial prose, amenities, FAQ, hourly table, and nearby and guide links.
- Retire on the visual layout: `StickySignupBar`, `ContentPageAppHandoffCta` (after hourly), `BeachDetailInstallCta`, and the zine hero's "Spot photo, map & camera" disclosure.
- The global header's "Get the app" button stays.

**Analytics**
- New client events go through `captureClientPostHogEventAfterConsent` (`lib/posthog-client.ts:244`) and are named `beach_hero_viewpoint_changed` and `beach_share_opened`.
- Signed-out Watch reuses `trackAppHandoffView` and `trackAppHandoffLinkOpened` with `placement: "beach_watch"`.

**Photos and data rules**
- Photo rule: a hero photo must be a real photo of this beach. No stock images. A photo that fails to load drops out of the hero.
- Web and app contracts stay additive. `POST /api/alerts/rules` is unchanged. Web watches use `sourceSurface: "beach_detail"` and `mode: "beach-detail"`, both already accepted by `validateConditionAlertInput`.

## Review Focus

1. **A held beach whose raw verdict is YES** must render "No call today" and the hold reason, never "Good" or "Worth a surf". Pinned in Task 1 (`getPublicSurfCall`) and Task 8 (hero render).
2. **A beach with no cam, a dead photo URL, or no coordinates** must still show a hero. A dead photo falls back to the next viewpoint, and no coordinates plus no media shows the plain panel without a broken `<img>`. Pinned in Task 2.
3. **A low tide at 11:40pm local time** (already the next day in UTC) must land on the local day, not the next card. Pinned in Task 3.
4. **A signed-in free user watching a beach that isn't their home beach** gets a 403 from the rules route. They must see the app sheet with the server's message, never a dead button or a silent failure. Pinned in Task 7.
5. **Missing data** (no water temperature, no tide meta, no best window, `score: null`) must render no "null", "NaN" or empty "—" labels. Items with no value are omitted, and Watch is hidden without a future best window. Pinned in Tasks 6, 7 and 8.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/utils/public-surf-call.ts` (new) | The surf call for signed-out visitors, from the hold-sanitized report |
| `lib/utils/beach-forecast-heading.ts` (new) | H1 text shared by the hero and `PublicForecastAnswer` |
| `components/oracle/zine/home-hero-media.tsx` (modify) | Viewpoint priority, storage key, change callback, aspect override, photo-failure fallback |
| `lib/utils/horizon-strip-utils.ts` (modify) | `DaySummary.bestForecastAt` (additive) |
| `lib/utils/beach-week.ts` (new) | 7-day week model: tier, size, swell glyph input, local-day low tide, early flag |
| `components/beach-detail/visual/swell-glyph.tsx` (new) | SVG glyph of one day's primary swell |
| `components/beach-detail/visual/beach-week.tsx` (new) | Week cards |
| `lib/utils/beach-hourly-chart.ts` (new) | Hourly chart model from the server's public hourly rows |
| `components/beach-detail/visual/beach-hourly-chart.tsx` (new) | SVG chart: surf bars, tide line, wind arrows, best window |
| `components/beach-detail/visual/beach-day-column.tsx` (new) | Water, tides, daylight, advisory |
| `lib/alerts/beach-watch.ts` (new) | Watch window selection, `watched_call` rule body, app link |
| `lib/constants/app-capabilities.ts` (new) | `NATIVE_SELECTED_WINDOW_WATCH` switch shared with the native release |
| `components/beach-detail/visual/beach-actions.tsx` (new) | Watch and Share buttons, app sheet with QR |
| `components/beach-detail/visual/beach-visual-hero.tsx` (new) | Hero card: safety strip, media, H1, two answer panels |
| `components/beach-detail/visual/beach-visual-shell.tsx` (new) | Page width and stage for the visual layout |
| `components/beach-detail/zine/zine-about-spot.tsx` (new) | Skill, break, rating, reviews and prose, extracted from `zine-hero.tsx` |
| `components/beach-detail/beach-tabs.tsx` (modify) | `visibleTabs` prop |
| `components/beach-detail.tsx` (modify) | `layout="visual"`, `visualTop`, week, limited tabs |
| `components/beach-detail/public-forecast-answer.tsx` (modify) | Shared heading helper; optional `title` |
| `app/beach/[slug]/beach-detail-client.tsx` (modify) | Pass `layout` and `visualTop` through |
| `app/[intent]/[city]/[beachSlug]/page.tsx` (modify) | Compose the visual page |
| `e2e/guest-anonymous-cta-reduction.spec.ts`, `e2e/usage-critical.spec.ts`, `e2e/prod-readonly/guest-ui.spec.ts` (modify) | New signed-out contract |
| `components/beach-detail/ARCHITECTURE.md` (modify) | Document the visual layout |

---

### Task 1: Public surf call

**Files:**
- Create: `lib/utils/public-surf-call.ts`
- Test: `__tests__/lib/utils/public-surf-call.test.ts`

**Interfaces:**
- Consumes:
  - `getCanonicalVerdictCall(verdict, score, tense)` from `components/forecast/score-band-call.ts`
  - `SurfCallVerdict = 'YES' | 'MAYBE' | 'NO'` from `lib/utils/surf-call-logic.ts`
  - `RecommendationAvailability` and `RecommendationHoldReasonCode` from `lib/recommendations/major-event-hold/types.ts`
- Produces:
  - `type PublicSurfCall = { kind: "call"; label: ScoreLabel; action: string } | { kind: "no_call"; reason: string } | { kind: "unknown" }`
  - `interface PublicSurfCallInput { verdict: SurfCallVerdict | null | undefined; score: number | null | undefined; availability: RecommendationAvailability | null | undefined; isTomorrow: boolean }`
  - `getPublicSurfCall(input: PublicSurfCallInput): PublicSurfCall`
  - `PUBLIC_HOLD_REASONS: Record<RecommendationHoldReasonCode, string>`

The spec said to add `verdict` and `score` to `selectPublicForecastReportFacts`. This plan computes the call on the server from the full report instead, and passes only `PublicSurfCall` down. The public facts filter stays untouched and nothing new crosses the boundary.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
import { getPublicSurfCall, PUBLIC_HOLD_REASONS } from "@/lib/utils/public-surf-call";

const AVAILABLE = { state: "available" as const, holdEpoch: "e1" };

describe("getPublicSurfCall", () => {
  it("speaks home's vocabulary for a go call", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 82, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "GOOD", action: "Worth a surf" });
  });

  it("picks the tier inside the maybe band from the score", () => {
    expect(getPublicSurfCall({ verdict: "MAYBE", score: 60, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "FAIR", action: "Worth a look" });
    expect(getPublicSurfCall({ verdict: "MAYBE", score: 45, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "RIDEABLE", action: "Slim pickings" });
  });

  it("never lets a score contradict the verdict", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 50, availability: AVAILABLE, isTomorrow: false }))
      .toMatchObject({ label: "GOOD" });
    expect(getPublicSurfCall({ verdict: "NO", score: 90, availability: AVAILABLE, isTomorrow: false }))
      .toEqual({ kind: "call", label: "MEH", action: "Skip it" });
  });

  it("uses planning words when the window is tomorrow", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 75, availability: AVAILABLE, isTomorrow: true }))
      .toEqual({ kind: "call", label: "GOOD", action: "Worth planning" });
  });

  it("falls back to the verdict's band when the score is missing", () => {
    expect(getPublicSurfCall({ verdict: "MAYBE", score: null, availability: AVAILABLE, isTomorrow: false }))
      .toMatchObject({ label: "RIDEABLE" });
  });

  it("shows a hold, never a positive word, even when the raw verdict is YES", () => {
    const held = { state: "none" as const, reasonCode: "water_quality_hold" as const, holdEpoch: "h1" };
    expect(getPublicSurfCall({ verdict: "YES", score: 88, availability: held, isTomorrow: false }))
      .toEqual({ kind: "no_call", reason: PUBLIC_HOLD_REASONS.water_quality_hold });
  });

  it("treats a hold without a reason as unavailable", () => {
    expect(getPublicSurfCall({ verdict: "YES", score: 88, availability: { state: "none", holdEpoch: "h2" }, isTomorrow: false }))
      .toEqual({ kind: "no_call", reason: PUBLIC_HOLD_REASONS.hold_state_unavailable });
  });

  it("is unknown when there is no report", () => {
    expect(getPublicSurfCall({ verdict: null, score: null, availability: null, isTomorrow: false }))
      .toEqual({ kind: "unknown" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/lib/utils/public-surf-call.test.ts`
Expected: FAIL with `Cannot find module '@/lib/utils/public-surf-call'`

- [ ] **Step 3: Write the implementation**

```ts
import { getCanonicalVerdictCall } from "@/components/forecast/score-band-call";
import type {
  RecommendationAvailability,
  RecommendationHoldReasonCode,
} from "@/lib/recommendations/major-event-hold/types";
import type { ScoreLabel } from "@/lib/utils/score-color-utils";
import type { SurfCallVerdict } from "@/lib/utils/surf-call-logic";

/**
 * The beach page's call for everyone, signed in or not: home's words, not
 * personalized. The report has already been through the major-event hold
 * check (`getSpotSurfReportPublic`), so a held window arrives as state "none".
 */
export type PublicSurfCall =
  | { kind: "call"; label: ScoreLabel; action: string }
  | { kind: "no_call"; reason: string }
  | { kind: "unknown" };

export interface PublicSurfCallInput {
  verdict: SurfCallVerdict | null | undefined;
  score: number | null | undefined;
  availability: RecommendationAvailability | null | undefined;
  isTomorrow: boolean;
}

const CANONICAL_VERDICT = { YES: "go", MAYBE: "maybe", NO: "no" } as const;

export const PUBLIC_HOLD_REASONS: Record<RecommendationHoldReasonCode, string> = {
  major_event_hold: "A big swell or storm is running, so there's no call here right now.",
  water_quality_hold: "There's a water-quality advisory here, so there's no call until it clears.",
  hold_state_unavailable: "We can't confirm conditions right now, so there's no call.",
};

export function getPublicSurfCall(input: PublicSurfCallInput): PublicSurfCall {
  if (input.availability?.state === "none") {
    const reasonCode = input.availability.reasonCode ?? "hold_state_unavailable";
    return { kind: "no_call", reason: PUBLIC_HOLD_REASONS[reasonCode] };
  }
  if (!input.verdict) return { kind: "unknown" };

  const call = getCanonicalVerdictCall(
    CANONICAL_VERDICT[input.verdict],
    input.score,
    input.isTomorrow ? "upcoming" : "now",
  );
  return { kind: "call", label: call.label, action: call.action };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/lib/utils/public-surf-call.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add lib/utils/public-surf-call.ts __tests__/lib/utils/public-surf-call.test.ts
git commit -m "feat(beach): public surf call in home's vocabulary, hold-safe"
```

---

### Task 2: Hero media options for the beach page

**Files:**
- Modify: `components/oracle/zine/home-hero-media.tsx`
- Test: `__tests__/components/oracle/home-hero-media.test.tsx` (extend)

**Interfaces:**
- Produces, all new props optional so home's behavior is unchanged:
  - `export type HeroViewpoint = "swell" | "satellite" | "photo" | "cam"`
  - `viewpointPriority?: readonly HeroViewpoint[]`, the order to try when nothing is remembered. Default `["swell", "satellite", "photo", "cam"]`, which is today's behavior.
  - `storageKey?: string`, default `"quiver:home-hero-viewpoint"`
  - `onViewpointChange?: (viewpoint: HeroViewpoint) => void`
  - `aspectClassName?: string`, default `"aspect-[4/5] sm:aspect-[16/10]"`
  - Photo load failure: the photo leaves `available`, and the card falls through to the next priority.

- [ ] **Step 1: Write the failing tests.** Append inside `describe("HomeHeroMedia", …)`:

```tsx
  it("opens on the first available viewpoint in the given priority", () => {
    renderMedia({
      sources: { camera_url: "https://example.com/cam.m3u8" },
      viewpointPriority: ["cam", "photo", "swell", "satellite"],
      storageKey: "quiver:beach-hero-viewpoint",
    });
    expect(screen.getByTestId("home-hero-media")).toHaveAttribute("data-viewpoint", "cam");
  });

  it("skips a missing cam and lands on the photo", () => {
    renderMedia({ viewpointPriority: ["cam", "photo", "swell", "satellite"] });
    expect(screen.getByTestId("home-hero-media")).toHaveAttribute("data-viewpoint", "photo");
  });

  it("remembers the choice under its own key and reports it", async () => {
    const user = userEvent.setup();
    const onViewpointChange = jest.fn();
    renderMedia({ storageKey: "quiver:beach-hero-viewpoint", onViewpointChange });
    await user.click(screen.getByRole("tab", { name: "Sat" }));
    expect(window.localStorage.getItem("quiver:beach-hero-viewpoint")).toBe("satellite");
    expect(window.localStorage.getItem("quiver:home-hero-viewpoint")).toBeNull();
    expect(onViewpointChange).toHaveBeenCalledWith("satellite");
  });

  it("drops a photo that fails to load and falls through", () => {
    renderMedia({ viewpointPriority: ["photo", "swell", "satellite", "cam"] });
    const media = screen.getByTestId("home-hero-media");
    expect(media).toHaveAttribute("data-viewpoint", "photo");
    fireEvent.error(screen.getByAltText("Photo of Ocean Beach Pier"));
    expect(media).toHaveAttribute("data-viewpoint", "swell");
    expect(screen.queryByRole("tab", { name: "Photo" })).not.toBeInTheDocument();
  });

  it("takes an aspect override", () => {
    renderMedia({ aspectClassName: "aspect-[21/9]" });
    expect(screen.getByTestId("home-hero-media").className).toContain("aspect-[21/9]");
  });
```

Also change the first import line to `import { fireEvent, render, screen } from "@testing-library/react";`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/components/oracle/home-hero-media.test.tsx`
Expected: FAIL. The new props are ignored, so the cam test sees `data-viewpoint="swell"`, and `fireEvent.error` leaves the photo in place.

- [ ] **Step 3: Implement.** In `components/oracle/zine/home-hero-media.tsx`:

Replace the viewpoint type, storage key and the two storage helpers (lines 22–51) with:

```tsx
export type HeroViewpoint = "swell" | "satellite" | "photo" | "cam";

const VIEWPOINT_ORDER: readonly HeroViewpoint[] = ["swell", "satellite", "photo", "cam"];

const VIEWPOINT_LABELS: Record<HeroViewpoint, string> = {
  swell: "Swell",
  satellite: "Sat",
  photo: "Photo",
  cam: "Cam",
};

const DEFAULT_STORAGE_KEY = "quiver:home-hero-viewpoint";
const ORANGE = "F78E42";

function readStoredViewpoint(storageKey: string): HeroViewpoint | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return VIEWPOINT_ORDER.includes(stored as HeroViewpoint) ? (stored as HeroViewpoint) : null;
  } catch {
    return null;
  }
}

function storeViewpoint(storageKey: string, viewpoint: HeroViewpoint): void {
  try {
    window.localStorage.setItem(storageKey, viewpoint);
  } catch {
    // A remembered viewpoint is a convenience; the hero works without it.
  }
}
```

Add these to `HomeHeroMediaProps`:

```tsx
  /** Order to try when nothing is remembered. Home keeps native's (swell first); beach pages lead with the cam. */
  viewpointPriority?: readonly HeroViewpoint[];
  /** Each surface remembers its own choice. */
  storageKey?: string;
  onViewpointChange?: (viewpoint: HeroViewpoint) => void;
  /** Home's 4:5 / 16:10 card is too tall at full page width. */
  aspectClassName?: string;
```

Destructure them with defaults: `viewpointPriority = VIEWPOINT_ORDER, storageKey = DEFAULT_STORAGE_KEY, onViewpointChange, aspectClassName = "aspect-[4/5] sm:aspect-[16/10]"`.

Replace the `available`, `preferred` and `active` block (lines ~124–146) with:

```tsx
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUrl]);

  const available = useMemo(() => {
    const kinds: HeroViewpoint[] = [];
    if (streetsMap) kinds.push("swell");
    if (satelliteMap) kinds.push("satellite");
    if (photoUrl && !photoFailed) kinds.push("photo");
    if (cameraUrl) kinds.push("cam");
    return kinds;
  }, [streetsMap, satelliteMap, photoUrl, photoFailed, cameraUrl]);

  // Stored preference is read after mount so server and client render the
  // same first frame.
  const [remembered, setRemembered] = useState<HeroViewpoint | null>(null);
  useEffect(() => {
    setRemembered(readStoredViewpoint(storageKey));
  }, [storageKey]);

  const active: HeroViewpoint | null =
    [remembered, ...viewpointPriority].find(
      (viewpoint): viewpoint is HeroViewpoint => viewpoint != null && available.includes(viewpoint),
    ) ?? available[0] ?? null;
```

Replace `selectViewpoint`:

```tsx
  const selectViewpoint = (viewpoint: HeroViewpoint) => {
    setRemembered(viewpoint);
    storeViewpoint(storageKey, viewpoint);
    onViewpointChange?.(viewpoint);
  };
```

On the `<figure>`, change `className="relative m-0 aspect-[4/5] w-full overflow-hidden sm:aspect-[16/10]"` to ``className={`relative m-0 w-full overflow-hidden ${aspectClassName}`}``.

Pass the failure handler to the photo:

```tsx
      {active === "photo" && photoUrl && (
        <MediaImage
          src={getOptimizedImageUrl(photoUrl)}
          alt={`Photo of ${beachName}`}
          onFailed={() => setPhotoFailed(true)}
        />
      )}
```

Extend `MediaImage` with an `onFailed?: () => void` prop and put `onError={onFailed}` on the `<img>`.

The tab list keeps rendering `available` in `VIEWPOINT_ORDER` order. The priority only picks the opening view.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/components/oracle/home-hero-media.test.tsx __tests__/components/oracle/oracle-home-screen.test.tsx`
Expected: PASS. Home's existing tests stay green, which shows its behavior is unchanged.

- [ ] **Step 5: Commit**

```bash
git add components/oracle/zine/home-hero-media.tsx __tests__/components/oracle/home-hero-media.test.tsx
git commit -m "feat(hero): viewpoint priority, per-surface memory and a dead-photo fallback"
```

---

### Task 3: The week model

**Files:**
- Modify: `lib/utils/horizon-strip-utils.ts` (the `DaySummary` interface and `summaries.push` at ~line 320)
- Create: `lib/utils/beach-week.ts`
- Test: `__tests__/lib/utils/beach-week.test.ts`; extend `__tests__/lib/utils/horizon-strip-null-tail.test.ts`

**Interfaces:**
- Consumes:
  - `aggregateDayForecasts(forecasts, beach, { maxDays, timezone })`
  - `extractMergedTideSchedule(forecasts)`, whose entries are `{ time: seconds; height: ft; type: "high" | "low" }`
  - `rowToSwellPartition(row)`
  - `partitionToPoint(0, 0, partition, "s1")`, which returns `{ dir, periodS, heightFt } | null`
  - `getLocalDateString(date, timezone)`
- Produces:
  - `DaySummary.bestForecastAt?: string | null`
  - `interface BeachWeekSwell { directionDeg: number; periodS: number; heightFt: number }`
  - `interface BeachWeekDay { fullDate: string; dayName: string; isToday: boolean; tier: ConditionTier; minHeight: number; maxHeight: number; bestAt: string | null; swell: BeachWeekSwell | null; lowTide: { at: string; heightFt: number } | null; early: boolean }`
  - `const EARLY_READ_DAY_OFFSET = 4`
  - `buildBeachWeek(forecasts: EnhancedForecastEntity[], beach: Beach, timezone: string, days?: number): BeachWeekDay[]`

- [ ] **Step 1: Write the failing tests**

In `__tests__/lib/utils/horizon-strip-null-tail.test.ts`, add inside the existing `describe` (it already has `makeForecasts` and `mockBeach`):

```ts
  it("records which row each day's summary came from", () => {
    const today = new Date().toISOString().split('T')[0];
    const forecasts = makeForecasts(today, 8);
    const [day] = aggregateDayForecasts(forecasts, mockBeach, { maxDays: 1 });
    expect(forecasts.map((f) => f.forecast_at)).toContain(day.bestForecastAt);
  });
```

Create `__tests__/lib/utils/beach-week.test.ts`:

```ts
/**
 * @jest-environment node
 */
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

const mockAggregate = jest.fn<DaySummary[], unknown[]>();
jest.mock("@/lib/utils/horizon-strip-utils", () => ({
  aggregateDayForecasts: (...args: unknown[]) => mockAggregate(...args),
}));

import { buildBeachWeek, EARLY_READ_DAY_OFFSET } from "@/lib/utils/beach-week";

const TZ = "America/Los_Angeles";
const BEACH = { id: "b1", name: "Tourmaline" } as Beach;

function summary(fullDate: string, bestForecastAt: string | null, index: number): DaySummary {
  return {
    date: fullDate, dayName: "Sun", minHeight: 2, maxHeight: 3, tier: "fair", score: 60,
    fullDate, isToday: index === 0, bestTime: null, period: 11, bestForecastAt,
  };
}

function row(forecastAt: string, extra: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    forecast_at: forecastAt,
    swell_1_direction: "225",
    swell_1_period: "11",
    swell_1_height: "1.8",
    raw_forecast: null,
    ...extra,
  } as EnhancedForecastEntity;
}

describe("buildBeachWeek", () => {
  beforeEach(() => mockAggregate.mockReset());

  it("draws each day's glyph from that day's best row, primary swell only", () => {
    mockAggregate.mockReturnValue([summary("2026-09-27", "2026-09-27T18:00:00.000Z", 0)]);
    const [day] = buildBeachWeek([row("2026-09-27T18:00:00.000Z")], BEACH, TZ);
    expect(day.swell).toEqual({ directionDeg: 225, periodS: 11, heightFt: 1.8 });
    expect(day.bestAt).toBe("2026-09-27T18:00:00.000Z");
  });

  it("has no glyph when the best row lacks a complete primary swell", () => {
    mockAggregate.mockReturnValue([summary("2026-09-27", "2026-09-27T18:00:00.000Z", 0)]);
    const [day] = buildBeachWeek([row("2026-09-27T18:00:00.000Z", { swell_1_period: null })], BEACH, TZ);
    expect(day.swell).toBeNull();
  });

  it("puts a late-evening low on its local day, not the UTC day", () => {
    // 11:40pm PDT on Sep 27 is 06:40 UTC on Sep 28.
    const lateLow = Date.parse("2026-09-28T06:40:00.000Z") / 1000;
    const nextMorningLow = Date.parse("2026-09-28T13:05:00.000Z") / 1000;
    const tides = row("2026-09-27T07:00:00.000Z", {
      raw_forecast: { tide_schedule: [
        { time: lateLow, height: 0.9, type: "low" },
        { time: nextMorningLow, height: 1.2, type: "low" },
      ] },
    } as Partial<EnhancedForecastEntity>);
    mockAggregate.mockReturnValue([
      summary("2026-09-27", null, 0),
      summary("2026-09-28", null, 1),
    ]);
    const [sat, sun] = buildBeachWeek([tides], BEACH, TZ);
    expect(sat.lowTide).toEqual({ at: "2026-09-28T06:40:00.000Z", heightFt: 0.9 });
    expect(sun.lowTide).toEqual({ at: "2026-09-28T13:05:00.000Z", heightFt: 1.2 });
  });

  it("fades days from the fifth card on", () => {
    mockAggregate.mockReturnValue(
      Array.from({ length: 7 }, (_, i) => summary(`2026-09-${27 + i}`, null, i)),
    );
    const week = buildBeachWeek([], BEACH, TZ);
    expect(week.map((d) => d.early)).toEqual([false, false, false, false, true, true, true]);
    expect(EARLY_READ_DAY_OFFSET).toBe(4);
  });

  it("carries no water temperature", () => {
    mockAggregate.mockReturnValue([summary("2026-09-27", null, 0)]);
    const [day] = buildBeachWeek([], BEACH, TZ);
    expect(Object.keys(day)).not.toContain("waterTemp");
  });

  it("asks the aggregator for 7 days in the beach's timezone", () => {
    mockAggregate.mockReturnValue([]);
    buildBeachWeek([], BEACH, TZ);
    expect(mockAggregate).toHaveBeenCalledWith([], BEACH, { maxDays: 7, timezone: TZ });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/utils/beach-week.test.ts __tests__/lib/utils/horizon-strip-null-tail.test.ts`
Expected: FAIL. `beach-week` isn't found, and `bestForecastAt` is `undefined`.

- [ ] **Step 3: Implement**

In `lib/utils/horizon-strip-utils.ts`, add to `DaySummary` after `headlineForecastAt?`:

```ts
  /** The forecast row this day's summary scored best; lets callers read its swell. */
  bestForecastAt?: string | null;
```

In the `summaries.push({ … })` call, add:

```ts
      bestForecastAt: headlineForecast?.forecast_at ?? bestForecast.forecast_at ?? null,
```

Create `lib/utils/beach-week.ts`:

```ts
import { partitionToPoint } from "@/components/map/swell-field/field-sampler";
import { rowToSwellPartition } from "@/lib/domains/conditions/map-forecast";
import type { ConditionTier } from "@/lib/utils/condition-tier-utils";
import { aggregateDayForecasts } from "@/lib/utils/horizon-strip-utils";
import { extractMergedTideSchedule } from "@/lib/utils/tide-schedule";
import { getLocalDateString } from "@/lib/utils/timezone-utils";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface BeachWeekSwell {
  directionDeg: number;
  periodS: number;
  heightFt: number;
}

export interface BeachWeekDay {
  fullDate: string;
  dayName: string;
  isToday: boolean;
  tier: ConditionTier;
  minHeight: number;
  maxHeight: number;
  bestAt: string | null;
  swell: BeachWeekSwell | null;
  lowTide: { at: string; heightFt: number } | null;
  early: boolean;
}

/** Same rule as the planning home: the fifth card on is an early read. */
export const EARLY_READ_DAY_OFFSET = 4;

function primarySwell(row: EnhancedForecastEntity | undefined): BeachWeekSwell | null {
  if (!row) return null;
  const point = partitionToPoint(0, 0, rowToSwellPartition(row), "s1");
  if (!point) return null;
  return { directionDeg: point.dir, periodS: point.periodS, heightFt: point.heightFt };
}

/**
 * One beach's next 7 days from the rows the page already loads. No per-day
 * water temperature: future rows carry the current reading, not a forecast.
 */
export function buildBeachWeek(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  timezone: string,
  days = 7,
): BeachWeekDay[] {
  const summaries = aggregateDayForecasts(forecasts, beach, { maxDays: days, timezone });
  const rowsByInstant = new Map(forecasts.map((row) => [row.forecast_at, row]));
  const lows = extractMergedTideSchedule(forecasts).filter((entry) => entry.type === "low");

  return summaries.map((summary, index) => {
    const low = lows.find(
      (entry) => getLocalDateString(new Date(entry.time * 1000), timezone) === summary.fullDate,
    );
    return {
      fullDate: summary.fullDate,
      dayName: summary.dayName,
      isToday: summary.isToday,
      tier: summary.tier,
      minHeight: summary.minHeight,
      maxHeight: summary.maxHeight,
      bestAt: summary.bestForecastAt ?? null,
      swell: primarySwell(summary.bestForecastAt ? rowsByInstant.get(summary.bestForecastAt) : undefined),
      lowTide: low ? { at: new Date(low.time * 1000).toISOString(), heightFt: low.height } : null,
      early: index >= EARLY_READ_DAY_OFFSET,
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/utils/beach-week.test.ts __tests__/lib/utils/horizon-strip-null-tail.test.ts __tests__/lib/utils/horizon-strip-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils/horizon-strip-utils.ts lib/utils/beach-week.ts __tests__/lib/utils/beach-week.test.ts __tests__/lib/utils/horizon-strip-null-tail.test.ts
git commit -m "feat(beach): 7-day week model with swell glyph input and local-day low tides"
```

---

### Task 4: Swell glyph and week cards

**Files:**
- Create: `components/beach-detail/visual/swell-glyph.tsx`, `components/beach-detail/visual/beach-week.tsx`
- Test: `__tests__/components/beach-detail/visual/beach-week.test.tsx`

**Interfaces:**
- Consumes:
  - `BeachWeekDay` and `BeachWeekSwell` (Task 3)
  - `TIER_COLOR_HEX` and `formatWaveRange` from `lib/utils/horizon-strip-utils.ts`
  - `formatBeachDateTime` and `formatTimeCasual` from `lib/utils/date-time.ts`
- Produces:
  - `interface SwellGlyphGeometry { lines: number; strokeWidth: number; rotationDeg: number }`
  - `swellGlyphGeometry(swell: BeachWeekSwell): SwellGlyphGeometry`
  - `SwellGlyph({ swell, color }: { swell: BeachWeekSwell; color: string })`
  - `BeachWeek({ days, timezone }: { days: BeachWeekDay[]; timezone: string })`, rendering `data-testid="beach-week"`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from "@testing-library/react";
import { BeachWeek } from "@/components/beach-detail/visual/beach-week";
import { swellGlyphGeometry } from "@/components/beach-detail/visual/swell-glyph";
import type { BeachWeekDay } from "@/lib/utils/beach-week";

const TZ = "America/Los_Angeles";

function day(overrides: Partial<BeachWeekDay>): BeachWeekDay {
  return {
    fullDate: "2026-09-27", dayName: "Sun", isToday: false, tier: "fair", minHeight: 2, maxHeight: 3,
    bestAt: "2026-09-27T14:00:00.000Z", swell: { directionDeg: 225, periodS: 11, heightFt: 1.8 },
    lowTide: { at: "2026-09-27T22:10:00.000Z", heightFt: 1.1 }, early: false,
    ...overrides,
  };
}

describe("swellGlyphGeometry", () => {
  it("spaces long-period swell wider, with fewer lines", () => {
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 16, heightFt: 3 }).lines).toBe(2);
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 3 }).lines).toBe(3);
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 7, heightFt: 3 }).lines).toBe(4);
  });

  it("draws bigger swell heavier, within bounds", () => {
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 0.5 }).strokeWidth).toBe(1.4);
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 12 }).strokeWidth).toBe(4);
  });

  it("tilts with the direction the swell comes from", () => {
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 2 }).rotationDeg).toBe(0);
    expect(swellGlyphGeometry({ directionDeg: 225, periodS: 11, heightFt: 2 }).rotationDeg).toBe(-45);
  });
});

describe("BeachWeek", () => {
  it("labels each day with its tier word, size and low tide", () => {
    render(<BeachWeek days={[day({ isToday: true, dayName: "Sat" })]} timezone={TZ} />);
    const card = within(screen.getByTestId("beach-week")).getAllByRole("listitem")[0];
    expect(card).toHaveTextContent("Today");
    expect(card).toHaveTextContent("FAIR");
    expect(card).toHaveTextContent("ft");
    expect(card).toHaveTextContent("Low 3:10pm");
  });

  it("marks early reads and omits what a day doesn't have", () => {
    render(<BeachWeek days={[day({ early: true, swell: null, lowTide: null, bestAt: null })]} timezone={TZ} />);
    const card = within(screen.getByTestId("beach-week")).getAllByRole("listitem")[0];
    expect(card).toHaveTextContent("Early");
    expect(card).not.toHaveTextContent("Low");
    expect(card.textContent).not.toMatch(/null|NaN|undefined/);
    expect(card.querySelector("svg")).toBeNull();
  });

  it("renders nothing without days", () => {
    const { container } = render(<BeachWeek days={[]} timezone={TZ} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/components/beach-detail/visual/beach-week.test.tsx`
Expected: FAIL, module not found

- [ ] **Step 3: Implement**

`components/beach-detail/visual/swell-glyph.tsx`:

```tsx
import type { BeachWeekSwell } from "@/lib/utils/beach-week";

export interface SwellGlyphGeometry {
  lines: number;
  strokeWidth: number;
  rotationDeg: number;
}

/** Spacing reads as period, weight as size, tilt as where the swell comes from (W = level). */
export function swellGlyphGeometry(swell: BeachWeekSwell): SwellGlyphGeometry {
  const lines = swell.periodS >= 14 ? 2 : swell.periodS >= 10 ? 3 : 4;
  const strokeWidth = Math.min(4, Math.max(1.4, Math.round((1 + swell.heightFt * 0.5) * 10) / 10));
  const rotationDeg = Math.max(-80, Math.min(80, swell.directionDeg - 270));
  return { lines, strokeWidth, rotationDeg };
}

export function SwellGlyph({ swell, color }: { swell: BeachWeekSwell; color: string }) {
  const { lines, strokeWidth, rotationDeg } = swellGlyphGeometry(swell);
  const gap = 32 / (lines + 1);
  return (
    <svg width="100%" height="44" viewBox="0 0 120 44" aria-hidden="true">
      <g transform={`rotate(${rotationDeg} 60 22)`} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round">
        {Array.from({ length: lines }, (_, i) => {
          const y = 6 + gap * (i + 1);
          return <path key={i} d={`M8 ${y}q26-8 52 0t52 0`} />;
        })}
      </g>
    </svg>
  );
}
```

`components/beach-detail/visual/beach-week.tsx`:

```tsx
import { SwellGlyph } from "@/components/beach-detail/visual/swell-glyph";
import type { BeachWeekDay } from "@/lib/utils/beach-week";
import { formatTimeCasual } from "@/lib/utils/date-time";
import { formatWaveRange, TIER_COLOR_HEX } from "@/lib/utils/horizon-strip-utils";

export function BeachWeek({ days, timezone }: { days: BeachWeekDay[]; timezone: string }) {
  if (days.length === 0) return null;
  return (
    <section aria-labelledby="beach-week-heading" className="mt-12">
      <h2 id="beach-week-heading" className="zine-display text-2xl uppercase tracking-wide text-[#F5EEDC]">
        The week
      </h2>
      <ol data-testid="beach-week" className="mt-4 grid grid-flow-col auto-cols-[minmax(128px,1fr)] gap-3 overflow-x-auto pb-2 lg:grid-flow-row lg:grid-cols-7">
        {days.map((day) => {
          const color = TIER_COLOR_HEX[day.tier];
          return (
            <li
              key={day.fullDate}
              className="overflow-hidden rounded-2xl border border-[#F5EEDC]/15 bg-[#F5EEDC]/5"
              style={{ opacity: day.early ? 0.62 : 1 }}
            >
              <div className="px-3 pt-3">
                <div className="flex items-center justify-between font-mono text-xs font-bold uppercase tracking-widest text-[#F5EEDC]">
                  <span>{day.isToday ? "Today" : day.dayName}</span>
                  {day.early ? <span className="rounded border border-dashed border-[#F5EEDC]/60 px-1 text-[10px]">Early</span> : null}
                </div>
                {day.swell ? <SwellGlyph swell={day.swell} color={color} /> : <div className="h-11" />}
                <span className="zine-display inline-block -rotate-3 rounded-md border-[2.5px] px-1.5 text-base" style={{ color, borderColor: color }}>
                  {day.tier.toUpperCase()}
                </span>
                <p className="zine-display mt-1 text-lg text-[#F5EEDC]">{formatWaveRange(day.minHeight, day.maxHeight)}</p>
                {day.bestAt ? (
                  <p className="text-xs text-[#F5EEDC]/65">best ~{formatTimeCasual(day.bestAt, timezone)}</p>
                ) : null}
              </div>
              {day.lowTide ? (
                <p className="mt-2 bg-[#F4EBD8] px-3 py-1.5 text-xs text-[#11100D]">
                  Low {formatTimeCasual(day.lowTide.at, timezone)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
```

`formatWaveRange(2, 3)` returns `"2-3ft"` (`lib/utils/wave-formatters.ts:184-203`), so the card needs no unit of its own.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/components/beach-detail/visual/beach-week.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/beach-detail/visual/swell-glyph.tsx components/beach-detail/visual/beach-week.tsx __tests__/components/beach-detail/visual/beach-week.test.tsx
git commit -m "feat(beach): week cards with per-day swell glyphs"
```

---

### Task 5: Hourly chart

**Files:**
- Create: `lib/utils/beach-hourly-chart.ts`, `components/beach-detail/visual/beach-hourly-chart.tsx`
- Test: `__tests__/lib/utils/beach-hourly-chart.test.ts`, `__tests__/components/beach-detail/visual/beach-hourly-chart.test.tsx`

**Interfaces:**
- Consumes:
  - `PublicForecastHour` from `lib/services/spot-surf-report-service.ts`, whose fields are `forecast_at`, `wave_height`, `wind_speed`, `wind_direction`, `tide_height`, `tide_status` and the swell fields; all strings or null
  - `compassToDegrees(label)` from `lib/domains/conditions/map-forecast.ts`
- Produces:
  - `interface HourlyChartPoint { at: string; heightFt: number | null; tideFt: number | null; windFromDeg: number | null; inBestWindow: boolean }`
  - `interface HourlyChart { points: HourlyChartPoint[]; maxHeightFt: number; tideRange: [number, number] | null }`
  - `buildHourlyChart(hours: PublicForecastHour[], best: { start: string | null; end: string | null }): HourlyChart`
  - `BeachHourlyChart({ chart, timezone }: { chart: HourlyChart; timezone: string })`, rendering `data-testid="beach-hourly-chart"`

The chart uses the server's public hourly rows (today, or tomorrow when the report fell back), so it renders in the first HTML with no client wait. The full numeric table stays on the page (Task 9).

- [ ] **Step 1: Write the failing tests**

`__tests__/lib/utils/beach-hourly-chart.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { buildHourlyChart } from "@/lib/utils/beach-hourly-chart";
import type { PublicForecastHour } from "@/lib/services/spot-surf-report-service";

function hour(at: string, extra: Partial<PublicForecastHour> = {}): PublicForecastHour {
  return { forecast_at: at, wave_height: "2.5 ft", wind_speed: "9 mph", wind_direction: "WNW",
    tide_height: "4.0", tide_status: "Falling", confidence_score: 90,
    swell_1_height: null, swell_1_period: null, swell_1_direction: null,
    swell_2_height: null, swell_2_period: null, swell_2_direction: null, ...extra } as PublicForecastHour;
}

describe("buildHourlyChart", () => {
  it("reads the top of a range as the bar height", () => {
    const chart = buildHourlyChart([hour("2026-09-27T18:00:00.000Z", { wave_height: "2-3 ft" })], { start: null, end: null });
    expect(chart.points[0].heightFt).toBe(3);
    expect(chart.maxHeightFt).toBe(3);
  });

  it("marks the hours inside the best window", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T17:00:00.000Z"), hour("2026-09-27T18:00:00.000Z"), hour("2026-09-27T20:30:00.000Z")],
      { start: "2026-09-27T18:00:00.000Z", end: "2026-09-27T20:30:00.000Z" },
    );
    expect(chart.points.map((p) => p.inBestWindow)).toEqual([false, true, false]);
  });

  it("parses compass and numeric wind directions", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T18:00:00.000Z"), hour("2026-09-27T19:00:00.000Z", { wind_direction: "300" })],
      { start: null, end: null },
    );
    expect(chart.points[0].windFromDeg).toBe(292.5);
    expect(chart.points[1].windFromDeg).toBe(300);
  });

  it("keeps unreadable values as null and the range empty", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T18:00:00.000Z", { wave_height: null, tide_height: null, wind_direction: null })],
      { start: null, end: null },
    );
    expect(chart.points[0]).toMatchObject({ heightFt: null, tideFt: null, windFromDeg: null });
    expect(chart.tideRange).toBeNull();
    expect(chart.maxHeightFt).toBe(0);
  });

  it("sorts points by time", () => {
    const chart = buildHourlyChart(
      [hour("2026-09-27T20:00:00.000Z"), hour("2026-09-27T14:00:00.000Z")],
      { start: null, end: null },
    );
    expect(chart.points.map((p) => p.at)).toEqual(["2026-09-27T14:00:00.000Z", "2026-09-27T20:00:00.000Z"]);
  });
});
```

`__tests__/components/beach-detail/visual/beach-hourly-chart.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { BeachHourlyChart } from "@/components/beach-detail/visual/beach-hourly-chart";
import type { HourlyChart } from "@/lib/utils/beach-hourly-chart";

const CHART: HourlyChart = {
  points: [
    { at: "2026-09-27T17:00:00.000Z", heightFt: 2, tideFt: 4.4, windFromDeg: 290, inBestWindow: false },
    { at: "2026-09-27T18:00:00.000Z", heightFt: 3, tideFt: 3.8, windFromDeg: 290, inBestWindow: true },
  ],
  maxHeightFt: 3,
  tideRange: [3.8, 4.4],
};

describe("BeachHourlyChart", () => {
  it("draws one bar per hour and highlights the best window", () => {
    render(<BeachHourlyChart chart={CHART} timezone="America/Los_Angeles" />);
    const chart = screen.getByTestId("beach-hourly-chart");
    expect(chart.querySelectorAll("[data-bar]")).toHaveLength(2);
    expect(chart.querySelectorAll('[data-bar="best"]')).toHaveLength(1);
    expect(chart.querySelector("[data-tide-line]")).not.toBeNull();
  });

  it("describes itself for screen readers", () => {
    render(<BeachHourlyChart chart={CHART} timezone="America/Los_Angeles" />);
    expect(screen.getByRole("img", { name: /surf height by hour/i })).toBeInTheDocument();
  });

  it("renders nothing without points", () => {
    const { container } = render(<BeachHourlyChart chart={{ points: [], maxHeightFt: 0, tideRange: null }} timezone="UTC" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/utils/beach-hourly-chart.test.ts __tests__/components/beach-detail/visual/beach-hourly-chart.test.tsx`
Expected: FAIL, modules not found

- [ ] **Step 3: Implement**

`lib/utils/beach-hourly-chart.ts`:

```ts
import { compassToDegrees } from "@/lib/domains/conditions/map-forecast";
import type { PublicForecastHour } from "@/lib/services/spot-surf-report-service";

export interface HourlyChartPoint {
  at: string;
  heightFt: number | null;
  tideFt: number | null;
  windFromDeg: number | null;
  inBestWindow: boolean;
}

export interface HourlyChart {
  points: HourlyChartPoint[];
  maxHeightFt: number;
  tideRange: [number, number] | null;
}

/** "2-3 ft" charts as 3: a bar shows how big it gets. */
function topOfRange(value: string | null | undefined): number | null {
  const numbers = (value?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function direction(value: string | null | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return compassToDegrees(value);
}

function tide(value: string | null | undefined): number | null {
  const parsed = value == null ? NaN : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildHourlyChart(
  hours: PublicForecastHour[],
  best: { start: string | null; end: string | null },
): HourlyChart {
  const start = best.start ? Date.parse(best.start) : NaN;
  const end = best.end ? Date.parse(best.end) : NaN;
  const points = [...hours]
    .sort((a, b) => Date.parse(a.forecast_at) - Date.parse(b.forecast_at))
    .map((hour) => {
      const at = Date.parse(hour.forecast_at);
      return {
        at: hour.forecast_at,
        heightFt: topOfRange(hour.wave_height),
        tideFt: tide(hour.tide_height),
        windFromDeg: direction(hour.wind_direction),
        inBestWindow: Number.isFinite(start) && Number.isFinite(end) && at >= start && at < end,
      };
    });
  const heights = points.map((p) => p.heightFt).filter((h): h is number => h != null);
  const tides = points.map((p) => p.tideFt).filter((t): t is number => t != null);
  return {
    points,
    maxHeightFt: heights.length > 0 ? Math.max(...heights) : 0,
    tideRange: tides.length > 0 ? [Math.min(...tides), Math.max(...tides)] : null,
  };
}
```

`components/beach-detail/visual/beach-hourly-chart.tsx`:

```tsx
import type { HourlyChart } from "@/lib/utils/beach-hourly-chart";
import { formatTimeCasual } from "@/lib/utils/date-time";

const W = 1160;
const H = 230;
const BASE = 200;
const TOP = 40;

export function BeachHourlyChart({ chart, timezone }: { chart: HourlyChart; timezone: string }) {
  const { points, maxHeightFt, tideRange } = chart;
  if (points.length === 0) return null;
  const slot = W / points.length;
  const barWidth = Math.min(46, slot * 0.66);
  const heightScale = maxHeightFt > 0 ? (BASE - TOP) / maxHeightFt : 0;
  const tideY = (ft: number) =>
    tideRange && tideRange[1] > tideRange[0]
      ? 150 - ((ft - tideRange[0]) / (tideRange[1] - tideRange[0])) * 100
      : 100;
  const tidePath = points
    .map((p, i) => (p.tideFt == null ? null : `${i === 0 ? "M" : "L"}${slot * i + slot / 2} ${tideY(p.tideFt)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <figure data-testid="beach-hourly-chart" className="m-0 rounded-2xl border border-[#F5EEDC]/15 bg-[#F5EEDC]/5 p-4">
      <svg role="img" aria-label="Surf height by hour, with the tide and wind" viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {points.map((p, i) => {
          const x = slot * i + (slot - barWidth) / 2;
          const h = p.heightFt == null ? 0 : p.heightFt * heightScale;
          return (
            <g key={p.at}>
              <rect
                data-bar={p.inBestWindow ? "best" : "hour"}
                x={x}
                y={BASE - h}
                width={barWidth}
                height={h}
                rx={6}
                fill={p.inBestWindow ? "#FDB84B" : "rgba(245,238,220,0.28)"}
              />
              {p.windFromDeg != null ? (
                <text x={x + barWidth / 2} y={BASE - 6} textAnchor="middle" fontSize="16" fill="#F5EEDC"
                  transform={`rotate(${p.windFromDeg + 180} ${x + barWidth / 2} ${BASE - 11})`}>
                  ↑
                </text>
              ) : null}
              {i % 2 === 0 ? (
                <text x={x + barWidth / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="rgba(245,238,220,0.6)" fontFamily="var(--font-mono), monospace">
                  {formatTimeCasual(p.at, timezone)}
                </text>
              ) : null}
            </g>
          );
        })}
        {tidePath ? <path data-tide-line d={tidePath} fill="none" stroke="#7FA7B8" strokeWidth={3} /> : null}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-[#F5EEDC]/70">
        <span><i className="mr-1.5 inline-block h-1 w-3.5 rounded bg-[#FDB84B] align-middle" />Best window</span>
        <span><i className="mr-1.5 inline-block h-1 w-3.5 rounded bg-[#7FA7B8] align-middle" />Tide</span>
        <span>↑ Wind direction</span>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/utils/beach-hourly-chart.test.ts __tests__/components/beach-detail/visual/beach-hourly-chart.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils/beach-hourly-chart.ts components/beach-detail/visual/beach-hourly-chart.tsx __tests__/lib/utils/beach-hourly-chart.test.ts __tests__/components/beach-detail/visual/beach-hourly-chart.test.tsx
git commit -m "feat(beach): hourly surf chart with tide line and wind arrows"
```

---

### Task 6: Beach-day column

**Files:**
- Create: `components/beach-detail/visual/beach-day-column.tsx`
- Test: `__tests__/components/beach-detail/visual/beach-day-column.test.tsx`

**Interfaces:**
- Consumes:
  - `WaterTempMetaData { tempF; wetsuitRec }` (`lib/seo/water-temp-meta-data.ts`)
  - `TideMetaData { nextHighTime; nextLowTime; nextHighHeight; nextLowHeight }` (`lib/seo/tide-meta-data.ts`); the times are already formatted, like `"3:10 PM"`
  - `WaterQuality` (`components/beach-detail/water-quality-badge.tsx`)
  - `useSunTimes(beachId, localDate)`, which returns `{ sunrise: Date | null; sunset: Date | null }`
  - `formatBeachDateTime(date, tz, "h:mm a")`
- Produces:
  - `interface BeachDayColumnProps { beachId: string; timezone: string; localDate: string; waterTemp: WaterTempMetaData | null; tide: TideMetaData | null; waterQuality: WaterQuality | null; links: { waterTemp: string | null; tides: string | null } }`
  - `BeachDayColumn(props)`, rendering `data-testid="beach-day-column"`

The mockup had its own tide curve card. The hourly chart already draws the tide line, so the column shows the next low and next high as text instead of a second curve.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { BeachDayColumn } from "@/components/beach-detail/visual/beach-day-column";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";

const mockSun = jest.fn();
jest.mock("@/hooks/use-sun-times", () => ({ useSunTimes: (...args: unknown[]) => mockSun(...args) }));

const BASE = {
  beachId: "b1",
  timezone: "America/Los_Angeles",
  localDate: "2026-09-27",
  waterTemp: { tempF: 73, wetsuitRec: "Boardshorts" },
  tide: { nextLowTime: "3:10 PM", nextLowHeight: 1.1, nextHighTime: "9:52 PM", nextHighHeight: 5.1 },
  waterQuality: null,
  links: { waterTemp: "/ca/san-diego/tourmaline/water-temp", tides: "/ca/san-diego/tourmaline/tides" },
};

beforeEach(() => {
  mockSun.mockReturnValue({ sunrise: new Date("2026-09-27T13:41:00Z"), sunset: new Date("2026-09-28T01:42:00Z") });
});

describe("BeachDayColumn", () => {
  it("answers the beach day: water, tides, daylight", () => {
    render(<BeachDayColumn {...BASE} />);
    const col = screen.getByTestId("beach-day-column");
    expect(col).toHaveTextContent("73°F");
    expect(col).toHaveTextContent("Boardshorts");
    expect(col).toHaveTextContent("3:10 PM");
    expect(col).toHaveTextContent("9:52 PM");
    expect(col).toHaveTextContent("6:41 AM");
    expect(col).toHaveTextContent("6:42 PM");
    expect(screen.getByRole("link", { name: /water temp/i })).toHaveAttribute("href", BASE.links.waterTemp);
    expect(screen.getByRole("link", { name: /tide chart/i })).toHaveAttribute("href", BASE.links.tides);
  });

  it("never says the water is clean, even for a stored 'good' sample", () => {
    const { rerender } = render(<BeachDayColumn {...BASE} waterQuality={{ status: "unknown" } as WaterQuality} />);
    expect(screen.getByTestId("beach-day-column")).not.toHaveTextContent(/clean|clear|safe|good/i);
    rerender(<BeachDayColumn {...BASE} waterQuality={{ status: "good" } as WaterQuality} />);
    expect(screen.getByTestId("beach-day-column")).not.toHaveTextContent(/clean|clear|safe|good|water quality/i);
  });

  it("shows an advisory when there is one", () => {
    render(<BeachDayColumn {...BASE} waterQuality={{ status: "advisory" } as WaterQuality} />);
    expect(screen.getByTestId("beach-day-column")).toHaveTextContent(/advisory/i);
  });

  it("omits what it doesn't know instead of printing blanks", () => {
    mockSun.mockReturnValue({ sunrise: null, sunset: null });
    render(<BeachDayColumn {...BASE} waterTemp={null} tide={null} links={{ waterTemp: null, tides: null }} />);
    const col = screen.getByTestId("beach-day-column");
    expect(col.textContent).not.toMatch(/null|NaN|undefined|°F/);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/components/beach-detail/visual/beach-day-column.test.tsx`
Expected: FAIL, module not found

- [ ] **Step 3: Implement**

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { useSunTimes } from "@/hooks/use-sun-times";
import { formatBeachDateTime } from "@/lib/utils/date-time";
import type { TideMetaData } from "@/lib/seo/tide-meta-data";
import type { WaterTempMetaData } from "@/lib/seo/water-temp-meta-data";

export interface BeachDayColumnProps {
  beachId: string;
  timezone: string;
  localDate: string;
  waterTemp: WaterTempMetaData | null;
  tide: TideMetaData | null;
  waterQuality: WaterQuality | null;
  links: { waterTemp: string | null; tides: string | null };
}

function Tile({ label, value, detail, link }: { label: string; value: string; detail?: string | null; link?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#F4EBD8] px-4 py-3.5 text-[#11100D]">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6b5a3a]">{label}</p>
      <p className="zine-display mt-1 text-2xl">{value}</p>
      {detail ? <p className="text-sm text-[#3d3326]">{detail}</p> : null}
      {link}
    </div>
  );
}

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-2 inline-block border-b-2 border-[#F78E42] text-xs font-bold">
      {children}
    </Link>
  );
}

/** Beachgoers' answer. Water quality appears only as an advisory; "no notice" is not "clean". */
export function BeachDayColumn({ beachId, timezone, localDate, waterTemp, tide, waterQuality, links }: BeachDayColumnProps) {
  const { sunrise, sunset } = useSunTimes(beachId, localDate);
  const advisory = waterQuality?.status === "advisory" || waterQuality?.status === "closure" ? waterQuality.status : null;

  return (
    <section aria-labelledby="beach-day-heading" data-testid="beach-day-column">
      <h2 id="beach-day-heading" className="zine-display text-xl uppercase text-[#F5EEDC]">
        Beach day
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {waterTemp?.tempF != null ? (
          <Tile
            label="Water"
            value={`${waterTemp.tempF}°F`}
            detail={waterTemp.wetsuitRec}
            link={links.waterTemp ? <TileLink href={links.waterTemp}>Water temp →</TileLink> : null}
          />
        ) : null}
        {tide?.nextLowTime ? (
          <Tile
            label="Next low tide"
            value={tide.nextLowTime}
            detail={tide.nextHighTime ? `High ${tide.nextHighTime}` : null}
            link={links.tides ? <TileLink href={links.tides}>Tide chart →</TileLink> : null}
          />
        ) : null}
        {sunrise && sunset ? (
          <Tile
            label="Daylight"
            value={`${formatBeachDateTime(sunrise, timezone, "h:mm a")}–${formatBeachDateTime(sunset, timezone, "h:mm a")}`}
          />
        ) : null}
        {advisory ? (
          <Tile label="Water quality" value={advisory === "closure" ? "Closed" : "Advisory"} detail="Check county notices before going in." />
        ) : null}
      </div>
    </section>
  );
}
```

`WaterQuality.status` is `"good" | "advisory" | "closure" | "unknown"` (`components/beach-detail/water-quality-badge.tsx:26`). The column deliberately ignores `"good"`, because "no notice" isn't "clean".

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/components/beach-detail/visual/beach-day-column.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/beach-detail/visual/beach-day-column.tsx __tests__/components/beach-detail/visual/beach-day-column.test.tsx
git commit -m "feat(beach): beach-day column (water, tides, daylight, advisories only)"
```

---

### Task 7: Watch and Share

**Files:**
- Create: `lib/constants/app-capabilities.ts`, `lib/alerts/beach-watch.ts`, `components/beach-detail/visual/beach-actions.tsx`
- Test: `__tests__/lib/alerts/beach-watch.test.ts`, `__tests__/components/beach-detail/visual/beach-actions.test.tsx`

**Interfaces:**
- Consumes:
  - `validateConditionAlertInput` (`lib/alerts/condition-validation.ts`), in tests
  - `normalizeForecastWindowParam` (`lib/utils/forecast-window-param.ts`)
  - `SITE_URL` (`lib/constants/seo.ts`)
  - `formatTimeCasual`
  - `PublicSurfCall` (Task 1)
  - `useAuth` (`@/context/auth-context`)
  - `trackAppHandoffView` and `trackAppHandoffLinkOpened` (`lib/analytics/app-handoff-tracking.ts`)
  - `captureClientPostHogEventAfterConsent`
  - `QRCodeSVG` (`qrcode.react`)
  - `toast` (`sonner`)
- Produces:
  - `NATIVE_SELECTED_WINDOW_WATCH: boolean`
  - `interface BeachWatchWindow { start: string; end: string; forecastAt: string; label: string }`
  - `selectBeachWatchWindow(input: { call: PublicSurfCall; start: string | null; end: string | null; forecastAt: string | null; timezone: string; isTomorrow: boolean; now?: Date }): BeachWatchWindow | null`
  - `buildBeachWatchRule(input: { beachId: string; beachName: string; window: BeachWatchWindow; score: number | null }): BeachWatchRuleBody`
  - `buildBeachWatchAppLink(slug: string, forecastAt: string): string`
  - `BeachActions({ beach, watchWindow, score, shareUrl }: { beach: { id: string; slug: string; name: string }; watchWindow: BeachWatchWindow | null; score: number | null; shareUrl: string })`, rendering `data-testid="beach-watch-button"` and `data-testid="beach-share-button"`

- [ ] **Step 1: Write the failing tests**

`__tests__/lib/alerts/beach-watch.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { validateConditionAlertInput } from "@/lib/alerts/condition-validation";
import { buildBeachWatchAppLink, buildBeachWatchRule, selectBeachWatchWindow } from "@/lib/alerts/beach-watch";

const NOW = new Date("2026-09-27T16:00:00.000Z");
const CALL = { kind: "call" as const, label: "FAIR" as const, action: "Worth a look" };
const WINDOW = { start: "2026-09-27T18:00:00.000Z", end: "2026-09-27T20:30:00.000Z", forecastAt: "2026-09-27T18:00:00.000Z" };

describe("selectBeachWatchWindow", () => {
  it("offers today's best window with a readable label", () => {
    expect(selectBeachWatchWindow({ call: CALL, ...WINDOW, timezone: "America/Los_Angeles", isTomorrow: false, now: NOW }))
      .toEqual({ ...WINDOW, label: "today 11am–1:30pm" });
  });

  it("says tomorrow when the report fell back", () => {
    expect(selectBeachWatchWindow({ call: CALL, ...WINDOW, timezone: "America/Los_Angeles", isTomorrow: true, now: NOW })?.label)
      .toBe("tomorrow 11am–1:30pm");
  });

  it("offers nothing for a skip, a hold, an unknown call, a missing or a past window", () => {
    const base = { ...WINDOW, timezone: "UTC", isTomorrow: false, now: NOW };
    expect(selectBeachWatchWindow({ ...base, call: { kind: "call", label: "MEH", action: "Skip it" } })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: { kind: "no_call", reason: "x" } })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: { kind: "unknown" } })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: CALL, start: null })).toBeNull();
    expect(selectBeachWatchWindow({ ...base, call: CALL, now: new Date("2026-09-27T21:00:00.000Z") })).toBeNull();
  });

  it("falls back to the window start when there is no forecast row instant", () => {
    expect(selectBeachWatchWindow({ call: CALL, ...WINDOW, forecastAt: null, timezone: "UTC", isTomorrow: false, now: NOW })?.forecastAt)
      .toBe(WINDOW.start);
  });
});

describe("buildBeachWatchRule", () => {
  const window = { ...WINDOW, label: "today 11am–1:30pm" };

  it("builds a watched_call the rules route accepts", () => {
    const body = buildBeachWatchRule({ beachId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", beachName: "Tourmaline", window, score: 61 });
    expect(body).toMatchObject({ preset_type: "watched_call", notify_push: true, notify_email: false });
    const result = validateConditionAlertInput({
      presetType: body.preset_type,
      conditions: body.conditions,
      notifyEmail: body.notify_email,
      notifyPush: body.notify_push,
    });
    expect(result.ok).toBe(true);
  });

  it("uses the app's dedupe key shape so a web and an app watch of one window are the same watch", () => {
    const body = buildBeachWatchRule({ beachId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", beachName: "Tourmaline", window, score: null });
    const watched = body.conditions.watched_call;
    expect(watched.dedupeKey).toBe(
      ["watched-call.v1", "3fa85f64-5717-4562-b3fc-2c963f66afa6", watched.recommendationId, window.start, window.end]
        .map(encodeURIComponent).join(":"),
    );
    expect(watched.overallScore).toBe(0);
    expect(watched.sourceSurface).toBe("beach_detail");
    expect(watched.mode).toBe("beach-detail");
  });
});

describe("buildBeachWatchAppLink", () => {
  it("opens the exact window in the app", () => {
    expect(buildBeachWatchAppLink("Tourmaline", "2026-09-27T18:00:00.000Z"))
      .toMatch(/\/app\/spot\/tourmaline\?window=2026-09-27T18%3A00%3A00\.000Z$/);
  });
});
```

`__tests__/components/beach-detail/visual/beach-actions.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUser = { current: null as null | { id: string } };
jest.mock("@/context/auth-context", () => ({ useAuth: () => ({ user: mockUser.current }) }));
jest.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="watch-qr" data-value={value} /> }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/posthog-client", () => ({ captureClientPostHogEventAfterConsent: jest.fn() }));
jest.mock("@/lib/analytics/app-handoff-tracking", () => ({ trackAppHandoffView: jest.fn(), trackAppHandoffLinkOpened: jest.fn() }));
const mockNative = { ready: false };
jest.mock("@/lib/constants/app-capabilities", () => ({
  get NATIVE_SELECTED_WINDOW_WATCH() { return mockNative.ready; },
}));

import { BeachActions } from "@/components/beach-detail/visual/beach-actions";

const BEACH = { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", slug: "tourmaline", name: "Tourmaline" };
const WINDOW = { start: "2099-09-27T18:00:00.000Z", end: "2099-09-27T20:30:00.000Z", forecastAt: "2099-09-27T18:00:00.000Z", label: "today 11am–1:30pm" };

function setPointer(coarse: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({ matches: coarse }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  mockUser.current = null;
  mockNative.ready = false;
  setPointer(false);
  global.fetch = jest.fn();
});

describe("BeachActions", () => {
  it("says 'Open in the app' to signed-out visitors until the app can watch a window", () => {
    render(<BeachActions beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="https://www.quiversurf.app/ca/san-diego/tourmaline" />);
    expect(screen.getByTestId("beach-watch-button")).toHaveTextContent("Open in the app");
  });

  it("says Watch once the app supports it", () => {
    mockNative.ready = true;
    render(<BeachActions beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    expect(screen.getByTestId("beach-watch-button")).toHaveTextContent("Watch today 11am–1:30pm");
  });

  it("shows a QR for the exact window on desktop", async () => {
    render(<BeachActions beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    expect(screen.getByTestId("watch-qr").getAttribute("data-value")).toMatch(/\/app\/spot\/tourmaline\?window=/);
  });

  it("opens the app directly on a phone", async () => {
    setPointer(true);
    const assign = jest.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
    render(<BeachActions beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/app\/spot\/tourmaline\?window=/));
  });

  it("creates the watch for signed-in users", async () => {
    mockUser.current = { id: "u1" };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    render(<BeachActions beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/alerts/rules");
    expect(JSON.parse(init.body)).toMatchObject({ preset_type: "watched_call", beach_id: BEACH.id });
    await waitFor(() => expect(screen.getByTestId("beach-watch-button")).toHaveTextContent("Watching"));
  });

  it("falls back to the app sheet with the server's reason when the watch is refused", async () => {
    mockUser.current = { id: "u1" };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 403, json: async () => ({ success: false, error: "Watching other beaches is part of Pro", timestamp: "t" }),
    });
    render(<BeachActions beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    expect(await screen.findByText("Watching other beaches is part of Pro")).toBeInTheDocument();
    expect(screen.getByTestId("watch-qr")).toBeInTheDocument();
  });

  it("offers only Share when there is no window to watch", () => {
    render(<BeachActions beach={BEACH} watchWindow={null} score={null} shareUrl="x" />);
    expect(screen.queryByTestId("beach-watch-button")).toBeNull();
    expect(screen.getByTestId("beach-share-button")).toBeInTheDocument();
  });

  it("copies the link when the browser can't share", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<BeachActions beach={BEACH} watchWindow={null} score={null} shareUrl="https://www.quiversurf.app/ca/san-diego/tourmaline" />);
    await userEvent.click(screen.getByTestId("beach-share-button"));
    expect(writeText).toHaveBeenCalledWith("https://www.quiversurf.app/ca/san-diego/tourmaline");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/alerts/beach-watch.test.ts __tests__/components/beach-detail/visual/beach-actions.test.tsx`
Expected: FAIL, modules not found

- [ ] **Step 3: Implement**

`lib/constants/app-capabilities.ts`:

```ts
/**
 * The app's selected-window sheet can create a watch (quiver-native plan:
 * "Watch on the selected-window sheet"). Until it ships and most active
 * installs have it, the web's signed-out Watch button says "Open in the app"
 * so it never promises what the app can't do. Flip in its own PR.
 */
export const NATIVE_SELECTED_WINDOW_WATCH = false;
```

`lib/alerts/beach-watch.ts`:

```ts
import { SITE_URL } from "@/lib/constants/seo";
import { formatTimeCasual } from "@/lib/utils/date-time";
import { normalizeForecastWindowParam } from "@/lib/utils/forecast-window-param";
import type { PublicSurfCall } from "@/lib/utils/public-surf-call";

export interface BeachWatchWindow {
  start: string;
  end: string;
  forecastAt: string;
  label: string;
}

/** Only a window worth surfing, that hasn't ended, can be watched. */
export function selectBeachWatchWindow(input: {
  call: PublicSurfCall;
  start: string | null;
  end: string | null;
  forecastAt: string | null;
  timezone: string;
  isTomorrow: boolean;
  now?: Date;
}): BeachWatchWindow | null {
  if (input.call.kind !== "call" || input.call.label === "MEH") return null;
  if (!input.start || !input.end) return null;
  const now = (input.now ?? new Date()).getTime();
  if (!(Date.parse(input.end) > now)) return null;
  const range = `${formatTimeCasual(input.start, input.timezone)}–${formatTimeCasual(input.end, input.timezone)}`;
  return {
    start: input.start,
    end: input.end,
    forecastAt: input.forecastAt ?? input.start,
    label: `${input.isTomorrow ? "tomorrow" : "today"} ${range}`,
  };
}

export interface BeachWatchRuleBody {
  beach_id: string;
  name: string;
  preset_type: "watched_call";
  conditions: {
    watched_call: {
      version: 1;
      recommendationId: string;
      sourceSurface: "beach_detail";
      mode: "beach-detail";
      beachId: string;
      windowStart: string;
      windowEnd: string;
      forecastAt: string | null;
      recommendationState: "ready_today" | "future_fallback";
      conditionScore: number;
      personalMatchScore: number;
      overallScore: number;
      reasonType: string;
      dedupeKey: string;
    };
  };
  notify_email: boolean;
  notify_push: boolean;
}

/** Same identity and dedupe key as the app's watch (quiver-native src/lib/alert-rule-seed.ts). */
export function buildBeachWatchRule(input: {
  beachId: string;
  beachName: string;
  window: BeachWatchWindow;
  score: number | null;
}): BeachWatchRuleBody {
  const { beachId, window } = input;
  const recommendationId = `beach-detail:${beachId}:${window.start}`;
  const score = Math.max(0, Math.min(100, Math.round(input.score ?? 0)));
  const dedupeKey = ["watched-call.v1", beachId, recommendationId, window.start, window.end]
    .map(encodeURIComponent)
    .join(":");
  return {
    beach_id: beachId,
    name: `Watch ${input.beachName} ${window.label}`,
    preset_type: "watched_call",
    conditions: {
      watched_call: {
        version: 1,
        recommendationId,
        sourceSurface: "beach_detail",
        mode: "beach-detail",
        beachId,
        windowStart: window.start,
        windowEnd: window.end,
        forecastAt: normalizeForecastWindowParam(window.forecastAt),
        recommendationState: window.label.startsWith("tomorrow") ? "future_fallback" : "ready_today",
        conditionScore: score,
        personalMatchScore: 0,
        overallScore: score,
        reasonType: "public_call",
        dedupeKey,
      },
    },
    notify_email: false,
    notify_push: true,
  };
}

/** A universal link: the app opens this beach at this window; the web shows the handoff page. */
export function buildBeachWatchAppLink(slug: string, forecastAt: string): string {
  const params = new URLSearchParams({ window: forecastAt });
  return `${SITE_URL.replace(/\/$/, "")}/app/spot/${encodeURIComponent(slug.trim().toLowerCase())}?${params.toString()}`;
}
```

`components/beach-detail/visual/beach-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Eye, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { buildBeachWatchAppLink, buildBeachWatchRule, type BeachWatchWindow } from "@/lib/alerts/beach-watch";
import { trackAppHandoffLinkOpened, trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";
import { NATIVE_SELECTED_WINDOW_WATCH } from "@/lib/constants/app-capabilities";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";

interface BeachActionsProps {
  beach: { id: string; slug: string; name: string };
  watchWindow: BeachWatchWindow | null;
  score: number | null;
  shareUrl: string;
}

type WatchState = "idle" | "saving" | "watching";

const BUTTON = "flex min-h-14 items-center gap-3 rounded-2xl border-2 border-[#11100D] px-4 py-3 text-left text-[#11100D]";

export function BeachActions({ beach, watchWindow, score, shareUrl }: BeachActionsProps) {
  const { user } = useAuth();
  const [watchState, setWatchState] = useState<WatchState>("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetNote, setSheetNote] = useState<string | null>(null);

  const appLink = watchWindow ? buildBeachWatchAppLink(beach.slug, watchWindow.forecastAt) : null;
  const handoff = { source: `beach-detail-${beach.slug}`, surface: "beach_detail", placement: "beach_watch" } as const;
  const canWatchHere = Boolean(user) || NATIVE_SELECTED_WINDOW_WATCH;

  function openAppSheet(note: string | null) {
    if (!appLink) return;
    setSheetNote(note);
    setSheetOpen(true);
    trackAppHandoffView({ ...handoff, platform: "desktop", handoff_channel: "qr", destination_url: appLink });
  }

  async function handleWatch() {
    if (!watchWindow || !appLink || watchState !== "idle") return;
    if (user) {
      setWatchState("saving");
      try {
        const res = await fetch("/api/alerts/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBeachWatchRule({ beachId: beach.id, beachName: beach.name, window: watchWindow, score })),
        });
        if (res.ok) {
          setWatchState("watching");
          toast.success(`Watching ${beach.name} ${watchWindow.label}`);
          return;
        }
        const json = (await res.json().catch(() => ({}))) as { error?: unknown };
        setWatchState("idle");
        openAppSheet(typeof json.error === "string" ? json.error : "Couldn't save the watch here. You can watch it in the app.");
      } catch (error) {
        console.error("[BeachActions] watch failed", error instanceof Error ? error.message : error);
        setWatchState("idle");
        openAppSheet("Couldn't reach Quiver. You can watch it in the app.");
      }
      return;
    }
    if (window.matchMedia("(pointer: coarse)").matches) {
      trackAppHandoffLinkOpened({ ...handoff, destination_url: appLink });
      window.location.assign(appLink);
      return;
    }
    openAppSheet(null);
  }

  async function handleShare() {
    captureClientPostHogEventAfterConsent("beach_share_opened", { beach_id: beach.id, beach_slug: beach.slug });
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${beach.name} today`, url: shareUrl });
      } catch (error) {
        // Closing the share sheet rejects with AbortError; anything else is a real failure.
        if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Couldn't open sharing");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  const watchText =
    watchState === "watching" ? "Watching" : canWatchHere && watchWindow ? `Watch ${watchWindow.label}` : "Open in the app";

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-[1.25fr_1fr]">
      {watchWindow ? (
        <button
          type="button"
          data-testid="beach-watch-button"
          onClick={handleWatch}
          disabled={watchState === "saving"}
          className={`${BUTTON} bg-[#F78E42] shadow-[4px_4px_0_#000]`}
        >
          <Eye aria-hidden className="h-5 w-5 shrink-0" />
          <span>
            <span className="block text-base font-bold">{watchText}</span>
            <span className="block text-sm text-[#3a1f08]">For surfers: a heads-up on your phone if it changes. Opens in the Quiver app.</span>
          </span>
        </button>
      ) : null}
      <button type="button" data-testid="beach-share-button" onClick={handleShare} className={`${BUTTON} bg-[#F4EBD8]`}>
        <Share2 aria-hidden className="h-5 w-5 shrink-0" />
        <span>
          <span className="block text-base font-bold">Share {beach.name} today</span>
          <span className="block text-sm text-[#3d3326]">The cam still, the water temp and the surf call.</span>
        </span>
      </button>
      {sheetOpen && appLink && watchWindow ? (
        <div role="dialog" aria-label="Watch in the Quiver app" className="flex items-center gap-4 rounded-2xl border border-dashed border-[#F5EEDC]/35 bg-[#F5EEDC]/5 p-4 md:col-span-2">
          <div className="rounded-lg bg-white p-2">
            <QRCodeSVG value={appLink} size={96} />
          </div>
          <div className="text-sm text-[#F5EEDC]">
            {sheetNote ? <p className="mb-1 font-bold">{sheetNote}</p> : null}
            <p>Scan to watch {beach.name} {watchWindow.label} in the Quiver app.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

Check `trackAppHandoffView`'s metadata type accepts `handoff_channel: "qr"` and `platform: "desktop"`; `AppHandoffMetadata` allows both (`lib/analytics/app-handoff-tracking.ts:28-42`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/alerts/beach-watch.test.ts __tests__/components/beach-detail/visual/beach-actions.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/constants/app-capabilities.ts lib/alerts/beach-watch.ts components/beach-detail/visual/beach-actions.tsx __tests__/lib/alerts/beach-watch.test.ts __tests__/components/beach-detail/visual/beach-actions.test.tsx
git commit -m "feat(beach): Watch (web watch or app handoff) and Share actions"
```

---

### Task 8: Visual hero

**Files:**
- Create: `lib/utils/beach-forecast-heading.ts`, `components/beach-detail/visual/beach-visual-hero.tsx`
- Modify: `components/beach-detail/public-forecast-answer.tsx` (use the shared heading helper; add an optional `title`)
- Test: `__tests__/lib/utils/beach-forecast-heading.test.ts`, `__tests__/components/beach-detail/visual/beach-visual-hero.test.tsx`

**Interfaces:**
- Consumes:
  - `HomeHeroMedia` with `viewpointPriority`, `storageKey`, `onViewpointChange` and `aspectClassName` (Task 2)
  - `PublicSurfCall` (Task 1)
  - `RipCurrentWarning({ beachId, localDate, timezone })`
  - `normalizeForecastDateParam` and `normalizeForecastWindowParam`
- Produces:
  - `formatForecastHeadingDate(localDate: string | null | undefined, timezone: string): string | null`, moved from `public-forecast-answer.tsx`
  - `beachForecastHeadingSuffix(forecastDate: string | null, hasSelection: boolean): string`, which returns `"Surf Forecast"` or `"Surf Forecast for …"`
  - `interface BeachHeroSurfFacts { size: string | null; swell: string | null; wind: string | null; bestWindow: string | null }`
  - `interface BeachHeroDayFacts { water: string | null; nextLow: string | null; advisory: string | null }`
  - `BeachVisualHero(props: { beach: { id: string; name: string; lat: number | null; lon: number | null; city: string | null }; timezone: string; localDate: string; forecastLocalDate: string | null; photoUrl: string | null; sources: BeachSources | null; swellPartition: SwellPartition | null; call: PublicSurfCall; surf: BeachHeroSurfFacts; beachDay: BeachHeroDayFacts })`, rendering `data-testid="beach-visual-hero"` and `data-testid="beach-public-call"`

- [ ] **Step 1: Write the failing tests**

`__tests__/lib/utils/beach-forecast-heading.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { beachForecastHeadingSuffix, formatForecastHeadingDate } from "@/lib/utils/beach-forecast-heading";

describe("beach forecast heading", () => {
  it("formats the forecast's local date in the beach's timezone", () => {
    expect(formatForecastHeadingDate("2026-09-27", "America/Los_Angeles")).toBe("Sunday, September 27, 2026");
    expect(formatForecastHeadingDate(null, "UTC")).toBeNull();
  });

  it("keeps today's H1 words, and drops the date for a selected window", () => {
    expect(beachForecastHeadingSuffix("Sunday, September 27, 2026", false)).toBe("Surf Forecast for Sunday, September 27, 2026");
    expect(beachForecastHeadingSuffix("Sunday, September 27, 2026", true)).toBe("Surf Forecast");
    expect(beachForecastHeadingSuffix(null, false)).toBe("Surf Forecast");
  });
});
```

`__tests__/components/beach-detail/visual/beach-visual-hero.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";

const mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams }));
jest.mock("@/components/oracle/zine/home-hero-media", () => ({
  HomeHeroMedia: ({ children, viewpointPriority }: { children: React.ReactNode; viewpointPriority: string[] }) => (
    <figure data-testid="hero-media" data-priority={viewpointPriority.join(",")}>{children}</figure>
  ),
}));
jest.mock("@/components/beach-detail/rip-current-warning", () => ({ RipCurrentWarning: () => <div data-testid="rip" /> }));
jest.mock("@/lib/posthog-client", () => ({ captureClientPostHogEventAfterConsent: jest.fn() }));

import { BeachVisualHero } from "@/components/beach-detail/visual/beach-visual-hero";

const PROPS = {
  beach: { id: "b1", name: "Tourmaline", lat: 32.8, lon: -117.26, city: "San Diego" },
  timezone: "America/Los_Angeles",
  localDate: "2026-09-27",
  forecastLocalDate: "2026-09-27",
  photoUrl: "https://example.com/t.jpg",
  sources: null,
  swellPartition: null,
  call: { kind: "call" as const, label: "FAIR" as const, action: "Worth a look" },
  surf: { size: "2–3 ft", swell: "11s SW", wind: "9 mph cross-shore", bestWindow: "11am–1:30pm" },
  beachDay: { water: "73°F · Boardshorts", nextLow: "Low 3:10 PM", advisory: null },
};

describe("BeachVisualHero", () => {
  it("keeps the H1's words with the beach name large", () => {
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tourmaline Surf Forecast for Sunday, September 27, 2026");
  });

  it("leads with the cam, then the photo", () => {
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByTestId("hero-media")).toHaveAttribute("data-priority", "cam,photo,swell,satellite");
  });

  it("gives everyone the surf call, for most surfers", () => {
    render(<BeachVisualHero {...PROPS} />);
    const call = screen.getByTestId("beach-public-call");
    expect(call).toHaveTextContent("Fair");
    expect(call).toHaveTextContent("Worth a look");
    expect(call).toHaveTextContent(/for most surfers/i);
  });

  it("shows a hold instead of a call", () => {
    render(<BeachVisualHero {...PROPS} call={{ kind: "no_call", reason: "There's a water-quality advisory here, so there's no call until it clears." }} />);
    const call = screen.getByTestId("beach-public-call");
    expect(call).toHaveTextContent("No call today");
    expect(call).toHaveTextContent("water-quality advisory");
    expect(call).not.toHaveTextContent(/worth|good|fair/i);
  });

  it("omits facts it doesn't have", () => {
    render(<BeachVisualHero {...PROPS} surf={{ size: null, swell: null, wind: null, bestWindow: null }} beachDay={{ water: null, nextLow: null, advisory: null }} />);
    const hero = screen.getByTestId("beach-visual-hero");
    expect(hero.textContent).not.toMatch(/null|NaN|undefined/);
    expect(screen.queryByText(/beach day today/i)).toBeNull();
  });

  it("drops the date from the H1 for a selected window", () => {
    mockParams.set("window", "2026-09-28T15:00:00.000Z");
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Tourmaline\s*Surf Forecast$/);
    mockParams.delete("window");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/utils/beach-forecast-heading.test.ts __tests__/components/beach-detail/visual/beach-visual-hero.test.tsx`
Expected: FAIL, modules not found

- [ ] **Step 3: Implement**

`lib/utils/beach-forecast-heading.ts`:

```ts
export function formatForecastHeadingDate(
  localDate: string | null | undefined,
  timezone: string,
): string | null {
  if (!localDate) return null;
  const date = new Date(`${localDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

/** The H1 after the beach name. A selected window or date drops the date, as today. */
export function beachForecastHeadingSuffix(forecastDate: string | null, hasSelection: boolean): string {
  return !hasSelection && forecastDate ? `Surf Forecast for ${forecastDate}` : "Surf Forecast";
}
```

In `components/beach-detail/public-forecast-answer.tsx`:
- Delete the local `formatForecastDate` (lines 50–64).
- Import `formatForecastHeadingDate` and `beachForecastHeadingSuffix` from `@/lib/utils/beach-forecast-heading`.
- Set `const forecastDate = formatForecastHeadingDate(context?.localDate, timezone);`
- Add an optional prop `title?: string` to `PublicForecastAnswerProps`.
- Render the heading as `{title ?? `${beach.name} ${beachForecastHeadingSuffix(forecastDate, hasSelection)}`}`.
- Remove the now-unused `titleDate` variable.

The existing `PublicForecastAnswer` tests must stay green unchanged. Their expected H1 text is identical.

`components/beach-detail/visual/beach-visual-hero.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { RipCurrentWarning } from "@/components/beach-detail/rip-current-warning";
import { HomeHeroMedia } from "@/components/oracle/zine/home-hero-media";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import type { SwellPartition } from "@/lib/domains/conditions/map-forecast";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";
import { beachForecastHeadingSuffix, formatForecastHeadingDate } from "@/lib/utils/beach-forecast-heading";
import { normalizeForecastDateParam, normalizeForecastWindowParam } from "@/lib/utils/forecast-window-param";
import type { PublicSurfCall } from "@/lib/utils/public-surf-call";

export interface BeachHeroSurfFacts { size: string | null; swell: string | null; wind: string | null; bestWindow: string | null }
export interface BeachHeroDayFacts { water: string | null; nextLow: string | null; advisory: string | null }

interface BeachVisualHeroProps {
  beach: { id: string; name: string; lat: number | null; lon: number | null; city: string | null };
  timezone: string;
  localDate: string;
  forecastLocalDate: string | null;
  photoUrl: string | null;
  sources: BeachSources | null;
  swellPartition: SwellPartition | null;
  call: PublicSurfCall;
  surf: BeachHeroSurfFacts;
  beachDay: BeachHeroDayFacts;
}

const TIER_HEX = { EPIC: "#00D4AA", GOOD: "#00D4AA", FAIR: "#FDB84B", RIDEABLE: "#FDB84B", MEH: "#F4EBD8" } as const;
const BEACH_PRIORITY = ["cam", "photo", "swell", "satellite"] as const;

function sentenceCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function Facts({ items }: { items: Array<string | null> }) {
  const present = items.filter((item): item is string => Boolean(item));
  if (present.length === 0) return null;
  return <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#F5EEDC]/85">{present.map((item) => <span key={item}>{item}</span>)}</p>;
}

export function BeachVisualHero(props: BeachVisualHeroProps) {
  const { beach, timezone, localDate, call, surf, beachDay } = props;
  const searchParams = useSearchParams();
  const hasSelection = Boolean(
    normalizeForecastDateParam(searchParams?.get("date")) || normalizeForecastWindowParam(searchParams?.get("window")),
  );
  const suffix = beachForecastHeadingSuffix(formatForecastHeadingDate(props.forecastLocalDate, timezone), hasSelection);
  const hasBeachDay = Boolean(beachDay.water || beachDay.nextLow || beachDay.advisory);

  return (
    <section data-testid="beach-visual-hero" aria-labelledby="beach-hero-heading">
      <RipCurrentWarning beachId={beach.id} localDate={localDate} timezone={timezone} />
      <HomeHeroMedia
        beachName={beach.name}
        lat={beach.lat}
        lon={beach.lon}
        photoUrl={props.photoUrl}
        sources={props.sources}
        swellPartition={props.swellPartition}
        viewpointPriority={BEACH_PRIORITY}
        storageKey="quiver:beach-hero-viewpoint"
        aspectClassName="aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]"
        onViewpointChange={(viewpoint) =>
          captureClientPostHogEventAfterConsent("beach_hero_viewpoint_changed", { beach_id: beach.id, viewpoint })
        }
      >
        <div className="p-4 sm:p-7">
          <h1 id="beach-hero-heading" className="zine-display m-0 text-[#F5EEDC]">
            <span className="block text-5xl leading-none sm:text-7xl">{beach.name}</span>{" "}
            <span className="mt-2 block font-mono text-xs uppercase tracking-[0.2em] text-[#F5EEDC]/85 sm:text-sm">{suffix}</span>
          </h1>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div data-testid="beach-public-call" className="rounded-2xl border border-[#F5EEDC]/15 bg-[#0D1020]/60 p-4 backdrop-blur">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#F2C94C]">Surfing today · for most surfers</p>
              {call.kind === "call" ? (
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="zine-display text-4xl uppercase" style={{ color: TIER_HEX[call.label] }}>{sentenceCase(call.label)}</span>
                  <span className="text-xl text-[#F5EEDC]" style={{ fontFamily: "var(--font-zine-marker), 'Permanent Marker', cursive" }}>{call.action}</span>
                </p>
              ) : call.kind === "no_call" ? (
                <>
                  <p className="zine-display mt-1 text-3xl text-[#F5EEDC]">No call today</p>
                  <p className="mt-1 text-sm text-[#F5EEDC]/85">{call.reason}</p>
                </>
              ) : null}
              <Facts items={[surf.size, surf.swell, surf.wind, surf.bestWindow ? `best ${surf.bestWindow}` : null]} />
            </div>
            {hasBeachDay ? (
              <div className="rounded-2xl border border-[#F5EEDC]/15 bg-[#0D1020]/60 p-4 backdrop-blur">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#F2C94C]">Beach day today</p>
                {beachDay.water ? <p className="zine-display mt-1 text-4xl text-[#7FDCF0]">{beachDay.water}</p> : null}
                <Facts items={[beachDay.nextLow, beachDay.advisory]} />
              </div>
            ) : null}
          </div>
        </div>
      </HomeHeroMedia>
    </section>
  );
}
```

The tier word keeps sentence case in the DOM so its accessible name reads "Fair". The display uppercases it with CSS, as home does. `backdrop-blur` is decorative; if the project avoids it, delete the class.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/utils/beach-forecast-heading.test.ts __tests__/components/beach-detail/visual/beach-visual-hero.test.tsx __tests__/components/beach-detail`
Expected: PASS, including the existing `PublicForecastAnswer` and beach-detail suites

- [ ] **Step 5: Commit**

```bash
git add lib/utils/beach-forecast-heading.ts components/beach-detail/visual/beach-visual-hero.tsx components/beach-detail/public-forecast-answer.tsx __tests__/lib/utils/beach-forecast-heading.test.ts __tests__/components/beach-detail/visual/beach-visual-hero.test.tsx
git commit -m "feat(beach): visual hero with the public call and a beach-day answer"
```

---

### Task 9: Compose the visual page

**Files:**
- Create: `components/beach-detail/visual/beach-visual-shell.tsx`, `components/beach-detail/zine/zine-about-spot.tsx`
- Modify: `components/beach-detail/zine/zine-hero.tsx`, `components/beach-detail/beach-tabs.tsx`, `components/beach-detail.tsx`, `app/beach/[slug]/beach-detail-client.tsx`, `app/[intent]/[city]/[beachSlug]/page.tsx`
- Test: `__tests__/components/beach-detail/beach-tabs-visible.test.tsx`, `__tests__/components/beach-detail/visual/zine-about-spot.test.tsx`

**Interfaces:**
- Consumes everything from Tasks 1–8.
- Produces:
  - `BeachTabs` gets `visibleTabs?: readonly BeachTabValue[]`; the default is all five.
  - `ZineAboutSpot({ beach, open }: { beach: Beach; open?: boolean })`
  - `BeachVisualShell({ children })`
  - `BeachDetail` gets `layout?: "zine" | "visual"` (default `"zine"`) and `visualTop?: ReactNode`.

- [ ] **Step 1: Write the failing tests**

`__tests__/components/beach-detail/beach-tabs-visible.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { BeachTabs } from "@/components/beach-detail/beach-tabs";

jest.mock("@/hooks/use-track-event", () => ({ useTrackEvent: () => ({ track: jest.fn() }) }));

describe("BeachTabs visibleTabs", () => {
  it("shows only the tabs it's given", () => {
    render(
      <BeachTabs activeTab="reviews" onTabChange={jest.fn()} visibleTabs={["reviews", "intel", "sessions"]}>
        <div />
      </BeachTabs>,
    );
    expect(screen.getAllByRole("tab").map((t) => t.textContent?.trim().toLowerCase())).toEqual(
      expect.arrayContaining([expect.stringContaining("review"), expect.stringContaining("intel"), expect.stringContaining("session")]),
    );
    expect(screen.queryByRole("tab", { name: /forecast/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /overview/i })).toBeNull();
  });

  it("keeps all five by default", () => {
    render(<BeachTabs activeTab="forecast" onTabChange={jest.fn()}><div /></BeachTabs>);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });
});
```

`__tests__/components/beach-detail/visual/zine-about-spot.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { ZineAboutSpot } from "@/components/beach-detail/zine/zine-about-spot";
import type { Beach } from "@/types/database";

const BEACH = {
  id: "b1", name: "Tourmaline", skill_level: "beginner", break_type: "point",
  average_rating: 4.2, review_count: 12, best_conditions_prose: "Best on a small SW swell with morning glass.",
} as unknown as Beach;

describe("ZineAboutSpot", () => {
  it("keeps the editorial text and spot facts in the page", () => {
    render(<ZineAboutSpot beach={BEACH} open />);
    expect(screen.getByText("Best on a small SW swell with morning glass.")).toBeInTheDocument();
    expect(screen.getByText("BEGINNER")).toBeInTheDocument();
    expect(screen.getByText("POINT")).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAttribute("open");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/components/beach-detail/beach-tabs-visible.test.tsx __tests__/components/beach-detail/visual/zine-about-spot.test.tsx`
Expected: FAIL. `visibleTabs` is ignored (5 tabs), and `zine-about-spot` isn't found.

- [ ] **Step 3: Implement, part A: shared pieces**

1. **`BeachTabs`:**
   - Add `visibleTabs?: readonly BeachTabValue[]` to `BeachTabsProps`, defaulting to `["overview", "forecast", "reviews", "intel", "sessions"]`.
   - Wrap each of the five `<TabsTrigger value="…">` elements in `{visibleTabs.includes("…") ? (…) : null}`.

2. **`ZineAboutSpot`:**
   - Move the `<details className="mt-6 …">…About this spot · ratings &amp; ideal conditions…</details>` block from `zine-hero.tsx` into a new `components/beach-detail/zine/zine-about-spot.tsx`, exporting `ZineAboutSpot({ beach, open = false })`.
   - Move the `skill`, `breakType`, `rating`, `reviewCount` and `filledStars` derivations with it, and the imports of `MetaItem`, `Divider`, `RatingStamp`, `ReviewCircle`, `SkillBars` and `DoodleReef` from wherever `zine-hero.tsx` imports them.
   - Render it as `<details className="mt-6 border-t border-[#11100D]/30 pt-4" open={open}>` with the same summary and body.
   - In `zine-hero.tsx`, replace the moved block with `<ZineAboutSpot beach={beach} />`. The zine layout's output is unchanged.

3. **`BeachVisualShell`:**

```tsx
import type { ReactNode } from "react";

/** The visual beach page sits on the site's twilight stage, not the zine's cream paper. */
export function BeachVisualShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-4 text-[#F5EEDC] sm:px-7">{children}</div>;
}
```

- [ ] **Step 4: Run the tests to verify part A**

Run: `npx jest __tests__/components/beach-detail/beach-tabs-visible.test.tsx __tests__/components/beach-detail/visual/zine-about-spot.test.tsx __tests__/components/beach-detail`
Expected: PASS. Existing zine and hero tests stay green.

- [ ] **Step 5: Implement, part B: `BeachDetail` visual layout.** In `components/beach-detail.tsx`:

   1. **New props.** Add `layout?: "zine" | "visual"` and `visualTop?: ReactNode` to `BeachDetailProps`, and destructure them with `layout = "zine"`.
   2. **Default tab.** Change the tab state initializer to:

```tsx
  const [activeTab, setActiveTab] = useState<BeachTabValue>(
    layout === "visual"
      ? defaultTab && VISUAL_TABS.includes(defaultTab) ? defaultTab : "reviews"
      : defaultTab || "forecast",
  );
```

   Define `const VISUAL_TABS: readonly BeachTabValue[] = ["reviews", "intel", "sessions"];` at module scope.

   3. **Week model.** Near the other derived data (after `forecasts` from `useBeachDetailData`), add:

```tsx
  const week = useMemo(
    () => (layout === "visual" && beach ? buildBeachWeek(forecasts || [], beach as Beach, beachTimezone || beach.timezone || DEFAULT_TIMEZONE) : []),
    [layout, beach, forecasts, beachTimezone],
  );
```

   `BeachBreadcrumb` is already imported at `components/beach-detail.tsx:51`. Import `buildBeachWeek` from `@/lib/utils/beach-week`, `BeachWeek` from `@/components/beach-detail/visual/beach-week`, `BeachVisualShell` from `@/components/beach-detail/visual/beach-visual-shell`, and `DEFAULT_TIMEZONE` from `@/lib/utils/timezone-constants` if not already imported.

   4. **Wrap the shell.** Move the whole `<ZinePageShell …>…</ZinePageShell>` element's children into a local `const pageBody = (<>…</>)`, then render:

```tsx
      {layout === "visual" ? (
        <BeachVisualShell>
          <BeachBreadcrumb beach={beach as Beach} className="mb-3" />
          {visualTop}
          <BeachWeek days={week} timezone={beachTimezone || beach.timezone || DEFAULT_TIMEZONE} />
          {pageBody}
        </BeachVisualShell>
      ) : (
        <ZinePageShell
          beach={beach as Beach}
          beachPhoto={beachPhoto}
          sources={sources}
          heroHeadingLevel={heroHeadingLevel}
          heroHeadingSuffix={heroHeadingSuffix}
          heroSummarySlot={heroSummarySlot}
          heroForecastSlot={heroForecastSlot}
        >
          {pageBody}
        </ZinePageShell>
      )}
```

   5. **Limit the tabs.** Inside `pageBody`, give `<BeachTabs …>` the prop `visibleTabs={layout === "visual" ? VISUAL_TABS : undefined}`. Wrap the Overview and Forecast `<BeachTabContent>` blocks in `{layout !== "visual" ? (…) : null}` so their data and components don't load. Leave everything else in `pageBody` unchanged: the anchor, `beforeTabsContent`, `AlertNudge`, tabs, `CommunityPhotoUpload` and `afterTabsContent`.

   **Pass-through.** In `app/beach/[slug]/beach-detail-client.tsx`, add `layout?: "zine" | "visual"` and `visualTop?: ReactNode` to its props and pass both to `BeachDetail`.

- [ ] **Step 6: Implement, part C: the page.** In `app/[intent]/[city]/[beachSlug]/page.tsx`:

1. **More server reads.** Append `getWaterTempMetaData(beach.id)` and `getTideMetaData(beach.id)` to the end of the existing `Promise.all` array, and destructure them as `waterTemp` and `tideMeta` (after `nearbyResult`). Both are React-cached, so `DeferredRelatedGuidesSection` reuses them.

2. **Keep the full-size photo.** Change the `getSpotFeaturedPhoto(beach.id).then((photo) => …)` entry to return `{ zine: <the existing object, unchanged>, heroUrl: photo ? photo.imageUrl ?? photo.thumbUrl : null }` (or `{ zine: null, heroUrl: null }` when there's no photo). Destructure that slot as `photoResult`, and set `const beachPhoto = photoResult.zine;` and `const heroPhotoUrl = photoResult.heroUrl;`. The zine keeps its thumbnail-first image, and the hero gets the full-size one.

3. **Compute the public call and the Watch window:**

```tsx
    const beachTz = beachTimezone ?? "UTC";
    const publicCall = getPublicSurfCall({
      verdict: surfCallReport?.verdict,
      score: surfCallReport?.score,
      availability: surfCallReport?.recommendationAvailability,
      isTomorrow: surfCallIsTomorrow,
    });
    const windowStart = forecastContext?.displayWindowStart ?? surfCallReport?.bestWindowStart ?? null;
    const windowEnd = forecastContext?.displayWindowEnd ?? surfCallReport?.bestWindowEnd ?? null;
    const watchWindow = selectBeachWatchWindow({
      call: publicCall,
      start: windowStart,
      end: windowEnd,
      forecastAt: forecastContext?.selectedRowTime ?? null,
      timezone: beachTz,
      isTomorrow: surfCallIsTomorrow,
    });
    const hourlyChart = buildHourlyChart(hourlyForecasts, { start: windowStart, end: windowEnd });
    const localDate = getLocalDateString(new Date(), beachTz);
```

4. **Build `visualTop`:**

```tsx
    const visualTop = (
      <>
        <BeachVisualHero
          beach={{ id: publicBeach.id, name: publicBeach.name, lat: publicBeach.lat ?? null, lon: publicBeach.lon ?? null, city: publicBeach.city ?? null }}
          timezone={beachTz}
          localDate={localDate}
          forecastLocalDate={forecastContext?.localDate ?? null}
          photoUrl={heroPhotoUrl}
          sources={cameraUrl ? { camera_url: cameraUrl } : null}
          swellPartition={hourlyForecasts[0] ? rowToSwellPartition(hourlyForecasts[0]) : null}
          call={publicCall}
          surf={{
            size: forecastContext?.waveHeightRangeLabel ?? forecastContext?.waveHeight ?? surfCallReport?.waveHeight ?? null,
            swell: forecastContext?.swellPeriod ? [forecastContext.swellPeriod, forecastContext.swellDirection].filter(Boolean).join(" ") : null,
            wind: forecastContext?.windSpeed ? [forecastContext.windSpeed, surfCallReport?.windType].filter(Boolean).join(" ") : null,
            bestWindow: formatTimeRangeInTimezone(windowStart, windowEnd, beachTz),
          }}
          beachDay={{
            water: waterTemp.tempF != null ? [`${waterTemp.tempF}°F`, waterTemp.wetsuitRec].filter(Boolean).join(" · ") : null,
            nextLow: tideMeta.nextLowTime ? `Low ${tideMeta.nextLowTime}` : null,
            advisory: waterQualityResult?.status === "advisory" || waterQualityResult?.status === "closure" ? "Water-quality advisory" : null,
          }}
        />
        <BeachActions
          beach={{ id: publicBeach.id, slug: beachSlug, name: publicBeach.name }}
          watchWindow={watchWindow}
          score={surfCallReport?.score ?? null}
          shareUrl={`${baseUrl}${buildBeachUrl(publicBeach)}`}
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section aria-labelledby="beach-hourly-heading">
            <h2 id="beach-hourly-heading" className="zine-display text-xl uppercase">Surf, hour by hour</h2>
            <div className="mt-3"><BeachHourlyChart chart={hourlyChart} timezone={beachTz} /></div>
          </section>
          <BeachDayColumn
            beachId={publicBeach.id}
            timezone={beachTz}
            localDate={localDate}
            waterTemp={waterTemp}
            tide={tideMeta}
            waterQuality={waterQualityResult}
            links={{
              waterTemp: waterTemp.tempF != null ? `${buildBeachUrl(publicBeach)}/water-temp` : null,
              tides: tideMeta.nextLowTime ? `${buildBeachUrl(publicBeach)}/tides` : null,
            }}
          />
        </div>
      </>
    );
```

   `hourlyForecasts[0]` is a `PublicForecastHour`, which includes the `swell_*` fields `rowToSwellPartition` reads. If TypeScript rejects the narrower type, pass `rowToSwellPartition(hourlyForecasts[0] as Parameters<typeof rowToSwellPartition>[0])`. The OM fields are simply absent, which `rowToSwellPartition` already treats as null.

5. **Render with the visual layout:**
   - Pass `layout="visual"` and `visualTop={visualTop}` to `BeachDetailClient`.
   - Remove `heroForecastSlot` (the zine hero isn't rendered).
   - Set `beforeTabsContent` to the nearby spots: `<Suspense fallback={null}><DeferredZineNearbySpots beach={beach} nearbyBeachesRaw={nearbyBeachesRaw} /></Suspense>`.
   - Replace `afterTabsContent` with:

```tsx
            afterTabsContent={
              <div className="space-y-10 text-[#11100D]">
                <section aria-labelledby="about-heading" className="rounded-2xl bg-[#F4EBD8] p-5 sm:p-7">
                  <h2 id="about-heading" className="zine-display text-2xl uppercase">About {publicBeach.name}</h2>
                  <ZineAboutSpot beach={publicBeach} open />
                  <div className="mt-4"><AmenitiesBadges amenities={amenitiesResult} /></div>
                  <div className="mt-6">
                    <PublicForecastAnswer
                      beach={publicBeach}
                      waterQuality={waterQualityResult}
                      report={publicForecastReport}
                      context={publicForecastContext}
                      isTomorrow={surfCallIsTomorrow}
                      publicDecisionWindow={{ start: windowStart, end: windowEnd }}
                      nearbyBeaches={nearbyBeachesRaw}
                      headingLevel="h2"
                      title="Forecast details"
                      returnTo={returnTo}
                    />
                  </div>
                  <details className="mt-6">
                    <summary className="cursor-pointer text-base font-bold">Full hourly table</summary>
                    <PublicForecastHourly
                      beachName={publicBeach.name}
                      forecastHours={hourlyForecasts}
                      context={publicForecastContext}
                      forecastDay={hourlyForecastDay}
                      returnTo={returnTo}
                    />
                  </details>
                  <section aria-labelledby="faq-heading" className="mt-6">
                    <h2 id="faq-heading" className="zine-display text-xl uppercase">Frequently asked</h2>
                    {generateBeachFAQ(publicBeach).map((item) => (
                      <details key={item.question} className="border-t border-[#11100D]/20 py-3">
                        <summary className="cursor-pointer font-semibold">{item.question}</summary>
                        <p className="mt-2 text-sm">{item.answer}</p>
                      </details>
                    ))}
                  </section>
                </section>
                <Suspense fallback={null}>
                  <DeferredRelatedGuidesSection beach={publicBeach} />
                </Suspense>
              </div>
            }
```

   `generateBeachFAQ` items are `{ question: string; answer: string }` (`lib/utils/beach-faq-utils.ts:7-8`). `<details>` content is in the server HTML, so crawlers read it, and the visible FAQ now matches `FAQSchema`.

   - Delete from this route: `ContentPageAppHandoffCta`, `BeachDetailInstallCta` and `StickySignupBar`, with their imports if unused elsewhere in the file.
   - Keep all five structured-data components exactly as they are.

   **Imports to add:**
   - `getPublicSurfCall` from `@/lib/utils/public-surf-call`
   - `selectBeachWatchWindow` from `@/lib/alerts/beach-watch`
   - `buildHourlyChart` from `@/lib/utils/beach-hourly-chart`
   - `rowToSwellPartition` from `@/lib/domains/conditions/map-forecast`
   - `getLocalDateString` from `@/lib/utils/timezone-utils`
   - `formatTimeRangeInTimezone` from `@/lib/utils/date-time`
   - `BeachVisualHero`, `BeachActions`, `BeachHourlyChart` and `BeachDayColumn` from `@/components/beach-detail/visual/*`
   - `ZineAboutSpot` from `@/components/beach-detail/zine/zine-about-spot`
   - `AmenitiesBadges` from `@/components/beach-detail/amenities-badges`
   - `getWaterTempMetaData` and `getTideMetaData`, if not already imported

- [ ] **Step 7: Typecheck and run the suites**

Run: `npx tsc --noEmit -p tsconfig.json && npx jest __tests__/components/beach-detail __tests__/app 2>&1 | tail -20`
Expected: no type errors; all suites PASS. If a snapshot of the beach page shell changes, confirm the diff is only the visual layout, then update it with `npx jest -u <path>`.

- [ ] **Step 8: Check it in the browser.** Start the dev server with `preview_start` (use `.claude/launch.json`; add a `yarn dev` entry on port 3000 if missing) and open `/ca/san-diego/tourmaline`. Verify with `read_page` and a screenshot:
  - a breadcrumb
  - one H1 containing "Tourmaline Surf Forecast"
  - a cam or photo hero with the public call
  - Watch and Share
  - the hourly chart and beach-day column
  - the week
  - nearby spots
  - the Reviews, Local intel and Sessions tabs only
  - the About block with prose, amenities, forecast details, the hourly table and the FAQ
  - no sticky signup bar

  Also run `read_console_messages` and expect no errors. Test a beach without a cam (for example `/nj/seaside-park/seaside-park-seaside-park-nj`) to see the photo or swell fallback.

- [ ] **Step 9: Commit**

```bash
git add components/beach-detail app/beach/[slug]/beach-detail-client.tsx "app/[intent]/[city]/[beachSlug]/page.tsx" __tests__/components/beach-detail
git commit -m "feat(beach): compose the visual beach page; retire the signup bar and generic app pitches"
```

---

### Task 10: The signed-out contract in end-to-end tests, and docs

**Files:**
- Modify: `e2e/guest-anonymous-cta-reduction.spec.ts`, `e2e/usage-critical.spec.ts:212-232`, `e2e/prod-readonly/guest-ui.spec.ts:120-130`, `components/beach-detail/ARCHITECTURE.md`

**Interfaces:**
- Consumes the test ids from Tasks 7–9: `beach-visual-hero`, `beach-public-call`, `beach-watch-button`, `beach-share-button`, `beach-week`, `beach-hourly-chart` and `beach-day-column`.

- [ ] **Step 1: Rewrite the contract spec.** In `e2e/guest-anonymous-cta-reduction.spec.ts`:
  - **Keep:** the tests at `:50`, `:63`, `:73` and `:80`. They assert absences that remain true.
  - **Delete:** the `:196` test, whose target never exists.
  - **Replace** `:101`, `:133`, `:152`, `:181`, `:233` and `:263` with:

```ts
  test("a signed-out visitor sees the surf call, for most surfers", async ({ page }) => {
    const call = page.getByTestId("beach-public-call");
    await expect(call).toBeVisible();
    await expect(call).toContainText(/for most surfers/i);
    await expect(call).toContainText(/Epic|Good|Fair|Rideable|Meh|No call today/);
  });

  test("one primary action (Watch or Open in the app) plus Share, and no signup asks", async ({ page }) => {
    await expect(page.getByTestId("beach-share-button")).toBeVisible();
    const watch = page.getByTestId("beach-watch-button");
    if (await watch.count()) await expect(watch).toContainText(/Watch|Open in the app/);
    await page.mouse.wheel(0, 4000);
    await expect(page.getByTestId("sticky-signup-bar")).toHaveCount(0);
    await expect(page.getByTestId("inline-signup-cta")).toHaveCount(0);
    await expect(page.locator('[data-testid^="content-page-app-handoff-cta"]')).toHaveCount(0);
  });

  test("the visual sections render", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Surf Forecast/);
    await expect(page.getByTestId("beach-visual-hero")).toBeVisible();
    await expect(page.getByTestId("beach-week")).toBeVisible();
    await expect(page.getByTestId("beach-hourly-chart")).toBeVisible();
  });
```

- [ ] **Step 2: Update the other specs:**
  - **`e2e/usage-critical.spec.ts:212-232`:** replace the signup-element requirement with `await expect(page.getByTestId("beach-share-button")).toBeVisible();`.
  - **`e2e/prod-readonly/guest-ui.spec.ts:120-130`:** add `page.getByTestId("beach-public-call")` to the accepted set.

- [ ] **Step 3: Run the changed specs against local dev**

Run: `npx playwright test e2e/guest-anonymous-cta-reduction.spec.ts e2e/usage-critical.spec.ts --project=guest`
Expected: PASS. If the `guest` project needs a base URL, follow `e2e/README.md`. Don't point it at production.

- [ ] **Step 4: Update `components/beach-detail/ARCHITECTURE.md`.**
  - Replace the stale "Component Hierarchy" and `BeachHero` sections (the hardcoded "128 reviews" description) with the two layouts:
    - `zine`: water-temp and tides subpages, the Mexico and international routes
    - `visual`: `/[state]/[city]/[beach]`
  - List the visual layout's sections in order.
  - Add the rules:
    - public call via `getPublicSurfCall`
    - no "Clean"
    - no per-day water temperature
    - Watch vs "Open in the app" via `NATIVE_SELECTED_WINDOW_WATCH`
    - H1 words unchanged
    - every indexable block kept
  - List the tests.

- [ ] **Step 5: Commit**

```bash
git add e2e/guest-anonymous-cta-reduction.spec.ts e2e/usage-critical.spec.ts e2e/prod-readonly/guest-ui.spec.ts components/beach-detail/ARCHITECTURE.md
git commit -m "test(e2e): signed-out beach page contract for the visual layout; docs"
```

---

### Task 11: Full verification and release notes

**Files:**
- Create: `.planning/2026-09-27-beach-page-redesign/baseline.md`

- [ ] **Step 1: Full checks, CI-style**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
npx eslint components/beach-detail components/oracle/zine lib/utils lib/alerts "app/[intent]/[city]/[beachSlug]"
CI=true NEXT_PUBLIC_MAPBOX_TOKEN= npx jest __tests__/components/beach-detail __tests__/components/oracle __tests__/lib/utils __tests__/lib/alerts __tests__/config
```
Expected: no type or lint errors; all suites PASS. Fix any failure in the same branch, including pre-existing failures you run into (Steven's rule).

- [ ] **Step 2: Record the baseline.** The success measure compares 4 weeks before and after release. Write `.planning/2026-09-27-beach-page-redesign/baseline.md` with the numbers from:
  - **PostHog** (read-only `execute-sql` via the PostHog MCP): for beach pages (`match($pathname, '^/[a-z]{2}/[^/]+/[^/]+/?$')`) over the 28 days before release, human traffic only (`$virt_is_bot != true`), count:
    - `page_view` visitors
    - `scroll_depth` events past 50%
    - `app_handoff_link_opened`
    - `native_install_attribution_joined`
  - **Search Console:** beach-page clicks and impressions for the same 28 days (`scripts/gsc-stats.py` or the query used on 2026-09-27).

- [ ] **Step 3: Hand off.** Stop. Report to Steven:
  - what changed
  - test results with the exact commands
  - screenshots from Task 9 Step 8
  - that `NATIVE_SELECTED_WINDOW_WATCH` is `false` until the native plan ships
  - that release is one deploy followed by a 4-week hold before the next SEO template
  - the rollback trigger: beach-page Search Console clicks down more than 20% not explained by seasonality

  Pushing, the PR, and the prod promotion (`reference_prod_release_by_cherry_pick_pr`) need his approval.
