# Quiver Brand Re-skin of the Surf-Map Prototype (Track 1) Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-risk the look of the Windy-style surf-map prototype by re-skinning it to the Quiver brand (Deep Twilight navy canvas, sanctioned accents, Space Mono technical values, sticker texture) and porting forward cheap correctness/a11y wins (reduced-motion, ARIA, focus rings, WCAG CTA contrast). This is the fast VISUAL-APPROVAL gate BEFORE any prod `/map` work. It also creates the shared `components/map/swell-map-theme.ts` token module that Plan B (the WebGL data plan) imports, so the two plans stay DRY.

**Architecture:** Single client component `components/map/surf-map-prototype.tsx` mounted on the noindex route `app/surf-map-prototype/page.tsx`. The map basemap is Mapbox GL (`mapbox-gl@3.19.0`), recolored to navy at runtime via paint properties on the `load` event (no external Mapbox Studio dependency). Two `<canvas>` overlays (a static fallback basemap painter + a Canvas-2D particle animator) sit above the map. All brand tokens (surfaces, sticker shadow/radius, layer accent colors, CTA classes) move into a new pure module `components/map/swell-map-theme.ts` consumed by the component. Pure helpers (legend-ramp builder, degrees→compass label) get real Jest tests; the visual reskin and a Playwright smoke validate the rest.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript (strict) / Tailwind (tokens in `tailwind.config.ts`) / Mapbox GL 3.19.0 / lucide-react icons / Radix Dialog (already a dependency, used for the mobile drawer focus-trap) / Jest (`yarn test:unit`) / Playwright (`yarn test`).

> **Reality note (do NOT delete):** This prototype's animated overlay is a **Canvas-2D** particle engine (`runCanvasParticleFallback` in `surf-map-prototype.tsx`). There is NO WebGL render path here, and an earlier build summary that claimed "prefers WebGL, falls back to Canvas" was false. **This Track-1 plan keeps the Canvas-2D engine as-is** (it only wires reduced-motion and recolors it). The real WebGL particle layer is introduced in **Plan B** (`2026-06-16-swell-field-on-prod-map.md`). Do not re-add a "WebGL with Canvas fallback" claim, comment, or attribute in this prototype.

---

## File Structure

| File | Create / Modify | Responsibility |
|------|-----------------|----------------|
| `components/map/swell-map-theme.ts` | **Create** | Shared brand-token module: navy surfaces, sticker shadow/radius, sanctioned layer accent colors, CTA class, plus pure helpers `buildLegendRampCss()` and `degreesToCompass()`. Imported by both this prototype and Plan B. |
| `components/map/__tests__/swell-map-theme.test.ts` | **Create** | Jest unit tests asserting the exact token VALUES (so a brand-color regression fails CI) and the two pure helpers' behavior. |
| `components/map/surf-map-prototype.tsx` | **Modify** | The prototype itself: consume the theme tokens (navy opaque surfaces, no blur, sticker texture), recolor the Mapbox basemap to navy at runtime, recolor the Canvas-2D fallback + particle colors, swap technical values to `font-mono`, wire `useReducedMotion()` into the particle hook + isoline + drawer, add ARIA roles / focus rings / aria-live, convert the mobile drawer to a Radix Dialog focus-trap, and fix every white-text orange CTA to ocean-blue. |
| `app/surf-map-prototype/page.tsx` | **Modify** | Replace the `bg-slate-950` page wrapper with the navy base token so the route frame matches the canvas. |
| `e2e/surf-map-prototype.spec.ts` | **Create** | Playwright smoke: route renders, particle canvas present, reduced-motion paints a static frame without scheduling rAF (asserted via a `data-raf-scheduled` attribute), layer toggle updates the aria-live region, no console errors. |

---

### Task 1: Create the shared `swell-map-theme.ts` token module (with tests)

**Files:**
- Create: `components/map/swell-map-theme.ts`
- Create (Test): `components/map/__tests__/swell-map-theme.test.ts`

This task is TDD. The module is pure (no React, no DOM), so it is fully unit-testable. Plan B imports the EXACT names/values defined here — do not rename.

- [x] **Step 1: Write the failing token + helper test.**
  Create `components/map/__tests__/swell-map-theme.test.ts` with the COMPLETE content:
  ```ts
  import {
    SWELL_MAP_SURFACE,
    SWELL_MAP_STICKER_SHADOW,
    SWELL_MAP_STICKER_RADIUS,
    SWELL_LAYER_COLOR,
    SWELL_MAP_CTA_CLASS,
    buildLegendRampCss,
    degreesToCompass,
    type SwellLayerId,
  } from "../swell-map-theme";

  describe("swell-map-theme tokens", () => {
    it("uses Deep Twilight navy surfaces, never gray or pure black", () => {
      expect(SWELL_MAP_SURFACE.base).toBe("#252D6B");
      expect(SWELL_MAP_SURFACE.panel).toBe("#1E2558");
      expect(SWELL_MAP_SURFACE.panelDeep).toBe("#161A40");
      expect(SWELL_MAP_SURFACE.border).toBe("rgba(255,255,255,0.12)");
    });

    it("uses a hard offset sticker shadow with NO blur and asymmetric radius", () => {
      expect(SWELL_MAP_STICKER_SHADOW).toBe("2px 3px 0 0 rgba(0,0,0,0.35)");
      expect(SWELL_MAP_STICKER_RADIUS).toBe("12px 4px 14px 6px");
    });

    it("maps each layer to a sanctioned accent (no cyan/purple)", () => {
      expect(SWELL_LAYER_COLOR.s1).toBe("#F78E42");
      expect(SWELL_LAYER_COLOR.s2).toBe("#FDB84B");
      expect(SWELL_LAYER_COLOR.wind).toBe("#00D4AA");
      expect(SWELL_LAYER_COLOR.combined).toBe("#F78E42");
      const banned = ["#38bdf8", "#47e0d1", "#67e8f9", "#7dd3fc", "#7c3aed", "#9333ea", "#818cf8"];
      const values = Object.values(SWELL_LAYER_COLOR).map((c) => c.toLowerCase());
      for (const bad of banned) expect(values).not.toContain(bad);
    });

    it("ships an AA-safe interactive CTA class (ocean-blue, not raw orange)", () => {
      expect(SWELL_MAP_CTA_CLASS).toBe("bg-ocean-blue text-white hover:bg-ocean-blue/90");
      expect(SWELL_MAP_CTA_CLASS).not.toContain("#f78e42");
      expect(SWELL_MAP_CTA_CLASS).not.toContain("bg-[#");
    });
  });

  describe("buildLegendRampCss", () => {
    it("builds a navy -> gold -> orange linear-gradient with no banned hues", () => {
      const css = buildLegendRampCss();
      expect(css.startsWith("linear-gradient(90deg,")).toBe(true);
      expect(css).toContain("#1E2558");
      expect(css).toContain("#FDB84B");
      expect(css).toContain("#F78E42");
      for (const bad of ["#38bdf8", "#67e8f9", "#818cf8", "#9333ea", "#e11d48", "#f43f5e"]) {
        expect(css.toLowerCase()).not.toContain(bad);
      }
    });
  });

  describe("degreesToCompass", () => {
    it("converts cardinal and intercardinal degrees to 16-point labels", () => {
      expect(degreesToCompass(0)).toBe("N");
      expect(degreesToCompass(90)).toBe("E");
      expect(degreesToCompass(180)).toBe("S");
      expect(degreesToCompass(270)).toBe("W");
      expect(degreesToCompass(315)).toBe("NW");
      expect(degreesToCompass(292.5)).toBe("WNW");
    });

    it("wraps past 360 and handles negatives", () => {
      expect(degreesToCompass(360)).toBe("N");
      expect(degreesToCompass(720)).toBe("N");
      expect(degreesToCompass(-90)).toBe("W");
    });

    it("returns an em dash for non-finite input", () => {
      expect(degreesToCompass(Number.NaN)).toBe("—");
      expect(degreesToCompass(Number.POSITIVE_INFINITY)).toBe("—");
    });
  });

  // Type-level sanity: the union is exactly these four ids.
  it("exposes the SwellLayerId union", () => {
    const ids: SwellLayerId[] = ["s1", "s2", "wind", "combined"];
    expect(ids).toHaveLength(4);
  });
  ```

