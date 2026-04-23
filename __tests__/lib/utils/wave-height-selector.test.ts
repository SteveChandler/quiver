import { selectWaveHeightFormatted } from "@/lib/utils/wave-height-selector";

describe("selectWaveHeightFormatted", () => {
  it("returns the fallback string when om_m is null", () => {
    expect(
      selectWaveHeightFormatted({ om_m: null, fallback_ft_string: "2.5 ft" }),
    ).toBe("2.5 ft");
  });

  it("returns the fallback when om_m is below the 0.95m gate", () => {
    expect(
      selectWaveHeightFormatted({ om_m: 0.94, fallback_ft_string: "1.5 ft" }),
    ).toBe("1.5 ft");
  });

  it("returns OM at the gate boundary (0.95m = 3.1 ft)", () => {
    expect(
      selectWaveHeightFormatted({ om_m: 0.95, fallback_ft_string: null }),
    ).toBe("3.1 ft");
  });

  it("returns OM for a clearly-valid 1.5m (4.9 ft)", () => {
    expect(
      selectWaveHeightFormatted({ om_m: 1.5, fallback_ft_string: null }),
    ).toBe("4.9 ft");
  });

  it("falls back when om_m is NaN", () => {
    expect(
      selectWaveHeightFormatted({
        om_m: Number.NaN,
        fallback_ft_string: "3.0 ft",
      }),
    ).toBe("3.0 ft");
  });

  it("treats negative om_m as invalid and falls back", () => {
    expect(
      selectWaveHeightFormatted({ om_m: -0.5, fallback_ft_string: "2.0 ft" }),
    ).toBe("2.0 ft");
  });

  it("passes through null fallback when both paths have no data", () => {
    expect(
      selectWaveHeightFormatted({ om_m: null, fallback_ft_string: null }),
    ).toBeNull();
  });
});
