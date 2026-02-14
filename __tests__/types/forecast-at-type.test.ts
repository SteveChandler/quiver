import type { EnhancedForecastEntity } from "@/types/forecast";

describe("EnhancedForecastEntity", () => {
  it("accepts forecast_at field", () => {
    const entity: Partial<EnhancedForecastEntity> = {
      forecast_at: "2026-02-14T14:00:00Z",
      forecast_date: "2026-02-14",
      forecast_time: "14:00:00",
      beach_id: "test-beach-id",
    };
    expect(entity.forecast_at).toBe("2026-02-14T14:00:00Z");
  });

  it("works without forecast_date and forecast_time (post-migration)", () => {
    const entity: Partial<EnhancedForecastEntity> = {
      forecast_at: "2026-02-14T14:00:00Z",
      beach_id: "test-beach-id",
    };
    expect(entity.forecast_at).toBeDefined();
  });
});
