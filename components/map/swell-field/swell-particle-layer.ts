import mapboxgl from "mapbox-gl";
import type { FlowField } from "@/components/map/swell-field/field-sampler";

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
// space. a_alpha carries per-vertex trail fade. gl_PointSize is honored only in
// POINTS draw mode (the wind dot layer) and ignored when drawing LINES.
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

/** Sample the flow field for the cell nearest a lng/lat. Returns travel vec + speed. */
function sampleField(field: FlowField, lon: number, lat: number) {
  if (field.cells.length === 0) return { vx: 0, vy: 0, speed: 0, alpha: 0 };
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
   * particle — used by the wind layer to read as a stippled dot field. "comet"
   * renders a dot head with a short fading trail (two vertices per particle,
   * drawn as LINES then POINTS) trailing OPPOSITE the wind's travel direction.
   */
  markStyle?: "dash" | "dot" | "comet";
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
  let program: WebGLProgram | null = null;
  let posBuffer: WebGLBuffer | null = null;
  let alphaBuffer: WebGLBuffer | null = null;
  let aPosLoc = -1;
  let aAlphaLoc = -1;
  let uMatrixLoc: WebGLUniformLocation | null = null;
  let uColorLoc: WebGLUniformLocation | null = null;
  let uAlphaLoc: WebGLUniformLocation | null = null;
  let uPointSizeLoc: WebGLUniformLocation | null = null;
  let mapRef: mapboxgl.Map | null = null;

  // Particle state in Mercator unit space [0..1].
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const page = new Float32Array(count);
  const life = new Float32Array(count);
  // Two vertices per particle (trail segment); 2 floats pos + 1 float alpha each.
  const vertexPos = new Float32Array(count * 2 * 2);
  const vertexAlpha = new Float32Array(count * 2);

  const rng = Math.random;
  // Fraction of the current viewport a speed=1 particle ADVANCES per frame, scaled to
  // the live Mercator span so motion reads the same at any zoom. Very gentle so the
  // crawl matches Windy's pace; dash LENGTH is decoupled via DASH_FRACTION, so slowing
  // the step does not shrink the marks. Per-frame step = span * STEP_FRACTION *
  // cell.speed, and cell.speed is the swell's deep-water celerity (∝ period) — so
  // longer-period swells visibly drift faster, short-period swells slower.
  const STEP_FRACTION = 0.00012;
  // Fixed dash LENGTH as a fraction of the viewport span, DECOUPLED from drift speed
  // so dashes stay visible (~10px) no matter how slow they move. Tying length to the
  // per-frame step made slow dashes sub-pixel and invisible.
  const DASH_FRACTION = 0.011;
  // Comet TAIL length as a fraction of the viewport span — a short streak behind the
  // moving dot head. Shorter than a crest dash so it reads as a trailing wisp, not a
  // line. Decoupled from drift speed (same rationale as DASH_FRACTION).
  const COMET_TAIL_FRACTION = 0.02;

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
      page[i] = Math.floor(rng() * 60);
      life[i] = 40 + Math.floor(rng() * 60);
    }
  }

  function advanceAndFill(map: mapboxgl.Map): void {
    const field = options.getField();
    const box = viewBoxMercator(map);
    const span = Math.max(box.maxX - box.minX, 1e-6);
    for (let i = 0; i < count; i += 1) {
      // Convert this particle's Mercator pos back to lng/lat to sample the geo field.
      const merc = new mapboxgl.MercatorCoordinate(px[i], py[i]);
      const ll = merc.toLngLat();
      const cell = sampleField(field, ll.lng, ll.lat);
      // Drift rate is driven by the swell's celerity (cell.speed ∝ period) — no flat
      // floor, so the motion genuinely reflects how fast each swell is moving.
      const step = span * STEP_FRACTION * cell.speed;
      // Screen-y down maps to +Mercator-y down, so vy sign is consistent.
      px[i] += cell.vx * step;
      py[i] += cell.vy * step;
      page[i] += 1;

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
        page[i] = 0;
        if (markStyle === "dot") {
          // One vertex per particle; invisible on respawn so we don't flash a dot.
          vertexPos[i * 2 + 0] = px[i];
          vertexPos[i * 2 + 1] = py[i];
          vertexAlpha[i] = 0;
        } else {
          // Dash and comet share the 2-vertex layout: collapse both verts onto the new
          // position with alpha 0 so respawn draws no jump streak.
          vertexPos[i * 4 + 0] = px[i];
          vertexPos[i * 4 + 1] = py[i];
          vertexPos[i * 4 + 2] = px[i];
          vertexPos[i * 4 + 3] = py[i];
          vertexAlpha[i * 2 + 0] = 0;
          vertexAlpha[i * 2 + 1] = 0;
        }
        continue;
      }

      // Push populated cells toward opaque so the dark marks read solidly on the
      // light basemap; keep DEAD cells (no nearby beach data, speed === 0) fully
      // invisible so open water / land stays clean.
      const trail = 1 - page[i] / life[i];
      const fade =
        cell.speed > 0
          ? Math.min(1, 0.85 + cell.alpha) * Math.min(1, trail * 4)
          : 0;

      if (markStyle === "dot") {
        // One GL point per particle, centered on the particle position.
        vertexPos[i * 2 + 0] = px[i];
        vertexPos[i * 2 + 1] = py[i];
        vertexAlpha[i] = fade;
        continue;
      }

      if (markStyle === "comet") {
        // A small comet: vert 0 is the tail end (transparent), vert 1 is the head at
        // the particle position (solid). The tail extends BEHIND the head, opposite
        // the travel direction, so it trails the moving dot. Drawn as a LINES segment
        // (the fading streak) plus a POINTS pass (the dot head) sharing this buffer.
        const vlen = Math.hypot(cell.vx, cell.vy) || 1;
        const tailLen = span * COMET_TAIL_FRACTION;
        vertexPos[i * 4 + 0] = px[i] - (cell.vx / vlen) * tailLen;
        vertexPos[i * 4 + 1] = py[i] - (cell.vy / vlen) * tailLen;
        vertexPos[i * 4 + 2] = px[i];
        vertexPos[i * 4 + 3] = py[i];
        vertexAlpha[i * 2 + 0] = 0;
        vertexAlpha[i * 2 + 1] = fade;
        continue;
      }

      // Draw a small fixed-length dash oriented PERPENDICULAR to the flow vector — a
      // wave-CREST mark (the line of the wave front), centered on the particle. The
      // particle still ADVANCES along (vx,vy); only the drawn mark is rotated 90°.
      // Visible length is independent of drift speed.
      const vlen = Math.hypot(cell.vx, cell.vy) || 1;
      const dashHalf = span * DASH_FRACTION * 0.5;
      const dx = (-cell.vy / vlen) * dashHalf;
      const dy = (cell.vx / vlen) * dashHalf;
      vertexPos[i * 4 + 0] = px[i] - dx;
      vertexPos[i * 4 + 1] = py[i] - dy;
      vertexPos[i * 4 + 2] = px[i] + dx;
      vertexPos[i * 4 + 3] = py[i] + dy;
      vertexAlpha[i * 2 + 0] = fade;
      vertexAlpha[i * 2 + 1] = fade;
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
      advanceAndFill(mapRef);

      gl.useProgram(program);
      gl.uniformMatrix4fv(uMatrixLoc, false, matrix);
      const [r, g, b] = hexToRgb(options.getColorHex());
      gl.uniform3f(uColorLoc, r, g, b);
      // Near-opaque so the dark dashes read crisply on the light basemap; the static
      // reduced-motion frame stays a touch dimmer.
      gl.uniform1f(uAlphaLoc, options.reducedMotion ? 0.95 : 1.0);
      // Dot diameter in device pixels (≈3 CSS px scaled for retina). Ignored when
      // drawing LINES; only the dot layer reads gl_PointSize.
      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      gl.uniform1f(uPointSizeLoc, 3.0 * dpr);

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
      } else if (markStyle === "comet") {
        // Two passes over the SAME 2-vertex-per-particle buffer:
        // 1. LINES — the fading tail (tail vert alpha 0 → head vert alpha fade).
        // 2. POINTS — a point at every vertex; tail ends are alpha 0 (invisible),
        //    heads carry alpha fade and read as the dot (u_pointSize set above).
        gl.lineWidth(1);
        gl.drawArrays(gl.LINES, 0, count * 2);
        gl.drawArrays(gl.POINTS, 0, count * 2);
      } else {
        gl.lineWidth(1);
        gl.drawArrays(gl.LINES, 0, count * 2);
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
