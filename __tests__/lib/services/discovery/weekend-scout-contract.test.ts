import { readFileSync } from "fs";
import { join } from "path";
import { parseWeekendScoutSnapshot } from "@/lib/services/discovery/weekend-scout-contract";

function loadFixture(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "__tests__", "fixtures", "weekend-scout-v1.json"),
      "utf8"
    )
  ) as Record<string, unknown>;
}

describe("weekend-scout-v1 contract", () => {
  it("parses the shared three-result fixture", () => {
    const fixture = loadFixture();

    expect(parseWeekendScoutSnapshot(fixture)).toEqual(fixture);
  });

  it("rejects a qualifying count that disagrees with the rows", () => {
    const fixture = loadFixture();

    expect(() =>
      parseWeekendScoutSnapshot({
        ...fixture,
        qualifyingCount: 2,
      })
    ).toThrow(/qualifyingCount/i);
  });

  it("rejects duplicate beaches", () => {
    const fixture = loadFixture();
    const results = fixture.results as Array<Record<string, unknown>>;

    expect(() =>
      parseWeekendScoutSnapshot({
        ...fixture,
        results: [
          results[0],
          { ...results[1], beachId: results[0].beachId },
          results[2],
        ],
      })
    ).toThrow(/beachId/i);
  });

  it("rejects non-contiguous ranks", () => {
    const fixture = loadFixture();
    const results = fixture.results as Array<Record<string, unknown>>;

    expect(() =>
      parseWeekendScoutSnapshot({
        ...fixture,
        results: [results[0], { ...results[1], rank: 3 }, results[2]],
      })
    ).toThrow(/rank/i);
  });

  it("rejects malformed dates and timestamps", () => {
    const fixture = loadFixture();

    expect(() =>
      parseWeekendScoutSnapshot({
        ...fixture,
        weekendStart: "2026-02-30",
      })
    ).toThrow(/weekendStart/i);

    expect(() =>
      parseWeekendScoutSnapshot({
        ...fixture,
        generatedAt: "not-a-timestamp",
      })
    ).toThrow(/generatedAt/i);
  });
});
