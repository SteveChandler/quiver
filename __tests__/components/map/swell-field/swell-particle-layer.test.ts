// Minimal mapbox-gl mock: the layer touches MercatorCoordinate during render.
jest.mock("mapbox-gl", () => {
  class MercatorCoordinate {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    toLngLat(): { lng: number; lat: number } {
      return { lng: 0, lat: 0 };
    }
    static fromLngLat(): MercatorCoordinate {
      return new MercatorCoordinate(0.5, 0.5);
    }
  }
  return { __esModule: true, default: { MercatorCoordinate } };
});

import {
  PARTICLE_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  SHADER_UNIFORM_NAMES,
  reseedParticle,
  gridDimensions,
  gridSeedParticle,
  PARTICLE_COUNT_DESKTOP,
  PARTICLE_COUNT_MOBILE,
  resolveParticleCount,
  createSwellParticleLayer,
} from "@/components/map/swell-field/swell-particle-layer";
import type {
  FlowField,
} from "@/components/map/swell-field/field-sampler";
import type { MercatorBox } from "@/components/map/swell-field/swell-particle-layer";

describe("swell particle layer — pure exports", () => {
  it("exposes GLSL sources referencing the declared uniforms", () => {
    expect(PARTICLE_VERTEX_SHADER).toContain("attribute");
    expect(PARTICLE_VERTEX_SHADER).toContain("u_matrix");
    expect(PARTICLE_FRAGMENT_SHADER).toContain("gl_FragColor");
    for (const name of SHADER_UNIFORM_NAMES) {
      const inAny =
        PARTICLE_VERTEX_SHADER.includes(name) ||
        PARTICLE_FRAGMENT_SHADER.includes(name);
      expect(inAny).toBe(true);
    }
  });

  it("reseedParticle returns coords inside the unit Mercator bounds", () => {
    const rng = () => 0.5;
    const p = reseedParticle(rng, { minX: 0.1, minY: 0.2, maxX: 0.3, maxY: 0.4 });
    expect(p.x).toBeCloseTo(0.2, 6);
    expect(p.y).toBeCloseTo(0.3, 6);
    expect(p.age).toBe(0);
  });

  it("scales particle count down on small screens", () => {
    expect(resolveParticleCount(1440)).toBe(PARTICLE_COUNT_DESKTOP);
    expect(resolveParticleCount(380)).toBe(PARTICLE_COUNT_MOBILE);
    expect(PARTICLE_COUNT_MOBILE).toBeLessThan(PARTICLE_COUNT_DESKTOP);
  });

  it("keeps the desktop count sparse (Windy-style spacing) but populated", () => {
    expect(PARTICLE_COUNT_DESKTOP).toBe(450);
    expect(PARTICLE_COUNT_MOBILE).toBe(200);
    // Sparse, evenly spaced field — well below the earlier dense 4000 blanket.
    expect(PARTICLE_COUNT_DESKTOP).toBeLessThanOrEqual(450);
  });
});