- [x] **Step 2: Run the test, expect FAIL (module does not exist).**
  ```bash
  yarn test:unit components/map/__tests__/swell-map-theme.test.ts
  ```
  Expected: FAIL — `Cannot find module '../swell-map-theme'`.

- [x] **Step 3: Create the module with COMPLETE code.**
  Create `components/map/swell-map-theme.ts`:
  ```ts
  /**
   * Shared brand tokens + pure helpers for the Quiver swell map (prototype + prod).
   * Brand law (DESIGN_SYSTEM.md): always-dark Deep Twilight navy canvas, NO glass
   * (backdrop-blur), NO cyan/purple, sticker texture (hard offset shadow, no blur,
   * asymmetric radius). Sanctioned accents only.
   *
   * Plan B imports these EXACT names/values — do not rename or recolor without
   * updating both plans and components/map/__tests__/swell-map-theme.test.ts.
   */

  export type SwellLayerId = "s1" | "s2" | "wind" | "combined";

  // Opaque navy surfaces (NO glass). rgba alphas are for layering over the map, still navy-tinted.
  export const SWELL_MAP_SURFACE = {
    base: "#252D6B",      // Deep Twilight navy — canvas
    panel: "#1E2558",     // opaque card (header.start)
    panelDeep: "#161A40", // darker card / drawer
    border: "rgba(255,255,255,0.12)",
  } as const;

  // Hard offset sticker shadow (no blur) — use as boxShadow.
  export const SWELL_MAP_STICKER_SHADOW = "2px 3px 0 0 rgba(0,0,0,0.35)";
  export const SWELL_MAP_STICKER_RADIUS = "12px 4px 14px 6px"; // asymmetric

  // Layer accent colors — sanctioned palette only, NO cyan/purple.
  export const SWELL_LAYER_COLOR: Record<SwellLayerId, string> = {
    s1: "#F78E42",   // primary swell — Charming Orange (decorative)
    s2: "#FDB84B",   // secondary swell — Paradise Gold
    wind: "#00D4AA", // wind — Pacific Teal (the ONE sanctioned teal; NOT #38bdf8 cyan)
    combined: "#F78E42",
  };

  // CTA tokens (Tailwind classes). Interactive buttons w/ white text MUST use ocean-blue
  // (#9E5010, AA-safe), NEVER bg-[#f78e42] white-text (2.36:1 AA fail). Decorative orange
  // text-on-navy uses text-ocean-blue-decorative.
  export const SWELL_MAP_CTA_CLASS = "bg-ocean-blue text-white hover:bg-ocean-blue/90";

  /**
   * Wave-height legend ramp: navy -> gold -> orange. Replaces the prototype's two
   * rainbow gradients (cyan/indigo/rose). Low energy reads navy, big swell reads orange.
   */
  export function buildLegendRampCss(): string {
    return (
      "linear-gradient(90deg," +
      `${SWELL_MAP_SURFACE.panel} 0%,` +     // #1E2558 navy (flat)
      "#3D4A86 22%," +                        // navy lifting toward the accent band
      `${SWELL_LAYER_COLOR.s2} 58%,` +        // #FDB84B Paradise Gold (mid)
      `${SWELL_LAYER_COLOR.s1} 84%,` +        // #F78E42 Charming Orange (firing)
      "#9E5010 100%)"                         // ocean-blue (deepest orange, max energy)
    );
  }

  const COMPASS_16 = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ] as const;

  /**
   * Convert a heading in degrees to a 16-point compass label.
   * Swell/wind direction fields arrive as degree strings — parse first, then call this.
   */
  export function degreesToCompass(degrees: number): string {
    if (!Number.isFinite(degrees)) return "—";
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.round(normalized / 22.5) % 16;
    return COMPASS_16[index];
  }
  ```

- [x] **Step 4: Run the test, expect PASS.**
  ```bash
  yarn test:unit components/map/__tests__/swell-map-theme.test.ts
  ```
  Expected: PASS — all describe blocks green.

- [x] **Step 5: Typecheck the new module.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: no errors referencing `swell-map-theme.ts`.

- [x] **Step 6: Commit.**
  ```bash
  git add components/map/swell-map-theme.ts components/map/__tests__/swell-map-theme.test.ts
  git commit -m "feat(map): add shared swell-map brand token module"
  ```

---

### Task 2: Re-skin surfaces — navy opaque panels, drop all backdrop-blur, sticker shadow

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (root 605; panels 626, 710, 726, 792, 841, 889; mobile FABs 747/756/765; blur at 626,710,726,747,756,781,792,841,889)
- Modify: `app/surf-map-prototype/page.tsx` (16: `bg-slate-950`)

No TDD (visual). Every change shows complete replacement code. Import the theme and apply `SWELL_MAP_SURFACE` / `SWELL_MAP_STICKER_SHADOW` as inline styles where a Tailwind token does not exist; drop every `backdrop-blur*` and every translucency suffix (`/94 /88 /92 /96`).

- [x] **Step 1: Import the theme tokens.**
  After the `import { cn } from "@/lib/utils";` line (37), add:
  ```ts
  import {
    SWELL_MAP_SURFACE,
    SWELL_MAP_STICKER_SHADOW,
    SWELL_MAP_STICKER_RADIUS,
    SWELL_LAYER_COLOR,
    SWELL_MAP_CTA_CLASS,
    buildLegendRampCss,
    degreesToCompass,
  } from "@/components/map/swell-map-theme";
  ```
  (Not every symbol is used until later tasks; that is fine — later steps consume them. If lint flags an unused import mid-task, finish the task before linting.)

- [x] **Step 2: Navy the page wrapper.**
  In `app/surf-map-prototype/page.tsx` (line 16), replace `bg-slate-950` with the navy base:
  ```tsx
      <div className="h-[calc(100dvh-64px)] overflow-hidden bg-[#252D6B]">
  ```

- [x] **Step 3: Navy the root container.**
  Replace the root `<div>` (line 605):
  ```tsx
      <div className="relative h-full w-full overflow-hidden bg-[#252D6B] text-white">
  ```

- [x] **Step 4: Re-skin the top-left search/metric panel (was line 626).**
  Replace the opening panel `<div>`:
  ```tsx
        <div
          className="absolute left-3 top-3 z-20 w-[min(380px,calc(100vw-24px))] rounded-lg text-white md:left-4 md:top-4"
          style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
        >
  ```
  (Removes `bg-[#3f3f3f]/94`, `shadow-lg`, and `backdrop-blur-md`.)

- [x] **Step 5: Re-skin the right-side Layers panel (was line 710).**
  Replace:
  ```tsx
          <div
            className="rounded-lg p-2"
            style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
          >
  ```
  (Removes `bg-[#373737]/88 shadow-lg backdrop-blur`.)

- [x] **Step 6: Re-skin the right-side Toggles panel (was line 726).**
  Replace:
  ```tsx
          <div
            className="rounded-lg p-2"
            style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
          >
  ```

- [x] **Step 7: Re-skin the three mobile FAB buttons (was 747, 756, 765).**
  These use `bg-black/35 ... backdrop-blur` (two of them) and `bg-[#a3271e]` (menu). Replace the className of the **Center map** FAB (747) and the **Share map** FAB (756) respectively with navy opaque + no blur:
  ```tsx
            className="h-10 w-10 rounded-full text-white hover:text-white"
            style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
  ```
  (apply the same `style` + className to both; keep their existing `aria-label`s.) For the **Open layer menu** FAB (765), use the interactive CTA color instead of brick red — replace its className with:
  ```tsx
            className={cn("h-10 w-10 rounded-full text-white hover:text-white", SWELL_MAP_CTA_CLASS)}
            style={{ boxShadow: SWELL_MAP_STICKER_SHADOW }}
  ```
  (Removes `bg-[#a3271e] hover:bg-[#8d2019]`; `SWELL_MAP_CTA_CLASS` carries the ocean-blue bg + hover.)

