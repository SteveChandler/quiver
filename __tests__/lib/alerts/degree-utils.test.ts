import {
  normalizeAngle,
  angularDistance,
  isWithinArc,
  resolveWindDirection,
} from "@/lib/alerts/degree-utils";

describe("normalizeAngle", () => {
  it("normalizes negative angles", () => {
    expect(normalizeAngle(-10)).toBe(350);
  });

  it("normalizes angles over 360", () => {
    expect(normalizeAngle(370)).toBe(10);
  });

  it("leaves 0-359 unchanged", () => {
    expect(normalizeAngle(180)).toBe(180);
    expect(normalizeAngle(0)).toBe(0);
  });
});

describe("angularDistance", () => {
  it("calculates simple distance", () => {
    expect(angularDistance(10, 20)).toBe(10);
  });

  it("handles wrapping around north", () => {
    expect(angularDistance(350, 10)).toBe(20);
    expect(angularDistance(10, 350)).toBe(20);
  });

  it("returns 180 for opposite directions", () => {
    expect(angularDistance(0, 180)).toBe(180);
  });
});

describe("isWithinArc", () => {
  it("matches within simple arc", () => {
    expect(isWithinArc(200, 180, 270)).toBe(true);
  });

  it("rejects outside simple arc", () => {
    expect(isWithinArc(100, 180, 270)).toBe(false);
  });

  it("handles arc wrapping around north (315 to 45)", () => {
    expect(isWithinArc(350, 315, 45)).toBe(true);
    expect(isWithinArc(10, 315, 45)).toBe(true);
    expect(isWithinArc(0, 315, 45)).toBe(true);
    expect(isWithinArc(180, 315, 45)).toBe(false);
    expect(isWithinArc(90, 315, 45)).toBe(false);
  });

  it("handles full circle (min === max)", () => {
    expect(isWithinArc(100, 45, 45)).toBe(true);
  });
});

describe("resolveWindDirection", () => {
  it("identifies offshore wind", () => {
    expect(resolveWindDirection(90, 90, 45, 270)).toBe("offshore");
    expect(resolveWindDirection(110, 90, 45, 270)).toBe("offshore");
  });

  it("identifies onshore wind", () => {
    expect(resolveWindDirection(270, 90, 45, 270)).toBe("onshore");
  });

  it("identifies cross-shore wind", () => {
    expect(resolveWindDirection(180, 90, 30, 270)).toBe("cross-shore");
  });

  it("returns null if offshore_deg is null", () => {
    expect(resolveWindDirection(90, null, null, null)).toBeNull();
  });
});
