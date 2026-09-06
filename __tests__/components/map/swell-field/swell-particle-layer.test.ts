jest.mock("mapbox-gl", () => {
  class MercatorCoordinate {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    toLngLat(): { lng: number; lat: number } {
      return {
        lng: this.x * 360 - 180,
        lat:
          (2 * Math.atan(Math.exp((180 - this.y * 360) * Math.PI / 180)) -
            Math.PI / 2) *
          180 /
          Math.PI,
      };
    }
    static fromLngLat({ lng, lat }: { lng: number; lat: number }): MercatorCoordinate {
      return new MercatorCoordinate(
        (lng + 180) / 360,
        (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) /
          360,
      );
    }
  }
  return { __esModule: true, default: { MercatorCoordinate } };
});

import mapboxgl from "mapbox-gl";
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
  sampleFlowField,
  createSwellParticleLayer,
  shouldAnimateSwellParticles,
  longitudeFromMercatorX,
  latitudeFromMercatorY,
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

  it("keeps the desktop count populated but well below a dense blanket", () => {
    expect(PARTICLE_COUNT_DESKTOP).toBe(650);
    expect(PARTICLE_COUNT_MOBILE).toBe(520);
    // Denser than the first pass (which read too sparse) but still far below the
    // earlier 4000 blanket.
    expect(PARTICLE_COUNT_DESKTOP).toBeLessThanOrEqual(800);
  });

  it("bilinearly samples the flow grid instead of snapping to the nearest cell", () => {
    const field: FlowField = {
      cols: 2,
      rows: 2,
      cells: [
        { lon: 0, lat: 0, vx: 1, vy: 0, speed: 0.2, alpha: 0.2 },
        { lon: 10, lat: 0, vx: 1, vy: 0, speed: 0.4, alpha: 0.4 },
        { lon: 0, lat: 10, vx: 0, vy: 1, speed: 0.6, alpha: 0.6 },
        { lon: 10, lat: 10, vx: 0, vy: 1, speed: 0.8, alpha: 0.8 },
      ],
    };

    const sample = sampleFlowField(field, 5, 5);

    expect(sample.vx).toBeCloseTo(Math.SQRT1_2, 6);
    expect(sample.vy).toBeCloseTo(Math.SQRT1_2, 6);
    expect(sample.speed).toBeCloseTo(0.5, 6);
    expect(sample.alpha).toBeCloseTo(0.5, 6);
  });

  it("round-trips inverse Mercator helpers against Mapbox coordinates", () => {
    for (const lon of [-180, -120, 0, 75, 180]) {
      for (const lat of [-80, -45, 0, 45, 80]) {
        const coordinate = mapboxgl.MercatorCoordinate.fromLngLat({ lng: lon, lat });
        expect(longitudeFromMercatorX(coordinate.x)).toBeCloseTo(lon, 12);
        expect(latitudeFromMercatorY(coordinate.y)).toBeCloseTo(lat, 12);
      }
    }
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
   * Drive onAdd + a single render and capture EVERY draw call. `draws[0]` is the
   * first call for back-compat.
   */
  function renderedDraw(opts?: {
    count?: number;
    markStyle?: "dash" | "dot" | "streak";
    dashLengthScale?: number;
    reducedMotion?: boolean;
    renders?: number;
    field?: FlowField;
    fields?: FlowField[];
    captureUploads?: boolean;
    timestamps?: number[];
    beforeRender?: (map: import("mapbox-gl").Map, index: number) => void;
  }): {
    mode: number;
    vertexCount: number;
    draws: { mode: number; vertexCount: number }[];
    uploads: number[][];
    repaintCalls: number;
    activeCount: number;
    LINES: number;
    POINTS: number;
    TRIANGLES: number;
  } {
    const LINES = 11;
    const POINTS = 12;
    const TRIANGLES = 13;
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
      TRIANGLES,
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
      uniform1i: jest.fn(),
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

    const triggerRepaint = jest.fn();
    const map = {
      getBounds: () => null,
      getCanvas: () => ({
        width: 1440,
        getBoundingClientRect: () => ({
          width: 1440,
          height: 720,
          top: 0,
          left: 0,
          right: 1440,
          bottom: 720,
        }),
      }),
      triggerRepaint,
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
      dashLengthScale: opts?.dashLengthScale,
    });

    const nowSpy = opts?.timestamps
      ? jest.spyOn(performance, "now").mockImplementation(() => opts.timestamps?.shift() ?? 0)
      : null;
    layer.onAdd?.(map, gl);
    try {
      for (let i = 0; i < (opts?.renders ?? 1); i += 1) {
        opts?.beforeRender?.(map, i);
        layer.render(gl, new Array(16).fill(0));
      }
    } finally {
      nowSpy?.mockRestore();
    }
    // drawArrays(mode, 0, vertexCount) - capture all calls.
    const draws = (gl.drawArrays as jest.Mock).mock.calls.map((c) => ({
      mode: c[0] as number,
      vertexCount: c[2] as number,
    }));
    return {
      mode: draws[0].mode,
      vertexCount: draws[0].vertexCount,
      draws,
      uploads,
      repaintCalls: triggerRepaint.mock.calls.length,
      activeCount: layer.getActiveParticleCount(),
      LINES,
      POINTS,
      TRIANGLES,
    };
  }

  it("spreads existing particles across the wider viewport after zooming out", () => {
    const mapbox = require("mapbox-gl").default;
    const from = jest.spyOn(mapbox.MercatorCoordinate, "fromLngLat").mockImplementation((value: any) => new mapbox.MercatorCoordinate(value.lng, value.lat));
    const result = renderedDraw({ count: 100, markStyle: "dot", captureUploads: true, renders: 2, reducedMotion: true,
      field: { cols: 1, rows: 1, cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 0, alpha: 1 }] },
      beforeRender: (map, index) => {
        if (index === 0) return;
        map.getBounds = (() => ({ getWest: () => -1, getSouth: () => -1, getEast: () => 2, getNorth: () => 2 })) as any;
      },
    });
    const positions = result.uploads[2];
    const xs = positions.filter((_, index) => index % 2 === 0);
    expect(Math.min(...xs)).toBeLessThan(-0.5);
    expect(Math.max(...xs)).toBeGreaterThan(1.5);
    from.mockRestore();
  });

  /** Backwards-compat helper: just the vertex count for the default dash path. */
  function renderedVertexCount(count?: number): number {
    return renderedDraw({ count }).vertexCount;
  }

  it("defaults to the viewport-derived count when no override is given", () => {
    expect(renderedVertexCount()).toBe(PARTICLE_COUNT_DESKTOP * 6);
  });

  it("preserves the legacy particle positions after 100 frames", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.25);
    const field: FlowField = {
      cols: 2,
      rows: 2,
      cells: [
        { lon: -180, lat: -85, vx: 1, vy: 0, speed: 0.1, alpha: 1 },
        { lon: 180, lat: -85, vx: 0, vy: 1, speed: 0.1, alpha: 1 },
        { lon: -180, lat: 85, vx: -1, vy: 0, speed: 0.1, alpha: 1 },
        { lon: 180, lat: 85, vx: 0, vy: -1, speed: 0.1, alpha: 1 },
      ],
    };
    try {
      const result = renderedDraw({
        count: 4,
        markStyle: "dot",
        field,
        reducedMotion: false,
        renders: 100,
        captureUploads: true,
        timestamps: Array.from({ length: 100 }, (_, i) => i * (1000 / 60)),
      });
      const expected = [
        0.11955291032791138,
        0.12423904985189438,
        0.622158944606781,
        0.12029054760932922,
        0.1304423063993454,
        0.6257948875427246,
        0.6278185844421387,
        0.6297227144241333,
      ];
      const positions = result.uploads.at(-2);
      expect(positions).toHaveLength(expected.length);
      positions?.forEach((position, index) => {
        expect(position).toBeCloseTo(expected[index], 9);
      });
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("honors an explicit count override (combined-view per-layer budget)", () => {
    expect(renderedVertexCount(500)).toBe(500 * 6);
  });

  it("reduces sustained-low-fps work and restores it after sustained recovery", () => {
    const lowTimestamps = Array.from({ length: 180 }, (_, i) => i * 50);
    const highStart = lowTimestamps[lowTimestamps.length - 1];
    const highTimestamps = Array.from(
      { length: 1200 },
      (_, i) => highStart + (i + 1) * (1000 / 60),
    );
    const result = renderedDraw({
      count: 100,
      reducedMotion: false,
      renders: lowTimestamps.length + highTimestamps.length,
      timestamps: [...lowTimestamps, ...highTimestamps],
    });
    const drawnParticleCounts = new Set(
      result.draws.map(({ vertexCount }) => vertexCount / 6),
    );

    expect(drawnParticleCounts).toEqual(new Set([100, 75, 50, 40]));
    expect(result.activeCount).toBe(100);
  });

  it("ignores a non-positive override and falls back to the default", () => {
    expect(renderedVertexCount(0)).toBe(PARTICLE_COUNT_DESKTOP * 6);
  });

  it("draws TRIANGLES with six vertices (a quad) per particle for the default dash style", () => {
    const { mode, vertexCount, TRIANGLES } = renderedDraw({ count: 300 });
    expect(mode).toBe(TRIANGLES);
    expect(vertexCount).toBe(300 * 6);
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
      const positionUpload = uploads.find((upload) => upload.length === 12);

      if (!positionUpload) {
        throw new Error("Expected particle quad position upload");
      }
      const xs = positionUpload.filter((_, i) => i % 2 === 0);
      const ys = positionUpload.filter((_, i) => i % 2 === 1);
      const xExtent = Math.max(...xs) - Math.min(...xs);
      const yExtent = Math.max(...ys) - Math.min(...ys);
      // East travel -> the crest (length) runs perpendicular, along y; the thickness
      // (along travel) is x. So the mark is longer than it is wide, and — unlike the
      // old 1px line — it now has real width.
      expect(yExtent).toBeGreaterThan(xExtent);
      expect(xExtent).toBeGreaterThan(0);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("can shorten crest dashes without changing S2 defaults", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.25);
    const eastField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha: 1 }],
    };

    try {
      const defaultDraw = renderedDraw({
        count: 1,
        field: eastField,
        captureUploads: true,
      });
      const scaledDraw = renderedDraw({
        count: 1,
        field: eastField,
        dashLengthScale: 0.75,
        captureUploads: true,
      });
      const defaultPosition = defaultDraw.uploads.find((upload) => upload.length === 12);
      const scaledPosition = scaledDraw.uploads.find((upload) => upload.length === 12);

      if (!defaultPosition || !scaledPosition) {
        throw new Error("Expected particle quad position uploads");
      }

      // Crest length is the y-extent of the quad (east field). dashLengthScale only
      // shortens length, not thickness.
      const lengthOf = (p: number[]): number => {
        const ys = p.filter((_, i) => i % 2 === 1);
        return Math.max(...ys) - Math.min(...ys);
      };
      const defaultHeight = lengthOf(defaultPosition);
      const scaledHeight = lengthOf(scaledPosition);
      expect(scaledHeight).toBeLessThan(defaultHeight);
      expect(scaledHeight / defaultHeight).toBeCloseTo(0.75, 2);
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

  it("draws the wind worm as a single multi-segment line pass, no dot-head pass", () => {
    const { draws, LINES } = renderedDraw({
      count: 300,
      markStyle: "streak",
    });
    // 10 segments per worm -> 20 vertices per particle, one LINES pass.
    expect(draws).toEqual([{ mode: LINES, vertexCount: 300 * 20 }]);
  });

  it("builds the wind worm along travel with a sideways wiggle", () => {
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
        markStyle: "streak",
        captureUploads: true,
      });
      const positionUpload = uploads.find((upload) => upload.length === 40);

      if (!positionUpload) {
        throw new Error("Expected particle position upload");
      }
      const xs = Array.from(positionUpload).filter((_, idx) => idx % 2 === 0);
      const ys = Array.from(positionUpload).filter((_, idx) => idx % 2 === 1);
      const xRange = Math.max(...xs) - Math.min(...xs);
      const yRange = Math.max(...ys) - Math.min(...ys);
      // East flow: body extends along x (travel) and wiggles sideways in y,
      // but the travel extent dominates the wiggle.
      expect(xRange).toBeGreaterThan(0.02);
      expect(yRange).toBeGreaterThan(1e-6);
      expect(xRange).toBeGreaterThan(yRange);

      const alphaUpload = uploads.find((upload) => upload.length === 20);
      if (!alphaUpload) {
        throw new Error("Expected wind alpha upload");
      }
      // Full-strength wind (cell.alpha = 1) reads boldly; weaker would be fainter.
      expect(Math.min(...alphaUpload)).toBeGreaterThan(0.7);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("encodes wave strength: a strong cell draws a longer, more opaque dash than a weak one", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.25);
    const fieldFor = (alpha: number): FlowField => ({
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha }],
    });
    // Overall mark size (bbox diagonal of the quad) — strength grows both length
    // and thickness, so a stronger cell draws a bigger mark.
    const dashLength = (uploads: number[][]): number => {
      const pos = uploads.find((upload) => upload.length === 12);
      if (!pos) throw new Error("Expected dash quad position upload");
      const xs = pos.filter((_, i) => i % 2 === 0);
      const ys = pos.filter((_, i) => i % 2 === 1);
      return Math.hypot(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
    };
    const dashAlpha = (uploads: number[][]): number => {
      const alpha = uploads.find((upload) => upload.length === 6);
      if (!alpha) throw new Error("Expected dash alpha upload");
      return alpha[0];
    };

    try {
      const strong = renderedDraw({
        count: 1,
        field: fieldFor(1),
        markStyle: "dash",
        captureUploads: true,
      });
      const weak = renderedDraw({
        count: 1,
        field: fieldFor(0.2),
        markStyle: "dash",
        captureUploads: true,
      });

      expect(dashLength(strong.uploads)).toBeGreaterThan(dashLength(weak.uploads));
      expect(dashAlpha(strong.uploads)).toBeGreaterThan(dashAlpha(weak.uploads));
    } finally {
      randomSpy.mockRestore();
    }
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
    const positionUploads = uploads.filter((upload) => upload.length === 24);

    expect(positionUploads).toHaveLength(2);
    expect(positionUploads[1]).toEqual(positionUploads[0]);
  });

  it("schedules repaints only while animation is allowed", () => {
    const movingField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha: 1 }],
    };

    expect(
      renderedDraw({
        count: 2,
        field: movingField,
        reducedMotion: false,
      }).repaintCalls,
    ).toBe(1);
    expect(
      renderedDraw({
        count: 2,
        field: movingField,
        reducedMotion: true,
      }).repaintCalls,
    ).toBe(0);
  });

  it("does not schedule hidden-tab animation frames", () => {
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "hidden",
    );
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState",
    );
    const movingField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha: 1 }],
    };

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    try {
      expect(
        renderedDraw({
          count: 2,
          field: movingField,
          reducedMotion: false,
        }).repaintCalls,
      ).toBe(0);
    } finally {
      if (hiddenDescriptor) {
        Object.defineProperty(Document.prototype, "hidden", hiddenDescriptor);
      } else {
        delete (document as unknown as Record<string, unknown>).hidden;
      }
      if (visibilityDescriptor) {
        Object.defineProperty(
          Document.prototype,
          "visibilityState",
          visibilityDescriptor,
        );
      } else {
        delete (document as unknown as Record<string, unknown>).visibilityState;
      }
    }
  });

  it("renders one static frame when animation is suppressed outside reduced motion", () => {
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "hidden",
    );
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState",
    );
    const movingField: FlowField = {
      cols: 1,
      rows: 1,
      cells: [{ lon: 0, lat: 0, vx: 1, vy: 0, speed: 1, alpha: 1 }],
    };

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    try {
      const { uploads, repaintCalls } = renderedDraw({
        count: 2,
        field: movingField,
        reducedMotion: false,
        captureUploads: true,
      });
      const alphaUpload = uploads.find((upload) => upload.length === 12);

      expect(repaintCalls).toBe(0);
      expect(alphaUpload?.some((alpha) => alpha > 0)).toBe(true);
    } finally {
      if (hiddenDescriptor) {
        Object.defineProperty(Document.prototype, "hidden", hiddenDescriptor);
      } else {
        delete (document as unknown as Record<string, unknown>).hidden;
      }
      if (visibilityDescriptor) {
        Object.defineProperty(
          Document.prototype,
          "visibilityState",
          visibilityDescriptor,
        );
      } else {
        delete (document as unknown as Record<string, unknown>).visibilityState;
      }
    }
  });

  it("pauses the animation loop for data saver and offscreen canvases", () => {
    const connectionDescriptor = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      "connection",
    );
    const offscreenMap = {
      getCanvas: () => ({
        getBoundingClientRect: () => ({
          width: 1440,
          height: 720,
          top: 1200,
          left: 0,
          right: 1440,
          bottom: 1920,
        }),
      }),
    } as unknown as import("mapbox-gl").Map;

    try {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true, effectiveType: "4g" },
      });
      expect(shouldAnimateSwellParticles(offscreenMap)).toBe(false);

      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: false, effectiveType: "4g" },
      });
      expect(shouldAnimateSwellParticles(offscreenMap)).toBe(false);
    } finally {
      if (connectionDescriptor) {
        Object.defineProperty(
          Navigator.prototype,
          "connection",
          connectionDescriptor,
        );
      } else {
        delete (
          navigator as Navigator & {
            connection?: { saveData?: boolean; effectiveType?: string };
          }
        ).connection;
      }
    }
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
    const alphaUploads = uploads.filter((upload) => upload.length === 12);

    expect(alphaUploads).toHaveLength(2);
    expect(alphaUploads[0].every((alpha) => alpha === 0)).toBe(true);
    expect(alphaUploads[1].some((alpha) => alpha > 0)).toBe(true);
  });
});
