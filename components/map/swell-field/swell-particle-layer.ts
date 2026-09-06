import { drawWaterMask } from "./water-mask";
import mapboxgl from "mapbox-gl";
import type {
  FlowCell,
  FlowField,
} from "@/components/map/swell-field/field-sampler";

export interface MercatorBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ParticleSeed {
  x: number;
  y: number;
  age: number;
}

// Windy-like spacing: sparse + evenly distributed (jittered grid) so water shows
// between dashes. Lower than the earlier dense random blanket (4000/1400).
export const PARTICLE_COUNT_DESKTOP = 650;
// Mobile (incl. the native iOS WebView) reads at a narrow viewport. 300 looked far
// too sparse on an actual phone — most of the field is open water + land, so the
// coastal band ends up nearly empty. 520 restores a clearly-alive density while
// staying well under the old dense-blanket counts.
export const PARTICLE_COUNT_MOBILE = 520;

/** Below this CSS width we treat the device as small and cut particle count. */
const SMALL_SCREEN_PX = 640;

export function resolveParticleCount(viewportWidthPx: number): number {
  return viewportWidthPx < SMALL_SCREEN_PX
    ? PARTICLE_COUNT_MOBILE
    : PARTICLE_COUNT_DESKTOP;
}

/** Uniform names referenced by the shaders (asserted in unit tests). */
export const SHADER_UNIFORM_NAMES = [
  "u_matrix",
  "u_color",
  "u_alpha",
  "u_pointSize",
] as const;

// Vertex shader: positions arrive as line endpoints already in Mercator [0..1]
// unit space; the passed mapbox projection matrix (u_matrix) maps them to clip
// space. a_alpha carries per-vertex fade. gl_PointSize is honored only in
// POINTS draw mode and ignored when drawing LINES.
export const PARTICLE_VERTEX_SHADER = `
precision highp float;
attribute vec2 a_pos;
attribute float a_alpha;
uniform mat4 u_matrix;
uniform float u_pointSize;
varying float v_alpha;
void main() {
  v_alpha = a_alpha;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  gl_PointSize = u_pointSize;
}
`;

// Fragment shader: dark trail color (normal alpha-blended), modulated by per-vertex
// fade and a global u_alpha (reduced-motion / layer dimming).
export const PARTICLE_FRAGMENT_SHADER = `
precision highp float;
uniform vec3 u_color;
uniform float u_alpha;
uniform sampler2D u_waterMask;
uniform vec2 u_viewport;
uniform bool u_maskToWater;
varying float v_alpha;
void main() {
  if (u_maskToWater && texture2D(u_waterMask, vec2(gl_FragCoord.x / u_viewport.x, 1.0 - gl_FragCoord.y / u_viewport.y)).a < 0.99) discard;
  gl_FragColor = vec4(u_color, v_alpha * u_alpha);
}
`;