- [x] **Step 8: Re-skin the bottom-left spot detail card (was line 792).**
  Replace:
  ```tsx
        <div
          className="absolute bottom-[86px] left-3 z-20 w-[min(330px,calc(100vw-24px))] rounded-lg p-3 md:bottom-20 md:left-4"
          style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
        >
  ```
  (Removes `bg-[#373737]/92 shadow-lg backdrop-blur-md`.)

- [x] **Step 9: Re-skin the bottom timeline bar (was line 841).**
  Replace:
  ```tsx
        <div
          className="absolute bottom-0 left-0 right-0 z-30 border-t"
          style={{
            background: SWELL_MAP_SURFACE.panelDeep,
            borderColor: SWELL_MAP_SURFACE.border,
            boxShadow: "0 -8px 0 0 rgba(0,0,0,0.35)",
          }}
        >
  ```
  (Removes `border-white/12 bg-[#3a3a3a]/96`, the blurred drop shadow, and `backdrop-blur-md`; uses a hard no-blur top shadow.)

- [x] **Step 10: Re-skin the mobile drawer container (was line 889).**
  > NOTE: Task 7 converts this drawer to a Radix Dialog. For now just navy it in place so the surface pass is complete; Task 7 will move this className/style onto the Dialog content. Replace the drawer `<div>`'s className/style:
  ```tsx
        className={cn(
          "absolute inset-y-0 right-0 z-40 w-[min(292px,74vw)] border-l p-3 transition-transform duration-300 md:hidden",
          menuOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          background: SWELL_MAP_SURFACE.panelDeep,
          borderColor: SWELL_MAP_SURFACE.border,
          boxShadow: SWELL_MAP_STICKER_SHADOW,
        }}
  ```
  (Removes `border-white/12 bg-[#333333]/96 shadow-2xl backdrop-blur-md`.)

- [x] **Step 11: Verify no backdrop-blur or gray hex remains in the file.**
  ```bash
  grep -nE "backdrop-blur|#3f3f3f|#373737|#3a3a3a|#333333|#4d4d4d|bg-slate-950" components/map/surf-map-prototype.tsx app/surf-map-prototype/page.tsx
  ```
  Expected: NO matches (empty output). If any line prints, fix it before committing.

- [x] **Step 12: Typecheck.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean (unused-import warnings for theme symbols consumed in later tasks are acceptable here; they are resolved by Task 6).

- [x] **Step 13: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx app/surf-map-prototype/page.tsx
  git commit -m "refactor(map): navy opaque surfaces and sticker shadows on surf-map prototype"
  ```

---

### Task 3: Re-skin the basemap + fallback + radial wash to navy

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (Mapbox init style 540 + `load` handler 549-552; radial wash 614; fallback ocean/land gradient `paintFallbackMap` 244-280)

No TDD (canvas/map paint is visual). DEFAULT approach: keep `mapbox://styles/mapbox/dark-v11` as the base style but recolor water/land/background to navy at runtime via paint properties on `load` (code-only, no Studio dependency). The teal radial wash and the teal/gray fallback gradient become navy.

> Optional later upgrade (NOT a step): a dedicated Mapbox Studio style baked to navy would avoid the brief dark-v11 flash before `load` fires. Out of scope for Track 1 — the runtime recolor is sufficient for visual approval.

- [x] **Step 1: Add a runtime navy-recolor helper above the component.**
  Insert this function just above `export function SurfMapPrototype()` (line 471). It paints the base style navy by setting paint properties on the layer groups dark-v11 ships:
  ```ts
  function recolorBasemapToNavy(map: mapboxgl.Map) {
    const NAVY_LAND = SWELL_MAP_SURFACE.base;   // #252D6B
    const NAVY_WATER = SWELL_MAP_SURFACE.panel; // #1E2558 (water reads slightly deeper)
    const style = map.getStyle();
    if (!style?.layers) return;

    for (const layer of style.layers) {
      try {
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", NAVY_LAND);
          continue;
        }
        if (layer.type !== "fill" && layer.type !== "line" && layer.type !== "symbol") continue;

        const id = layer.id.toLowerCase();
        const isWater = id.includes("water") || id.includes("ocean") || id.includes("bathymetry");
        if (layer.type === "fill") {
          map.setPaintProperty(layer.id, "fill-color", isWater ? NAVY_WATER : NAVY_LAND);
        } else if (layer.type === "line") {
          map.setPaintProperty(layer.id, "line-color", SWELL_MAP_SURFACE.border);
        } else if (layer.type === "symbol") {
          // Keep labels legible on navy.
          map.setPaintProperty(layer.id, "text-color", "rgba(255,255,255,0.78)");
          map.setPaintProperty(layer.id, "text-halo-color", NAVY_LAND);
        }
      } catch {
        // Some layers reject paint props for their type; skip silently.
      }
    }
  }
  ```

- [x] **Step 2: Call the recolor on `load`.**
  In the `map.on("load", ...)` handler (was lines 549-552), call the helper before updating positions:
  ```ts
        map.on("load", () => {
          recolorBasemapToNavy(map!);
          setMapLoaded(true);
          updateSpotPositions();
        });
  ```
  (Leave the `style: "mapbox://styles/mapbox/dark-v11"` line as-is — we recolor it at runtime. Do not change the style URL.)

- [x] **Step 3: Navy the radial wash overlay (was line 614).**
  Replace the teal radial + black linear wash with a navy depth wash (subtle, keeps the map readable, NO teal):
  ```tsx
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_56%,rgba(30,37,88,0.55),transparent_42%),linear-gradient(180deg,rgba(22,26,64,0.10),rgba(22,26,64,0.42))]" />
  ```
  (Removes `rgba(20,184,166,0.22)` teal.)

- [x] **Step 4: Navy the fallback ocean gradient (was 245-250).**
  In `paintFallbackMap`, replace the three ocean stops:
  ```ts
    oceanGradient.addColorStop(0, "#1E2558");
    oceanGradient.addColorStop(0.42, "#252D6B");
    oceanGradient.addColorStop(1, "#161A40");
  ```
  (Removes `#243442 / #1b4250 / #0a2435` teal-gray.)

- [x] **Step 5: Navy the fallback land gradient (was 252-254).**
  Replace the two land stops with a slightly lifted navy so land is distinguishable from water:
  ```ts
    landGradient.addColorStop(0, "#2E3878");
    landGradient.addColorStop(1, "#1E2558");
  ```
  (Removes the `#5c5e5d / #343837` gray.)

- [x] **Step 6: Confirm no banned basemap hues remain.**
  ```bash
  grep -nE "#243442|#1b4250|#0a2435|#5c5e5d|#343837|184,166|20,184" components/map/surf-map-prototype.tsx
  ```
  Expected: NO matches.

- [x] **Step 7: Typecheck.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean.

- [x] **Step 8: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx
  git commit -m "refactor(map): recolor basemap, wash, and canvas fallback to navy"
  ```

---

### Task 4: Re-skin layer colors, gradients, and the rainbow legends

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (`SURF_LAYERS` colors+backgrounds 82-115; top-panel legend gradient 674; bottom legend gradient 882; legend ticks 874-880)

No TDD for the JSX swaps; the `buildLegendRampCss()` helper they consume is already tested in Task 1. Replace every cyan/teal/purple in `SURF_LAYERS` with `SWELL_LAYER_COLOR` plus navy→accent backgrounds, and replace both rainbow legend gradients with `buildLegendRampCss()`.

- [x] **Step 1: Recolor `SURF_LAYERS` (was 82-115).**
  Replace the whole `const SURF_LAYERS: SurfLayer[] = [ ... ];` block:
  ```ts
  const SURF_LAYERS: SurfLayer[] = [
    {
      id: "s1",
      label: "Primary swell",
      meta: "WNW 14s",
      icon: Waves,
      color: SWELL_LAYER_COLOR.s1, // #F78E42
      background: "linear-gradient(135deg, #161A40, #F78E42)",
    },
    {
      id: "s2",
      label: "Secondary swell",
      meta: "SSW 11s",
      icon: Droplets,
      color: SWELL_LAYER_COLOR.s2, // #FDB84B
      background: "linear-gradient(135deg, #161A40, #FDB84B)",
    },
    {
      id: "wind",
      label: "Wind",
      meta: "W 8 mph",
      icon: Wind,
      color: SWELL_LAYER_COLOR.wind, // #00D4AA Pacific Teal (the ONE sanctioned teal)
      background: "linear-gradient(135deg, #161A40, #00D4AA)",
    },
    {
      id: "combined",
      label: "Combined",
      meta: "Surf energy",
      icon: CloudSun,
      color: SWELL_LAYER_COLOR.combined, // #F78E42
      background: "linear-gradient(135deg, #1E2558, #FDB84B 55%, #F78E42)",
    },
  ];
  ```
  (Drops every `#0f766e/#38bdf8/#47e0d1/#7c3aed/#9333ea/#1d4ed8/#7dd3fc/#14b8a6/#f6c453/#f59e0b`.)

