# Tap-water conditions callout — design

**Date:** 2026-06-29
**Surface:** Quiver web `InteractiveMap`, enabled only in the `/embed/map` WebView (native iOS Explore map)
**Status:** Approved design, pre-implementation

## Goal

When a user taps open water on the embed map, show a radial callout pinned to the
nearest beach that renders that beach's three swell/wind inputs as labeled,
directional banner-arrows converging on the beach — primary swell (S1), secondary
swell (S2), and wind. Mirrors the reference screenshot (banner = arrow, label
inside, head pointing at the beach).

This is a read-only visualization over data already loaded client-side. No new
network calls, no new persisted state.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Data source | **Snap to nearest beach.** An arbitrary pixel has no real-unit forecast; the labels come from the nearest beach's partition data. |
| Trigger | **Tap open water → callout** on nearest beach. **Tap a beach marker → unchanged** (opens spot detail). Two distinct gestures. |
| Surface | **WebView embed only**, behind a new `showConditionsOnTap` prop. Native and web `/map` untouched. |
| Units | **ft + mph** (matches the rest of Quiver; data is already ft/mph). |
| Center label | **Beach name + water temp** (e.g. `Del Mar 68°`); fall back to name-only when that beach's temp is missing. |
| Tap reach | **Only show if the nearest beach is within the current viewport.** A tap far from any beach does nothing — never pin a callout to an off-screen beach. |
| No-data beach | **Center label only, no arrows** — signals "this is the beach, no conditions right now." |
| Number integrity | **Never fabricate.** Show only real partition values; omit any component missing real height/period/direction. Do NOT use `partitionToPoint`'s viz fallbacks. |
| Arrow polarity | Arrowhead = travel direction (`dir + 180`), i.e. inward at the beach. **Verified against a live sim render**, not asserted (wind-particle reversal history). |

## Architecture — three isolated units

### 1. Pure builder — `components/map/conditions-callout.ts`

```ts
export interface CalloutComponent {
  kind: "s1" | "s2" | "wind";
  name: string;       // "SWELL" | "S2" | "WIND"
  bearingDeg: number; // compass bearing the energy COMES FROM
  label: string;      // "2.6ft, 8s" | "1.6ft, 13s" | "8 mph"
  color: string;      // brand hue per component
}

export interface ConditionsCalloutOptions {
  beachName: string;
  tempLabel: string | null;       // "68°" or null
  components: CalloutComponent[];  // 0–3, already filtered to real data
}

export function createConditionsCalloutElement(
  opts: ConditionsCalloutOptions
): { element: HTMLElement };
```

Returns an SVG element (fixed pixel size). Pure DOM, jsdom-unit-testable exactly
like `createClusterMarkerElement`. Renders:

- A fixed-pixel white ring + center dot.
- Center text: `beachName` and, on a second line, `tempLabel` when present.
- One banner-arrow per `CalloutComponent`.

### 2. Pure resolvers — same file or `components/map/conditions-callout-data.ts`

```ts
// Up to 3 real components from a beach's partition; omits null/zero-magnitude.
export function resolveCalloutComponents(p: SwellPartition): CalloutComponent[];

// Nearest beach to a lon/lat among those with coords; null if none.
export function nearestBeach(lon: number, lat: number, beaches: Beach[]): Beach | null;
```

`resolveCalloutComponents` reads raw fields directly (no fabrication):

- **S1:** dir = `swellDirOm ?? s1Dir`; require dir != null and `s1HeightFt > 0`.
  label = `"{s1HeightFt}ft, {s1PeriodS}s"` (drop `, {…}s` if period null).
- **S2:** dir = `s2Dir`; require dir != null and `s2HeightFt > 0`. Same label shape.
- **Wind:** dir = `windDir`; require dir != null and `windMph > 0`. label = `"{windMph} mph"`.

(Heights match per-component partition values, which can differ from the marker's
single combined wave-height number — expected, they are different quantities.)

### 3. Wiring in `interactive-map.tsx` (behind `showConditionsOnTap?: boolean`)

- New prop `showConditionsOnTap` (default `false`). When false, none of the below runs.
- A `map.on("click")` handler (canvas-level; DOM beach markers sit above the canvas
  and do not fire map `click`, so beach taps are unaffected). On click, when
  `showConditionsOnTap` and **not** in placement mode:
  1. `nearest = nearestBeach(tap.lng, tap.lat, loadedBeaches)`.
  2. If `nearest` is null or **outside current `mapBounds`**, do nothing.
  3. Resolve its partition at the current timeline position via
     `partitionAtTimelinePosition(nearest, swellTimelineIndex, partitionsTimelineMap, partitionsMap)`.
  4. `components = resolveCalloutComponents(partition)` (may be empty → center label only).
  5. `tempLabel = waterTempMap.get(nearest.id) ?? null`.
  6. Build the element; drop it as a `mapboxgl.Marker({ element, anchor: "center" })`
     at `[nearest.lon, nearest.lat]`. Store in a ref; remove any previous callout first.