/** Pick a fresh in-box spawn point. `rng` injectable for deterministic tests. */
export function reseedParticle(rng: () => number, box: MercatorBox): ParticleSeed {
  return {
    x: box.minX + (box.maxX - box.minX) * rng(),
    y: box.minY + (box.maxY - box.minY) * rng(),
    age: 0,
  };
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

/**
 * Seed particle `i` into ITS OWN grid cell (jittered within the cell) so coverage
 * stays even as particles drift and respawn — a Windy-style regular field rather
 * than a random blanket. `rng` injectable for deterministic tests.
 */
export function gridSeedParticle(
  i: number,
  count: number,
  box: MercatorBox,
  rng: () => number
): ParticleSeed {
  const { cols, rows } = gridDimensions(count, box);
  const col = i % cols;
  const row = Math.floor(i / cols) % rows;
  const cellW = (box.maxX - box.minX) / cols;
  const cellH = (box.maxY - box.minY) / rows;
  return {
    x: box.minX + (col + rng()) * cellW,
    y: box.minY + (row + rng()) * cellH,
    age: 0,
  };
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("swell-field: failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`swell-field: shader compile failed: ${log}`);
  }
  return shader;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function longitudeFromMercatorX(x: number): number {
  return x * 360 - 180;
}

export function latitudeFromMercatorY(y: number): number {
  return (
    (2 * Math.atan(Math.exp((180 - y * 360) * Math.PI / 180)) - Math.PI / 2) *
    180 /
    Math.PI
  );
}

const mercatorXFromLongitude = (lon: number): number => (lon + 180) / 360;
const mercatorYFromLatitude = (lat: number): number =>
  (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) /
  360;

interface FlowSample {
  vx: number;
  vy: number;
  speed: number;
  alpha: number;
}

interface MercatorFieldBounds {
  westX: number;
  eastX: number;
  southY: number;
  northY: number;
  southLat: number;
  northLat: number;
  regularGrid: boolean;
}

const mercatorFieldBounds = new WeakMap<FlowField, MercatorFieldBounds>();

function getMercatorFieldBounds(field: FlowField): MercatorFieldBounds {
  const cached = mercatorFieldBounds.get(field);
  if (cached) return cached;

  const west = field.cells[0]?.lon ?? 0;
  const east = field.cells[field.cols - 1]?.lon ?? west;
  const south = field.cells[0]?.lat ?? 0;
  const north = field.cells[(field.rows - 1) * field.cols]?.lat ?? south;
  const bounds = {
    westX: mercatorXFromLongitude(west),
    eastX: mercatorXFromLongitude(east),
    southY: mercatorYFromLatitude(south),
    northY: mercatorYFromLatitude(north),
    southLat: south,
    northLat: north,
    regularGrid:
      field.cols >= 2 &&
      field.rows >= 2 &&
      field.cells.length >= field.cols * field.rows &&
      Number.isFinite(east - west) &&
      Number.isFinite(north - south) &&
      Math.abs(east - west) >= 1e-9 &&
      Math.abs(north - south) >= 1e-9,
  };
  mercatorFieldBounds.set(field, bounds);
  return bounds;
}

function sampleFlowFieldMercator(
  field: FlowField,
  bounds: MercatorFieldBounds,
  x: number,
  y: number,
  sample: FlowSample
): void {
  if (!bounds.regularGrid) {
    if (field.cells.length === 0) {
      sample.vx = 0;
      sample.vy = 0;
      sample.speed = 0;
      sample.alpha = 0;
      return;
    }
    const lon = longitudeFromMercatorX(x);
    const lat = latitudeFromMercatorY(y);
    const cell = nearestFlowCell(field, lon, lat);
    sample.vx = cell.vx;
    sample.vy = cell.vy;
    sample.speed = cell.speed;
    sample.alpha = cell.alpha;
    return;
  }

  const colF =
    clamp01((x - bounds.westX) / (bounds.eastX - bounds.westX)) * (field.cols - 1);
  const rowF = y >= bounds.southY
    ? 0
    : y <= bounds.northY
      ? field.rows - 1
      : clamp01(
          (latitudeFromMercatorY(y) - bounds.southLat) /
            (bounds.northLat - bounds.southLat)
        ) * (field.rows - 1);
  const col0 = Math.min(field.cols - 2, Math.max(0, Math.floor(colF)));
  const row0 = Math.min(field.rows - 2, Math.max(0, Math.floor(rowF)));
  const tx = colF - col0;
  const ty = rowF - row0;
  const c00 = field.cells[row0 * field.cols + col0];
  const c10 = field.cells[row0 * field.cols + col0 + 1];
  const c01 = field.cells[(row0 + 1) * field.cols + col0];
  const c11 = field.cells[(row0 + 1) * field.cols + col0 + 1];
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  const rawVx = c00.vx * w00 + c10.vx * w10 + c01.vx * w01 + c11.vx * w11;
  const rawVy = c00.vy * w00 + c10.vy * w10 + c01.vy * w01 + c11.vy * w11;
  const length = Math.hypot(rawVx, rawVy);
  sample.vx = length > 1e-6 ? rawVx / length : 0;
  sample.vy = length > 1e-6 ? rawVy / length : 0;
  sample.speed = c00.speed * w00 + c10.speed * w10 + c01.speed * w01 + c11.speed * w11;
  sample.alpha = c00.alpha * w00 + c10.alpha * w10 + c01.alpha * w01 + c11.alpha * w11;
}

function nearestFlowCell(field: FlowField, lon: number, lat: number): FlowCell {
  if (field.cells.length === 0) {
    return { lon, lat, vx: 0, vy: 0, speed: 0, alpha: 0 };
  }
  let best = field.cells[0];
  let bestD = Infinity;
  for (const cell of field.cells) {
    const d = (cell.lon - lon) ** 2 + (cell.lat - lat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

function blendFlowCells(
  c00: FlowCell,
  c10: FlowCell,
  c01: FlowCell,
  c11: FlowCell,
  tx: number,
  ty: number,
  lon: number,
  lat: number
): FlowCell {
  const topWeight = 1 - ty;
  const bottomWeight = ty;
  const leftWeight = 1 - tx;
  const rightWeight = tx;
  const w00 = leftWeight * topWeight;
  const w10 = rightWeight * topWeight;
  const w01 = leftWeight * bottomWeight;
  const w11 = rightWeight * bottomWeight;
  const rawVx = c00.vx * w00 + c10.vx * w10 + c01.vx * w01 + c11.vx * w11;
  const rawVy = c00.vy * w00 + c10.vy * w10 + c01.vy * w01 + c11.vy * w11;
  const vlen = Math.hypot(rawVx, rawVy);
  const vx = vlen > 1e-6 ? rawVx / vlen : 0;
  const vy = vlen > 1e-6 ? rawVy / vlen : 0;

  return {
    lon,
    lat,
    vx,
    vy,
    speed: c00.speed * w00 + c10.speed * w10 + c01.speed * w01 + c11.speed * w11,
    alpha: c00.alpha * w00 + c10.alpha * w10 + c01.alpha * w01 + c11.alpha * w11,
  };
}

export function sampleFlowField(
  field: FlowField,
  lon: number,
  lat: number
): FlowCell {
  if (field.cells.length === 0) {
    return { lon, lat, vx: 0, vy: 0, speed: 0, alpha: 0 };
  }
  if (
    field.cols < 2 ||
    field.rows < 2 ||
    field.cells.length < field.cols * field.rows
  ) {
    return nearestFlowCell(field, lon, lat);
  }

  const west = field.cells[0].lon;
  const east = field.cells[field.cols - 1].lon;
  const south = field.cells[0].lat;
  const north = field.cells[(field.rows - 1) * field.cols].lat;
  const lonSpan = east - west;
  const latSpan = north - south;
  if (
    !Number.isFinite(lonSpan) ||
    !Number.isFinite(latSpan) ||
    Math.abs(lonSpan) < 1e-9 ||
    Math.abs(latSpan) < 1e-9
  ) {
    return nearestFlowCell(field, lon, lat);
  }

  const colF = clamp01((lon - west) / lonSpan) * (field.cols - 1);
  const rowF = clamp01((lat - south) / latSpan) * (field.rows - 1);
  const col0 = Math.min(field.cols - 2, Math.max(0, Math.floor(colF)));
  const row0 = Math.min(field.rows - 2, Math.max(0, Math.floor(rowF)));
  const col1 = col0 + 1;
  const row1 = row0 + 1;
  const tx = colF - col0;
  const ty = rowF - row0;
  const c00 = field.cells[row0 * field.cols + col0];
  const c10 = field.cells[row0 * field.cols + col1];
  const c01 = field.cells[row1 * field.cols + col0];
  const c11 = field.cells[row1 * field.cols + col1];

  return blendFlowCells(c00, c10, c01, c11, tx, ty, lon, lat);
}

export interface SwellParticleLayerOptions {
  id: string;
  /** Returns the current flow field (re-read each frame so timeline scrubs apply). */
  getField: () => FlowField;
  /** Hex accent for the active layer. */
  getColorHex: () => string;
  /** When true: render ONE static frame, never triggerRepaint. */
  reducedMotion: boolean;
  /** CSS viewport width for particle-count scaling. */
  viewportWidthPx: number;
  /**
   * Optional explicit particle count, overriding the viewport-derived default.
   * Used by the combined view to cap per-layer count when three layers stack
   * (keeps the total in budget).
   */
  count?: number;
  maskToWater?: boolean | (() => boolean);
  /**
   * Mark style for the drawn particle. "dash" (default) renders a crest line
   * (two vertices per particle, GL LINES). "dot" renders a single GL point per
   * particle. "streak" renders a short line along the travel direction with no
   * dot head, used by wind so it reads as flow instead of stippled dots.
   */
  markStyle?: "dash" | "dot" | "streak";
  /** Layer-specific advection scale. Lower values make motion read smoother. */
  motionScale?: number;
  /**
   * Per-frame velocity easing responsiveness, 0..1. Smaller values smooth jitter
   * across grid-cell boundaries; 1 follows the sampled vector immediately.
   */
  velocitySmoothing?: number;
  /** Layer-specific scale for wave-crest dash length. */
  dashLengthScale?: number;
  /**
   * Read motion params each frame so a single persistent layer can retarget to a
   * new swell component (e.g. Swell -> Swell 2) without being torn down and
   * re-seeded — which is what causes the visible jitter on layer switch.
   */
  getDynamics?: () => {
    motionScale?: number;
    velocitySmoothing?: number;
    dashLengthScale?: number;
  };
}

export interface SwellParticleLayer extends mapboxgl.CustomLayerInterface {
  getActiveParticleCount: () => number;
}

export function shouldAnimateSwellParticles(map: mapboxgl.Map): boolean {
  if (typeof document !== "undefined") {
    if (document.hidden || document.visibilityState === "hidden") return false;
  }

  if (typeof navigator !== "undefined") {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData) return false;
    if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
      return false;
    }
  }

  if (typeof window === "undefined") return true;
  const canvas = map.getCanvas();
  const rect = canvas.getBoundingClientRect?.();
  if (!rect) return true;
  if (rect.width <= 0 || rect.height <= 0) return false;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return (
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < viewportWidth &&
    rect.top < viewportHeight
  );
}

/**
 * Build a Mapbox CustomLayerInterface that advects additive particle trails
 * through the swell flow field, locked to geography via Mercator coordinates.
 */
export function createSwellParticleLayer(
  options: SwellParticleLayerOptions
): SwellParticleLayer {
  const count =
    options.count != null && options.count > 0
      ? Math.floor(options.count)
      : resolveParticleCount(options.viewportWidthPx);
  const markStyle = options.markStyle ?? "dash";
  // Wind renders as a wiggling "worm": a short sinuous polyline. Each segment is a
  // GL LINES pair, so a worm of N segments needs N*2 vertices.
  const STREAK_SEGMENTS = 10;
  // A dash is drawn as a width-controllable quad (two triangles = 6 verts) instead
  // of a 1px GL line, because gl.lineWidth is pinned to 1px on most drivers and the
  // hairline crest washed out on the bright basemap. Streak stays a polyline; dot a point.
  const verticesPerParticle =
    markStyle === "dot" ? 1 : markStyle === "streak" ? STREAK_SEGMENTS * 2 : 6;
  const clampMotion = (v: number | undefined, fallback: number): number =>
    v != null && Number.isFinite(v) ? Math.max(0, v) : fallback;
  const clampSmoothing = (v: number | undefined, fallback: number): number =>
    v != null && Number.isFinite(v) ? Math.min(1, Math.max(0.01, v)) : fallback;
  const clampDashScale = (v: number | undefined, fallback: number): number =>
    v != null && Number.isFinite(v) ? Math.max(0.1, v) : fallback;
  const staticMotionScale = clampMotion(options.motionScale, 1);
  const staticVelocitySmoothing = clampSmoothing(options.velocitySmoothing, 0.16);
  const staticDashLengthScale = clampDashScale(options.dashLengthScale, 1);
  let waterTexture: WebGLTexture | null = null;
  let maskCanvas: HTMLCanvasElement | null = null;
  let maskDirty = true;
  const invalidateMask = (): void => { maskDirty = true; };
  let program: WebGLProgram | null = null;
  let posBuffer: WebGLBuffer | null = null;
  let alphaBuffer: WebGLBuffer | null = null;
  let aPosLoc = -1;
  let aAlphaLoc = -1;
  let uMatrixLoc: WebGLUniformLocation | null = null;
  let uColorLoc: WebGLUniformLocation | null = null;
  let uAlphaLoc: WebGLUniformLocation | null = null;
  let uPointSizeLoc: WebGLUniformLocation | null = null;
  let staticRenderedField: FlowField | null = null;
  let staticRenderedCamera = "";
  let particleBox: MercatorBox | null = null;
  let mapRef: mapboxgl.Map | null = null;

  // Particle state in Mercator unit space [0..1].
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const page = new Float32Array(count);
  const life = new Float32Array(count);
  const vxState = new Float32Array(count);
  const vyState = new Float32Array(count);
  // 2 floats per vertex plus one alpha. Dash and streak are both single segments.
  const vertexPos = new Float32Array(count * verticesPerParticle * 2);
  const vertexAlpha = new Float32Array(count * verticesPerParticle);
  const flowSample: FlowSample = { vx: 0, vy: 0, speed: 0, alpha: 0 };

  const rng = Math.random;
  let lastFrameMs: number | null = null;
  // Fraction of the current viewport a speed=1 particle advances per 60Hz frame,
  // scaled to the live Mercator span so motion reads the same at any zoom. This is
  // intentionally time-based: reference wind maps keep particles alive and advect
  // them through the field instead of respawning whole cohorts that appear to blink.
  const STEP_FRACTION = 0.00055;
  const FRAME_MS = 1000 / 60;
  const MAX_FRAME_STEP = 1.6;
  const activeCounts = [
    count,
    Math.max(1, Math.round(count * 0.75)),
    Math.max(1, Math.round(count * 0.5)),
    Math.max(1, Math.ceil(count * 0.4)),
  ];
  let activeCountLevel = 0;
  let activeCount = count;
  let smoothedFrameMs = FRAME_MS;
  let slowFrameMs = 0;
  let fastFrameMs = 0;
  const MIN_LIFE_FRAMES = 300;
  const LIFE_JITTER_FRAMES = 360;
  const BIRTH_FADE_PORTION = 0.08;
  const DEATH_FADE_PORTION = 0.16;
  // Fixed dash LENGTH as a fraction of the viewport span, DECOUPLED from drift speed
  // so dashes stay visible no matter how slow they move. Tying length to the
  // per-frame step made slow dashes sub-pixel and invisible.
  const DASH_FRACTION = 0.032;
  // Dash thickness in device pixels (a quad, so width is real — gl.lineWidth is not).
  // Weak swell ~2.6px, strong swell ~2.6+4.4 ≈ 7px, so strength reads as weight.
  const DASH_WIDTH_PX_BASE = 2.6;
  const DASH_WIDTH_PX_GAIN = 4.4;
  // Wind worm geometry: a short sinuous line that undulates as it drifts.
  const WIND_STREAK_FRACTION = 0.034; // worm length as a fraction of the viewport span
  const WIND_WIGGLE_AMP = 0.0035; // gentle sideways wiggle (fraction of span)
  const WIND_WIGGLE_WAVES = 1; // one smooth undulation along the body
  const WIND_WIGGLE_SPEED = 0.05; // slow phase advance per frame (calm wriggle)
  // How aggressively weak cells thin out their particles (higher = sparser weak).
  const STRENGTH_DENSITY_CULL = 0.8;

  function randomLifeFrames(): number {
    return MIN_LIFE_FRAMES + rng() * LIFE_JITTER_FRAMES;
  }

  function frameStep(adaptParticleCount: boolean): number {
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    if (lastFrameMs == null) {
      lastFrameMs = now;
      return 1;
    }
    const deltaMs = now - lastFrameMs;
    const deltaFrames = deltaMs / FRAME_MS;
    lastFrameMs = now;
    if (!Number.isFinite(deltaFrames) || deltaFrames <= 0) return 1;
    if (adaptParticleCount) {
      const measuredFrameMs = Math.min(deltaMs, 100);
      smoothedFrameMs += (measuredFrameMs - smoothedFrameMs) * 0.1;
      slowFrameMs = smoothedFrameMs > 1000 / 30 ? slowFrameMs + measuredFrameMs : 0;
      fastFrameMs = smoothedFrameMs < 1000 / 50 ? fastFrameMs + measuredFrameMs : 0;
      if (slowFrameMs >= 2000 && activeCountLevel < activeCounts.length - 1) {
        activeCountLevel += 1;
        activeCount = activeCounts[activeCountLevel];
        slowFrameMs = 0;
      } else if (fastFrameMs >= 5000 && activeCountLevel > 0) {
        activeCountLevel -= 1;
        activeCount = activeCounts[activeCountLevel];
        fastFrameMs = 0;
      }
    }
    return Math.min(MAX_FRAME_STEP, deltaFrames);
  }

  function viewBoxMercator(map: mapboxgl.Map): MercatorBox {
    const b = map.getBounds();
    // getBounds() can be null before the map has a position; fall back to the
    // full Mercator unit square so particles still have a valid spawn box.
    if (!b) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const sw = mapboxgl.MercatorCoordinate.fromLngLat({
      lng: b.getWest(),
      lat: b.getSouth(),
    });
    const ne = mapboxgl.MercatorCoordinate.fromLngLat({
      lng: b.getEast(),
      lat: b.getNorth(),
    });
    return {
      minX: Math.min(sw.x, ne.x),
      maxX: Math.max(sw.x, ne.x),
      minY: Math.min(sw.y, ne.y),
      maxY: Math.max(sw.y, ne.y),
    };
  }

  function seedAll(map: mapboxgl.Map): void {
    const box = viewBoxMercator(map);
    particleBox = box;
    for (let i = 0; i < count; i += 1) {
      // Jittered grid: even, Windy-style spacing instead of a random blanket.
      const s = gridSeedParticle(i, count, box, rng);
      px[i] = s.x;
      py[i] = s.y;
      vxState[i] = 0;
      vyState[i] = 0;
      life[i] = randomLifeFrames();
      page[i] = rng() * life[i];
    }
    lastFrameMs = null;
    activeCountLevel = 0;
    activeCount = count;
    smoothedFrameMs = FRAME_MS;
    slowFrameMs = 0;
    fastFrameMs = 0;
  }

  function advanceAndFill(
    map: mapboxgl.Map,
    field: FlowField,
    adaptParticleCount: boolean
  ): void {
    const box = viewBoxMercator(map);
    const fieldBounds = getMercatorFieldBounds(field);
    const span = Math.max(box.maxX - box.minX, 1e-6);
    if (particleBox) {
      const oldWidth = particleBox.maxX - particleBox.minX;
      const oldHeight = particleBox.maxY - particleBox.minY;
      if (oldWidth > 0 && oldHeight > 0 && Math.abs(span / oldWidth - 1) > 0.001) {
        for (let i = 0; i < count; i += 1) {
          px[i] = box.minX + ((px[i] - particleBox.minX) / oldWidth) * span;
          py[i] = box.minY + ((py[i] - particleBox.minY) / oldHeight) * (box.maxY - box.minY);
        }
      }
    }
    particleBox = box;
    const deltaFrames = frameStep(adaptParticleCount);
    // Read dynamics each frame so the active single layer can retarget without a
    // teardown (falls back to the values fixed at creation, e.g. combined sub-layers).
    const dyn = options.getDynamics?.();
    const motionScale = clampMotion(dyn?.motionScale, staticMotionScale);
    const velocitySmoothing = clampSmoothing(dyn?.velocitySmoothing, staticVelocitySmoothing);
    const dashLengthScale = clampDashScale(dyn?.dashLengthScale, staticDashLengthScale);
    // Mercator units per device pixel, so dash thickness can be set in pixels for a
    // consistent on-screen weight regardless of zoom or DPR.
    const canvasWidthPx = map.getCanvas().width || 1;
    const mercPerPx = span / canvasWidthPx;
    const { cols: seedCols, rows: seedRows } = gridDimensions(count, box);
    const seedCellWidth = (box.maxX - box.minX) / seedCols;
    const seedCellHeight = (box.maxY - box.minY) / seedRows;
    for (let i = 0; i < activeCount; i += 1) {
      sampleFlowFieldMercator(field, fieldBounds, px[i], py[i], flowSample);
      const rawLen = Math.hypot(flowSample.vx, flowSample.vy);
      let flowVx = rawLen > 1e-6 ? flowSample.vx / rawLen : 0;
      let flowVy = rawLen > 1e-6 ? flowSample.vy / rawLen : 0;
      if (flowSample.speed > 0 && rawLen > 1e-6) {
        const previousLen = Math.hypot(vxState[i], vyState[i]);
        if (previousLen <= 1e-6) {
          vxState[i] = flowVx;
          vyState[i] = flowVy;
        } else {
          const blend = 1 - Math.pow(1 - velocitySmoothing, deltaFrames);
          vxState[i] += (flowVx - vxState[i]) * blend;
          vyState[i] += (flowVy - vyState[i]) * blend;
          const easedLen = Math.hypot(vxState[i], vyState[i]);
          if (easedLen > 1e-6) {
            vxState[i] /= easedLen;
            vyState[i] /= easedLen;
          }
        }
        flowVx = vxState[i];
        flowVy = vyState[i];
      } else {
        vxState[i] = 0;
        vyState[i] = 0;
      }
      // Drift rate is driven by the swell's celerity (cell.speed by period) - no flat
      // floor, so the motion genuinely reflects how fast each swell is moving.
      const step = span * STEP_FRACTION * flowSample.speed * deltaFrames * motionScale;
      // Screen-y down maps to +Mercator-y down, so vy sign is consistent.
      px[i] += flowVx * step;
      py[i] += flowVy * step;
      page[i] += deltaFrames;

      const out =
        px[i] < box.minX ||
        px[i] > box.maxX ||
        py[i] < box.minY ||
        py[i] > box.maxY ||
        page[i] > life[i];
      if (out) {
        // Respawn back into THIS particle's own grid cell so even coverage holds as
        // particles drift out-of-box or exceed their life.
        px[i] = box.minX + (i % seedCols + rng()) * seedCellWidth;
        py[i] =
          box.minY + (Math.floor(i / seedCols) % seedRows + rng()) * seedCellHeight;
        vxState[i] = 0;
        vyState[i] = 0;
        // Stronger swell at the spawn point -> a longer-lasting particle.
        sampleFlowFieldMercator(field, fieldBounds, px[i], py[i], flowSample);
        const seedStrength = Math.min(1, Math.max(0, flowSample.alpha));
        life[i] = randomLifeFrames() * (0.55 + seedStrength * 0.9);
        page[i] = 0;
        const baseVertex = i * verticesPerParticle;
        for (let vertex = 0; vertex < verticesPerParticle; vertex += 1) {
          const offset = (baseVertex + vertex) * 2;
          vertexPos[offset + 0] = px[i];
          vertexPos[offset + 1] = py[i];
          vertexAlpha[baseVertex + vertex] = 0;
        }
        continue;
      }

      // Push populated cells toward opaque so the dark marks read solidly on the
      // light basemap; keep DEAD cells (no nearby beach data, speed === 0) fully
      // invisible so open water / land stays clean.
      const ageRatio = Math.min(1, Math.max(0, page[i] / Math.max(life[i], 1)));
      const birthFade = Math.min(1, ageRatio / BIRTH_FADE_PORTION);
      const deathFade = Math.min(1, (1 - ageRatio) / DEATH_FADE_PORTION);
      const lifeFade = Math.min(birthFade, deathFade);
      // Wave strength (energy ~ height^2, normalized 0..1) drives the whole look:
      // stronger swell reads bolder, denser, longer; weaker reads faint and sparse.
      const strength = Math.min(1, Math.max(0, flowSample.alpha));
      // Stable per-particle cull threshold (golden-ratio sequence, no per-frame
      // flicker): weak cells reveal only the low-threshold particles -> sparser;
      // strong cells clear nearly everyone -> denser.
      const cullThreshold = (i * 0.6180339887498949) % 1;
      // Floor at 0.55 so even weak cells stay reasonably dense (the field never
      // looks empty); strong cells still read noticeably denser.
      const visible = 0.55 + strength * 0.45 >= cullThreshold * STRENGTH_DENSITY_CULL;
      const baseAlpha =
        markStyle === "streak" ? 0.22 + strength * 0.6 : 0.3 + strength * 0.7;
      const fade =
        flowSample.speed > 0 && visible ? Math.min(1, baseAlpha) * lifeFade : 0;

      if (markStyle === "dot") {
        // One GL point per particle, centered on the particle position.
        vertexPos[i * 2 + 0] = px[i];
        vertexPos[i * 2 + 1] = py[i];
        vertexAlpha[i] = fade;
        continue;
      }

      if (markStyle === "streak") {
        // A wiggling "worm": a sinuous polyline along the travel vector whose body
        // undulates via a traveling sine wave (phase driven by particle age, so each
        // worm wriggles independently). No POINTS pass, so there is no dot head.
        const vlen = Math.hypot(flowVx, flowVy) || 1;
        const dirX = flowVx / vlen;
        const dirY = flowVy / vlen;
        const normalX = -dirY;
        const normalY = dirX;
        // Stronger wind -> longer worm.
        const len = span * WIND_STREAK_FRACTION * (0.55 + strength * 0.8);
        const amp = span * WIND_WIGGLE_AMP;
        const phase = page[i] * WIND_WIGGLE_SPEED;
        const baseVertex = i * verticesPerParticle;
        let prevX = 0;
        let prevY = 0;
        for (let s = 0; s <= STREAK_SEGMENTS; s += 1) {
          const t = s / STREAK_SEGMENTS;
          const along = (t - 0.5) * len;
          const wiggle =
            Math.sin(t * Math.PI * 2 * WIND_WIGGLE_WAVES + phase) * amp;
          const x = px[i] + dirX * along + normalX * wiggle;
          const y = py[i] + dirY * along + normalY * wiggle;
          if (s > 0) {
            const vertexOffset = (baseVertex + (s - 1) * 2) * 2;
            vertexPos[vertexOffset + 0] = prevX;
            vertexPos[vertexOffset + 1] = prevY;
            vertexPos[vertexOffset + 2] = x;
            vertexPos[vertexOffset + 3] = y;
            vertexAlpha[baseVertex + (s - 1) * 2 + 0] = fade;
            vertexAlpha[baseVertex + (s - 1) * 2 + 1] = fade;
          }
          prevX = x;
          prevY = y;
        }
        continue;
      }

      // Draw a fixed-length crest mark PERPENDICULAR to the flow vector, centered on
      // the particle (visible length is independent of drift speed). It is a quad
      // (two triangles), not a 1px line, so it has real width and reads on the light
      // basemap; stronger swell -> longer and thicker.
      const vlen = Math.hypot(flowVx, flowVy) || 1;
      const dashHalf =
        span * DASH_FRACTION * dashLengthScale * (0.45 + strength) * 0.5;
      // Crest direction (perpendicular to flow) gives the dash its length...
      const cx = (-flowVy / vlen) * dashHalf;
      const cy = (flowVx / vlen) * dashHalf;
      // ...flow direction gives the dash its thickness, in pixels for crisp weight.
      const halfWidth = (DASH_WIDTH_PX_BASE + strength * DASH_WIDTH_PX_GAIN) * 0.5 * mercPerPx;
      const wx = (flowVx / vlen) * halfWidth;
      const wy = (flowVy / vlen) * halfWidth;
      const ax = px[i] - cx;
      const ay = py[i] - cy;
      const bx = px[i] + cx;
      const by = py[i] + cy;
      const baseVertex = i * verticesPerParticle;
      let o = baseVertex * 2;
      // Triangle 1: A-side near, A-side far, B-side far. Triangle 2: A near, B far, B near.
      vertexPos[o + 0] = ax - wx; vertexPos[o + 1] = ay - wy;
      vertexPos[o + 2] = ax + wx; vertexPos[o + 3] = ay + wy;
      vertexPos[o + 4] = bx + wx; vertexPos[o + 5] = by + wy;
      vertexPos[o + 6] = ax - wx; vertexPos[o + 7] = ay - wy;
      vertexPos[o + 8] = bx + wx; vertexPos[o + 9] = by + wy;
      vertexPos[o + 10] = bx - wx; vertexPos[o + 11] = by - wy;
      for (let v = 0; v < 6; v += 1) vertexAlpha[baseVertex + v] = fade;
    }
  }

  return {
    id: options.id,
    type: "custom",
    renderingMode: "2d",
    getActiveParticleCount: () => activeCount,

    onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
      mapRef = map;
      if (options.maskToWater) {
        maskCanvas = document.createElement("canvas");
        waterTexture = gl.createTexture();
        map.on("move", invalidateMask);
        map.on("resize", invalidateMask);
        map.on("sourcedata", invalidateMask);
      }
      const vs = compileShader(gl, gl.VERTEX_SHADER, PARTICLE_VERTEX_SHADER);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAGMENT_SHADER);
      const prog = gl.createProgram();
      if (!prog) throw new Error("swell-field: failed to create program");
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(prog);
        throw new Error(`swell-field: program link failed: ${log}`);
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      program = prog;

      aPosLoc = gl.getAttribLocation(prog, "a_pos");
      aAlphaLoc = gl.getAttribLocation(prog, "a_alpha");
      uMatrixLoc = gl.getUniformLocation(prog, "u_matrix");
      uColorLoc = gl.getUniformLocation(prog, "u_color");
      uAlphaLoc = gl.getUniformLocation(prog, "u_alpha");
      uPointSizeLoc = gl.getUniformLocation(prog, "u_pointSize");

      posBuffer = gl.createBuffer();
      alphaBuffer = gl.createBuffer();
      seedAll(map);
    },

    render(gl: WebGL2RenderingContext, matrix: number[]) {
      if (!program || !mapRef) return;
      const field = options.getField();
      const shouldAnimate =
        !options.reducedMotion && shouldAnimateSwellParticles(mapRef);
      const camera = JSON.stringify(viewBoxMercator(mapRef));
      const shouldRenderStaticFrame = !shouldAnimate && (staticRenderedField !== field || staticRenderedCamera !== camera);
      if (shouldAnimate || shouldRenderStaticFrame) {
        advanceAndFill(mapRef, field, shouldAnimate);
        staticRenderedField = shouldAnimate ? null : field;
        staticRenderedCamera = camera;
      }

      gl.useProgram(program);
      const maskToWater = typeof options.maskToWater === "function" ? options.maskToWater() : options.maskToWater;
      gl.uniform1i(gl.getUniformLocation(program, "u_maskToWater"), maskToWater ? 1 : 0);
      if (options.maskToWater && maskCanvas && waterTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, waterTexture);
        if (maskDirty) {
          drawWaterMask(mapRef, maskCanvas);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          maskDirty = false;
        }
        gl.uniform1i(gl.getUniformLocation(program, "u_waterMask"), 0);
        gl.uniform2f(gl.getUniformLocation(program, "u_viewport"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      }
      gl.uniformMatrix4fv(uMatrixLoc, false, matrix);
      const [r, g, b] = hexToRgb(options.getColorHex());
      gl.uniform3f(uColorLoc, r, g, b);
      // Near-opaque so the dark dashes read crisply on the light basemap; the static
      // reduced-motion frame stays a touch dimmer.
      gl.uniform1f(uAlphaLoc, options.reducedMotion ? 0.95 : 1.0);
      // Dot diameter in device pixels. Ignored when drawing LINES.
      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      gl.uniform1f(uPointSizeLoc, 5 * dpr);

      gl.enable(gl.BLEND);
      // Normal alpha blending — dark marks paint over the light water (additive glow
      // is invisible on a light map).
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexPos, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, alphaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexAlpha, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aAlphaLoc);
      gl.vertexAttribPointer(aAlphaLoc, 1, gl.FLOAT, false, 0, 0);

      if (markStyle === "dot") {
        // One vertex per particle drawn as a GL point.
        gl.drawArrays(gl.POINTS, 0, activeCount);
      } else if (markStyle === "streak") {
        // Worm: polyline pairs.
        gl.lineWidth(1);
        gl.drawArrays(gl.LINES, 0, activeCount * verticesPerParticle);
      } else {
        // Dash: quads (two triangles per particle) for real, controllable width.
        gl.drawArrays(gl.TRIANGLES, 0, activeCount * verticesPerParticle);
      }

      // Animate only when motion is allowed. When animation is suppressed, draw
      // one static frame for each field and never request a repaint loop.
      if (shouldAnimate) {
        mapRef.triggerRepaint();
      }
    },

    onRemove(_map: mapboxgl.Map, gl: WebGL2RenderingContext) {
      _map.off("move", invalidateMask);
      _map.off("resize", invalidateMask);
      _map.off("sourcedata", invalidateMask);
      if (waterTexture) gl.deleteTexture(waterTexture);
      if (program) gl.deleteProgram(program);
      if (posBuffer) gl.deleteBuffer(posBuffer);
      if (alphaBuffer) gl.deleteBuffer(alphaBuffer);
      program = null;
      posBuffer = null;
      alphaBuffer = null;
      mapRef = null;
    },
  };
}
