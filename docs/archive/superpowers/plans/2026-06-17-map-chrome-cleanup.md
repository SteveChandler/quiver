# /map chrome cleanup — consolidated toolbar, region nav, remove sidebar

**Date:** 2026-06-17
**Branch:** `feature/surf-map-brand-reskin` (build on top; do NOT branch from `main` — the swell-field work lives only here)
**Executor:** Codex
**Validate against:** the current working tree of the branch above (this plan's file:line refs were read from it, not from `main`).

---

## Goal

Make `/map` feel professional by fixing three things the owner called out:

1. **Two stacked header bars** under the global site header → collapse into **one** clean toolbar.
2. **No way to view another region** (the only cross-region search is buried in the global header and is desktop + logged-in only) → add an **always-visible search box + region quick-jump pills** to the toolbar, working for anonymous and mobile users.
3. **Desktop "Surf Spots" sidebar** looks out of place → **remove it**; the map goes full-width. List browsing already lives in the **List** view mode (`BeachList`), which stays.

Keep everything else as-is: the swell-field animation, its layer selector, field legend, forecast timeline, condition legend, and the coastal camera leash. The animation is good; do not touch the WebGL field or `swell-particle-layer.ts`.

## Non-goals / out of scope

- No change to the swell-field rendering, particle math, colors, or the leash logic in `components/map/interactive-map.tsx` (the leash already re-applies correctly after a region jump — see "Leash interaction").
- No backend/API/DB changes. Reuse the existing `useBeachSearch` search (full-table load + fuzzy match) and `loadNearbyBeaches`.
- No removal of the **mobile** bottom sheet (`MapBottomSheet`) in this pass (see "Open decision").

---

## Locked decisions (from the owner)

- Region nav = **search box + region pills** (both), as the primary controls in the new toolbar.
- Remove the **desktop** Surf Spots sidebar; map full-width.
- Keep **List** view mode and the **Map/List** toggle (List mode is where the list now lives).
- Consolidate the two in-page bars into one toolbar.

## Open decision (flag to owner, default chosen)

- **Mobile bottom sheet** (`MapBottomSheet`, `components/map-view.tsx:451`): the owner's complaint was the *desktop* left list. Default for this plan: **keep** the mobile bottom sheet (it is the standard mobile pattern and a different component). If the owner wants full parity (markers + List mode on mobile too), it is a one-line removal — note it, do not do it without confirmation.

---

## Current state (what exists today)

Orchestrator: `components/map-view.tsx`.

- **Bar 1** — `MapSearchHeader` (`components/map/map-search-header.tsx`), rendered at `map-view.tsx:319`. `sticky top-0`. Holds **"Use Near Me"** + **Map/List** segmented toggle. Its search props are already deprecated/removed (search moved to the global header).
- **Bar 2** — inline `<div className="sticky top-[64px] ...">` at `map-view.tsx:332`. Holds **region Tabs** (`Tabs/TabsList/TabsTrigger`, values from `regions`) + **filter chips** (Beginner-friendly, break types, Clear all) + the **swell-field toggle** button (`data-testid="swell-field-toggle"`).
  - The two bars at `top-0` and `top-[64px]` are the "two headers."
- **Desktop sidebar** — `map-view.tsx:408-418`, `{!isMobile && <div className="flex w-[380px] shrink-0 border-r"><MapSidebar .../></div>}`. Remove this.
- **Map** — `MapContent` (`components/map/map-content.tsx`) renders `InteractiveMap` keyed on `` `${mapCenter.lat.toFixed(4)}-${mapCenter.lon.toFixed(4)}` `` (`map-content.tsx:222`). `mapCenter` priority (`map-content.tsx:122-156`): `selectedBeach` → `searchQuery` first result → `userLocation` → Mission Beach default.
- **List mode** — `viewMode === "list"` renders `<BeachList .../>` (`map-view.tsx:466-480`). Full list lives here; unaffected by sidebar removal.
- **Region tabs today** drive `regionViewport` (`map-view.tsx:254-314`) → in-place `fitBounds/easeTo` on the live map (`interactive-map.tsx:1157-1189`). That path is **clamped by the swell-field leash** (the bug behind "region tabs don't really move"). We replace it with the remount path (below).

`useBeachSearch` (`hooks/use-beach-search.ts`) already returns everything we need: `searchQuery`, `setSearchQuery`, `clearSearch`, `filteredBeaches`, `setSelectedBeach`, `loadBeaches`, `loadNearbyBeaches`, `regions`, filters + toggles. The search auto-loads the full beach table when `searchQuery` is non-empty (`use-beach-search.ts:242-252`), so an in-toolbar input gives cross-region search with **no auth gate**.

Existing test/E2E references (blast radius): `__tests__/components/map/map-search-header.test.tsx`, `__tests__/components/map/map-content.test.tsx`, `e2e/map.spec.ts`, `e2e/map-use-near-me.spec.ts`, `e2e/usage-critical.spec.ts`, `e2e/map-swell-field.spec.ts`.

---

## Target architecture

```
app/map (global site header above, 64px)
└─ MapView
   ├─ <MapToolbar>                         ← NEW, single bar, replaces Bar 1 + Bar 2
   │    Row 1: [🔍 search input (+ suggestions)] [📍 Use my location] [Map | List]
   │    Row 2: [ region pills (scroll) ]            [ filter chips · swell toggle ]
   └─ content
        map mode → <MapContent> full-width (no desktop sidebar)
        list mode → <BeachList> (unchanged)
        mobile    → <MapBottomSheet> (kept)
```

### Region navigation = remount path (leash-safe)

Both new nav controls move the camera by changing `mapCenter` (the `InteractiveMap` `key`), which **remounts** the map fresh at the destination. A fresh map has no `maxBounds`/zoom-lock, and the leash effect then re-applies around the new region's beaches. **Therefore region nav works even while the swell field is ON** — no change to the leash code.

- **Search box** → sets `searchQuery` → `filteredBeaches[0]` becomes the center (existing `mapCenter` branch) → remount.
- **Region pill** → sets a new `mapFocusCenter` state + clears selection/search + `loadNearbyBeaches(center)` → `mapCenter` resolves to `mapFocusCenter` → remount.

### `mapCenter` priority (updated)

In `map-content.tsx`, extend the `mapCenter` `useMemo` to accept a new `focusCenter` prop and slot it **above `userLocation`, below `selectedBeach`/`searchQuery`**:

```
selectedBeach  →  searchQuery result  →  focusCenter (region pill)  →  userLocation  →  Mission Beach default
```

Clear `mapFocusCenter` (`setMapFocusCenter(null)`) inside `handleBeachSelect`, on search input change, and on "Use my location", so a stale region focus never pins the camera.

---

## Region pills constant (starter curation — Codex may adjust)

Create `components/map/map-regions.ts`:

```ts
// Quick-jump region centers for the /map toolbar. lat/lon (never lng in new code).
// Each click loads nearby beaches (30mi) around the center and recenters via remount.
export interface MapRegionPill {
  id: string;
  label: string;       // short toolbar label
  center: { lat: number; lon: number };
}

export const MAP_REGION_PILLS: MapRegionPill[] = [
  { id: "san-diego",    label: "San Diego",   center: { lat: 32.79, lon: -117.25 } },
  { id: "orange-county",label: "OC",          center: { lat: 33.63, lon: -117.95 } },
  { id: "los-angeles",  label: "LA / South Bay", center: { lat: 33.88, lon: -118.41 } },
  { id: "ventura-sb",   label: "Ventura / SB",center: { lat: 34.34, lon: -119.50 } },
  { id: "central-coast",label: "Central Coast", center: { lat: 36.96, lon: -122.02 } }, // Santa Cruz
  { id: "bay-area",     label: "Bay Area",    center: { lat: 37.76, lon: -122.51 } },   // Ocean Beach SF
  { id: "hawaii",       label: "Hawaii",      center: { lat: 21.66, lon: -158.06 } },   // North Shore
  // Optional / lower data density — include if desired:
  // { id: "pnw",        label: "Pacific NW",  center: { lat: 45.99, lon: -123.93 } },
  // { id: "east-coast", label: "East Coast",  center: { lat: 35.55, lon: -75.47 } },   // Outer Banks
];
```

Lead with the SoCal regions (densest data). Keep the list to ~6-8 pills so the row stays clean.

---

## Implementation phases (TDD: write/adjust the test first where noted)

### Phase 1 — `MapToolbar` component (search + pills + view toggle + filters + swell toggle)

**New file:** `components/map/map-toolbar.tsx`. Props (cohesive, all already available in `MapView`):

```ts
interface MapToolbarProps {
  // search
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onClearSearch: () => void;
  suggestions: Beach[];               // top matches for the dropdown (filteredBeaches.slice(0, 6))
  onSuggestionSelect: (b: Beach) => void;
  // region pills
  regions: MapRegionPill[];
  onRegionSelect: (r: MapRegionPill) => void;
  // location + view
  onUseMyLocation: () => void;
  viewMode: "map" | "list";
  onViewModeChange: (m: "map" | "list") => void;
  // filters
  filters: { beginnerFriendly: boolean; breakTypes: Set<string> };
  onToggleBeginner: () => void;
  onToggleBreakType: (t: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  // swell field
  showSwellField: boolean;
  onToggleSwellField: () => void;
}
```

Layout (clean, single sticky bar, consistent with the existing shadcn app chrome — solid `bg-background`, `border-b`, NO glassmorphism/backdrop-blur per brand law):

- Container: `<div data-testid="map-controls" className="sticky top-0 z-20 bg-background border-b">` with inner padding. (Keep the `map-controls` testid.)
- **Row 1:** search input (`flex-1 max-w-md`, leading search icon, `role="searchbox"`, `aria-label="Search beaches, spots, or cities"`, clear "×" when non-empty). Then **"Use my location"** button. Then the **Map/List** segmented toggle (keep `data-testid="view-mode-map"` / `view-mode-list"` and the existing button structure/labels).
  - Suggestions dropdown: when `searchQuery.trim()` and `suggestions.length`, render an absolutely-positioned list under the input (top ~6), each row showing beach name + city/region; click → `onSuggestionSelect(beach)`; Esc/blur closes; keyboard up/down/enter optional but preferred (a11y).
- **Row 2:** region pills as a horizontally-scrollable row of buttons (`onRegionSelect`). Right-aligned on the same row (wraps on mobile): the filter chips (Beginner-friendly + break types `["beach","point","reef","longboard","bodyboard"]` + "Clear all" with `data-testid="map-clear-all"` when `hasActiveFilters`) and the **swell-field toggle** button — port the existing button verbatim, including `data-testid="swell-field-toggle"`, `aria-pressed`, and the orange-fill/`SWELL_MAP_CTA_CLASS` pressed/idle treatment from `map-view.tsx:379-400`.
- **Mobile:** search is a full-width Row 1; "Use my location" becomes an icon button; region pills + filters are their own horizontal-scroll rows. Keep it compact.

**Test (same commit):** `__tests__/components/map/map-toolbar.test.tsx` — renders the search input; typing calls `onSearchChange`; rendering `suggestions` and clicking one calls `onSuggestionSelect`; each region pill calls `onRegionSelect` with its object; Map/List buttons call `onViewModeChange`; the swell toggle exposes `data-testid="swell-field-toggle"` + `aria-pressed`; "Clear all" appears only when `hasActiveFilters`.

### Phase 2 — Wire `MapToolbar` into `MapView`; delete the two old bars

In `components/map-view.tsx`:

- Add state: `const [mapFocusCenter, setMapFocusCenter] = useState<{ lat: number; lon: number } | null>(null);`
- Add handler:
  ```ts
  const handleRegionSelect = useCallback((r: MapRegionPill) => {
    setSelectedBeach(null);
    clearSearch();
    setMapFocusCenter(r.center);
    lastLocationRef.current = null;
    void loadNearbyBeaches(r.center.lat, r.center.lon);
  }, [setSelectedBeach, clearSearch, loadNearbyBeaches]);
  ```
- In `handleBeachSelect` and the `onUseMyLocation`/`onNearMe` paths, add `setMapFocusCenter(null);`. On search change, also clear it.
- Replace the `<MapSearchHeader>` block (`map-view.tsx:319-329`) **and** the entire `sticky top-[64px]` region/filter `<div>` (`map-view.tsx:332-402`) with a single `<MapToolbar ... />`, passing:
  - `searchQuery`, `onSearchChange={setSearchQuery}`, `onClearSearch={handleClearSearch}`, `suggestions={filteredBeaches.slice(0, 6)}`, `onSuggestionSelect={handleBeachSelect}` (centers + remounts via `selectedBeach`),
  - `regions={MAP_REGION_PILLS}`, `onRegionSelect={handleRegionSelect}`,
  - `onUseMyLocation={() => { setSelectedBeach(null); clearSearch(); setMapFocusCenter(null); lastLocationRef.current = null; getUserLocation(true); }}`,
  - `viewMode`, `onViewModeChange={setViewMode}`, filters + toggles, `showSwellField`, `onToggleSwellField={() => setShowSwellField(v => !v)}`.
- Remove now-unused imports: `MapSearchHeader`, `Tabs/TabsList/TabsTrigger`. Keep `Badge` only if `MapToolbar` does not own the chips (it should; then drop `Badge` from map-view).

### Phase 3 — Remove the desktop sidebar; map full-width

- Delete the `{!isMobile && <div className="flex w-[380px] shrink-0 border-r"><MapSidebar .../></div>}` block (`map-view.tsx:408-418`) and the `MapSidebar` import.
- The content wrapper becomes the map only: `<div className="flex-1 flex min-h-0">` → `<div className="flex-1 relative min-h-0 flex flex-col"><MapContent .../></div>`. Mobile `MapBottomSheet` stays.
- `viewportBeaches` is still used by the mobile sheet + `visibleBeachCount`; keep it. `MapSidebar` component file can stay on disk (unused) or be deleted — deleting is cleaner; if deleted, also delete `map-sidebar`-specific tests.

### Phase 4 — Retire the old region-viewport path

- Remove `regionViewport` state + its `useEffect` (`map-view.tsx:254-314`) and the `activeRegion`/`setActiveRegion` usage tied to the old tabs (pills do not filter; they navigate).
- Stop passing `regionViewport` to `MapContent` (pass nothing). Leave the `regionViewport` prop on `MapContent`/`InteractiveMap` intact and simply unused, to **avoid editing the swell-field file** `interactive-map.tsx`. (Its consumer effect is keyed on `regionViewport?.key`, so it no-ops when undefined.)

### Phase 5 — `MapContent` `focusCenter`

- Add `focusCenter?: { lat: number; lon: number } | null` to `MapContentProps`; thread it from `MapView` (`focusCenter={mapFocusCenter}`).
- In the `mapCenter` `useMemo` (`map-content.tsx:122-156`), insert the `focusCenter` branch **after** the `searchQuery` branch and **before** `userLocation`. Add `focusCenter` to the memo deps.

---

## Test blast radius (update in the SAME commit per CLAUDE.md)

- `__tests__/components/map/map-search-header.test.tsx` — `MapSearchHeader` is removed from `/map`. Either delete this test (if the component is deleted) or leave it if the component file remains but is unimported. Prefer: delete the component + test.
- `__tests__/components/map/map-content.test.tsx` — mocks `InteractiveMap` wholesale; add coverage that `focusCenter` drives `mapCenter` (and thus the remount key). Verify no sidebar/region-tab assertions remain.
- `e2e/map-use-near-me.spec.ts` — if "Use Near Me" is relabeled to "Use my location", update the selector here. Otherwise keep the label.
- `e2e/map.spec.ts`, `e2e/usage-critical.spec.ts` — update any selectors for the moved Map/List toggle, region tabs (now pills), or the removed sidebar. The list view path (`view-mode-list`) must still work.
- `e2e/map-swell-field.spec.ts` — must pass unchanged (the `swell-field-toggle` testid is preserved).
- **New E2E** `e2e/map-region-nav.spec.ts`: (a) toolbar search for an out-of-region beach recenters the map (assert the `InteractiveMap` key / `window.__quiverMapInstance` center changed); (b) clicking a region pill recenters; (c) both work with the swell field toggled ON (remount path); (d) the desktop sidebar is gone (no `w-[380px]` sidebar / no `MapSidebar`).
  - Follow the repo E2E rules: `setupErrorDetection`/`assertNoErrors`, `isVisibleSafe`, no raw `waitForTimeout` without an eslint-disable + reason.

---

## Leash interaction (no code change needed — verify only)

The swell-field leash (`interactive-map.tsx:829-877`) clamps the **live** map (drag-pan, zoom-out, in-place `fitBounds`). Search and region pills navigate by **remounting** the map (new `mapCenter` key), so they are not clamped: the fresh instance re-leashes to the destination region after its beaches load. Confirm in the new E2E that a cross-region search/pill with the field ON actually travels. The only thing still leashed is free dragging/zoom-out, which is intended; to free-roam the user hides the field (unchanged).

---

## Verification checklist (Codex must run before reporting done)

1. `NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck` — clean.
2. `yarn test:unit __tests__/components/map/ components/map/__tests__/` — green (incl. new `map-toolbar` test).
3. `npx playwright test e2e/map.spec.ts e2e/map-use-near-me.spec.ts e2e/map-swell-field.spec.ts e2e/map-region-nav.spec.ts` — green.
4. Scoped lint: `npx eslint --max-warnings=0` on every touched/new file — clean.
5. Live visual check (Playwright MCP or screenshots) at **desktop (1440)** and **mobile (390)**:
   - Exactly **one** in-page toolbar under the global header (no double bar).
   - Map is **full-width** on desktop (no left sidebar).
   - Search box visible **while logged out**; typing a far region recenters the map.
   - Region pills visible; clicking one recenters.
   - Swell field still toggles, animates, and its legend/selector/timeline are intact; region nav works with the field on.
6. `CHANGELOG.md` under `[Unreleased]`: a `Changed` bullet ("`/map`: consolidated toolbar, added region search + quick-jump pills, removed desktop sidebar") and bundle it into the final commit (no CHANGELOG-only commit at HEAD on a Vercel branch).
7. Commit per concern (suggested): `feat(map): consolidated toolbar with search + region pills`; `refactor(map): remove desktop surf-spots sidebar, full-width map`; `refactor(map): retire region-viewport tabs for remount-based region nav`; `test(map): region navigation e2e`. **Do NOT push** unless asked.

---

## Risks / footguns

- **Remount cost:** changing `mapCenter` remounts the whole Mapbox instance (existing behavior for search/selection). Region pills add more of it; acceptable, but do not lower the 4-decimal key precision (that would remount on tiny nudges).
- **`loadNearbyBeaches(center)` is a 30mi radius** — fine for marquee pill centers; spread-out regions may want a slightly different center. Curate `MAP_REGION_PILLS` centers to sit on the densest cluster.
- **Preserve testids** `map-controls`, `view-mode-map`, `view-mode-list`, `swell-field-toggle`, `map-clear-all` or update every referencing spec in the same commit.
- **`?search=` deep-link:** keep the existing URL→`searchQuery` read (`map-view.tsx:119-122`) so `/map?search=...` still works. Optionally also write `?search=` on submit for shareable links (nice-to-have, keep `/map` canonicalization in `app/map/page.tsx` intact).
- **Out-of-area search** already shows a coverage message (`map-content.tsx:261-263`); confirm it still renders from the toolbar input.
- **Do not edit** `components/map/swell-field/*` or the leash block in `interactive-map.tsx`.

---

## Follow-up (Round 2 — Codex) — P2 polish + E2E de-flake

The main change above is **implemented, reviewed (ship-with-nits, 0 P0/P1), and verified live** (one toolbar; full-width map; anonymous search + region pills travel cross-region; both work with the swell field ON and the leash re-applies at the destination; mobile bottom sheet kept; field animates — two canvas frames 1s apart differ). These are the remaining **non-blocking** items. Same branch (`feature/surf-map-brand-reskin`) and same verification gates (typecheck, `yarn test:unit __tests__/components/map/`, scoped eslint, targeted e2e). Commit per concern. Do NOT push.

1. **Delete orphaned dead code** (Phase 3 intent). After the cleanup these are unimported:
   - `components/map/map-search-header.tsx` + `__tests__/components/map/map-search-header.test.tsx`
   - `components/map/map-sidebar.tsx` (+ any `map-sidebar` test, if present)
   - **Do NOT delete `components/map/sidebar-beach-card.tsx`** — it is still imported by the mobile `components/map/map-bottom-sheet.tsx` (grep-confirmed). Leave it and `sidebar-beach-card.test.tsx`.
   - Before deleting, confirm zero imports: `rg "map-search-header|MapSearchHeader|map-sidebar|MapSidebar" components app __tests__ e2e`. Then run typecheck + the map unit suite.

2. **`?search=` URL ↔ state hygiene.** In `components/map-view.tsx`, `handleRegionSelect` and `handleSearchChange` clear/replace search state but never call `stripMapUrlParams(["search"])` (which `handleClearSearch` already uses). So landing on `/map?search=Blacks` then clicking a region pill leaves a stale `?search=Blacks` in the URL while state shows empty search (no visible bug; bad shareable links). Add `stripMapUrlParams(["search"])` to both handlers. Optional nice-to-have: write `?search=<q>` on search submit for shareable deep-links (keep the `/map` canonicalization in `app/map/page.tsx`).

3. **Stale location banner after a region jump.** After a pill/search jump the map banner still reads "Showing beaches near Mission Beach" (driven by `usingDefaultLocation`). When `focusCenter` or a search result is active, the banner should reflect the jumped-to region or be suppressed. File: `components/map/map-content.tsx` (the `usingDefaultLocation` banner copy) — thread `focusCenter`/`searchQuery` so the "near X" copy updates or hides.

4. **a11y polish:**
   - Region pills row (`components/map/map-toolbar.tsx` ~:175): a bare `aria-label="Map regions"` on a non-interactive `<div>` isn't exposed to AT. Wrap in `<nav aria-label="Map regions">` or add `role="group"`.
   - Suggestions dropdown: add arrow up/down roving focus + `role="listbox"`/`role="option"` + `aria-activedescendant` for a real combobox (Escape-to-clear and Tab-through already work).
   - Consistency: `components/map-view.tsx` (~:351) passes raw `getUserLocation` to `BeachList`; pass `handleUseMyLocation` so `mapFocusCenter` is nulled like every other location entry point.

5. **De-flake the swell-field animation E2E** (`e2e/map-swell-field.spec.ts`, test *"animates when motion allowed, static under reduced motion"*). Confirmed **NOT a product bug**: live, the field animates (two `canvas.screenshot()` frames 1s apart differ) and the particle layer honors the reduced-motion skip. The test is fragile because it byte-compares canvas frames without (a) waiting for map `idle` and (b) guaranteeing the field actually has particles seeded — so in the `auth` project the motion-allowed frames can read identical (empty/not-yet-animating field) and the reduced-motion frames can differ (tiles still settling).
   - Before capturing any frame: await `window.__quiverMapInstance` `idle` (style + tiles settled) AND assert the layer is non-empty (confirm particles, not just that the GL layer exists).
   - Reduced-motion leg: capture both frames only after `idle` so tile-settling can't masquerade as motion.
   - Prefer a small pixel-delta tolerance over strict `Buffer.compare === 0` (WebGL readback is not guaranteed bit-identical frame to frame).

6. **De-flake `e2e/map.spec.ts:192`** *"preserve forecast height from list card into beach detail"*. It waits 30s for a List card matching `/…ft/`, which local data doesn't render. Gate on forecast-data presence (skip-with-reason via `throw new Error("Not implemented: no forecast data in env")` per the repo E2E rules) or seed forecast data in the fixture, rather than a hard 30s wait, so it's deterministic.

---

## Follow-up (Round 3) — after the status-overlay + List-view removal

The map status overlay and List view were both removed (map-only experience, swell field defaults ON). That surfaced two items:

7. **Restore out-of-area / no-result search feedback** (regression). The "X is outside our coverage area" message lived in BOTH the deleted status overlay AND `BeachList` (now removed), so searching an uncovered place (e.g. "Bali", "Cornwall") now shows **nothing** — no list, no message. Add feedback to the toolbar search: when `searchQuery.trim()` is non-empty and `filteredBeaches.length === 0`, show a small message in / under the search input or the suggestions dropdown. Reuse `isLikelyOutOfAreaSearch(searchQuery)` + `COVERAGE_MESSAGES` from `lib/constants/coverage-areas.ts` (`getOutOfAreaMessage(q)` + `COVERAGE_AREA_INFO` for out-of-area; fall back to `No beaches match "{q}"` for in-area no-matches). Keep it on-brand (NO glassmorphism — the removed overlay used `bg-white/90 backdrop-blur-sm`; don't reintroduce it). File: `components/map/map-toolbar.tsx`; add a unit test for both branches.

8. **Finish the `BeachList` removal** — the component (`components/map/beach-list.tsx`) and its test (`__tests__/components/map/beach-list.test.tsx`) are **already deleted** (orphaned once List view was removed; verified sole importer was its own test). Remaining cleanup: drop the now-stale references in `components/map/ARCHITECTURE.md` (the `beach-list.tsx` component-structure line, the `### BeachList (Legacy Standalone List)` section ~427-497, and the `data-testid="beach-list"` reference ~1008). Then check whether `hooks/use-beach-list-state.ts` (`useBeachListState`) is now orphaned — `BeachList` was likely its only consumer (`rg useBeachListState components app`); if so, delete the hook + its ARCHITECTURE.md section (~625) too.
