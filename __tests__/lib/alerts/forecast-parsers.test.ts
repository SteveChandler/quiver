import { parseWindSpeedToKt } from "@/lib/alerts/forecast-parsers";

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
