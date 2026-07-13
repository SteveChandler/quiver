import { classifyPeriod } from "@/components/learn/figures/period-classification";

describe("classifyPeriod", () => {
  it("classifies wind swell below the 10s threshold", () => {
    expect(classifyPeriod(6).classification).toBe("wind");
    expect(classifyPeriod(9.5).classification).toBe("wind");
    expect(classifyPeriod(6).label).toBe("WIND SWELL");
  });

  it("classifies groundswell at/above 10s", () => {
    expect(classifyPeriod(10).classification).toBe("ground");
    expect(classifyPeriod(16).classification).toBe("ground");
    expect(classifyPeriod(10).label).toBe("GROUNDSWELL");
  });

  it("maps the four readout bands", () => {
    expect(classifyPeriod(5)).toMatchObject({ distance: "~50–100 mi", quality: "Choppy & weak", why: "Short-lived, hard to ride" });
    expect(classifyPeriod(8)).toMatchObject({ distance: "~200–500 mi", quality: "Mixed, improving", why: "Some organization" });
    expect(classifyPeriod(12)).toMatchObject({ distance: "~500–1,500 mi", quality: "Clean & organized", why: "Even sets, real push" });
    expect(classifyPeriod(17)).toMatchObject({ distance: "~1,500–3,000 mi", quality: "Powerful & lined-up", why: "The good stuff" });
  });

  it("clamps and normalizes t to [0,1]", () => {
    expect(classifyPeriod(4).t).toBeCloseTo(0);
    expect(classifyPeriod(20).t).toBeCloseTo(1);
    expect(classifyPeriod(2).t).toBeCloseTo(0); // clamped
    expect(classifyPeriod(30).t).toBeCloseTo(1); // clamped
  });
});
