import parity from "../../fixtures/wave-range-native-parity.json";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";
import { formatWaveHeightRangeString, formatWaveRange } from "@/lib/utils/wave-formatters";

// Expected strings come from native's own formatWaveRange (see the fixture's _note).
describe("web wave range equals quiver-native formatWaveRange", () => {
  it.each(parity.cases)("single height $ft ft → $native", ({ ft, native }) => {
    expect(formatWaveHeightRange(ft)).toBe(native);
    expect(formatWaveHeightRangeString(ft, ft)).toBe(native);
    expect(formatWaveRange(ft)).toBe(native);
  });

  it.each(parity.ranges)("range $min-$max ft → $native", ({ min, max, native }) => {
    expect(formatWaveHeightRangeString(min, max)).toBe(native);
    expect(formatWaveRange(min, max)).toBe(native);
    expect(formatWaveRange([min, max], "integer")).toBe(native);
  });
});
