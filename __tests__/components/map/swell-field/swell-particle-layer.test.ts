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
  PARTICLE_COUNT_DESKTOP,
  PARTICLE_COUNT_MOBILE,
  resolveParticleCount,
  createSwellParticleLayer,
} from "@/components/map/swell-field/swell-particle-layer";
import type { FlowField } from "@/components/map/swell-field/field-sampler";

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

  it("keeps the desktop count densely populated but performant", () => {
    expect(PARTICLE_COUNT_DESKTOP).toBe(4000);
    expect(PARTICLE_COUNT_MOBILE).toBe(1400);
    // Stay performant: never blow past ~4000 desktop particles.
    expect(PARTICLE_COUNT_DESKTOP).toBeLessThanOrEqual(4000);
  });
});

describe("createSwellParticleLayer — particle count", () => {
  const FIELD: FlowField = { cols: 0, rows: 0, cells: [] };

  /** Drive onAdd + a single render and capture the vertex count drawArrays sees. */
  function renderedVertexCount(count?: number): number {
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
      LINES: 11,
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
      bufferData: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      lineWidth: jest.fn(),
      drawArrays: jest.fn(),
    } as unknown as WebGL2RenderingContext;

    const map = {
      getBounds: () => null,
      triggerRepaint: jest.fn(),
    } as unknown as import("mapbox-gl").Map;

    const layer = createSwellParticleLayer({
      id: "test-layer",
      getField: () => FIELD,
      getColorHex: () => "#B5450F",
      reducedMotion: true, // skip triggerRepaint loop
      viewportWidthPx: 1440,
      count,
    });

    layer.onAdd?.(map, gl);
    layer.render(gl, new Array(16).fill(0));
    const draw = (gl.drawArrays as jest.Mock).mock.calls[0];
    // drawArrays(LINES, 0, vertexCount) — two vertices per particle.
    return draw[2] as number;
  }

  it("defaults to the viewport-derived count when no override is given", () => {
    expect(renderedVertexCount()).toBe(PARTICLE_COUNT_DESKTOP * 2);
  });

  it("honors an explicit count override (combined-view per-layer budget)", () => {
    expect(renderedVertexCount(1600)).toBe(1600 * 2);
  });

  it("ignores a non-positive override and falls back to the default", () => {
    expect(renderedVertexCount(0)).toBe(PARTICLE_COUNT_DESKTOP * 2);
  });
});
