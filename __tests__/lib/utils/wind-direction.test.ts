import { getWindDirectionName } from "@/lib/utils/wind-direction";

describe("getWindDirectionName", () => {
  test("returns null for invalid inputs", () => {
    expect(getWindDirectionName(null)).toBeNull();
    // @ts-expect-error - testing undefined behavior
    expect(getWindDirectionName(undefined)).toBeNull();
    expect(getWindDirectionName(-1)).toBeNull();
    expect(getWindDirectionName(361)).toBeNull();
  });

  test("handles cardinal and intercardinal boundaries", () => {
    expect(getWindDirectionName(0)).toBe("N");
    expect(getWindDirectionName(11.25)).toBe("N");
    expect(getWindDirectionName(11.26)).toBe("NNE");
    // 33.75 is still NNE per implementation
    expect(getWindDirectionName(33.75)).toBe("NNE");
    expect(getWindDirectionName(56.25)).toBe("NE");
    expect(getWindDirectionName(78.76)).toBe("E");
    expect(getWindDirectionName(101.25)).toBe("E");
    expect(getWindDirectionName(146.26)).toBe("SSE");
    expect(getWindDirectionName(168.75)).toBe("SSE");
    expect(getWindDirectionName(191.26)).toBe("SSW");
    expect(getWindDirectionName(236.25)).toBe("SW");
    expect(getWindDirectionName(281.25)).toBe("W");
    expect(getWindDirectionName(303.76)).toBe("NW");
    expect(getWindDirectionName(326.25)).toBe("NW");
  });

  test("wraps around to N after 348.75", () => {
    expect(getWindDirectionName(348.75)).toBe("NNW");
    expect(getWindDirectionName(348.76)).toBe("N");
  });
});
