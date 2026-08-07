# Map Hourly Timeline and Camera Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public map's relative, fixed-horizon forecast control with a Windy-style expandable hourly timeline in location-local time, and prevent GPS/default state from reclaiming the camera after a surfer starts exploring.

**Architecture:** Introduce explicit camera commands with monotonic IDs so only initial resolution or deliberate actions move Mapbox; user gestures latch camera ownership. Add a paginated absolute-timestamp timeline envelope to the bulk API, a pure merge/format layer plus controller hook, and a dedicated bottom timeline component. Preserve the legacy embed index contract while adding absolute timestamps.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Mapbox GL, Tailwind CSS, Supabase, Jest/Testing Library, Playwright.

## Global Constraints

- Timeline labels use the viewed location's IANA timezone, not the device timezone, except as a final fallback.
- Forecast frames are keyed by actual `forecast_at` timestamps; never fabricate later hours or carry a stale partition into a missing hour.
- Initial chunk size is 48 hours; prefetch the next chunk inside the final six loaded hours.
- Existing `/api/forecasts/bulk` consumers and native index-based bridge commands remain backward compatible.
- GPS, home, last-viewed, and fallback may choose the initial camera only; after region/search/pin/gesture interaction, only an explicit command may move it.
- Shared clustering behavior remains unchanged.
- No database migration, environment variable, or new dependency.
- Follow `docs/ARCHITECTURE.md`, `components/map/ARCHITECTURE.md`, `app/api/ARCHITECTURE.md`, and `e2e/ARCHITECTURE.md` before editing their surfaces.

---

## File Structure

### Create

- `components/map/map-camera-command.ts` — pure camera command, ownership, and beach-bounds helpers.
- `components/map/hourly-swell-timeline.ts` — absolute timeline types, append/deduplication, timezone labels, and day segmentation.
- `hooks/use-expandable-swell-timeline.ts` — timeline playback, extension, stale-request protection, and exhaustion state.
- `components/map/swell-field/swell-day-timeline.tsx` — Windy-style Quiver timeline presentation and input handling.
- `__tests__/components/map/map-camera-command.test.ts` — camera transition and bounds tests.
- `__tests__/components/map/hourly-swell-timeline.test.ts` — timestamp, timezone, DST, merge, and gap tests.
- `__tests__/hooks/use-expandable-swell-timeline.test.ts` — chunk loading and playback boundary tests.
- `__tests__/components/map/swell-day-timeline.test.tsx` — visual-control semantics and keyboard tests.

### Modify

- `components/map-view.tsx` — issue camera commands, latch user ownership, select location timezone, enable expandable hourly mode.
- `components/map/map-content.tsx` — pass camera commands, user-interaction callback, and timeline mode.
- `components/map/interactive-map.tsx` — apply command IDs, ignore marker-originated generic clicks, report real gestures, own expandable timeline state.
- `components/map/map-regions.ts` — optional configured bounds/timezones for regions that need deterministic framing.
- `components/map/map-beach-loader.ts` — parse the paginated timeline envelope and expose initial data.
- `components/map/swell-field/swell-forecast-timeline.tsx` — retain as the legacy/embed compact control; do not expand it into the new public component.
- `components/map/embed-map-timeline.ts` — absolute label helpers shared with embed compatibility.
- `app/api/forecasts/bulk/route.ts` — paginated hourly query and aligned response envelope.
- `app/embed/map/embed-map-client.tsx` — consume absolute timestamps when available and emit bridge timestamps.
- `components/map/embed-map-bridge.ts` — backward-compatible timestamp field in forecast-time events.
- Relevant unit tests under `__tests__/components/map/`, `__tests__/app/api/forecasts/`, and `components/map/__tests__/`.
- `e2e/map.spec.ts` and `e2e/map-swell-field.spec.ts` — Hawaii ownership and timeline journeys.
- `CHANGELOG.md` — bundle timeline/camera release notes with the final production change commit.

---

### Task 1: Explicit Camera Commands and Ownership

**Files:**
- Create: `components/map/map-camera-command.ts`
- Create: `__tests__/components/map/map-camera-command.test.ts`
- Modify: `components/map/map-regions.ts`
- Modify: `components/map-view.tsx`
- Modify: `components/map/map-content.tsx`
- Modify: `components/map/interactive-map.tsx`
- Modify: `__tests__/components/map-view.test.tsx`
- Modify: `__tests__/components/map/interactive-map.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type MapCameraOwner = "initial" | "explicit-command" | "user";
  export type MapCameraSource = "home" | "last-viewed" | "gps" | "fallback" | "region" | "search" | "pin";
  export type MapBoundsTuple = [[number, number], [number, number]];
  export interface MapCameraCommand {
    id: number;
    source: MapCameraSource;
    center?: { lat: number; lon: number };
    bounds?: MapBoundsTuple;
    zoom?: number;
  }
  export function createCameraCommand(
    previous: MapCameraCommand | null,
    input: Omit<MapCameraCommand, "id">,
  ): MapCameraCommand;
  export function boundsFromBeaches(beaches: Beach[]): MapBoundsTuple | null;
  ```
