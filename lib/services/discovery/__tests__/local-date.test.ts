import { describe, expect, it } from "@jest/globals";

import { addDays, localDate, zonedWallClockToUtc } from "../local-date";

describe("localDate", () => {
  it("resolves the Pacific calendar day, not the UTC one", () => {
    // 06:00 UTC on the 26th is still 23:00 on the 25th in California (PDT).
    expect(localDate(new Date("2026-10-26T06:00:00Z"), "America/Los_Angeles")).toBe("2026-10-25");
    expect(localDate(new Date("2026-10-26T18:00:00Z"), "America/Los_Angeles")).toBe("2026-10-26");
  });
});

describe("zonedWallClockToUtc", () => {
  it("resolves a Pacific wall clock on both sides of the DST change", () => {
    expect(zonedWallClockToUtc("2026-10-26", "23:59:59", "America/Los_Angeles")).toBe("2026-10-27T06:59:59.000Z");
    expect(zonedWallClockToUtc("2026-11-02", "23:59:59", "America/Los_Angeles")).toBe("2026-11-03T07:59:59.000Z");
  });
});

describe("addDays", () => {
  it("shifts a calendar date across a month end", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });
});
