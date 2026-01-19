import {
  getHeightAssessment,
  getHeightConditionNote,
} from "@/lib/utils/coast-pulse-formatter";

describe("getHeightAssessment", () => {
  it("returns 'Flat' for < 1ft", () => {
    expect(getHeightAssessment(0.5)).toBe("Flat");
    expect(getHeightAssessment(0)).toBe("Flat");
  });

  it("returns 'Ankle-to-knee' for 1-1.5ft", () => {
    expect(getHeightAssessment(1.0)).toBe("Ankle-to-knee");
    expect(getHeightAssessment(1.4)).toBe("Ankle-to-knee");
  });

  it("returns 'Knee-to-waist' for 1.5-2.5ft", () => {
    expect(getHeightAssessment(1.5)).toBe("Knee-to-waist");
    expect(getHeightAssessment(2.4)).toBe("Knee-to-waist");
  });

  it("returns 'Waist-to-chest' for 2.5-4ft", () => {
    expect(getHeightAssessment(2.5)).toBe("Waist-to-chest");
    expect(getHeightAssessment(3.9)).toBe("Waist-to-chest");
  });

  it("returns 'Head-high' for 4-6ft", () => {
    expect(getHeightAssessment(4.0)).toBe("Head-high");
    expect(getHeightAssessment(5.9)).toBe("Head-high");
  });

  it("returns 'Overhead' for 6-8ft", () => {
    expect(getHeightAssessment(6.0)).toBe("Overhead");
    expect(getHeightAssessment(7.9)).toBe("Overhead");
  });

  it("returns 'Double overhead' for 8-12ft", () => {
    expect(getHeightAssessment(8.0)).toBe("Double overhead");
    expect(getHeightAssessment(11.9)).toBe("Double overhead");
  });

  it("returns 'XXL' for > 12ft", () => {
    expect(getHeightAssessment(12.0)).toBe("XXL");
    expect(getHeightAssessment(20.0)).toBe("XXL");
  });
});

describe("getHeightConditionNote", () => {
  it("suggests SUP for flat conditions", () => {
    expect(getHeightConditionNote(0.5, 10)).toContain("SUP");
  });

  it("suggests longboards for small waves", () => {
    expect(getHeightConditionNote(1.2, 12)).toContain("longboard");
  });

  it("notes good size for mid-range", () => {
    expect(getHeightConditionNote(3.5, 14)).toContain("most surfers");
  });

  it("notes experts for big waves", () => {
    expect(getHeightConditionNote(10.0, 18)).toContain("expert");
  });

  it("notes favorable for knee-to-waist waves", () => {
    expect(getHeightConditionNote(2.0, 12)).toContain("longboards");
  });

  it("notes choppy for short-period mid-size", () => {
    expect(getHeightConditionNote(3.5, 8)).toContain("Choppy");
  });

  it("notes inconsistent for short-period head-high", () => {
    expect(getHeightConditionNote(5.0, 8)).toContain("Inconsistent");
  });

  it("notes solid for long-period head-high", () => {
    expect(getHeightConditionNote(5.0, 14)).toContain("Solid");
  });

  it("notes powerful for long-period overhead", () => {
    expect(getHeightConditionNote(7.0, 16)).toContain("Powerful");
  });

  it("notes dangerous for XXL waves", () => {
    expect(getHeightConditionNote(15.0, 18)).toContain("Dangerous");
  });
});