- Consumed later by `MapView`, `MapContent`, and `InteractiveMap`.

- [ ] **Step 1: Write failing pure camera tests**

  Cover monotonic IDs, invalid coordinates, and bounds derived from valid beaches:

  ```ts
  it("increments command ids and frames valid beaches", () => {
    const first = createCameraCommand(null, {
      source: "gps",
      center: { lat: 32.77, lon: -117.25 },
    });
    const second = createCameraCommand(first, {
      source: "region",
      bounds: [[-160.3, 18.8], [-154.7, 22.4]],
    });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(boundsFromBeaches([
      { id: "north", lat: 21.67, lon: -158.05 } as Beach,
      { id: "bowls", lat: 21.28, lon: -157.85 } as Beach,
      { id: "bad", lat: null, lon: null } as Beach,
    ])).toEqual([[-158.05, 21.28], [-157.85, 21.67]]);
  });
  ```

- [ ] **Step 2: Run the camera helper test and verify red**

  Run: `yarn test:unit --runInBand __tests__/components/map/map-camera-command.test.ts`

  Expected: FAIL because `map-camera-command.ts` does not exist.

- [ ] **Step 3: Implement the pure command and bounds helpers**

  Use finite `lat`/`lon` validation and return `null` unless at least two valid coordinates produce non-zero bounds. Add deterministic Hawaii metadata:

  ```ts
  export interface MapRegionPill {
    id: string;
    label: string;
    center: { lat: number; lon: number };
    bounds?: MapBoundsTuple;
    timezone?: string;
  }

  // Hawaii region
  bounds: [[-160.3, 18.8], [-154.7, 22.4]],
  timezone: "Pacific/Honolulu",
  ```

- [ ] **Step 4: Write failing `MapView` ownership tests**

  Extend the existing mocked `MapContent` capture to assert:

  ```ts
  it("does not restore GPS ownership after region, pin, or map interaction", async () => {
    render(<MapView />);
    fireEvent.click(screen.getByRole("button", { name: "Hawaii" }));
    expect(lastMapContentProps.cameraCommand.source).toBe("region");

    act(() => lastMapContentProps.onBeachSelect(alaMoana));
    expect(lastMapContentProps.cameraCommand.source).toBe("pin");

    act(() => lastMapContentProps.onUserCameraInteraction({
      action: "pan",
      center: { lat: 21.28, lon: -157.85 },
    }));
    act(() => lastMapContentProps.onMapClick());
    expect(lastMapContentProps.cameraOwner).toBe("user");
    expect(lastMapContentProps.cameraCommand.source).toBe("pin");
  });
  ```

  Add a second test proving `onUseMyLocation` creates a newer `gps` command after user ownership.

- [ ] **Step 5: Run the `MapView` tests and verify red**

  Run: `yarn test:unit --runInBand __tests__/components/map-view.test.tsx`

  Expected: FAIL because camera command/owner props and gesture callback are absent.

- [ ] **Step 6: Replace derived center authority with explicit commands**

  In `MapView`:

  ```ts
  const [cameraOwner, setCameraOwner] = useState<MapCameraOwner>("initial");
  const [cameraCommand, setCameraCommand] = useState<MapCameraCommand | null>(null);

  const issueCameraCommand = useCallback(
    (input: Omit<MapCameraCommand, "id">, owner: MapCameraOwner) => {
      setCameraCommand((previous) => createCameraCommand(previous, input));
      setCameraOwner(owner);
    },
    [],
  );
  ```

  Initial home/last/GPS/fallback resolution may call `issueCameraCommand(..., "initial")` only while owner remains `initial`. Region/search/pin call it with `"explicit-command"`. Real pan/zoom/rotate sets owner to `"user"` without changing the last command. `handleMapClick` may clear selected presentation state but must not clear the command or owner.

  Remove `mapFocusCenter` as a continuous fallback guard. Keep beach loading separate from camera ownership.

