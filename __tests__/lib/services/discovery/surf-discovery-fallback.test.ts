import type { EnhancedForecastEntity } from "@/types/forecast";
import { hasUsableTodayForecastForFallback } from "@/lib/services/discovery/surf-discovery-orchestrator";

function forecastAt(value: string): EnhancedForecastEntity {
  return { forecast_at: value } as EnhancedForecastEntity;
}

describe("surf discovery today fallback eligibility", () => {
  const sunTimes = {
    sunrises: [new Date("2026-08-31T06:00:00.000Z")],
    sunsets: [new Date("2026-08-31T19:00:00.000Z")],
  };

  it.each([
    ["pre-dawn", "2026-08-31T04:00:00.000Z", "2026-08-31T03:30:00.000Z"],
    ["after last light", "2026-08-31T19:30:00.000Z", "2026-08-31T19:00:00.000Z"],
  ])("rejects a %s slot the selector cannot use", (_label, slot, now) => {
    expect(
      hasUsableTodayForecastForFallback({
        forecasts: [forecastAt(slot)],
        beachTz: "UTC",
        sunTimes,
        now: new Date(now),
      }),
    ).toBe(false);
  });

  it("accepts a fresh daylight slot with a full session before sunset", () => {
    expect(
      hasUsableTodayForecastForFallback({
        forecasts: [forecastAt("2026-08-31T17:30:00.000Z")],
        beachTz: "UTC",
        sunTimes,
        now: new Date("2026-08-31T17:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
