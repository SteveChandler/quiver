# Tap-Water Conditions Callout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user taps open water on the `/embed/map` WebView, show a radial callout pinned to the nearest in-view beach that renders its S1/S2/wind inputs as labeled banner-arrows converging on the beach.

**Architecture:** Three pure, unit-tested units — a data resolver (`conditions-callout-data.ts`), an SVG element builder (`conditions-callout.ts`), and thin wiring inside the shared `InteractiveMap` gated by a new `showConditionsOnTap` prop that the embed alone enables. All data is already client-side (`partitionsMap`, `waterTempMap`); no new network calls or persisted state.

**Tech Stack:** Next.js 16 / React 19 / TypeScript (strict), Mapbox GL JS (`mapboxgl.Marker`), Jest + Testing Library (jsdom), Maestro (E2E on the iOS WebView).

## Global Constraints

- **Surface:** WebView embed only. Native and web `/map` must stay unchanged. Gate every new behavior behind `showConditionsOnTap` (default `false`).
- **Units:** feet + mph. Data is already ft (`s1HeightFt`/`s2HeightFt`) and mph (`windMph`). No conversion.
- **Number integrity:** Never display fabricated values. Do NOT use `partitionToPoint`'s viz fallbacks (`?? 1`, `?? 8`). Omit any component lacking a real direction or a positive magnitude.
- **Coordinates:** `lon`/`lat` only — never `lng` in new code. `beach.lat`/`beach.lon` (not `beach.latitude`).
- **Arrow polarity:** arrowhead = travel direction = `bearing + 180` (inward at the beach). Screen rotation `γ = bearing + 90`. **Verified against a live iOS sim render before done** — do not trust the on-paper convention (wind-particle reversal history).
- **Component colors:** S1 `#F2A24C`, S2 `#7AC74F`, wind `#74C7E3`.
- **Commit style:** Conventional Commits (`feat:`, `test:`). Atomic commits per task.

---

### Task 1: Component resolver — real values only

**Files:**
- Create: `components/map/conditions-callout-data.ts`
- Test: `__tests__/components/map/conditions-callout-data.test.ts`

**Interfaces:**
- Consumes: `SwellPartition` from `@/app/api/forecasts/bulk/route` (fields: `s1Dir`, `swellDirOm?`, `s1PeriodS`, `s1HeightFt`, `s2Dir`, `s2PeriodS`, `s2HeightFt`, `windDir`, `windMph` — all `number | null`).
- Produces: `CalloutComponent` interface and `resolveCalloutComponents(partition: SwellPartition): CalloutComponent[]`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/map/conditions-callout-data.test.ts
import {
  resolveCalloutComponents,
  type CalloutComponent,
} from "@/components/map/conditions-callout-data";
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";

const EMPTY: SwellPartition = {
  s1Dir: null, swellDirOm: null, s1PeriodS: null, s1HeightFt: null,
  s2Dir: null, s2PeriodS: null, s2HeightFt: null, windDir: null, windMph: null,
};