- [ ] **Step 7: Apply commands once in `InteractiveMap` and report real gestures**

  Replace the `initialCenter` change effect with:

  ```ts
  const appliedCameraCommandIdRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !cameraCommand) return;
    if (appliedCameraCommandIdRef.current === cameraCommand.id) return;

    releaseSwellFieldLeash(map);
    if (cameraCommand.bounds) {
      map.fitBounds(cameraCommand.bounds, { padding: 48, maxZoom: cameraCommand.zoom ?? 13 });
    } else if (cameraCommand.center) {
      map.flyTo({
        center: [cameraCommand.center.lon, cameraCommand.center.lat],
        zoom: cameraCommand.zoom ?? map.getZoom(),
        duration: 800,
      });
    }
    appliedCameraCommandIdRef.current = cameraCommand.id;
  }, [cameraCommand, isMapReady, releaseSwellFieldLeash]);
  ```

  Register `dragstart`, `zoomstart`, and `rotatestart`; call `onUserCameraInteraction({ action, center })` only when `event.originalEvent` exists, using the map's public `getCenter()` result. `MapView` stores this explored center for nearest-beach timezone resolution but does not turn it into a new camera command. Generic map-click delegation returns early when the target is inside `[data-testid="beach-marker"]` or `[data-conditions-callout="true"]`.

- [ ] **Step 8: Run focused camera tests**

  Run:

  ```bash
  yarn test:unit --runInBand \
    __tests__/components/map/map-camera-command.test.ts \
    __tests__/components/map-view.test.tsx \
    __tests__/components/map/interactive-map.test.tsx
  ```

  Expected: PASS with the repository's existing React `act(...)` console warnings only.

- [ ] **Step 9: Commit the camera fix**

  ```bash
  git add components/map/map-camera-command.ts components/map/map-regions.ts \
    components/map-view.tsx components/map/map-content.tsx components/map/interactive-map.tsx \
    __tests__/components/map/map-camera-command.test.ts \
    __tests__/components/map-view.test.tsx __tests__/components/map/interactive-map.test.tsx
  git commit -m "fix(map): preserve camera ownership while exploring"
  ```

---

### Task 2: Hawaii Camera Regression Journey

**Files:**
- Modify: `e2e/map.spec.ts`

**Interfaces:**
- Consumes: `MapCameraCommand` integration from Task 1.
- Produces: a browser-level guard for region framing, pin selection, delayed GPS, and explicit Near Me recovery.

- [ ] **Step 1: Add a failing Hawaii E2E test**

  Use mocked geolocation at San Diego and stable map APIs. The test must:

  ```ts
  test("Hawaii exploration is not reclaimed by San Diego GPS", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 32.7702, longitude: -117.2525 });
    await page.goto("/map");
    await dismissMapEntryOverlay(page);

    await page.getByRole("button", { name: "Regions and filters" }).click();
    await page.getByRole("button", { name: "Hawaii" }).click();
    await expect.poll(() => readMapCenter(page)).toMatchObject({ region: "hawaii" });

    await tapBeachMarker(page, "Ala Moana Bowls");
    await expect(page.getByText("Ala Moana Bowls")).toBeVisible();
    await expect.poll(() => readMapCenter(page)).toMatchObject({ region: "hawaii" });

    await page.getByRole("button", { name: "Use Near Me" }).click();
    await expect.poll(() => readMapCenter(page)).toMatchObject({ region: "san-diego" });
  });
  ```

  Implement `readMapCenter` through a test-only `window.__quiverMapDebugCenter` value already updated with the production move-end center; do not inspect Mapbox private fields. Implement `tapBeachMarker` using marker accessible names, not arbitrary coordinates.

- [ ] **Step 2: Run the browser regression after the Task 1 fix**

  Run: `BASE_URL=http://localhost:3000 npx playwright test e2e/map.spec.ts --project=auth --workers=1 --grep "Hawaii exploration"`

  Expected: PASS. Task 1's focused unit tests supplied the red phase before the production fix; this step proves the integrated browser behavior.

- [ ] **Step 3: Add only the minimal debug-center/accessibility seams required by the test**

  Expose the last public center in development/test builds:

  ```ts
  if (process.env.NODE_ENV !== "production") {
    window.__quiverMapDebugCenter = { lat: center.lat, lon: center.lng };
  }
  ```

  Read this value in Playwright through an explicit `Window` intersection cast. Do not add a production global declaration and do not expose beach data or user information.

- [ ] **Step 4: Run the Hawaii test three times**

  Run: `BASE_URL=http://localhost:3000 npx playwright test e2e/map.spec.ts --project=auth --workers=1 --grep "Hawaii exploration" --repeat-each=3`

  Expected: 3 passed with no console/page errors.

- [ ] **Step 5: Commit the browser regression guard**

  ```bash
  git add e2e/map.spec.ts
  git commit -m "test(map): guard Hawaii exploration camera ownership"
  ```

---

### Task 3: Paginated Absolute Hourly Timeline API

**Files:**
- Modify: `app/api/forecasts/bulk/route.ts`
- Modify: `__tests__/app/api/forecasts/bulk/route.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface HourlySwellTimeline {
    timestamps: string[];
    partitionsByBeach: Record<string, Array<SwellPartition | null>>;
    hasMore: boolean;
    nextStart: string | null;
  }
  ```