describe("jittered-grid seeding — even Windy-style distribution", () => {
  const UNIT_BOX: MercatorBox = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  it("derives a grid sized to the box aspect ratio (cols × rows ≥ count)", () => {
    // Square box: ~sqrt(count) per side.
    expect(gridDimensions(900, UNIT_BOX)).toEqual({ cols: 30, rows: 30 });
    // Wide box (aspect 4): more cols than rows.
    const wide: MercatorBox = { minX: 0, minY: 0, maxX: 4, maxY: 1 };
    const { cols, rows } = gridDimensions(900, wide);
    expect(cols).toBeGreaterThan(rows);
    expect(cols * rows).toBeGreaterThanOrEqual(900);
  });

  it("never produces a degenerate (zero) grid dimension", () => {
    expect(gridDimensions(1, UNIT_BOX)).toEqual({ cols: 1, rows: 1 });
    const flat: MercatorBox = { minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5 };
    const { cols, rows } = gridDimensions(100, flat);
    expect(cols).toBeGreaterThanOrEqual(1);
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  it("places particle i inside ITS OWN grid cell (jitter stays in-cell)", () => {
    const count = 16; // 4 × 4 grid on the unit square
    const { cols, rows } = gridDimensions(count, UNIT_BOX);
    expect({ cols, rows }).toEqual({ cols: 4, rows: 4 });
    const cellW = 1 / cols;
    const cellH = 1 / rows;
    // rng=0 -> cell origin; rng→1 stays within the cell (upper bound exclusive).
    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols) % rows;
      const lo = gridSeedParticle(i, count, UNIT_BOX, () => 0);
      expect(lo.x).toBeCloseTo(col * cellW, 9);
      expect(lo.y).toBeCloseTo(row * cellH, 9);
      const hi = gridSeedParticle(i, count, UNIT_BOX, () => 0.999);
      expect(hi.x).toBeGreaterThanOrEqual(col * cellW);
      expect(hi.x).toBeLessThan((col + 1) * cellW);
      expect(hi.y).toBeGreaterThanOrEqual(row * cellH);
      expect(hi.y).toBeLessThan((row + 1) * cellH);
      expect(lo.age).toBe(0);
    }
  });

  it("respects the box origin offset", () => {
    const offset: MercatorBox = { minX: 0.2, minY: 0.4, maxX: 0.6, maxY: 0.8 };
    const s = gridSeedParticle(0, 4, offset, () => 0);
    expect(s.x).toBeCloseTo(0.2, 9);
    expect(s.y).toBeCloseTo(0.4, 9);
  });
});

