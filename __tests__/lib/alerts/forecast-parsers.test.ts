import { parseWindSpeedToKt, parseSwellDirectionToDegrees } from "@/lib/alerts/forecast-parsers";

describe("parseWindSpeedToKt", () => {
  it("parses kt explicit", () => {
    expect(parseWindSpeedToKt("8 kt")).toBeCloseTo(8);
    expect(parseWindSpeedToKt("8 knots")).toBeCloseTo(8);
  });

  it("converts mph to kt", () => {
    expect(parseWindSpeedToKt("10 mph")).toBeCloseTo(8.69, 2);
  });

  it("converts m/s to kt", () => {
    expect(parseWindSpeedToKt("5 m/s")).toBeCloseTo(9.72, 2);
  });

  it("treats bare number as mph (current ingest convention)", () => {
    expect(parseWindSpeedToKt("10")).toBeCloseTo(8.69, 2);
  });

  it("returns null for unparseable", () => {
    expect(parseWindSpeedToKt(null)).toBeNull();
    expect(parseWindSpeedToKt("calm")).toBeNull();
  });
});

describe("parseSwellDirectionToDegrees", () => {
  it("converts cardinal", () => {
    expect(parseSwellDirectionToDegrees("N")).toBe(0);
    expect(parseSwellDirectionToDegrees("E")).toBe(90);
    expect(parseSwellDirectionToDegrees("S")).toBe(180);
    expect(parseSwellDirectionToDegrees("W")).toBe(270);
  });

  it("converts intercardinal", () => {
    expect(parseSwellDirectionToDegrees("NE")).toBe(45);
    expect(parseSwellDirectionToDegrees("SW")).toBe(225);
  });

  it("converts secondary intercardinal", () => {
    expect(parseSwellDirectionToDegrees("WNW")).toBe(292.5);
    expect(parseSwellDirectionToDegrees("ESE")).toBe(112.5);
  });

  it("passes through numeric strings", () => {
    expect(parseSwellDirectionToDegrees("180")).toBe(180);
    expect(parseSwellDirectionToDegrees("180.5")).toBe(180.5);
  });

  it("returns null for invalid", () => {
    expect(parseSwellDirectionToDegrees(null)).toBeNull();
    expect(parseSwellDirectionToDegrees("XYZ")).toBeNull();
  });
});