- [x] **Step 2: Replace the top-panel legend gradient (was line 674).**
  Replace the `<div className="h-2 rounded-b-lg bg-[linear-gradient(...)]" />`:
  ```tsx
        <div className="h-2 rounded-b-lg" style={{ background: buildLegendRampCss() }} />
  ```

- [x] **Step 3: Replace the bottom desktop legend gradient (was line 882).**
  Replace the `<div className="h-2 rounded-full bg-[linear-gradient(...)]" />`:
  ```tsx
            <div className="h-2 rounded-full" style={{ background: buildLegendRampCss() }} />
  ```

- [x] **Step 4: Make the bottom legend tick labels mono (was 874-880).**
  Replace the tick-row container className so the `ft / 1.6 / 3.3 / 5 / 6.6 / 20` ticks are Space Mono technical values:
  ```tsx
            <div className="mb-1 flex items-center justify-between font-mono text-xs text-white/72">
  ```

- [x] **Step 5: Confirm no banned layer/legend hues remain.**
  ```bash
  grep -nE "#0f766e|#38bdf8|#47e0d1|#7dd3fc|#7c3aed|#9333ea|#1d4ed8|#14b8a6|#f6c453|#67e8f9|#818cf8|#34d399|#f43f5e|#2dd4bf|#e11d48|#2dd4|#0a2435" components/map/surf-map-prototype.tsx
  ```
  Expected: NO matches.

- [x] **Step 6: Typecheck.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean.

- [x] **Step 7: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx
  git commit -m "refactor(map): replace rainbow layer colors and legends with sanctioned navy->gold->orange ramp"
  ```

---

### Task 5: Mono technical values, sticker marker, and collapse muddy accent sprawl

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (wave ft 641-642; period/wind 649-653; spot-card values 808-818; emerald rating chip 802-804; spot marker 780-788; muddy gold/brick/teal/indigo at 765/802/864/897/906/934/975/987/990; selected-state CTA contrast)

No TDD (visual + typography). Add `font-mono` to all technical numeric VALUES (keep `font-heading` on the big metric + spot name + wordmark — those are already correct), give the selected spot marker the sticker treatment, and collapse every off-palette accent to a sanctioned token.

- [x] **Step 1: Mono the period/wind sub-line (was 649-653).**
  Replace the inner stat line in the top panel (the `Wind` + mph + period row):
  ```tsx
              <div className="mt-1 flex items-center gap-2 font-mono text-xs text-white/75">
                <Wind className="h-3.5 w-3.5" />
                <span>{selectedSpot.windMph} mph wind</span>
                <span>{selectedSpot.periodS}s period</span>
              </div>
  ```
  (`font-mono` added; `text-white/72` -> `text-white/75` for a hair more contrast. The big `{selectedSpot.waveFt.toFixed(1)}` keeps `font-heading` — leave 641-642 unchanged.)

- [x] **Step 2: Mono the top-panel time-step swell values (was 667-670).**
  In the `TIME_STEPS.slice(0, 4)` buttons, the `{step.swell}` is a technical value. Replace that span:
  ```tsx
                <span className="mt-1 block font-mono font-semibold">{step.swell}</span>
  ```
  (Keep the uppercase `{step.label}` as-is — it is a label, not a value.)

- [x] **Step 3: Mono + fix contrast on the spot-card Swell/Wind/Tide tiles (was 806-818).**
  Replace the three-tile grid. The labels move from `text-white/55` (fails contrast on `bg-white/10`) to `text-white/70`, the tile darkens to navy, and the VALUES get `font-mono`:
  ```tsx
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md p-2" style={{ background: SWELL_MAP_SURFACE.panelDeep }}>
              <span className="block text-white/70">Swell</span>
              <span className="font-mono font-semibold">{selectedTime.swell}</span>
            </div>
            <div className="rounded-md p-2" style={{ background: SWELL_MAP_SURFACE.panelDeep }}>
              <span className="block text-white/70">Wind</span>
              <span className="font-mono font-semibold">{selectedSpot.windMph} mph</span>
            </div>
            <div className="rounded-md p-2" style={{ background: SWELL_MAP_SURFACE.panelDeep }}>
              <span className="block text-white/70">Tide</span>
              <span className="font-mono font-semibold">{selectedSpot.tide}</span>
            </div>
          </div>
  ```

- [x] **Step 4: Recolor the emerald rating chip to gold (was 802-804).**
  Replace the rating chip. The rating number is a technical value -> `font-mono`; emerald -> Paradise Gold on navy:
  ```tsx
            <div
              className="rounded-md px-2 py-1 font-mono text-sm font-bold text-[#FDB84B]"
              style={{ background: "rgba(253,184,75,0.16)" }}
            >
              {selectedSpot.rating}
            </div>
  ```
  (Drops `bg-emerald-400/16 text-emerald-200`.)

- [x] **Step 5: Sticker-treat the spot markers + mono the badge (was 773-790).**
  Replace the marker `<button>`. Selected state keeps decorative Charming Orange (`#F78E42` is sanctioned for the selected/decorative state, NOT a white-text CTA), gains the asymmetric radius, hard shadow, a 1.5° rotation, and a focus-visible ring; the `ft` badge value becomes `font-mono`:
  ```tsx
        {SURF_SPOTS.map((spot) => {
          const selected = spot.id === selectedSpotId;

          return (
            <button
              key={spot.id}
              type="button"
              aria-pressed={selected}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2 border border-white/35 px-2.5 py-1 font-mono text-xs font-bold text-white transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]",
                selected && "z-20 text-white",
              )}
              style={{
                background: selected ? SWELL_LAYER_COLOR.s1 : SWELL_MAP_SURFACE.panel,
                borderRadius: SWELL_MAP_STICKER_RADIUS,
                boxShadow: SWELL_MAP_STICKER_SHADOW,
                transform: `translate(-50%, -50%) rotate(${selected ? -1.5 : 1.5}deg)`,
              }}
              {...markerStyle(spot)}
              onClick={() => setSelectedSpotId(spot.id)}
            >
              {spot.waveFt.toFixed(1)}ft
            </button>
          );
        })}
  ```
  > GOTCHA: `markerStyle(spot)` currently returns a `style` OBJECT with `left/top`. Because we now set `style` inline AND a `transform` (the old `-translate-x-1/2 -translate-y-1/2` Tailwind classes are removed since `transform` overrides them), the `left/top` must merge into the same style object. Change `markerStyle` to return the left/top as part of a spread. Do Step 6 next.

- [x] **Step 6: Make `markerStyle` mergeable (was 587-602).**
  The marker now needs `left/top` merged with our inline `transform`. Replace the `markerStyle` callback so it returns `{ style: CSSProperties }` consumable via `{...markerStyle(spot)}`, merging position with the sticker transform set in Step 5. Replace the callback body:
  ```ts
    const markerStyle = useCallback(
      (spot: SurfSpot): { style: CSSProperties } => {
        const position = spotPositions[spot.id] ?? fallbackPosition(spot);
        const map = mapRef.current;
        const left = map ? `${position.x}px` : `${position.x}%`;
        const top = map ? `${position.y}px` : `${position.y}%`;
        const selected = spot.id === selectedSpotId;
        return {
          style: {
            left,
            top,
            background: selected ? SWELL_LAYER_COLOR.s1 : SWELL_MAP_SURFACE.panel,
            borderRadius: SWELL_MAP_STICKER_RADIUS,
            boxShadow: SWELL_MAP_STICKER_SHADOW,
            transform: `translate(-50%, -50%) rotate(${selected ? -1.5 : 1.5}deg)`,
          },
        };
      },
      [spotPositions, selectedSpotId],
    );
  ```
  Then SIMPLIFY the Step-5 button to consume it (remove the duplicate inline `style` and spread only `markerStyle`):
  ```tsx
            <button
              key={spot.id}
              type="button"
              aria-pressed={selected}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "absolute z-10 border border-white/35 px-2.5 py-1 font-mono text-xs font-bold text-white transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]",
                selected && "z-20",
              )}
              {...markerStyle(spot)}
              onClick={() => setSelectedSpotId(spot.id)}
            >
              {spot.waveFt.toFixed(1)}ft
            </button>
  ```
  (`markerStyle` now owns background/radius/shadow/transform; the className no longer carries the translate utilities.)

