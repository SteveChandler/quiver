import type { EnhancedForecastEntity } from "@/types/forecast";
import { hasUsableTodayForecastForFallback } from "@/lib/services/discovery/surf-discovery-orchestrator";

function forecastAt(value: string): EnhancedForecastEntity {
  return { forecast_at: value } as EnhancedForecastEntity;
}

describe("surf discovery today fallback eligibility", () => {
  const sunset = new Date("2026-08-31T19:00:00.000Z");

  it.each([
    ["pre-dawn", "2026-08-31T05:00:00.000Z", "2026-08-31T04:30:00.000Z"],
    ["too close to sunset", "2026-08-31T18:30:00.000Z", "2026-08-31T18:00:00.000Z"],
  ])("rejects a %s slot the selector cannot use", (_label, slot, now) => {
    expect(
      hasUsableTodayForecastForFallback({
        forecasts: [forecastAt(slot)],
        beachTz: "UTC",
        sunset,
        now: new Date(now),
      }),
    ).toBe(false);
  });

  it("accepts a fresh daylight slot with a full session before sunset", () => {
    expect(
      hasUsableTodayForecastForFallback({
        forecasts: [forecastAt("2026-08-31T17:30:00.000Z")],
        beachTz: "UTC",
        sunset,
        now: new Date("2026-08-31T17:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
