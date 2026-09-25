/**
 * How the /map swell field sizes, spaces, moves, and fades its particles.
 * Kept free of mapbox-gl so the signed-in home hero can draw the same field on
 * a plain canvas (components/oracle/zine/hero-swell-field.tsx).
 */

export interface MercatorBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Windy-like spacing: sparse + evenly distributed (jittered grid) so water shows
// between dashes. Lower than the earlier dense random blanket (4000/1400).
export const PARTICLE_COUNT_DESKTOP = 650;
// Leave room between crests on compact native map cards.
export const PARTICLE_COUNT_MOBILE = 280;

/** Below this CSS width we treat the device as small and cut particle count. */
const SMALL_SCREEN_PX = 640;

export function resolveParticleCount(viewportWidthPx: number): number {
  return viewportWidthPx < SMALL_SCREEN_PX
    ? PARTICLE_COUNT_MOBILE
    : PARTICLE_COUNT_DESKTOP;
}

/**
 * Derive an even grid (cols × rows) covering `count` cells across the box, sized to
 * the box aspect ratio so cells stay roughly square. `rows` is ceil'd so cols × rows
 * always ≥ count (the trailing partial row holds the remainder of the particles).
 */
export function gridDimensions(
  count: number,
  box: MercatorBox
): { cols: number; rows: number } {
  const width = Math.max(box.maxX - box.minX, 1e-9);
  const height = Math.max(box.maxY - box.minY, 1e-9);
  const aspect = width / height;
  const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  return { cols, rows };
}

// Fraction of the current viewport a speed=1 particle advances per 60Hz frame,
// scaled to the live Mercator span so motion reads the same at any zoom. This is
// intentionally time-based: reference wind maps keep particles alive and advect
// them through the field instead of respawning whole cohorts that appear to blink.
export const STEP_FRACTION = 0.00055;
export const FRAME_MS = 1000 / 60;
export const MAX_FRAME_STEP = 1.6;
export const MIN_LIFE_FRAMES = 300;
export const LIFE_JITTER_FRAMES = 360;
export const BIRTH_FADE_PORTION = 0.08;
export const DEATH_FADE_PORTION = 0.16;
// Fixed dash LENGTH as a fraction of the viewport span, DECOUPLED from drift speed
// so dashes stay visible no matter how slow they move. Tying length to the
// per-frame step made slow dashes sub-pixel and invisible.
export const DASH_FRACTION = 0.032;
// Dash thickness in device pixels (a quad, so width is real — gl.lineWidth is not).
// Weak swell ~2.6px, strong swell ~2.6+4.4 ≈ 7px, so strength reads as weight.
export const DASH_WIDTH_PX_BASE = 2.6;
export const DASH_WIDTH_PX_GAIN = 4.4;
// How aggressively weak cells thin out their particles (higher = sparser weak).
export const STRENGTH_DENSITY_CULL = 0.8;

// Wind worm length as a fraction of the viewport span.
export const WIND_STREAK_FRACTION = 0.034;

// Per-layer particle count for the combined view so three stacked layers keep the
// sparse Windy-style spacing in budget (3 × 260 = 780 total).
export const COMBINED_PARTICLE_COUNT = 340;
// Wind reads cleaner with a sparser field than swell - scale its particle count
// down, but keep enough strokes visible on the light-blue basemap.
export const WIND_PARTICLE_SCALE = 0.4; // keep wind sparser than swell even at the higher base count

export const PARTICLE_MOTION_SCALE = {
  s1: 1,
  s2: 1,
  wind: 0.25, // calm, slow wind drift (-75% movement)
} as const;

/** Primary swell crests draw shorter than secondary swell and wind marks. */
export const PARTICLE_DASH_LENGTH_SCALE = {
  s1: 0.75,
  s2: 1,
  wind: 1,
} as const;