- [x] **Step 6b: Re-skin the bottom timeline active tooltip (was 864 `#d8a12c`).**
  Replace the active-step floating time tooltip so it reads Paradise Gold on navy with a mono time value:
  ```tsx
                  <span
                    className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md px-4 py-1.5 font-mono text-sm font-semibold text-[#161A40]"
                    style={{ background: SWELL_LAYER_COLOR.s2, boxShadow: SWELL_MAP_STICKER_SHADOW }}
                  >
                    {step.time}
                  </span>
  ```
  (Drops `bg-[#d8a12c]`; gold bg with dark navy text passes contrast.) Also mono the timeline `{step.swell}` value (was 869):
  ```tsx
                  <span className="block font-mono font-semibold">{step.swell}</span>
  ```

- [x] **Step 7: Collapse the drawer muddy accents (was 897, 906, 934, 975, 987, 990).**
  In the mobile drawer, recolor:
  - "Go Pro" button (897) `bg-[#d5a12f] hover:bg-[#c58f23]` -> sanctioned interactive CTA. Replace its className with `cn("h-8 rounded-full px-3 text-white", SWELL_MAP_CTA_CLASS)`.
  - "Close layer menu" FAB (906) `bg-[#a3271e] hover:bg-[#8d2019]` -> navy opaque: className `"h-10 w-10 rounded-full text-white hover:text-white"` plus `style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}`.
  - "All" filter chip (934) `bg-[#d5a12f] text-white` -> selected uses decorative gold-on-navy: replace the conditional with `label === "All" && "bg-[rgba(253,184,75,0.18)] text-[#FDB84B]"`.
  - Timeline panel wrapper (975) `bg-teal-500/22` -> `style={{ background: SWELL_MAP_SURFACE.panelDeep }}` and drop the bg class.
  - Range input accent (987) `accent-[#d5a12f]` -> `accent-[#F78E42]`.
  - Toggles panel wrapper (990) `bg-indigo-500/22` -> `style={{ background: SWELL_MAP_SURFACE.panelDeep }}` and drop the bg class.

- [x] **Step 8: Confirm no muddy accent hex remains.**
  ```bash
  grep -nE "#d8a12c|#d5a12f|#c58f23|#a3271e|#8d2019|emerald|teal-|indigo-|bg-teal|bg-indigo" components/map/surf-map-prototype.tsx
  ```
  Expected: NO matches. (The ONE sanctioned teal `#00D4AA` lives in the theme module via `SWELL_LAYER_COLOR.wind`, not as a Tailwind `teal-*` class — so this grep should be empty.)

- [x] **Step 9: Typecheck.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean.