- Query: `timeline=hourly&timelineStart=<ISO>&timelineHours=<1..48>`.
- Existing response keys remain unchanged.

- [ ] **Step 1: Write failing parser and alignment tests**

  Add cases for default 48-hour chunk, explicit start, max-window clamp, aligned null gaps, and one-hour lookahead:

  ```ts
  expect(hourly.data.hourlySwellTimeline).toEqual({
    timestamps: ["2026-07-10T20:00:00.000Z", "2026-07-10T21:00:00.000Z"],
    partitionsByBeach: {
      "beach-1": [expect.objectContaining({ s1HeightFt: 2 }), null],
      "beach-2": [null, expect.objectContaining({ s1HeightFt: 3 })],
    },
    hasMore: true,
    nextStart: "2026-07-10T22:00:00.000Z",
  });
  ```

  Assert the query uses `.gte("forecast_at", startISO).lt("forecast_at", probeEndISO).order("forecast_at")`.

- [ ] **Step 2: Run the API test and verify red**

  Run: `yarn test:unit --runInBand __tests__/app/api/forecasts/bulk/route.test.ts`

  Expected: FAIL because `hourlySwellTimeline` and pagination parameters are absent.

- [ ] **Step 3: Implement strict timeline parameter parsing**

  ```ts
  const DEFAULT_TIMELINE_HOURS = 48;
  const MAX_TIMELINE_HOURS = 48;

  function parseHourlyTimelineWindow(searchParams: URLSearchParams, now: Date) {
    const requestedStart = Date.parse(searchParams.get("timelineStart") ?? "");
    const rawHours = Number.parseInt(searchParams.get("timelineHours") ?? "", 10);
    const hours = Number.isFinite(rawHours)
      ? Math.min(MAX_TIMELINE_HOURS, Math.max(1, rawHours))
      : DEFAULT_TIMELINE_HOURS;
    const startMs = Number.isFinite(requestedStart)
      ? requestedStart
      : Math.floor(now.getTime() / 3_600_000) * 3_600_000;
    const start = new Date(startMs);
    const end = new Date(startMs + hours * 3_600_000);
    const probeEnd = new Date(end.getTime() + 3_600_000);
    return { start, end, probeEnd, hours };
  }
  ```

  Reject malformed explicit `timelineStart` with HTTP 400 instead of silently using now.

- [ ] **Step 4: Build an aligned timeline from actual rows**

  Normalize row timestamps to exact UTC hour keys. Build the sorted union within `[start, end)`, align every requested beach to that union, and insert `null` for absent rows. Determine `hasMore` only from valid rows in `[end, probeEnd)`; set `nextStart` to `end.toISOString()` when true.

  Do not call the legacy nearest-row offset builder for the new envelope.

- [ ] **Step 5: Preserve legacy output and cache behavior**

  Continue returning `swellPartitionTimeline` for current clients. Add `hourlySwellTimeline` only when `timeline=hourly`. Ensure mutation-free GET caching varies by the full query string as it does today.

- [ ] **Step 6: Run focused API tests**

  Run:

  ```bash
  yarn test:unit --runInBand \
    __tests__/app/api/forecasts/bulk/route.test.ts \
    __tests__/components/map/map-beach-loader-partitions.test.ts
  ```

  Expected: PASS.

- [ ] **Step 7: Commit the API contract**

  ```bash
  git add app/api/forecasts/bulk/route.ts \
    __tests__/app/api/forecasts/bulk/route.test.ts \
    __tests__/components/map/map-beach-loader-partitions.test.ts
  git commit -m "feat(map): add paginated hourly swell timeline"
  ```

---

### Task 4: Timeline Domain Utilities and Controller

**Files:**
- Create: `components/map/hourly-swell-timeline.ts`
- Create: `__tests__/components/map/hourly-swell-timeline.test.ts`
- Create: `hooks/use-expandable-swell-timeline.ts`
- Create: `__tests__/hooks/use-expandable-swell-timeline.test.ts`

**Interfaces:**
- Consumes: `HourlySwellTimeline` from Task 3.
- Produces:
  ```ts
  export interface TimelineDaySegment {
    key: string;
    label: string;
    startIndex: number;
    endIndex: number;
  }
  export function mergeHourlyTimeline(current: HourlySwellTimeline, incoming: HourlySwellTimeline): HourlySwellTimeline;
  export function formatTimelineBubble(timestamp: string, timezone: string): string;
  export function segmentTimelineDays(timestamps: string[], timezone: string): TimelineDaySegment[];
  export interface ExpandableTimelineState {
    timestamps: string[];
    partitionsByBeach: Record<string, Array<SwellPartition | null>>;
    index: number;
    isPlaying: boolean;
    isLoadingMore: boolean;
    isExhausted: boolean;
    error: string | null;
  }
  ```

