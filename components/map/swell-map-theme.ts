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
// Used for the UI chips / layer selector (bright on the navy panels).
export const SWELL_LAYER_COLOR: Record<SwellLayerId, string> = {
  s1: "#F78E42",   // primary swell — Charming Orange (decorative)
  s2: "#FDB84B",   // secondary swell — Paradise Gold
  wind: "#00D4AA", // wind — Pacific Teal (the ONE sanctioned teal; NOT #38bdf8 cyan)
  combined: "#F78E42",
};

// Particle-trail colors for the Windy-style swell flow field on the LIGHT basemap.
// Darker, saturated variants of the layer accents so normal-blended dashes read
// against light-blue water (the bright SWELL_LAYER_COLOR washes out on light fill).
export const SWELL_FIELD_PARTICLE_COLOR: Record<SwellLayerId, string> = {
  s1: "#8F3408",   // dark rust-orange — high contrast on light-blue water
  s2: "#6E4500",   // dark brown-amber — distinct from primary, reads on light water
  wind: "#064A43", // very dark teal — darkness gives contrast vs the blue ocean
  combined: "#8F3408",
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

/**
 * Convert a 16-point compass label to its heading in degrees.
 * Live `enhanced_forecasts.swell_*_direction` rows store compass TEXT ("SSW",
 * "WNW", "N"), not numeric degrees — the inverse of `degreesToCompass`.
 * Case-insensitive, trims whitespace; returns null for unrecognized labels.
 */
export function compassToDegrees(label: string): number | null {
  if (typeof label !== "string") return null;
  const index = COMPASS_16.indexOf(
    label.trim().toUpperCase() as (typeof COMPASS_16)[number]
  );
  return index === -1 ? null : index * 22.5;
}