describe("createSwellParticleLayer — particle count", () => {
  const FIELD: FlowField = { cols: 0, rows: 0, cells: [] };

  /**
   * Drive onAdd + a single render and capture EVERY draw call (comet issues two:
   * a LINES tail then a POINTS head). `draws[0]` is the first call for back-compat.
   */
  function renderedDraw(opts?: {
    count?: number;
    markStyle?: "dash" | "dot" | "comet";
    reducedMotion?: boolean;
    renders?: number;
    field?: FlowField;
    fields?: FlowField[];
    captureUploads?: boolean;
  }): {
    mode: number;
    vertexCount: number;
    draws: { mode: number; vertexCount: number }[];
    uploads: number[][];
    LINES: number;
    POINTS: number;
  } {
    const LINES = 11;
    const POINTS = 12;
    const uploads: number[][] = [];
    const gl = {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      ARRAY_BUFFER: 5,
      DYNAMIC_DRAW: 6,
      FLOAT: 7,
      BLEND: 8,
      SRC_ALPHA: 9,
      ONE_MINUS_SRC_ALPHA: 10,
      LINES,
      POINTS,
      createShader: jest.fn(() => ({})),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn(() => true),
      getShaderInfoLog: jest.fn(() => ""),
      deleteShader: jest.fn(),
      createProgram: jest.fn(() => ({})),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      getProgramParameter: jest.fn(() => true),
      getProgramInfoLog: jest.fn(() => ""),
      getAttribLocation: jest.fn(() => 0),
      getUniformLocation: jest.fn(() => ({})),
      createBuffer: jest.fn(() => ({})),
      useProgram: jest.fn(),
      uniformMatrix4fv: jest.fn(),
      uniform3f: jest.fn(),
      uniform1f: jest.fn(),
      enable: jest.fn(),
      blendFunc: jest.fn(),
      bindBuffer: jest.fn(),
      bufferData: jest.fn((_target: number, data: unknown) => {
        if (opts?.captureUploads && data instanceof Float32Array) {
          uploads.push(Array.from(data));
        }
      }),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      lineWidth: jest.fn(),
      drawArrays: jest.fn(),
    } as unknown as WebGL2RenderingContext;

    const map = {
      getBounds: () => null,
      triggerRepaint: jest.fn(),
    } as unknown as import("mapbox-gl").Map;

    let fieldIndex = 0;
    const getField = (): FlowField => {
      if (!opts?.fields?.length) return opts?.field ?? FIELD;
      const field = opts.fields[Math.min(fieldIndex, opts.fields.length - 1)];
      fieldIndex += 1;
      return field;
    };

    const layer = createSwellParticleLayer({
      id: "test-layer",
      getField,
      getColorHex: () => "#B5450F",
      reducedMotion: opts?.reducedMotion ?? true, // skip triggerRepaint loop
      viewportWidthPx: 1440,
      count: opts?.count,
      markStyle: opts?.markStyle,
    });

    layer.onAdd?.(map, gl);
    for (let i = 0; i < (opts?.renders ?? 1); i += 1) {
      layer.render(gl, new Array(16).fill(0));
    }
    // drawArrays(mode, 0, vertexCount) — capture all calls (comet draws twice).
    const draws = (gl.drawArrays as jest.Mock).mock.calls.map((c) => ({
      mode: c[0] as number,
      vertexCount: c[2] as number,
    }));
    return {
      mode: draws[0].mode,
      vertexCount: draws[0].vertexCount,
      draws,
      uploads,
      LINES,
      POINTS,
    };
  }

  /** Backwards-compat helper: just the vertex count for the default dash path. */
  function renderedVertexCount(count?: number): number {
    return renderedDraw({ count }).vertexCount;
  }

  it("defaults to the viewport-derived count when no override is given", () => {
    expect(renderedVertexCount()).toBe(PARTICLE_COUNT_DESKTOP * 2);
  });

  it("honors an explicit count override (combined-view per-layer budget)", () => {
    expect(renderedVertexCount(500)).toBe(500 * 2);
  });

  it("ignores a non-positive override and falls back to the default", () => {
    expect(renderedVertexCount(0)).toBe(PARTICLE_COUNT_DESKTOP * 2);
  });

  it("draws LINES with two vertices per particle for the default dash style", () => {
    const { mode, vertexCount, LINES } = renderedDraw({ count: 300 });
    expect(mode).toBe(LINES);
    expect(vertexCount).toBe(300 * 2);
  });

  it("orients the default dash perpendicular to particle travel like a wave crest", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.25);
    const eastField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha: 1 }],
    };

    try {
      const { uploads } = renderedDraw({
        count: 1,
        field: eastField,
        captureUploads: true,
      });
      const positionUpload = uploads.find((upload) => upload.length === 4);

      if (!positionUpload) {
        throw new Error("Expected particle position upload");
      }
      const [x1, y1, x2, y2] = positionUpload;
      expect(Math.abs(x2 - x1)).toBeLessThan(1e-9);
      expect(Math.abs(y2 - y1)).toBeGreaterThan(0);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("draws POINTS with one vertex per particle for the dot style (wind layer)", () => {
    const { mode, vertexCount, POINTS } = renderedDraw({
      count: 300,
      markStyle: "dot",
    });
    expect(mode).toBe(POINTS);
    expect(vertexCount).toBe(300);
  });

  it("draws a LINES tail AND a POINTS head for the comet style (wind layer)", () => {
    const { draws, LINES, POINTS } = renderedDraw({
      count: 300,
      markStyle: "comet",
    });
    // Two passes over the shared 2-vertex-per-particle buffer: LINES tail then POINTS.
    expect(draws).toHaveLength(2);
    const lines = draws.find((d) => d.mode === LINES);
    const points = draws.find((d) => d.mode === POINTS);
    expect(lines).toEqual({ mode: LINES, vertexCount: 300 * 2 });
    expect(points).toEqual({ mode: POINTS, vertexCount: 300 * 2 });
  });

  it("keeps reduced-motion particles static after the first rendered frame", () => {
    const movingField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha: 1 }],
    };

    const { uploads } = renderedDraw({
      count: 2,
      field: movingField,
      reducedMotion: true,
      renders: 2,
      captureUploads: true,
    });
    const positionUploads = uploads.filter((upload) => upload.length === 8);

    expect(positionUploads).toHaveLength(2);
    expect(positionUploads[1]).toEqual(positionUploads[0]);
  });

  it("refreshes the reduced-motion static frame when the flow field changes", () => {
    const calmField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 0, vy: 0, speed: 0, alpha: 0 }],
    };
    const activeField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha: 1 }],
    };

    const { uploads } = renderedDraw({
      count: 2,
      fields: [calmField, activeField],
      reducedMotion: true,
      renders: 2,
      captureUploads: true,
    });
    const alphaUploads = uploads.filter((upload) => upload.length === 4);

    expect(alphaUploads).toHaveLength(2);
    expect(alphaUploads[0].every((alpha) => alpha === 0)).toBe(true);
    expect(alphaUploads[1].some((alpha) => alpha > 0)).toBe(true);
  });
});