- [x] **Step 10: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx
  git commit -m "refactor(map): mono technical values, sticker markers, collapse off-palette accents"
  ```

---

### Task 6: WCAG CTA fix + finish the Canvas-2D particle recolor

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (Get-app CTA 691-698; Alert-me CTA 821-828; Save-spot 829-837; particle stroke uses `LAYER_BY_ID[layerId].color` at 327/349 — now sourced from sanctioned `SWELL_LAYER_COLOR` via the recolored `SURF_LAYERS`)

No TDD (visual + WCAG). Every white-text orange button becomes the AA-safe ocean-blue CTA. The particle stroke color already follows `SURF_LAYERS[].color`, which Task 4 pointed at `SWELL_LAYER_COLOR` — so the canvas now strokes sanctioned hues automatically. This task just verifies that and fixes the remaining raw-orange buttons.

- [x] **Step 1: Fix the desktop "Get app" CTA (was 691-698).**
  Replace its className. `bg-[#f78e42] ... hover:bg-[#ff7f11]` fails AA with white text — use the CTA token:
  ```tsx
          <Button
            type="button"
            size="sm"
            className={cn("h-8 rounded-full px-3 font-semibold", SWELL_MAP_CTA_CLASS)}
          >
            <Smartphone className="h-4 w-4" />
            Get app
          </Button>
  ```

- [x] **Step 2: Fix the "Login" pill next to it (was 699-706).**
  `bg-black/42` is off-brand chrome — navy it (still a secondary action, lower emphasis than the ocean-blue CTA):
  ```tsx
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 rounded-full px-3 text-white hover:text-white"
            style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
          >
            Login
          </Button>
  ```

- [x] **Step 3: Fix the "Alert me" CTA (was 821-828).**
  Replace its className:
  ```tsx
            <Button
              type="button"
              size="xs"
              className={cn("h-8 flex-1", SWELL_MAP_CTA_CLASS)}
            >
              <Bell className="h-3.5 w-3.5" />
              Alert me
            </Button>
  ```

- [x] **Step 4: Fix the "Save spot" secondary CTA (was 829-837).**
  `bg-white/12` is low-contrast chrome — navy it for consistency:
  ```tsx
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="h-8 flex-1 text-white hover:text-white"
              style={{ background: SWELL_MAP_SURFACE.panelDeep }}
            >
              <Heart className="h-3.5 w-3.5" />
              Save spot
            </Button>
  ```

- [x] **Step 5: Confirm no white-text raw-orange CTA remains.**
  ```bash
  grep -nE "bg-\[#f78e42\]|#ff7f11|bg-black/42|bg-black/35|bg-black/58|bg-black/50" components/map/surf-map-prototype.tsx
  ```
  Expected: NO matches.

- [x] **Step 6: Verify the particle stroke uses sanctioned colors (no code change expected).**
  ```bash
  grep -nE "shadowColor = activeLayer.color|strokeStyle = activeLayer.color" components/map/surf-map-prototype.tsx
  ```
  Expected: BOTH lines present and unchanged — `activeLayer.color` resolves through `LAYER_BY_ID` -> `SURF_LAYERS[].color` -> `SWELL_LAYER_COLOR`, which Task 4 made sanctioned. No banned hue can reach the canvas stroke. (If this grep returns nothing, a prior task accidentally removed the stroke — stop and investigate.)

- [x] **Step 7: Scoped lint on the touched files (catches any now-unused theme import).**
  ```bash
  npx eslint --max-warnings=0 components/map/surf-map-prototype.tsx components/map/swell-map-theme.ts app/surf-map-prototype/page.tsx
  ```
  Expected: clean. (`degreesToCompass` is consumed in Task 9's layer meta; if you reach this point before Task 9 and lint flags it unused, leave the import and proceed — Task 9 consumes it. Alternatively gate the import addition in Task 2 to the symbols used so far and add `degreesToCompass` in Task 9. Pick one and stay consistent.)

- [x] **Step 8: Typecheck.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean.

- [x] **Step 9: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx
  git commit -m "fix(map): swap white-text orange CTAs to AA-safe ocean-blue"
  ```

---

### Task 7: Wire reduced-motion into the particle engine, isolines, and drawer transition

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (`runCanvasParticleFallback` 282-368; `useParticleCanvas` 370-389; particle canvas element 615-620; default `particlesEnabled` 476; isoline overlay 622-624; drawer transition 887-891)
- Modify (Test target): `e2e/surf-map-prototype.spec.ts` asserts the reduced-motion data attribute (created in Task 10)

This is the key correctness win that ports forward. When reduced motion is preferred: paint exactly ONE static frame and do NOT schedule `requestAnimationFrame`; default `particlesEnabled` off; gate the isoline overlay and the drawer transition with `motion-reduce:transition-none`. We expose a `data-raf-scheduled` attribute on the particle canvas so the E2E smoke can assert the rAF gate without timing flakiness.

- [x] **Step 1: Import the hook.**
  After the theme import added in Task 2, add:
  ```ts
  import { useReducedMotion } from "@/hooks/use-reduced-motion";
  ```

- [x] **Step 2: Thread `reducedMotion` through `runCanvasParticleFallback` (was 282-368).**
  Change the signature and the `render` loop so that when reduced, it paints one frame and returns WITHOUT scheduling rAF, and stamps the canvas `data-raf-scheduled`. Replace the function signature line and the rAF scheduling. New signature:
  ```ts
  function runCanvasParticleFallback(
    canvas: HTMLCanvasElement,
    layerId: LayerId,
    timeIndex: number,
    particlesEnabled: boolean,
    reducedMotion: boolean,
  ): () => void {
  ```
  Replace the body of `render` so the single-frame draw is extracted and the loop is gated. Specifically, after the existing per-particle stroke loop (the `for (const particle of particles) { ... }` block) replace the tail:
  ```ts
      context.globalAlpha = 1;

      if (reducedMotion || !particlesEnabled) {
        canvas.dataset.rafScheduled = "false";
        return; // one static frame; do NOT schedule rAF
      }
      canvas.dataset.rafScheduled = "true";
      animationFrame = window.requestAnimationFrame(render);
    };

    if (reducedMotion) {
      // Advance particles one step so the static frame shows streaks, then stop.
      render();
      return () => {
        observer.disconnect();
        window.cancelAnimationFrame(animationFrame);
      };
    }

    render();
  ```
  > NOTE: the existing early `if (!particlesEnabled) { context.clearRect(...); animationFrame = requestAnimationFrame(render); return; }` block at the TOP of `render` (was 315-319) must be updated so it does NOT keep scheduling rAF when particles are disabled — change it to clear once and stamp the attribute:
  ```ts
      if (!particlesEnabled) {
        context.clearRect(0, 0, width, height);
        canvas.dataset.rafScheduled = "false";
        return;
      }
  ```
  (Combined effect: rAF is scheduled ONLY when motion is allowed AND particles are enabled. The `data-raf-scheduled` attribute reflects the real state.)

- [x] **Step 3: Pass `reducedMotion` through `useParticleCanvas` (was 370-389).**
  Replace the hook so it accepts and forwards `reducedMotion`:
  ```ts
  function useParticleCanvas(
    layerId: LayerId,
    timeIndex: number,
    particlesEnabled: boolean,
    reducedMotion: boolean,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      return runCanvasParticleFallback(
        canvas,
        layerId,
        timeIndex,
        particlesEnabled,
        reducedMotion,
      );
    }, [layerId, particlesEnabled, timeIndex, reducedMotion]);

    return canvasRef;
  }
  ```

- [x] **Step 4: Read the preference and default particles accordingly (was 476, 486-490).**
  Add the hook call at the top of the component body and use it to default `particlesEnabled`. Replace the `particlesEnabled` state init AND the `useParticleCanvas` call:
  ```ts
    const reducedMotion = useReducedMotion();
    const [particlesEnabled, setParticlesEnabled] = useState(true);
    // ... (other state) ...
  ```
  Then where `useParticleCanvas(...)` is called (was 486-490), pass the flag:
  ```ts
    const canvasRef = useParticleCanvas(
      selectedLayerId,
      selectedTimeIndex,
      particlesEnabled,
      reducedMotion,
    );
  ```
  And add an effect that flips the default OFF once the preference is known (so the toggle still lets a reduced-motion user opt back in):
  ```ts
    useEffect(() => {
      if (reducedMotion) setParticlesEnabled(false);
    }, [reducedMotion]);
  ```

- [x] **Step 5: Initialize the data attribute on the canvas element (was 615-620).**
  Give the particle canvas a default `data-raf-scheduled="false"` so the attribute exists before first paint:
  ```tsx
        <canvas
          ref={canvasRef}
          data-testid="surf-map-particles"
          data-raf-scheduled="false"
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen"
          aria-hidden="true"
        />
  ```

- [x] **Step 6: Gate the isoline overlay and drawer transition for reduced motion (was 622-624, 887-891).**
  The isoline overlay is decorative; hide it when reduced motion is preferred. Replace its conditional:
  ```tsx
        {isolinesEnabled && !reducedMotion && (
          <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:repeating-radial-gradient(ellipse_at_70%_52%,transparent_0,transparent_44px,rgba(255,255,255,0.18)_45px,transparent_47px)]" />
        )}
  ```
  For the drawer transition (Task 7's interim drawer; Task 8 moves it to a Dialog), add `motion-reduce:transition-none` to its className so the slide is suppressed under reduced motion:
  ```tsx
          "... transition-transform duration-300 motion-reduce:transition-none md:hidden",
  ```

- [x] **Step 7: Typecheck.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean.

- [x] **Step 8: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx
  git commit -m "feat(map): honor prefers-reduced-motion in particle engine, isolines, and drawer"
  ```

---

### Task 8: Convert the mobile drawer to a focus-trapped Radix Dialog

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (drawer 887-1010; trigger FAB 765; close FAB 906; `menuOpen` state 475)

No TDD (interaction; the E2E smoke in Task 10 exercises Esc + focus). Radix Dialog is already a dependency. Wrap the drawer in `Dialog`/`DialogPortal`/`DialogContent` so it gets a real focus trap, Esc-to-close, `aria-modal`, scroll lock, and inert-when-closed for free. Keep the navy sticker styling from Task 2/5.

- [x] **Step 1: Import Radix Dialog primitives.**
  Add near the top imports:
  ```ts
  import * as Dialog from "@radix-ui/react-dialog";
  ```
  (Confirm availability first: `grep -R "@radix-ui/react-dialog" package.json` — it is a transitive/direct dep used by shadcn `dialog.tsx`. If `components/ui/dialog.tsx` exists, prefer importing the project wrapper; otherwise the raw primitive is fine for a noindex prototype.)

- [x] **Step 2: Replace the drawer block with a Dialog (was 887-1010).**
  Drive `open` from `menuOpen`, route close through `onOpenChange`, and move the navy sticker style onto `Dialog.Content`. Replace the entire trailing `<div className={cn("absolute inset-y-0 right-0 ...")}> ... </div>` drawer with:
  ```tsx
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(22,26,64,0.55)] md:hidden" />
            <Dialog.Content
              aria-label="Surf map layers and settings"
              className="fixed inset-y-0 right-0 z-50 w-[min(292px,74vw)] overflow-y-auto border-l p-3 text-white outline-none data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:transition-none md:hidden"
              style={{
                background: SWELL_MAP_SURFACE.panelDeep,
                borderColor: SWELL_MAP_SURFACE.border,
                boxShadow: SWELL_MAP_STICKER_SHADOW,
              }}
            >
              <Dialog.Title className="sr-only">Surf map layers and settings</Dialog.Title>
              {/* ... existing drawer inner markup (Go Pro / grid / chips / layer grid / timeline / toggles) ... */}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
  ```
  Move the existing inner drawer markup (the Go Pro button, the 3-up app/alerts/settings grid, the filter chips, the layer grid, the "Display more layers" button, the timeline range, and the toggles panel) INSIDE `Dialog.Content` unchanged except for the close button (next step).

- [x] **Step 3: Wire the close FAB through `Dialog.Close` (was 902-911).**
  Replace the close `<Button>` with a `Dialog.Close` asChild so it participates in the dialog focus contract:
  ```tsx
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full text-white hover:text-white"
                  style={{ background: SWELL_MAP_SURFACE.panel, boxShadow: SWELL_MAP_STICKER_SHADOW }}
                  aria-label="Close layer menu"
                >
                  <X className="h-6 w-6" />
                </Button>
              </Dialog.Close>
  ```
  (Remove the old `onClick={() => setMenuOpen(false)}` — `Dialog.Close` handles it. The layer-grid buttons inside that call `setMenuOpen(false)` after `setSelectedLayerId` are fine to keep — they close via state, which `open={menuOpen}` reflects.)