- [ ] **Step 1: Write failing pure utility tests**

  Cover:

  ```ts
  expect(formatTimelineBubble("2026-07-10T23:00:00.000Z", "Pacific/Honolulu"))
    .toBe("Fri 10 — 1 PM HST");

  expect(segmentTimelineDays([
    "2026-11-01T08:00:00.000Z",
    "2026-11-01T09:00:00.000Z",
  ], "America/Los_Angeles")).toHaveLength(1);
  ```

  Test duplicate timestamp replacement, beach-array realignment, null preservation, and incoming chunks delivered out of order.

- [ ] **Step 2: Run utility tests and verify red**

  Run: `yarn test:unit --runInBand __tests__/components/map/hourly-swell-timeline.test.ts`

  Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement timezone formatting and merge utilities**

  Use `Intl.DateTimeFormat(...).formatToParts()` with explicit `timeZone`. Keep UTC ISO timestamps as identity. Merge through a timestamp-indexed intermediate map, then rebuild every beach array in sorted timestamp order. An incoming non-null partition may replace null; null may not erase existing real data.

- [ ] **Step 4: Write failing controller-hook tests**

  Use fake timers and a deferred `loadChunk` mock to prove:

  - index entering `length - 6` loads `nextStart` once;
  - two triggers during one request do not duplicate it;
  - stale completion after `scopeKey` changes is ignored;
  - `hasMore: false` marks exhausted;
  - extension failure preserves loaded frames and pauses playback;
  - reduced-motion playback moves one integer hour per tick.

- [ ] **Step 5: Run hook tests and verify red**

  Run: `yarn test:unit --runInBand __tests__/hooks/use-expandable-swell-timeline.test.ts`

  Expected: FAIL because the hook does not exist.

- [ ] **Step 6: Implement the controller hook**

  ```ts
  interface UseExpandableSwellTimelineArgs {
    scopeKey: string;
    initial: HourlySwellTimeline | null;
    timezone: string;
    loadChunk: (start: string, hours: number, signal: AbortSignal) => Promise<HourlySwellTimeline>;
    reducedMotion: boolean;
  }

  interface UseExpandableSwellTimelineResult extends ExpandableTimelineState {
    timezone: string;
    bubbleLabel: string;
    daySegments: TimelineDaySegment[];
    setIndex: (index: number) => void;
    setPlaying: (playing: boolean) => void;
    retry: () => void;
  }
  ```

  Use one `AbortController` per scope/request generation. Prefetch at six remaining frames. Keep playback at a constant forecast-hours-per-second rate and skip null-only timestamps rather than displaying stale vectors.

- [ ] **Step 7: Run all new domain/controller tests**

  Run:

  ```bash
  yarn test:unit --runInBand \
    __tests__/components/map/hourly-swell-timeline.test.ts \
    __tests__/hooks/use-expandable-swell-timeline.test.ts
  ```

  Expected: PASS.

- [ ] **Step 8: Commit the timeline state layer**

  ```bash
  git add components/map/hourly-swell-timeline.ts hooks/use-expandable-swell-timeline.ts \
    __tests__/components/map/hourly-swell-timeline.test.ts \
    __tests__/hooks/use-expandable-swell-timeline.test.ts
  git commit -m "feat(map): add expandable hourly timeline controller"
  ```

---

### Task 5: Windy-Style Quiver Timeline Component

**Files:**
- Create: `components/map/swell-field/swell-day-timeline.tsx`
- Create: `__tests__/components/map/swell-day-timeline.test.tsx`
- Modify: `components/map/swell-map-theme.ts`

**Interfaces:**
- Consumes `UseExpandableSwellTimelineResult` presentation fields from Task 4.
- Produces:
  ```ts
  interface SwellDayTimelineProps {
    timestamps: string[];
    index: number;
    timezone: string;
    bubbleLabel: string;
    daySegments: TimelineDaySegment[];
    isPlaying: boolean;
    isLoadingMore: boolean;
    isExhausted: boolean;
    error: string | null;
    onIndexChange: (index: number) => void;
    onPlayingChange: (playing: boolean) => void;
    onRetry: () => void;
  }
  ```

- [ ] **Step 1: Write failing component tests**

  Assert:

  ```ts
  expect(screen.getByRole("slider", { name: "Forecast time" }))
    .toHaveAttribute("aria-valuetext", "Fri 10 — 2 PM HST");
  expect(screen.getByTestId("timeline-day-Fri-10")).toHaveTextContent("Fri 10");
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(onIndexChange).toHaveBeenCalledWith(1);
  fireEvent.keyDown(slider, { key: "PageDown" });
  expect(onIndexChange).toHaveBeenCalledWith(24);
  ```

  Cover play/pause names, Home/End, bubble clamping classes, loading live-region copy, exhausted copy, retry, 44px control height, and safe-area padding.