- **Lifecycle:** tap the callout element → remove it. Tap new water → moves to the new
  nearest beach. Tapping the same beach again → toggle off. Opening a beach detail
  (existing beach-marker tap) → also remove any open callout. The marker is pinned, so
  it survives pan/zoom. On timeline scrub while open, rebuild the element in place from
  the new partition.

### 4. Embed opt-in — `app/embed/map/embed-map-client.tsx`

Pass `showConditionsOnTap` to `InteractiveMap`. No other embed change.

## Geometry & rendering (the banner-arrow)

Each banner is built **horizontally** in local coordinates, then rotated:

- Local silhouette (rounded back cap, tapered arrowhead on the right), height 34px:
  `M17,0 H{body} L{tip},17 L{body},34 H17 A17,17 0 0 1 17,0 Z`, filled with the
  component color, `stroke-linejoin: round`.
- Dark name pill (rounded-left, flat-right) over the back cap so no colored "tail"
  pokes out: `M17,0 H{pillW} V34 H17 A17,17 0 0 1 17,0 Z`.
- Name text centered in the pill; value text centered on the colored body. Text is
  **inline** — it inherits the banner rotation (no counter-rotation), so on a steep
  banner it reads bottom-to-top like the reference S2.

Placement that guarantees the arrowhead lands on the beach for any bearing:

```
group transform = translate(cx, cy) rotate(γ) translate(-(bannerLen + gap), -17)
γ (screen deg) = travelDirection = (bearingDeg + 180) mapped to screen = bearingDeg + 90
```

The banner's right end (arrowhead) ends `gap` px from center pointing in `+x`
(= `γ`, toward the beach); the body and name pill swing out to the source side.
Because the arrowhead is the centerward end by construction, every head converges on
the beach regardless of bearing — this was the bug in early mockups (hand-typed
angles), and the construction removes it.

**Readability flip:** when `γ` falls in the left hemisphere (text would render
upside-down), the builder rotates that banner's text run 180° and right-aligns it so
reading still flows name→head. Rare for the San Diego embed (swells from W/NW/S →
heads point E/SE/N → naturally readable), but handled.

**Anti-overlap:** when two components share a near-identical bearing, stagger their
`gap`/length slightly so banners don't fully occlude.

Colors (data, not theme): S1 orange, S2 green, wind cyan. Fixed-pixel throughout so
the ring stays a constant on-screen circle and banners don't scale with zoom.

## Edge cases

> **Frequency (prod, 2026-06-29, 321/321 mappable beaches with a current forecast):**
> 3 arrows **53%**, 2 arrows / no-S2 **36%**, missing-S1 **11%**, **no usable data at all 0%**
> (every beach has usable wind). The all-null branch fires only under a forecast
> outage or client load miss — keep it as a defensive fallback, not a designed-for
> state. The common partial case is no-S2 (~36%), already handled by omit-and-converge.

- **All three components null** → center label only (no arrows). **~0% in practice** (see frequency note).
- **Zero magnitude** (0 ft / 0 mph) → that component omitted (no meaningful direction).
- **Period null but height present** → show height only (`"2.6ft"`).
- **Wind has no period** → `"8 mph"` (by design).
- **Temp missing** for that beach → name-only center label.
- **Tap far from any beach / nearest off-screen** → no callout.
- **Placement (add-spot) mode active** → callout suppressed.
- **Beach near viewport edge** → banners may clip at the map edge; accepted for v1.
- **Reduced motion** → callout is static anyway; unaffected; does not touch the
  animated swell field.

## Testing (TDD)

1. `conditions-callout.test.ts` (builder, jsdom): renders one banner per component
   with correct color/label; omits a null component; renders 0 banners + center
   label when `components` empty; shows name and temp; name-only when temp null.
2. `conditions-callout-data.test.ts`: `resolveCalloutComponents` returns only real
   components, omits null dir / zero height / zero wind, never emits fabricated
   `?? 1` / `?? 8` values; drops period from label when null. `nearestBeach` returns
   closest, skips beaches without coords, returns null on empty.
3. Maestro smoke on the embed: tap open water → callout appears on nearest beach;
   tap a beach marker → still opens spot detail (no regression).
4. **Live polarity check:** capture an iOS sim frame and confirm arrowheads point the
   physically correct way before marking done — do not trust the on-paper `dir+180`.

## Out of scope (YAGNI)

- Exact-pixel interpolation / reconstructed magnitudes.
- Web `/map` wiring.
- Animated arrows.
- Any new network request or persisted state.
- Wind direction word / cardinal text inside the banner (numbers + arrow only).

## Files touched

- **New:** `components/map/conditions-callout.ts` (builder), resolvers (same file or
  `conditions-callout-data.ts`), `__tests__/components/map/conditions-callout.test.ts`,
  `__tests__/components/map/conditions-callout-data.test.ts`.
- **Edit:** `components/map/interactive-map.tsx` (prop + click handler + marker
  lifecycle), `app/embed/map/embed-map-client.tsx` (pass the prop).
- **Evidence:** add a live iOS capture to the plan-024 rollout evidence dir.