describe("resolveCalloutComponents", () => {
  it("returns s1, s2, wind in order when all are real", () => {
    const parts: SwellPartition = {
      ...EMPTY,
      s1Dir: 290, s1PeriodS: 8, s1HeightFt: 2.6,
      s2Dir: 200, s2PeriodS: 13, s2HeightFt: 1.6,
      windDir: 230, windMph: 8,
    };
    const out = resolveCalloutComponents(parts);
    expect(out.map((c) => c.kind)).toEqual(["s1", "s2", "wind"]);
    expect(out[0]).toMatchObject({ name: "SWELL", bearingDeg: 290, label: "2.6ft, 8s", color: "#F2A24C" });
    expect(out[1]).toMatchObject({ name: "S2", bearingDeg: 200, label: "1.6ft, 13s", color: "#7AC74F" });
    expect(out[2]).toMatchObject({ name: "WIND", bearingDeg: 230, label: "8 mph", color: "#74C7E3" });
  });

  it("prefers swellDirOm over s1Dir for the primary swell bearing", () => {
    const out = resolveCalloutComponents({ ...EMPTY, swellDirOm: 305, s1Dir: 290, s1PeriodS: 9, s1HeightFt: 3 });
    expect(out[0].bearingDeg).toBe(305);
  });

  it("omits a component with null direction", () => {
    const out = resolveCalloutComponents({ ...EMPTY, s1Dir: null, s1HeightFt: 3, s1PeriodS: 9, windDir: 230, windMph: 8 });
    expect(out.map((c) => c.kind)).toEqual(["wind"]);
  });

  it("omits a component with zero or null magnitude", () => {
    const out = resolveCalloutComponents({ ...EMPTY, s1Dir: 290, s1HeightFt: 0, s1PeriodS: 9, windDir: 230, windMph: 0 });
    expect(out).toEqual([]);
  });

  it("drops the period from the label when period is null", () => {
    const out = resolveCalloutComponents({ ...EMPTY, s1Dir: 290, s1HeightFt: 2.6, s1PeriodS: null });
    expect(out[0].label).toBe("2.6ft");
  });

  it("returns [] for an empty partition", () => {
    expect(resolveCalloutComponents(EMPTY)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout-data.test.ts --runInBand`
Expected: FAIL — `Cannot find module '@/components/map/conditions-callout-data'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// components/map/conditions-callout-data.ts
import type { SwellPartition } from "@/app/api/forecasts/bulk/route";

export const CONDITIONS_CALLOUT_COLORS = {
  s1: "#F2A24C",
  s2: "#7AC74F",
  wind: "#74C7E3",
} as const;

export interface CalloutComponent {
  kind: "s1" | "s2" | "wind";
  name: string;
  bearingDeg: number;
  label: string;
  color: string;
}

function isReal(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function swellLabel(heightFt: number, periodS: number | null): string {
  const h = `${Math.round(heightFt * 10) / 10}ft`;
  return isReal(periodS) && periodS > 0 ? `${h}, ${Math.round(periodS)}s` : h;
}

export function resolveCalloutComponents(p: SwellPartition): CalloutComponent[] {
  const out: CalloutComponent[] = [];

  const s1Dir = isReal(p.swellDirOm) ? p.swellDirOm : p.s1Dir;
  if (isReal(s1Dir) && isReal(p.s1HeightFt) && p.s1HeightFt > 0) {
    out.push({ kind: "s1", name: "SWELL", bearingDeg: s1Dir, label: swellLabel(p.s1HeightFt, p.s1PeriodS), color: CONDITIONS_CALLOUT_COLORS.s1 });
  }
  if (isReal(p.s2Dir) && isReal(p.s2HeightFt) && p.s2HeightFt > 0) {
    out.push({ kind: "s2", name: "S2", bearingDeg: p.s2Dir, label: swellLabel(p.s2HeightFt, p.s2PeriodS), color: CONDITIONS_CALLOUT_COLORS.s2 });
  }
  if (isReal(p.windDir) && isReal(p.windMph) && p.windMph > 0) {
    out.push({ kind: "wind", name: "WIND", bearingDeg: p.windDir, label: `${Math.round(p.windMph)} mph`, color: CONDITIONS_CALLOUT_COLORS.wind });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout-data.test.ts --runInBand`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add components/map/conditions-callout-data.ts __tests__/components/map/conditions-callout-data.test.ts
git commit -m "feat(map): add conditions callout component resolver"
```

---

### Task 2: Nearest-beach-within-viewport resolver

**Files:**
- Modify: `components/map/conditions-callout-data.ts` (append)
- Test: `__tests__/components/map/conditions-callout-data.test.ts` (append)

**Interfaces:**
- Consumes: `Beach` from `@/types/database` (uses `id`, `lat`, `lon`).
- Produces: `CalloutBounds` interface and `nearestBeachInBounds(lon: number, lat: number, beaches: Beach[], bounds: CalloutBounds): Beach | null`.

- [ ] **Step 1: Write the failing test**

```ts
// append to __tests__/components/map/conditions-callout-data.test.ts
import { nearestBeachInBounds } from "@/components/map/conditions-callout-data";
import type { Beach } from "@/types/database";

const BOUNDS = { west: -118, south: 32, east: -117, north: 33 };
const mk = (id: string, lon: number, lat: number): Beach => ({ id, lon, lat } as Beach);

describe("nearestBeachInBounds", () => {
  const beaches = [mk("a", -117.3, 32.9), mk("b", -117.26, 32.99), mk("c", -117.9, 32.1)];

  it("returns the closest beach to the tap", () => {
    expect(nearestBeachInBounds(-117.27, 32.98, beaches, BOUNDS)?.id).toBe("b");
  });

  it("skips beaches without finite coordinates", () => {
    const withBad = [...beaches, mk("d", NaN, 32.98)];
    expect(nearestBeachInBounds(-117.27, 32.98, withBad, BOUNDS)?.id).toBe("b");
  });

  it("returns null when the nearest beach is outside the current viewport", () => {
    const offscreen = [mk("z", -119.5, 34.5)];
    expect(nearestBeachInBounds(-119.5, 34.5, offscreen, BOUNDS)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(nearestBeachInBounds(-117.27, 32.98, [], BOUNDS)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout-data.test.ts --runInBand`
Expected: FAIL — `nearestBeachInBounds is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to components/map/conditions-callout-data.ts
import type { Beach } from "@/types/database";

export interface CalloutBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function inBounds(lon: number, lat: number, b: CalloutBounds): boolean {
  const lonOk = b.west <= b.east ? lon >= b.west && lon <= b.east : lon >= b.west || lon <= b.east;
  return lat >= b.south && lat <= b.north && lonOk;
}

export function nearestBeachInBounds(
  lon: number,
  lat: number,
  beaches: Beach[],
  bounds: CalloutBounds
): Beach | null {
  let best: Beach | null = null;
  let bestD = Infinity;
  for (const beach of beaches) {
    if (!Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) continue;
    const dLon = beach.lon - lon;
    const dLat = beach.lat - lat;
    const d = dLon * dLon + dLat * dLat;
    if (d < bestD) {
      bestD = d;
      best = beach;
    }
  }
  if (!best || !inBounds(best.lon, best.lat, bounds)) return null;
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout-data.test.ts --runInBand`
Expected: PASS — 10 tests total.

- [ ] **Step 5: Commit**

```bash
git add components/map/conditions-callout-data.ts __tests__/components/map/conditions-callout-data.test.ts
git commit -m "feat(map): add nearest-beach-in-viewport resolver"
```

---

### Task 3: Pure SVG callout builder (geometry + DOM)

**Files:**
- Create: `components/map/conditions-callout.ts`
- Test: `__tests__/components/map/conditions-callout.test.ts`

**Interfaces:**
- Consumes: `CalloutComponent` from `@/components/map/conditions-callout-data`.
- Produces:
  - `travelScreenAngleDeg(bearingDeg: number): number` — returns `(bearingDeg + 90)` normalized to `[0, 360)`.
  - `textNeedsFlip(screenAngleDeg: number): boolean` — true when the angle is in the left hemisphere `(90, 270)`.
  - `createConditionsCalloutElement(opts: ConditionsCalloutOptions): { element: HTMLElement }`.
  - `ConditionsCalloutOptions { beachName: string; tempLabel: string | null; components: CalloutComponent[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/map/conditions-callout.test.ts
import {
  createConditionsCalloutElement,
  travelScreenAngleDeg,
  textNeedsFlip,
} from "@/components/map/conditions-callout";
import type { CalloutComponent } from "@/components/map/conditions-callout-data";

const S1: CalloutComponent = { kind: "s1", name: "SWELL", bearingDeg: 290, label: "2.6ft, 8s", color: "#F2A24C" };
const S2: CalloutComponent = { kind: "s2", name: "S2", bearingDeg: 200, label: "1.6ft, 13s", color: "#7AC74F" };
const WIND: CalloutComponent = { kind: "wind", name: "WIND", bearingDeg: 230, label: "8 mph", color: "#74C7E3" };

describe("travelScreenAngleDeg / textNeedsFlip", () => {
  it("maps bearing to travel screen angle (bearing + 90, normalized)", () => {
    expect(travelScreenAngleDeg(0)).toBe(90);
    expect(travelScreenAngleDeg(300)).toBe(30);
  });
  it("flags left-hemisphere angles for text flipping", () => {
    expect(textNeedsFlip(91)).toBe(true);
    expect(textNeedsFlip(269)).toBe(true);
    expect(textNeedsFlip(10)).toBe(false);
    expect(textNeedsFlip(300)).toBe(false);
  });
});

describe("createConditionsCalloutElement", () => {
  it("renders one banner per component, tagged by kind and label", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [S1, S2, WIND] });
    const banners = element.querySelectorAll("[data-callout-banner]");
    expect(banners.length).toBe(3);
    expect(Array.from(banners).map((b) => b.getAttribute("data-callout-banner"))).toEqual(["s1", "s2", "wind"]);
    expect(element.querySelector('[data-callout-banner="s1"]')?.getAttribute("data-callout-label")).toBe("2.6ft, 8s");
  });

  it("renders the beach name and temp at the center", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [S1] });
    expect(element.querySelector("[data-callout-name]")?.textContent).toBe("Del Mar");
    expect(element.querySelector("[data-callout-temp]")?.textContent).toBe("68°");
  });

  it("omits the temp node when tempLabel is null", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: null, components: [S1] });
    expect(element.querySelector("[data-callout-temp]")).toBeNull();
    expect(element.querySelector("[data-callout-name]")?.textContent).toBe("Del Mar");
  });

  it("renders zero banners (center label only) when components is empty", () => {
    const { element } = createConditionsCalloutElement({ beachName: "Del Mar", tempLabel: "68°", components: [] });
    expect(element.querySelectorAll("[data-callout-banner]").length).toBe(0);
    expect(element.querySelector("[data-callout-name]")?.textContent).toBe("Del Mar");
  });

  it("marks a left-hemisphere banner as text-flipped", () => {
    // S2 bearing 200 -> screen angle 290 -> right hemisphere -> no flip.
    // Wind bearing 230 -> screen angle 320 -> right hemisphere -> no flip.
    // S1 bearing 290 -> screen angle 380%360=20 -> no flip.
    // Use a south-traveling swell: bearing 10 -> screen 100 -> flip.
    const south: CalloutComponent = { ...S1, bearingDeg: 10 };
    const { element } = createConditionsCalloutElement({ beachName: "X", tempLabel: null, components: [south] });
    expect(element.querySelector('[data-callout-banner="s1"]')?.getAttribute("data-callout-flipped")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout.test.ts --runInBand`
Expected: FAIL — `Cannot find module '@/components/map/conditions-callout'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// components/map/conditions-callout.ts
import type { CalloutComponent } from "@/components/map/conditions-callout-data";

export interface ConditionsCalloutOptions {
  beachName: string;
  tempLabel: string | null;
  components: CalloutComponent[];
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SIZE = 480;
const CX = 240;
const CY = 240;
const RING_R = 150;
const BANNER_LEN = 190; // local x of the arrowhead tip
const BODY_END = 165; // local x where the taper begins
const GAP = 16; // px the arrowhead sits out from the beach center

export function travelScreenAngleDeg(bearingDeg: number): number {
  return ((bearingDeg + 90) % 360 + 360) % 360;
}

export function textNeedsFlip(screenAngleDeg: number): boolean {
  return screenAngleDeg > 90 && screenAngleDeg < 270;
}

function svgEl(name: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function buildBanner(c: CalloutComponent, indexGap: number): SVGElement {
  const gamma = travelScreenAngleDeg(c.bearingDeg);
  const flip = textNeedsFlip(gamma);
  const pillW = 30 + c.name.length * 9;

  const group = svgEl("g", {
    transform: `translate(${CX},${CY}) rotate(${gamma}) translate(${-(BANNER_LEN + GAP + indexGap)},-17)`,
  });
  group.setAttribute("data-callout-banner", c.kind);
  group.setAttribute("data-callout-label", c.label);
  group.setAttribute("data-callout-flipped", String(flip));

  group.appendChild(
    svgEl("path", {
      d: `M17,0 H${BODY_END} L${BANNER_LEN},17 L${BODY_END},34 H17 A17,17 0 0 1 17,0 Z`,
      fill: c.color, stroke: c.color, "stroke-width": "2", "stroke-linejoin": "round",
    })
  );
  group.appendChild(
    svgEl("path", { d: `M17,0 H${pillW} V34 H17 A17,17 0 0 1 17,0 Z`, fill: "#2E2A26" })
  );

  const textGroup = svgEl("g", flip ? { transform: `rotate(180 ${BANNER_LEN / 2} 17)` } : {});
  const name = svgEl("text", {
    x: String(pillW / 2 + 8), y: "23", "text-anchor": "middle",
    "font-family": "system-ui, sans-serif", "font-size": "14", "font-weight": "800", fill: "#fff",
  });
  name.textContent = c.name;
  const value = svgEl("text", {
    x: String((pillW + BANNER_LEN) / 2), y: "23", "text-anchor": "middle",
    "font-family": "system-ui, sans-serif", "font-size": "15", "font-weight": "800", fill: "#1a1208",
  });
  value.textContent = c.label;
  textGroup.appendChild(name);
  textGroup.appendChild(value);
  group.appendChild(textGroup);

  return group;
}

export function createConditionsCalloutElement(
  opts: ConditionsCalloutOptions
): { element: HTMLElement } {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-conditions-callout", "true");
  wrapper.style.cssText = `width:${SIZE}px;height:${SIZE}px;pointer-events:auto;cursor:pointer;`;

  const svg = svgEl("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, width: String(SIZE), height: String(SIZE) });
  svg.appendChild(svgEl("circle", { cx: String(CX), cy: String(CY), r: String(RING_R), fill: "none", stroke: "rgba(255,255,255,0.7)", "stroke-width": "2" }));

  opts.components.forEach((c, i) => svg.appendChild(buildBanner(c, i * 8)));

  svg.appendChild(svgEl("circle", { cx: String(CX), cy: String(CY), r: "6", fill: "#fff" }));
  const name = svgEl("text", { x: String(CX), y: String(CY - 8), "text-anchor": "middle", "font-family": "system-ui, sans-serif", "font-size": "24", "font-weight": "800", fill: "#fff" });
  name.setAttribute("data-callout-name", "true");
  name.textContent = opts.beachName;
  svg.appendChild(name);
  if (opts.tempLabel) {
    const temp = svgEl("text", { x: String(CX), y: String(CY + 18), "text-anchor": "middle", "font-family": "system-ui, sans-serif", "font-size": "20", "font-weight": "700", fill: "#fff" });
    temp.setAttribute("data-callout-temp", "true");
    temp.textContent = opts.tempLabel;
    svg.appendChild(temp);
  }

  wrapper.appendChild(svg);
  return { element: wrapper };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout.test.ts --runInBand`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/map/conditions-callout.ts __tests__/components/map/conditions-callout.test.ts
git commit -m "feat(map): add conditions callout SVG builder"
```

---

### Task 4: Tap-decision helper + wire callout into InteractiveMap

**Files:**
- Modify: `components/map/conditions-callout-data.ts` (append `decideCalloutAction`)
- Modify: `components/map/interactive-map.tsx`
- Test: `__tests__/components/map/conditions-callout-data.test.ts` (append)

**Interfaces:**
- Consumes: `nearestBeachInBounds`, `resolveCalloutComponents`, `createConditionsCalloutElement`, `partitionAtTimelinePosition` (module-private in interactive-map.tsx — call directly), `mapboxgl.Marker`.
- Produces: prop `showConditionsOnTap?: boolean` on `InteractiveMapProps`; `decideCalloutAction(currentBeachId: string | null, nextBeachId: string): "toggle-off" | "show"`.

- [ ] **Step 1: Write the failing test for the pure decision helper**

```ts
// append to __tests__/components/map/conditions-callout-data.test.ts
import { decideCalloutAction } from "@/components/map/conditions-callout-data";

describe("decideCalloutAction", () => {
  it("toggles off when tapping the already-open beach", () => {
    expect(decideCalloutAction("b", "b")).toBe("toggle-off");
  });
  it("shows when no callout is open", () => {
    expect(decideCalloutAction(null, "b")).toBe("show");
  });
  it("shows when tapping a different beach", () => {
    expect(decideCalloutAction("a", "b")).toBe("show");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout-data.test.ts --runInBand`
Expected: FAIL — `decideCalloutAction is not a function`.

- [ ] **Step 3: Implement the decision helper**

```ts
// append to components/map/conditions-callout-data.ts
export function decideCalloutAction(
  currentBeachId: string | null,
  nextBeachId: string
): "toggle-off" | "show" {
  return currentBeachId === nextBeachId ? "toggle-off" : "show";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map/conditions-callout-data.test.ts --runInBand`
Expected: PASS — 14 tests total in this file.

- [ ] **Step 5: Add the prop to InteractiveMapProps and destructure it**

In `components/map/interactive-map.tsx`, add to the `InteractiveMapProps` interface (near `showSwellField?: boolean`):

```ts
  showConditionsOnTap?: boolean; // Embed-only: tap open water shows a nearest-beach conditions callout.
```

Add to the destructured props (near `showSwellField = false,`):

```ts
  showConditionsOnTap = false,
```

- [ ] **Step 6: Add imports and refs**

Add to the imports from the callout data module (create the import line):

```ts
import {
  nearestBeachInBounds,
  resolveCalloutComponents,
  decideCalloutAction,
} from "@/components/map/conditions-callout-data";
import { createConditionsCalloutElement } from "@/components/map/conditions-callout";
```

Add refs near the other `useRef`s (e.g. after `activeBeachPreviewPopupRef`):

```ts
  const activeCalloutRef = useRef<{ marker: mapboxgl.Marker; beachId: string } | null>(null);
  const conditionsCtxRef = useRef({
    beaches: [] as Beach[],
    partitionsMap: new Map<string, SwellPartition>(),
    partitionsTimelineMap: new Map<string, SwellPartition[]>(),
    timelineIndex: 0,
    stepsLen: 0,
    bounds: { west: -118, south: 32, east: -117, north: 33 },
    waterTempMap: new Map<string, string | undefined>(),
  });
```

- [ ] **Step 7: Keep the ref fresh each render**

Add an effect (place near the other ref-sync effects around line 464):

```ts
  useEffect(() => {
    conditionsCtxRef.current = {
      beaches: beaches ?? swellFieldBeaches,
      partitionsMap,
      partitionsTimelineMap,
      timelineIndex: swellTimelineIndex,
      stepsLen: swellTimelineSteps.length,
      bounds: mapBounds || { west: -118, south: 32, east: -117, north: 33 },
      waterTempMap,
    };
  }, [beaches, swellFieldBeaches, partitionsMap, partitionsTimelineMap, swellTimelineIndex, swellTimelineSteps.length, mapBounds, waterTempMap]);
```

- [ ] **Step 8: Add show/remove helpers and the tap handler**

Add these `useCallback`s (place after `closeBeachPreviewPopup`, around line 532):

```ts
  const removeActiveCallout = useCallback((): void => {
    activeCalloutRef.current?.marker.remove();
    activeCalloutRef.current = null;
  }, []);

  const showCalloutForBeach = useCallback((beach: Beach): void => {
    const map = mapRef.current;
    if (!map) return;
    const ctx = conditionsCtxRef.current;
    const clampedIndex = Math.min(Math.max(ctx.timelineIndex, 0), Math.max(0, ctx.stepsLen - 1));
    const partition = partitionAtTimelinePosition(beach.id, clampedIndex, ctx.partitionsTimelineMap, ctx.partitionsMap);
    const components = partition ? resolveCalloutComponents(partition) : [];
    const tempLabel = ctx.waterTempMap.get(beach.id) ?? null;
    const { element } = createConditionsCalloutElement({ beachName: beach.name, tempLabel, components });
    element.addEventListener("click", () => removeActiveCallout());
    removeActiveCallout();
    const marker = new mapboxgl.Marker({ element, anchor: "center" }).setLngLat([beach.lon, beach.lat]).addTo(map);
    activeCalloutRef.current = { marker, beachId: beach.id };
  }, [removeActiveCallout]);

  const handleConditionsTap = useCallback((lngLat: mapboxgl.LngLat): void => {
    const ctx = conditionsCtxRef.current;
    const nearest = nearestBeachInBounds(lngLat.lng, lngLat.lat, ctx.beaches, ctx.bounds);
    if (!nearest) return;
    const action = decideCalloutAction(activeCalloutRef.current?.beachId ?? null, nearest.id);
    if (action === "toggle-off") {
      removeActiveCallout();
      return;
    }
    showCalloutForBeach(nearest);
  }, [removeActiveCallout, showCalloutForBeach]);
```

Keep a fresh ref to the handler so the stable map listener can reach it. Add near the other `*Ref` syncs:

```ts
  const handleConditionsTapRef = useRef(handleConditionsTap);
  useEffect(() => { handleConditionsTapRef.current = handleConditionsTap; }, [handleConditionsTap]);
```

- [ ] **Step 9: Register a gated click listener**

Add an effect (place near the other map-event effects, after the `idle`/`moveend` remask effect ~line 1025):

```ts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !showConditionsOnTap) return;
    const onTap = (e: mapboxgl.MapMouseEvent) => handleConditionsTapRef.current(e.lngLat);
    map.on("click", onTap);
    return () => {
      map.off("click", onTap);
      removeActiveCallout();
    };
  }, [isMapReady, showConditionsOnTap, removeActiveCallout]);
```

- [ ] **Step 10: Rebuild on timeline scrub; close when opening a beach detail**

Add a rebuild effect (after Step 9's effect):

```ts
  useEffect(() => {
    const open = activeCalloutRef.current;
    if (!open) return;
    const ctx = conditionsCtxRef.current;
    const beach = ctx.beaches.find((b) => b.id === open.beachId);
    if (beach) showCalloutForBeach(beach);
  }, [swellTimelineIndex, partitionsMap, showCalloutForBeach]);
```

In the marker builder's `onLocationClick` wrapper (the existing `onLocationClick: (beach: Beach) => { ... onLocationClick?.(beach); }` around line 727), add as its first line:

```ts
          removeActiveCallout();
```

Add `removeActiveCallout` to that `useMemo`/`useCallback` dependency array.

- [ ] **Step 11: Verify typecheck, lint, and the full callout test suite**

Run: `yarn typecheck`
Expected: `Done` with no errors.

Run: `npx eslint --max-warnings=0 components/map/interactive-map.tsx components/map/conditions-callout.ts components/map/conditions-callout-data.ts`
Expected: exit 0, no output.

Run: `NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit __tests__/components/map --runInBand`
Expected: PASS — all map suites green (existing + the two new files).

- [ ] **Step 12: Commit**

```bash
git add components/map/conditions-callout-data.ts __tests__/components/map/conditions-callout-data.test.ts components/map/interactive-map.tsx
git commit -m "feat(map): wire tap-water conditions callout into InteractiveMap"
```

---

### Task 5: Enable the callout in the embed (suppressed during placement)

**Files:**
- Modify: `app/embed/map/embed-map-client.tsx`

**Interfaces:**
- Consumes: `InteractiveMap` prop `showConditionsOnTap` (Task 4); existing `isPlacementActive` state (embed-map-client.tsx:125).

- [ ] **Step 1: Pass the prop, off during placement**

In `app/embed/map/embed-map-client.tsx`, on the `<InteractiveMap ... />` element (near the existing `disableBeachClustering` / `markerDisplay="points"` props), add:

```tsx
        showConditionsOnTap={!isPlacementActive}
```

Binding to `!isPlacementActive` means entering add-spot mode flips the prop false, which (via Task 4 Step 9 cleanup) also removes any open callout.

- [ ] **Step 2: Verify typecheck and prod build of the embed route**

Run: `yarn typecheck`
Expected: `Done`, no errors.

Run: `yarn build`
Expected: build succeeds; `/embed/map` compiles.

- [ ] **Step 3: Commit**

```bash
git add app/embed/map/embed-map-client.tsx
git commit -m "feat(embed): enable tap-water conditions callout on the WebView map"
```

---

### Task 6: Live verification on the iOS WebView (incl. arrow polarity)

**Files:**
- Modify: `quiver-native/.worktrees/024-webview-ios-readiness-20260628/docs/testing/webview-map-ios-rollout.md` (append a verification note)
- Evidence: `quiver-native/.worktrees/024-webview-ios-readiness-20260628/docs/release/evidence/plan-024-webview-ios-rollout/`

**Interfaces:** none (manual/maestro verification).

- [ ] **Step 1: Serve the clean embed build**

Run the embed web server (the rollout used `http://127.0.0.1:3011/embed/map`). Confirm `/embed/map` loads with the swell field.

- [ ] **Step 2: Capture tap-water behavior on the iOS sim**

Using the existing plan-024 maestro/sim flow (`maestro-native` skill; flows under `/tmp/quiver-plan-024/`), drive the embed map and:
1. Tap open water near a beach → confirm a callout appears centered on the nearest beach with banner-arrows.
2. Tap a beach marker → confirm it still opens the spot detail (no regression).
3. Tap the callout → confirm it dismisses.
4. Scrub the timeline with a callout open → confirm labels update.

Save a frame to the evidence dir as `ios-webview-conditions-callout.png`.

- [ ] **Step 3: Verify arrow polarity against ground truth (do NOT skip)**

For the captured beach, read its current partition from the DB and confirm each arrowhead points in the physically correct travel direction (energy `from` bearing → arrowhead at `bearing + 180`, i.e. toward the beach). Cross-check against the swell-field particle drift for the same component — they must agree.

Run (substitute the captured beach id):
```bash
# direction sanity: s1/s2/wind 'from' bearings for the beach under test
# (use the supabase MCP execute_sql against enhanced_forecasts, latest forecast_at)
```
Expected: arrowheads on screen point the same way the particles drift. If reversed, fix the sign in `travelScreenAngleDeg` (it is the single source of truth) and re-capture — do not adjust per-banner.

- [ ] **Step 4: Record the result and commit evidence**

Append a short "Conditions callout — verified" note (date, device, polarity confirmed) to `docs/testing/webview-map-ios-rollout.md`.

```bash
git add docs/testing/webview-map-ios-rollout.md docs/release/evidence/plan-024-webview-ios-rollout/ios-webview-conditions-callout.png
git commit -m "test(map): verify tap-water conditions callout on iOS WebView"
```

---

## Self-Review

**Spec coverage:**
- Nearest-beach data source → Task 2 (`nearestBeachInBounds`).
- Tap-water trigger, tap-beach unchanged → Task 4 (gated `map.on("click")`; beach-marker DOM is above the canvas so it doesn't fire map click; `onLocationClick` still opens detail and now also closes the callout).
- Embed-only behind a prop → Task 4 (prop, default false) + Task 5 (embed sets it).
- ft + mph, no fabrication → Task 1 (`resolveCalloutComponents` reads raw fields, omits null/zero, no `??` viz fallbacks).
- Center name + temp with fallback → Task 3 (omits temp node when null).
- Viewport gate → Task 2 (returns null if nearest outside bounds).
- No-data → center label only → Task 3 (empty components → 0 banners + center label).
- Banner geometry, `γ = bearing + 90`, converging heads, inline text + left-hemisphere flip → Task 3 (`travelScreenAngleDeg`, `textNeedsFlip`, `buildBanner`).
- Timeline-reactive → Task 4 Step 10.
- Dismiss/toggle, suppressed during placement → Task 4 (`decideCalloutAction`, click-to-dismiss) + Task 5 (`!isPlacementActive`).
- Anti-overlap stagger → Task 3 (`indexGap`).
- Live polarity verification → Task 6 Step 3.

**Placeholder scan:** none — every code step shows complete code; every run step shows the command + expected result.

**Type consistency:** `CalloutComponent` (Task 1) consumed unchanged in Tasks 3–4. `nearestBeachInBounds`/`resolveCalloutComponents`/`decideCalloutAction` names match between definition and call sites. `createConditionsCalloutElement` signature matches its consumer in Task 4 Step 8. `partitionAtTimelinePosition` call matches the existing signature `(beachId, position, timelineMap, currentMap)`.