- [x] **Step 4: Point the trigger FAB at the dialog (was 761-770).**
  The "Open layer menu" FAB can stay a plain button that sets `menuOpen(true)` (Radix opens on controlled `open` change), OR wrap it in `Dialog.Trigger asChild`. Keep it simple — leave the existing `onClick={() => setMenuOpen(true)}`; the controlled `open` prop already drives the dialog. No change needed beyond the Task 2/5 reskin.

- [x] **Step 5: Remove the now-dead interim drawer transition classes.**
  Confirm the old `translate-x-0 / translate-x-full / transition-transform` drawer wrapper is fully gone (replaced by `Dialog.Content`):
  ```bash
  grep -nE "translate-x-full|inset-y-0 right-0 z-40 w-\[min\(292px" components/map/surf-map-prototype.tsx
  ```
  Expected: NO matches (the Dialog replaced it).

- [x] **Step 6: Typecheck.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean.

- [x] **Step 7: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx
  git commit -m "feat(map): make mobile drawer a focus-trapped Radix dialog"
  ```

---

### Task 9: ARIA roles, focus rings, and an aria-live layer announcer

**Files:**
- Modify: `components/map/surf-map-prototype.tsx` (`ToggleRow` 431-469; `SurfLayerButton` 391-428; layer buttons 656-672 top-panel time steps, 852-871 timeline steps, 941-966 drawer layer grid; raw `<button>` focus rings throughout; aria-live region near root 604-620; `degreesToCompass` consumption in layer meta)

No TDD (a11y semantics; the E2E smoke asserts the live region updates). Add switch/pressed/current semantics, focus-visible rings to raw buttons, and an `sr-only` `aria-live="polite"` region announcing the active layer (the canvases are `aria-hidden`, so non-visual users get nothing otherwise).

- [x] **Step 1: Make `ToggleRow` a real switch (was 431-469).**
  Add `role="switch"` + `aria-checked` + a focus ring. Replace the `<Button>` opening tag and props in `ToggleRow`:
  ```tsx
      <Button
        type="button"
        variant="ghost"
        size="sm"
        role="switch"
        aria-checked={enabled}
        className="h-10 justify-between rounded-md px-3 text-white hover:text-white focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161A40]"
        onClick={onClick}
      >
  ```
  Recolor the toggle track from `bg-teal-400/80` (Tailwind teal, banned) to the sanctioned Pacific Teal via inline style on the track span:
  ```tsx
        <span
          className={cn(
            "h-5 w-9 rounded-full border border-white/28 p-0.5 transition-colors motion-reduce:transition-none",
          )}
          style={{ background: enabled ? SWELL_LAYER_COLOR.wind : "rgba(255,255,255,0.12)" }}
        >
  ```
  (Drops `bg-teal-400/80` / `bg-white/12`.)

- [x] **Step 2: Make `SurfLayerButton` announce selection (was 391-428).**
  Add `aria-pressed` and a focus ring:
  ```tsx
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={selected}
        className={cn(
          "h-auto justify-start rounded-md px-2.5 py-2 text-left text-white hover:text-white focus-visible:ring-2 focus-visible:ring-[#FDB84B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161A40]",
          selected && "ring-1 ring-white/35",
        )}
        onClick={onClick}
      >
  ```
  (Drops the translucent `hover:bg-white/14` / `bg-white/16 shadow-sm` chrome; the `ring-1 ring-white/35` selected outline stays.) Also mono the layer `meta` value (the `WNW 14s`-style technical string) — replace the meta span:
  ```tsx
          <span className="block truncate font-mono text-xs text-white/70">
            {layer.meta}
          </span>
  ```

- [x] **Step 3: Focus rings + `aria-pressed`/`aria-current` on the top-panel time steps (was 656-672).**
  Replace the time-step `<button>`:
  ```tsx
              <button
                key={step.label}
                type="button"
                aria-pressed={selectedTimeIndex === index}
                aria-current={selectedTimeIndex === index ? "true" : undefined}
                className={cn(
                  "border-r border-white/10 px-2 py-2 text-left last:border-r-0 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FDB84B]",
                  selectedTimeIndex === index && "bg-white/12",
                )}
                onClick={() => setSelectedTimeIndex(index)}
              >
  ```

- [x] **Step 4: Focus rings + selection semantics on the timeline steps (was 852-871).**
  Replace the timeline `<button>` opening tag:
  ```tsx
              <button
                key={step.label}
                type="button"
                aria-pressed={selectedTimeIndex === index}
                aria-current={selectedTimeIndex === index ? "true" : undefined}
                className={cn(
                  "relative min-w-[104px] border-l px-3 text-left text-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FDB84B] motion-reduce:transition-none",
                  selectedTimeIndex === index && "bg-white/12",
                )}
                style={{ borderColor: SWELL_MAP_SURFACE.border }}
                onClick={() => setSelectedTimeIndex(index)}
              >
  ```
  (Drops `border-white/12`; uses the border token.)

- [x] **Step 5: Focus rings + selection on the drawer layer grid (was 941-966).**
  Replace the drawer layer `<button>` opening tag:
  ```tsx
                <button
                  key={layer.id}
                  type="button"
                  aria-pressed={layer.id === selectedLayerId}
                  className={cn(
                    "rounded-lg border p-2 text-left text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]",
                    layer.id === selectedLayerId ? "border-white/42 bg-white/12" : "border-white/10",
                  )}
                  onClick={() => {
                    setSelectedLayerId(layer.id);
                    setMenuOpen(false);
                  }}
                >
  ```

- [x] **Step 6: Add the sr-only aria-live layer announcer (near root, after the particle canvas ~620).**
  Insert right after the particle `<canvas>` element:
  ```tsx
        <div aria-live="polite" className="sr-only" data-testid="surf-map-live">
          {`${selectedLayer.label} layer active — ${selectedLayer.meta}`}
        </div>
  ```
  (Because `selectedLayer.meta` is a direction/period string today, this also demonstrates where `degreesToCompass` plugs in when Plan B feeds real degree data. To consume the helper now without dead-import lint, add a derived label the announcer can use:)
  ```ts
    // Demonstrates the shared helper; Plan B replaces the static meta with live degrees.
    const selectedLayerHeading =
      selectedLayer.id === "wind" ? `wind from ${degreesToCompass(270)}` : selectedLayer.meta;
  ```
  and reference `selectedLayerHeading` in the live region text:
  ```tsx
          {`${selectedLayer.label} layer active — ${selectedLayerHeading}`}
  ```

- [x] **Step 7: Confirm no banned `teal-`/`bg-white/14`/`bg-white/16` chrome and rings exist.**
  ```bash
  grep -nE "bg-teal-400|focus-visible:ring-\[#FDB84B\]" components/map/surf-map-prototype.tsx
  ```
  Expected: the first pattern returns NO matches; the second returns MULTIPLE matches (the rings you added).

- [x] **Step 8: Typecheck + scoped lint.**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  npx eslint --max-warnings=0 components/map/surf-map-prototype.tsx components/map/swell-map-theme.ts
  ```
  Expected: both clean.

- [x] **Step 9: Commit.**
  ```bash
  git add components/map/surf-map-prototype.tsx
  git commit -m "feat(map): add switch/pressed ARIA, focus rings, and aria-live layer announcer"
  ```

---

### Task 10: Playwright smoke (route, particle canvas, reduced-motion rAF gate, layer toggle, no errors)

**Files:**
- Create (Test): `e2e/surf-map-prototype.spec.ts`

This task IS test-first: the spec encodes the acceptance criteria for the whole plan. It must use `setupErrorDetection`/`assertNoErrors` per `quiver/CLAUDE.md`.