- [ ] **Step 2: Run the component test and verify red**

  Run: `yarn test:unit --runInBand __tests__/components/map/swell-day-timeline.test.tsx`

  Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement semantic timeline structure**

  Use one native range input for slider semantics and a visual day-segment layer with `pointer-events: none`. The active bubble position is:

  ```ts
  const progress = timestamps.length <= 1 ? 0 : index / (timestamps.length - 1);
  const bubbleLeft = `${Math.min(96, Math.max(4, progress * 100))}%`;
  ```

  Render play/pause as a 44px circular Quiver CTA. Use cream surface, ink borders, orange active fill, and existing sticker shadow tokens. Add `pb-[max(0.75rem,env(safe-area-inset-bottom))]` to the fixed timeline container.

- [ ] **Step 4: Implement explicit keyboard behavior**

  Prevent the browser's default range jump when handling keys and call:

  ```ts
  const deltaByKey: Record<string, number> = {
    ArrowLeft: -1,
    ArrowDown: -1,
    ArrowRight: 1,
    ArrowUp: 1,
    PageUp: -24,
    PageDown: 24,
  };
  ```

  Home selects 0; End selects the final index. Clamp every result.

- [ ] **Step 5: Run component tests and scoped lint**

  Run:

  ```bash
  yarn test:unit --runInBand __tests__/components/map/swell-day-timeline.test.tsx
  npx eslint --max-warnings=0 components/map/swell-field/swell-day-timeline.tsx \
    __tests__/components/map/swell-day-timeline.test.tsx
  ```

  Expected: PASS.

- [ ] **Step 6: Commit the timeline UI**

  ```bash
  git add components/map/swell-field/swell-day-timeline.tsx \
    components/map/swell-map-theme.ts \
    __tests__/components/map/swell-day-timeline.test.tsx
  git commit -m "feat(map): add day-segmented forecast timeline"
  ```

---

### Task 6: Public Map Data and Timeline Integration

