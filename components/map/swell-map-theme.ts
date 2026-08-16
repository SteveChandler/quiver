/**
 * Shared brand tokens + pure helpers for the Quiver swell map (prototype + prod).
 * Brand law (DESIGN_SYSTEM.md): Deep Twilight is the map stage, cream paper is
 * the control surface, and sticker texture uses hard offset shadows with no
 * glass, cyan/purple gradients, or decorative glow.
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

export const SWELL_MAP_LEGEND_SURFACE = {
  paper: "#F4EBD8",
  paperRaised: "#F5EEDC",
  ink: "#11100D",
  mutedInk: "rgba(17,16,13,0.68)",
  border: "rgba(17,16,13,0.88)",
  divider: "rgba(17,16,13,0.16)",
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

// Timeline materials use the same cream-paper instrument language as the legend.
// Orange marks committed forecast progress; ink keeps keyboard focus AA-visible on paper.
export const SWELL_MAP_TIMELINE = {
  active: SWELL_LAYER_COLOR.s1,
  dayBand: "#E9DEC7",
  dayBandAlternate: "#F0E5D0",
  track: "#CDBD9C",
  focus: SWELL_MAP_LEGEND_SURFACE.ink,
  ink: SWELL_MAP_LEGEND_SURFACE.ink,
  stickerShadow: SWELL_MAP_STICKER_SHADOW,
} as const;

export const SWELL_MAP_TIMELINE_CSS_VARIABLES = {
  "--swell-timeline-active": SWELL_MAP_TIMELINE.active,
  "--swell-timeline-focus": SWELL_MAP_TIMELINE.focus,
  "--swell-timeline-ink": SWELL_MAP_TIMELINE.ink,
  "--swell-timeline-sticker-shadow": SWELL_MAP_TIMELINE.stickerShadow,
} as const;

// Particle-trail colors for the Windy-style swell flow field. The field rides the
// LIGHT Windy-style basemap (no recolor, see interactive-map.tsx), so these are
// darker, high-contrast brand colors. S1/S2/Wind intentionally use different hue
// families so the Combined/All view remains legible.
export const SWELL_FIELD_PARTICLE_COLOR: Record<SwellLayerId, string> = {
  s1: "#8A3B0A",   // primary swell - deep Charming Orange
  s2: "#252D6B",   // secondary swell - Deep Twilight navy for hue separation
  wind: "#004C40", // wind - dark Pacific Teal, distinct from S2 navy
  combined: "#8A3B0A",
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
