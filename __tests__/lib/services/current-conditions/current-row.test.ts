import { designateCurrentRow } from "@/lib/services/current-conditions/current-row";

describe("designateCurrentRow", () => {
  const now = new Date("2026-09-10T01:40:00.000Z");
  const past = { id: "past", forecast_at: "2026-09-10T00:00:00.000Z" };
  const future = { id: "future", forecast_at: "2026-09-10T03:00:00.000Z" };

  it("returns the latest past row and never a nearer future row", () => {
    expect(designateCurrentRow([future, past], now)).toEqual({
      row: past,
      ageMs: 100 * 60 * 1000,
    });
  });

  it("returns null when the latest past row exceeds the tolerance", () => {
    expect(
      designateCurrentRow([past, future], now, { toleranceMs: 60 * 60 * 1000 }),
    ).toBeNull();
  });
});