**Files:**
- Modify: `components/map/map-beach-loader.ts`
- Modify: `components/map/interactive-map.tsx`
- Modify: `components/map/map-content.tsx`
- Modify: `components/map-view.tsx`
- Modify: `__tests__/components/map/map-beach-loader-partitions.test.ts`
- Modify: `__tests__/components/map/map-content.test.tsx`
- Modify: `__tests__/components/map/map-forecast-basic.test.tsx`
- Modify: `e2e/map-swell-field.spec.ts`
- Modify: `e2e/map.spec.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes Tasks 3–5.
- Adds `swellTimelineMode?: "legacy" | "hourly" | "expandable-hourly"` and `viewTimezone?: string` to map props.
- Produces the public `/map` experience with no relative timeline labels.

- [ ] **Step 1: Write failing loader and integration tests**

  Assert the loader calls:

  ```ts
  "/api/forecasts/bulk?beachIds=a,b&timeline=hourly&timelineStart=2026-07-10T20%3A00%3A00.000Z&timelineHours=48"
  ```

  and returns `hourlySwellTimeline`. Assert public `MapContent` passes `swellTimelineMode="expandable-hourly"`, while existing callers without the prop stay legacy.

  In `map-forecast-basic.test.tsx`, assert the new day timeline renders and no text matching `/\+\d+h/` exists.

- [ ] **Step 2: Run integration tests and verify red**

  Run:

  ```bash
  yarn test:unit --runInBand \
    __tests__/components/map/map-beach-loader-partitions.test.ts \
    __tests__/components/map/map-content.test.tsx \
    __tests__/components/map/map-forecast-basic.test.tsx
  ```

  Expected: FAIL on missing envelope parsing and mode wiring.

- [ ] **Step 3: Extend the loader options and response**

  ```ts
  interface BeachLoaderOptions {
    timeline?: "hourly";
    timelineStart?: string;
    timelineHours?: number;
  }

  interface BeachLoaderResult {
    // existing fields
    hourlySwellTimeline: HourlySwellTimeline | null;
  }
  ```

  Construct URL parameters with `URLSearchParams`; do not interpolate unescaped ISO values. Parse malformed envelopes as `null` while preserving marker/current-condition data.

- [ ] **Step 4: Seed and extend timeline state in `InteractiveMap`**

  When `populateLocations` receives initial envelope data, seed `useExpandableSwellTimeline` with a `scopeKey` made from sorted beach IDs plus timezone. Implement `loadChunk` with the same capped beach IDs and an abort signal. Map the controller's active aligned arrays into the existing flow-field interpolation path.

  The new bottom timeline renders only for `expandable-hourly`. Keep `SwellForecastTimeline` in the legend for legacy/embed modes.

- [ ] **Step 5: Resolve the viewed timezone**

  Add a pure nearest-beach timezone helper. `MapView` supplies the selected beach timezone first, then nearest loaded beach to the current explored center, then active region timezone, then `Intl.DateTimeFormat().resolvedOptions().timeZone`.

  Do not use timezone changes to issue camera commands or reload beaches.

- [ ] **Step 6: Remove public relative steps**

  Delete the public `useMemo(() => ["Now", "+3h", ...])` state from `MapView`. Public map passes expandable mode; index/playback/timestamps come from the controller. Keep layer selection in `MapView`.

  Reuse `map_interaction` for `timeline_scrub`, `timeline_play`, `timeline_pause`, and `timeline_extend`. Include active UTC timestamp, timezone, and loaded-horizon hours. Debounce scrubbing and emit no event for playback ticks. Extend the focused analytics assertions to prove event names are bounded and authenticated state is not required.

- [ ] **Step 7: Run all focused map unit tests**

  Run:

  ```bash
  yarn test:unit --runInBand \
    __tests__/components/map-view.test.tsx \
    __tests__/components/map/map-beach-loader-partitions.test.ts \
    __tests__/components/map/map-content.test.tsx \
    __tests__/components/map/map-forecast-basic.test.tsx \
    __tests__/components/map/interactive-map.test.tsx \
    __tests__/components/map/hourly-swell-timeline.test.ts \
    __tests__/hooks/use-expandable-swell-timeline.test.ts \
    __tests__/components/map/swell-day-timeline.test.tsx
  ```

  Expected: PASS.

- [ ] **Step 8: Add timeline E2E coverage and release notes**

  Add browser tests that assert:

  - no `/\+\d+h/` labels appear;
  - active bubble includes a date, hour, and expected mocked location timezone;
  - ArrowRight advances exactly one timestamp hour;
  - PageDown advances one local calendar day;
  - approaching the final six loaded frames triggers a second bulk request and appends day segments;
  - mobile bubble and controls remain within the map viewport;
  - a visible conditions callout remains above the timeline.

  Route the bulk API with two deterministic chunks for extension tests; the second response uses a later `nextStart` and `hasMore: false`.

  Under the first `[Unreleased]` section add:

  ```md
  - **Map forecast timeline now uses real local clock time** (`components/map/*`, `/api/forecasts/bulk`). Replaces relative three-hour labels with an hourly, day-segmented timeline that progressively loads every available forecast hour in the viewed location's timezone.
  - **Map exploration no longer snaps back to GPS/default location** (`components/map-view.tsx`, `components/map/interactive-map.tsx`). Region, search, pin, pan, and zoom interactions retain camera ownership until `Use Near Me` is explicitly selected.
  ```

- [ ] **Step 9: Run public-map E2E**

  Run:

  ```bash
  npx playwright test --list e2e/map.spec.ts e2e/map-swell-field.spec.ts
  BASE_URL=http://localhost:3000 npx playwright test \
    e2e/map.spec.ts e2e/map-swell-field.spec.ts \
    --project=auth --workers=1
  ```

  Expected: all registered map tests pass with `setupErrorDetection`/`assertNoErrors` clean.

- [ ] **Step 10: Commit public map integration, E2E, and release notes together**

  ```bash
  git add components/map-view.tsx components/map/map-content.tsx \
    components/map/interactive-map.tsx components/map/map-beach-loader.ts \
    __tests__/components/map-view.test.tsx \
    __tests__/components/map/map-beach-loader-partitions.test.ts \
    __tests__/components/map/map-content.test.tsx \
    __tests__/components/map/map-forecast-basic.test.tsx \
    __tests__/components/map/interactive-map.test.tsx \
    e2e/map.spec.ts e2e/map-swell-field.spec.ts CHANGELOG.md
  git commit -m "feat(map): enable expandable local-time forecast timeline"
  ```

---

### Task 7: Embed and Native Bridge Compatibility

**Files:**
- Modify: `components/map/embed-map-timeline.ts`
- Modify: `components/map/embed-map-bridge.ts`
- Modify: `app/embed/map/embed-map-client.tsx`
- Modify: `components/map/__tests__/embed-map-bridge.test.ts`
- Modify: `__tests__/components/map/embed-map-timeline.test.ts`

**Interfaces:**
- Existing inbound `{ type: "setForecastTime", payload: { index } }` remains valid.
- Outbound event adds `forecastAt` without removing `index`:
  ```ts
  type ForecastTimeChangedEvent = {
    type: "forecastTimeChanged";
    payload: { index: number; forecastAt?: string };
  };
  ```

- [ ] **Step 1: Write failing bridge compatibility tests**

  Assert old index commands clamp exactly as before and the outbound event includes both fields when timestamps exist:

  ```ts
  expect(posted).toContainEqual({
    type: "forecastTimeChanged",
    payload: { index: 42, forecastAt: "2026-07-12T14:00:00.000Z" },
  });
  ```

- [ ] **Step 2: Run bridge tests and verify red**

  Run:

  ```bash
  yarn test:unit --runInBand \
    components/map/__tests__/embed-map-bridge.test.ts \
    __tests__/components/map/embed-map-timeline.test.ts
  ```

  Expected: FAIL only on the new timestamp behavior.

- [ ] **Step 3: Add optional timestamp fields without changing command semantics**

  Generate labels from absolute timestamps in location timezone when supplied. Keep `LEGACY_EMBED_TIMELINE_STEPS` and legacy query behavior. `timeline=hourly` can consume the first absolute chunk but must continue honoring index commands.

- [ ] **Step 4: Run embed and map bridge tests**

  Run:

  ```bash
  yarn test:unit --runInBand \
    components/map/__tests__/embed-map-bridge.test.ts \
    __tests__/components/map/interactive-map.test.tsx
  ```

  Expected: PASS.

- [ ] **Step 5: Commit compatibility changes**

  ```bash
  git add components/map/embed-map-timeline.ts components/map/embed-map-bridge.ts \
    app/embed/map/embed-map-client.tsx components/map/__tests__/embed-map-bridge.test.ts \
    __tests__/components/map/embed-map-timeline.test.ts
  git commit -m "feat(embed): bridge absolute forecast timestamps"
  ```

---

### Task 8: Final Verification and Release Gate

**Files:**
- Review only; production, test, and release-note edits are committed in Tasks 1–7.

**Interfaces:**
- Consumes all prior tasks.
- Produces release evidence and a clean final branch.

- [ ] **Step 1: Register and rerun targeted E2E**

  Run:

  ```bash
  npx playwright test --list e2e/map.spec.ts e2e/map-swell-field.spec.ts
  BASE_URL=http://localhost:3000 npx playwright test \
    e2e/map.spec.ts e2e/map-swell-field.spec.ts \
    --project=auth --workers=1
  ```

  Expected: all registered map tests pass with `setupErrorDetection`/`assertNoErrors` clean.

- [ ] **Step 2: Run scoped lint and TypeScript**

  Run:

  ```bash
  npx eslint --max-warnings=0 \
    components/map/map-camera-command.ts \
    components/map/hourly-swell-timeline.ts \
    components/map/swell-field/swell-day-timeline.tsx \
    components/map/map-beach-loader.ts \
    components/map/map-content.tsx \
    components/map/interactive-map.tsx \
    components/map-view.tsx \
    hooks/use-expandable-swell-timeline.ts \
    app/api/forecasts/bulk/route.ts \
    app/embed/map/embed-map-client.tsx
  yarn typecheck
  ```

  Expected: both pass with zero warnings from scoped ESLint.

- [ ] **Step 3: Run the focused unit aggregate**

  Run:

  ```bash
  yarn test:unit --runInBand \
    __tests__/components/map-view.test.tsx \
    __tests__/components/map \
    __tests__/hooks/use-expandable-swell-timeline.test.ts \
    __tests__/app/api/forecasts/bulk/route.test.ts \
    components/map/__tests__/embed-map-bridge.test.ts
  ```

  Expected: PASS. Existing `act(...)` warnings are recorded but not introduced by new assertions.

- [ ] **Step 4: Run the production preview build**

  Run: `VERCEL_ENV=preview yarn build`

  Expected: Next.js compilation, TypeScript, static generation, and route collection all pass.

- [ ] **Step 5: Review the complete diff like a PR**

  Run:

  ```bash
  git diff --check
  git status --short
  git diff --stat origin/main...HEAD
  git diff origin/main...HEAD -- components/map app/api/forecasts/bulk/route.ts hooks/use-expandable-swell-timeline.ts e2e/map.spec.ts e2e/map-swell-field.spec.ts
  ```

  Check specifically for stale-frame carry-forward, timezone fallback ambiguity, unbounded fetches, stale async writes, marker click propagation, and camera commands triggered by passive state changes. Fix every actionable finding and rerun affected tests.

- [ ] **Step 6: Run the repository push gate before any push**

  Run:

  ```bash
  source ~/.nvm/nvm.sh
  nvm use 22
  yarn typecheck
  yarn test:unit --bail=0
  ```

  Expected: all unit suites pass. Do not push if either command fails.

---

## Completion Evidence

The implementation is complete only when the handoff reports:

- exact commits and production files changed;
- API compatibility and absence of migrations/env changes;
- focused unit, E2E, lint, typecheck, and preview-build commands with pass/fail results;
- final map E2E pass count;
- camera behavior for Hawaii → Waikiki → Ala Moana Bowls → delayed San Diego GPS;
- timeline behavior through midnight, chunk extension, and exhausted data;
- remaining warnings or risks;
- whether changes are only local, pushed to `main`, or deployed.
