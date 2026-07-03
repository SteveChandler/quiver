// Polarity guard: the conditions-callout arrow must point the way the energy
// TRAVELS (compass `from` + 180), and must match the swell-field particle drift
// convention exactly. This locks the one invariant the wind-particle reversal
// class of bug silently breaks — keep it green.
import { travelScreenAngleDeg } from "@/components/map/conditions-callout";
import { degToVector } from "@/components/map/swell-field/field-sampler";

// Arrowhead points along local +x rotated by γ → screen vector (cosγ, sinγ), y-down.
function arrowVector(bearingDeg: number): { x: number; y: number } {
  const g = (travelScreenAngleDeg(bearingDeg) * Math.PI) / 180;
  return { x: Math.cos(g), y: Math.sin(g) };
}

describe("conditions callout arrow polarity", () => {
  for (let b = 0; b < 360; b += 30) {
    it(`bearing ${b}° points along travel (from+180) and matches particle drift`, () => {
      const a = arrowVector(b);
      const p = degToVector(b);
      expect(a.x).toBeCloseTo(p.x, 6);
      expect(a.y).toBeCloseTo(p.y, 6);
      const t = ((b + 180) * Math.PI) / 180; // mathematically-correct travel dir
      expect(a.x).toBeCloseTo(Math.sin(t), 6);
      expect(a.y).toBeCloseTo(-Math.cos(t), 6);
    });
  }
});
