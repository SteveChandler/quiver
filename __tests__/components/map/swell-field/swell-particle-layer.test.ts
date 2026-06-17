import {
  PARTICLE_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  SHADER_UNIFORM_NAMES,
  reseedParticle,
  PARTICLE_COUNT_DESKTOP,
  PARTICLE_COUNT_MOBILE,
  resolveParticleCount,
} from "@/components/map/swell-field/swell-particle-layer";

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

  it("keeps the desktop count populated but performant", () => {
    expect(PARTICLE_COUNT_DESKTOP).toBe(3200);
    expect(PARTICLE_COUNT_MOBILE).toBe(1000);
    // Stay performant: never blow past ~4000 desktop particles.
    expect(PARTICLE_COUNT_DESKTOP).toBeLessThanOrEqual(4000);
  });
});
