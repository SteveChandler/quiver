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
export const PARTICLE_COUNT_DESKTOP = 450;
export const PARTICLE_COUNT_MOBILE = 200;

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
varying float v_alpha;
void main() {
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
}

/**
 * Build a Mapbox CustomLayerInterface that advects additive particle trails
 * through the swell flow field, locked to geography via Mercator coordinates.
 */
export function createSwellParticleLayer(
  options: SwellParticleLayerOptions
): mapboxgl.CustomLayerInterface {
  const count =
    options.count != null && options.count > 0
      ? Math.floor(options.count)
      : resolveParticleCount(options.viewportWidthPx);
  const markStyle = options.markStyle ?? "dash";
  const verticesPerParticle = markStyle === "dot" ? 1 : 2;
  const motionScale =
    options.motionScale != null && Number.isFinite(options.motionScale)
      ? Math.max(0, options.motionScale)
      : 1;
  const velocitySmoothing =
    options.velocitySmoothing != null && Number.isFinite(options.velocitySmoothing)
      ? Math.min(1, Math.max(0.01, options.velocitySmoothing))
      : 0.16;
  const dashLengthScale =
    options.dashLengthScale != null && Number.isFinite(options.dashLengthScale)
      ? Math.max(0.1, options.dashLengthScale)
      : 1;
  let program: WebGLProgram | null = null;
  let posBuffer: WebGLBuffer | null = null;
  let alphaBuffer: WebGLBuffer | null = null;
  let aPosLoc = -1;
  let aAlphaLoc = -1;
  let uMatrixLoc: WebGLUniformLocation | null = null;
  let uColorLoc: WebGLUniformLocation | null = null;
  let uAlphaLoc: WebGLUniformLocation | null = null;
  let uPointSizeLoc: WebGLUniformLocation | null = null;
  let reducedMotionRenderedField: FlowField | null = null;
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

  const rng = Math.random;
  let lastFrameMs: number | null = null;
  // Fraction of the current viewport a speed=1 particle advances per 60Hz frame,
  // scaled to the live Mercator span so motion reads the same at any zoom. This is
  // intentionally time-based: reference wind maps keep particles alive and advect
  // them through the field instead of respawning whole cohorts that appear to blink.
  const STEP_FRACTION = 0.00055;
  const FRAME_MS = 1000 / 60;
  const MAX_FRAME_STEP = 1.6;
  const MIN_LIFE_FRAMES = 300;
  const LIFE_JITTER_FRAMES = 360;
  const BIRTH_FADE_PORTION = 0.08;
  const DEATH_FADE_PORTION = 0.16;
  // Fixed dash LENGTH as a fraction of the viewport span, DECOUPLED from drift speed
  // so dashes stay visible no matter how slow they move. Tying length to the
  // per-frame step made slow dashes sub-pixel and invisible. Line width >1 is
  // unreliable across GPUs, so length is the lever.
  const DASH_FRACTION = 0.032;
  // Wind gets a shorter line along the vector and no point pass. That removes the
  // dot-head look while still showing direction and drift.
  const WIND_STREAK_FRACTION = 0.026;

  function randomLifeFrames(): number {
    return MIN_LIFE_FRAMES + rng() * LIFE_JITTER_FRAMES;
  }

  function frameStep(): number {
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    if (lastFrameMs == null) {
      lastFrameMs = now;
      return 1;
    }
    const deltaFrames = (now - lastFrameMs) / FRAME_MS;
    lastFrameMs = now;
    if (!Number.isFinite(deltaFrames) || deltaFrames <= 0) return 1;
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
  }

  function advanceAndFill(map: mapboxgl.Map, field: FlowField): void {
    const box = viewBoxMercator(map);
    const span = Math.max(box.maxX - box.minX, 1e-6);
    const deltaFrames = frameStep();
    for (let i = 0; i < count; i += 1) {
      // Convert this particle's Mercator pos back to lng/lat to sample the geo field.
      const merc = new mapboxgl.MercatorCoordinate(px[i], py[i]);
      const ll = merc.toLngLat();
      const cell = sampleFlowField(field, ll.lng, ll.lat);
      const rawLen = Math.hypot(cell.vx, cell.vy);
      let flowVx = rawLen > 1e-6 ? cell.vx / rawLen : 0;
      let flowVy = rawLen > 1e-6 ? cell.vy / rawLen : 0;
      if (cell.speed > 0 && rawLen > 1e-6) {
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
      const step = span * STEP_FRACTION * cell.speed * deltaFrames * motionScale;
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
        const s = gridSeedParticle(i, count, box, rng);
        px[i] = s.x;
        py[i] = s.y;
        vxState[i] = 0;
        vyState[i] = 0;
        life[i] = randomLifeFrames();
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
      const baseAlpha =
        markStyle === "streak"
          ? Math.min(1, 0.72 + cell.alpha * 0.45)
          : Math.min(1, 0.72 + cell.alpha);
      const fade =
        cell.speed > 0 ? baseAlpha * lifeFade : 0;

      if (markStyle === "dot") {
        // One GL point per particle, centered on the particle position.
        vertexPos[i * 2 + 0] = px[i];
        vertexPos[i * 2 + 1] = py[i];
        vertexAlpha[i] = fade;
        continue;
      }

      if (markStyle === "streak") {
        // A single thin line along the velocity-smoothed travel vector — the easing
        // keeps the motion wavy. One stroke reads far cleaner than the old triple
        // line, which was too noisy. No POINTS pass, so there is no dot head.
        const vlen = Math.hypot(flowVx, flowVy) || 1;
        const halfLen = span * WIND_STREAK_FRACTION * 0.5;
        const dx = (flowVx / vlen) * halfLen;
        const dy = (flowVy / vlen) * halfLen;
        const baseVertex = i * verticesPerParticle;
        const vertexOffset = baseVertex * 2;
        vertexPos[vertexOffset + 0] = px[i] - dx;
        vertexPos[vertexOffset + 1] = py[i] - dy;
        vertexPos[vertexOffset + 2] = px[i] + dx;
        vertexPos[vertexOffset + 3] = py[i] + dy;
        vertexAlpha[baseVertex + 0] = fade;
        vertexAlpha[baseVertex + 1] = fade;
        continue;
      }

      // Draw a small fixed-length dash PERPENDICULAR to the flow vector, centered on
      // the particle, so the visible mark reads like a wave crest.
      // Visible length is independent of drift speed.
      const vlen = Math.hypot(flowVx, flowVy) || 1;
      const dashHalf = span * DASH_FRACTION * dashLengthScale * 0.5;
      const dx = (-flowVy / vlen) * dashHalf;
      const dy = (flowVx / vlen) * dashHalf;
      const baseVertex = i * verticesPerParticle;
      const vertexOffset = baseVertex * 2;
      vertexPos[vertexOffset + 0] = px[i] - dx;
      vertexPos[vertexOffset + 1] = py[i] - dy;
      vertexPos[vertexOffset + 2] = px[i] + dx;
      vertexPos[vertexOffset + 3] = py[i] + dy;
      vertexAlpha[baseVertex + 0] = fade;
      vertexAlpha[baseVertex + 1] = fade;
    }
  }

  return {
    id: options.id,
    type: "custom",
    renderingMode: "2d",

    onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
      mapRef = map;
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
      if (!options.reducedMotion || reducedMotionRenderedField !== field) {
        advanceAndFill(mapRef, field);
        reducedMotionRenderedField = options.reducedMotion ? field : null;
      }

      gl.useProgram(program);
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
        gl.drawArrays(gl.POINTS, 0, count);
      } else {
        gl.lineWidth(1);
        gl.drawArrays(gl.LINES, 0, count * verticesPerParticle);
      }

      // Animate only when motion is allowed. Under reduced motion we draw a
      // single static frame and never request another.
      if (!options.reducedMotion) {
        mapRef.triggerRepaint();
      }
    },

    onRemove(_map: mapboxgl.Map, gl: WebGL2RenderingContext) {
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
