import {
  parseNwsWindDirectionDeg,
  parseNwsWindSpeedMs,
} from "@/lib/services/nws-wind-service";

describe("nws-wind-service parsing", () => {
  describe("parseNwsWindDirectionDeg", () => {
    it("parses cardinal/ordinal directions", () => {
      expect(parseNwsWindDirectionDeg("N")).toBe(0);
      expect(parseNwsWindDirectionDeg("NW")).toBe(315);
      expect(parseNwsWindDirectionDeg("SSE")).toBe(157.5);
      expect(parseNwsWindDirectionDeg("  w  ")).toBe(270);
    });

    it("returns null for variable/unknown directions", () => {
      expect(parseNwsWindDirectionDeg("VRB")).toBeNull();
      expect(parseNwsWindDirectionDeg("VARIABLE")).toBeNull();
      expect(parseNwsWindDirectionDeg("")).toBeNull();
      expect(parseNwsWindDirectionDeg("Northwest")).toBeNull();
    });

    it("accepts numeric degrees", () => {
      expect(parseNwsWindDirectionDeg("0")).toBe(0);
      expect(parseNwsWindDirectionDeg("360")).toBe(0);
      expect(parseNwsWindDirectionDeg("-45")).toBe(315);
    });
  });

  describe("parseNwsWindSpeedMs", () => {
    it("parses mph values", () => {
      const ms = parseNwsWindSpeedMs("10 mph");
      expect(ms).not.toBeNull();
      expect(ms!).toBeCloseTo(10 * 0.44704, 5);
    });

    it("parses mph ranges (average)", () => {
      const ms = parseNwsWindSpeedMs("5 to 15 mph");
      expect(ms).not.toBeNull();
      expect(ms!).toBeCloseTo(((5 + 15) / 2) * 0.44704, 5);
    });

    it("parses knots", () => {
      const ms = parseNwsWindSpeedMs("15 kt");
      expect(ms).not.toBeNull();
      expect(ms!).toBeCloseTo(15 * 0.514444, 5);
    });

    it("handles Calm", () => {
      expect(parseNwsWindSpeedMs("Calm")).toBe(0);
      expect(parseNwsWindSpeedMs("calm")).toBe(0);
    });

    it("returns null when unit is unknown", () => {
      expect(parseNwsWindSpeedMs("10")).toBeNull();
      expect(parseNwsWindSpeedMs("")).toBeNull();
      expect(parseNwsWindSpeedMs("Light")).toBeNull();
    });
  });
});














