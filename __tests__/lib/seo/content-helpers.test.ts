import { countValues, pluralize, joinList } from "@/lib/seo/content-helpers";

describe("countValues", () => {
  it("counts non-null values", () => {
    expect(countValues(["A", "B", "A", null, undefined, "B", "C"])).toEqual({
      A: 2,
      B: 2,
      C: 1,
    });
  });

  it("returns empty object for empty array", () => {
    expect(countValues([])).toEqual({});
  });

  it("returns empty object for all-null array", () => {
    expect(countValues([null, undefined, null])).toEqual({});
  });
});

describe("pluralize", () => {
  it("returns singular for count 1", () => {
    expect(pluralize("spot", 1)).toBe("spot");
    expect(pluralize("break", 1)).toBe("break");
    expect(pluralize("city", 1)).toBe("city");
  });

  it("returns regular plural for count != 1", () => {
    expect(pluralize("spot", 0)).toBe("spots");
    expect(pluralize("spot", 5)).toBe("spots");
    expect(pluralize("break", 3)).toBe("breaks");
  });

  it("handles irregular 'city' -> 'cities'", () => {
    expect(pluralize("city", 0)).toBe("cities");
    expect(pluralize("city", 2)).toBe("cities");
    expect(pluralize("city", 10)).toBe("cities");
  });
});

describe("joinList", () => {
  it("returns empty string for empty array", () => {
    expect(joinList([])).toBe("");
  });

  it("returns single item without conjunction", () => {
    expect(joinList(["apples"])).toBe("apples");
  });

  it("joins two items with 'and'", () => {
    expect(joinList(["apples", "oranges"])).toBe("apples and oranges");
  });

  it("joins three items with Oxford comma", () => {
    expect(joinList(["apples", "oranges", "bananas"])).toBe(
      "apples, oranges, and bananas"
    );
  });

  it("joins four items with Oxford comma", () => {
    expect(joinList(["a", "b", "c", "d"])).toBe("a, b, c, and d");
  });
});
