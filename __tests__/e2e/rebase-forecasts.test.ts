import { rebaseRows } from "@/e2e/scripts/lib/rebase-forecasts";

describe("rebaseRows", () => {
  test("shifts all timestamps so newest lands at anchor, preserving spacing", () => {
    const anchor = Date.parse("2026-06-16T12:00:00Z");
    const rows = [
      { id: "a", forecast_at: "2026-06-10T00:00:00Z" },
      { id: "b", forecast_at: "2026-06-12T00:00:00Z" },
    ];

    const out = rebaseRows(rows, "forecast_at", anchor);

    expect(out[1].forecast_at).toBe(new Date(anchor).toISOString());
    expect(
      Date.parse(out[1].forecast_at) - Date.parse(out[0].forecast_at)
    ).toBe(2 * 24 * 3600 * 1000);
  });

  test("returns input unchanged when empty", () => {
    expect(rebaseRows([], "forecast_at", 0)).toEqual([]);
  });
});
