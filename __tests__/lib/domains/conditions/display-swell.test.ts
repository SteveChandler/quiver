import fixture from "@/__tests__/fixtures/display-swell-parity.json";
import { resolveDisplaySwell } from "@/lib/domains/conditions/display-swell";

describe("resolveDisplaySwell", () => {
  it.each(fixture.cases)("$name", ({ row, window, expected }) => {
    const result = resolveDisplaySwell(row, window);

    expect({
      ...result,
      heightFt:
        result.heightFt == null ? null : Number(result.heightFt.toFixed(3)),
    }).toEqual(expected);
  });
});