- [x] **Step 1: Write the spec.**
  Create `e2e/surf-map-prototype.spec.ts` with the COMPLETE content:
  ```ts
  import { test, expect } from "@playwright/test";
  import {
    assertNoErrors,
    setupErrorDetection,
    type ErrorCapture,
  } from "./utils/error-detection";

  const ROUTE = "/surf-map-prototype";

  test.describe("surf map prototype — brand reskin smoke", () => {
    let errorCapture: ErrorCapture;

    test.beforeEach(({ page }) => {
      errorCapture = setupErrorDetection(page);
    });

    test.afterEach(async ({ page }) => {
      await assertNoErrors(page, errorCapture);
    });

    test("renders the route with the particle canvas", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("load");
      const canvas = page.getByTestId("surf-map-particles");
      await expect(canvas).toBeAttached();
    });

    test("reduced motion paints a static frame without scheduling rAF", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(ROUTE);
      await page.waitForLoadState("load");
      const canvas = page.getByTestId("surf-map-particles");
      await expect(canvas).toBeAttached();
      // The component stamps data-raf-scheduled="false" when reduced motion is on.
      await expect(canvas).toHaveAttribute("data-raf-scheduled", "false");
    });

    test("layer selection updates the aria-live announcer", async ({ page }) => {
      await page.goto(ROUTE);
      await page.waitForLoadState("load");
      const live = page.getByTestId("surf-map-live");
      // Default selected layer is "combined".
      await expect(live).toContainText("Combined layer active");
      // Switch to the Wind layer via its labelled control (desktop Layers panel).
      await page.getByRole("button", { name: /Wind/ }).first().click();
      await expect(live).toContainText("Wind layer active");
    });
  });
  ```

- [x] **Step 2: Run the spec, expect the reduced-motion + live-region assertions to PASS (they exercise Task 7/9 code).**
  ```bash
  npx playwright test e2e/surf-map-prototype.spec.ts
  ```
  Expected: all three tests PASS. If `reduced-motion ... rAF` FAILS with `data-raf-scheduled="true"`, the Task 7 rAF gate is wrong — fix `runCanvasParticleFallback` (the reduced/disabled branch must `return` before `requestAnimationFrame`). If `aria-live` FAILS, re-check the Task 9 Step 6 announcer text.
  > ENV NOTE: the spec needs `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` available to the dev/preview server (it is set in `.env`). The reduced-motion and live-region assertions do NOT depend on the map actually loading (the particle canvas + aria-live render regardless), so the smoke is robust even if the basemap is slow or unavailable in CI.

- [x] **Step 3: Commit.**
  ```bash
  git add e2e/surf-map-prototype.spec.ts
  git commit -m "test(map): smoke surf-map prototype reskin (render, reduced-motion, aria-live)"
  ```

---

### Task 11: Full verification pass

**Files:** none (verification only)

- [x] **Step 1: Run the theme unit test.**
  ```bash
  yarn test:unit components/map/__tests__/swell-map-theme.test.ts
  ```
  Expected: PASS.

- [x] **Step 2: Run the E2E smoke.**
  ```bash
  npx playwright test e2e/surf-map-prototype.spec.ts
  ```
  Expected: 3 passed.

- [x] **Step 3: Typecheck the whole project (Node 22).**
  ```bash
  NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck
  ```
  Expected: clean.

- [x] **Step 4: Scoped lint on every touched file.**
  ```bash
  npx eslint --max-warnings=0 \
    components/map/surf-map-prototype.tsx \
    components/map/swell-map-theme.ts \
    components/map/__tests__/swell-map-theme.test.ts \
    app/surf-map-prototype/page.tsx \
    e2e/surf-map-prototype.spec.ts
  ```
  Expected: clean.

- [x] **Step 5: Final banned-token sweep across both source files.**
  ```bash
  grep -nE "backdrop-blur|#38bdf8|#47e0d1|#67e8f9|#7dd3fc|#7c3aed|#9333ea|#818cf8|bg-teal-|bg-indigo-|emerald|bg-\[#f78e42\]|bg-slate-950|#3f3f3f|#373737|#3a3a3a|#333333|#4d4d4d|#d5a12f|#a3271e|#d8a12c" \
    components/map/surf-map-prototype.tsx app/surf-map-prototype/page.tsx
  ```
  Expected: NO matches. Any hit is a brand regression — fix before declaring done.

- [x] **Step 6: Visual confirmation via Playwright MCP (per quiver/CLAUDE.md UI rule).**
  Start the dev server (`yarn dev`), navigate to `http://localhost:3000/surf-map-prototype` with the Playwright MCP, screenshot desktop (1280×800) and mobile (390×844). Confirm: navy canvas (no gray), opaque panels (no glass), orange/gold/teal accents only, mono numerals, sticker markers with the offset shadow, and the mobile drawer traps focus + closes on Esc. Attach screenshots to the PR.

- [x] **Step 7: Update CHANGELOG.**
  Add under `[Unreleased]` → `Changed`: "Re-skinned the surf-map prototype to the Quiver brand (navy surfaces, sanctioned accents, mono technical values, sticker texture) and added a shared swell-map token module, reduced-motion support, ARIA roles, and a focus-trapped mobile drawer." Commit:
  ```bash
  git add CHANGELOG.md
  git commit -m "docs(changelog): note surf-map prototype brand reskin"
  ```

---

## Self-Review Checklist

| Review finding | Addressed by |
|----------------|--------------|
| Shared token module `swell-map-theme.ts` (exact spec) created + unit-tested for Plan B to import | Task 1 |
| BRAND P0/P1: gray Windy chrome → navy opaque surfaces (root 605, panels 626/710/726/792/841/889), drop `/94 /88 /92 /96` translucency | Task 2 (Steps 3-10) |
| BRAND: remove ALL backdrop-blur (626,710,726,747,756,781,792,841,889) → sticker shadow, no blur | Task 2 (Steps 4-10) + verify Step 11 |
| BRAND: page wrapper `bg-slate-950` → navy | Task 2 (Step 2) |
| BRAND: map dark-v11 teal radial wash (540, 614) + teal/gray ocean fallback (246-254) → navy runtime paint recolor | Task 3 |
| BRAND: replace cyan/teal/purple `SURF_LAYERS` colors+gradients (82-115) + two rainbow legends (674, 882) → `SWELL_LAYER_COLOR` + navy→gold→orange ramp | Task 4 |
| BRAND: muddy gold/brick/emerald/indigo sprawl (#d8a12c, #d5a12f, #a3271e, emerald, teal, indigo) → sanctioned tokens | Task 5 (Steps 4, 6b, 7) + Task 9 (Step 1 teal track) |
| BRAND: technical values use `font-mono` (wave/period/wind 642-653, Swell/Wind/Tide 808-818, legend ticks 879, timeline swell, layer meta) | Task 4 (Step 4), Task 5 (Steps 1-3, 6b), Task 9 (Step 2) |
| BRAND: sticker treatment (asymmetric radius + hard shadow + rotation) on selected marker/badge (781-788) | Task 5 (Steps 5-6) |
| CORRECTNESS P1: `useReducedMotion()` into `useParticleCanvas` — paint one static frame, do NOT schedule rAF; default `particlesEnabled` accordingly; gate isoline overlay + drawer transition | Task 7 |
| A11Y: `ToggleRow` `role="switch"` + `aria-checked` (431-469) | Task 9 (Step 1) |
| A11Y: `aria-pressed`/`aria-current` on layer + time-step selection (391-428, 656-672, 852-871, 941-966) | Task 5 (Step 5 marker), Task 9 (Steps 2-5) |
| A11Y: raw `<button>` focus-visible rings (markers/time-steps/timeline/drawer) | Task 5 (Step 5), Task 9 (Steps 3-5) |
| A11Y: contrast fix `text-white/55` on `bg-white/10` tiles → darker navy tile + `text-white/70` (806-818) | Task 5 (Step 3) |
| A11Y: sr-only `aria-live` region announcing active layer (canvases are aria-hidden) | Task 9 (Step 6) |
| A11Y: mobile drawer → real focus-trapped dialog (Radix Dialog), aria-modal + Esc + inert-when-closed (887-1010) | Task 8 |
| WCAG CTA fix: every `bg-[#f78e42]` white-text button (694, 824, drawer) → `SWELL_MAP_CTA_CLASS` (ocean-blue); `#F78E42` kept only for decorative/selected state | Task 5 (Step 7 chips), Task 6 (Steps 1-4) |
| Reality note: keep Canvas-2D engine; do not re-add fake "WebGL fallback" claim | Reality note (top of plan) |
| Pure helpers (`buildLegendRampCss`, `degreesToCompass`) have real Jest tests | Task 1 (Steps 1, 3) |
| Smoke: route renders, particle canvas present, reduced-motion paints without scheduling rAF (data attribute), layer toggle works, no console errors | Task 10 |
