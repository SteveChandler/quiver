import { angleDiff180, triangleScore, swellWindowScore } from "@/lib/utils/score-utils";

describe("score-utils", () => {
  test("angleDiff180 basic and wrap-around", () => {
    expect(angleDiff180(0, 0)).toBe(0);
    expect(angleDiff180(0, 180)).toBe(180);
    expect(angleDiff180(10, 350)).toBe(20);
    expect(angleDiff180(350, 10)).toBe(20);
    expect(angleDiff180(90, 270)).toBe(180);
  });

  test("triangleScore shape", () => {
    expect(triangleScore(5, 5, 10)).toBeCloseTo(1);
    expect(triangleScore(0, 5, 10)).toBeCloseTo(0);
    expect(triangleScore(10, 5, 10)).toBeCloseTo(0);
    expect(triangleScore(2.5, 5, 10)).toBeCloseTo(0.5);
    expect(triangleScore(7.5, 5, 10)).toBeCloseTo(0.5);
    expect(triangleScore(12, 5, 10)).toBeCloseTo(0);
  });

  test("swellWindowScore inside and fade", () => {
    // window 300..30 spans 90°, center ~345
    expect(swellWindowScore(345, 300, 30)).toBeCloseTo(1);
    // 15° away beyond half span (45° half) should still be 1 (inside)
    expect(swellWindowScore(0, 300, 30)).toBeCloseTo(1);
    // 15° beyond window edge with 30° fade -> 0.5
    expect(swellWindowScore(60, 300, 30)).toBeCloseTo(0.5);
    // Far beyond fade -> 0
    expect(swellWindowScore(120, 300, 30)).toBeCloseTo(0);
  });
});
