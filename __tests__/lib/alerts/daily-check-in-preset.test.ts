import { getPreset } from "@/lib/alerts/presets";
import type { BeachAlertMeta } from "@/lib/alerts/types";

const mockBeach: BeachAlertMeta = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Test Beach",
  slug: "test-beach",
  lat: 32.85,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: null,
  wind_offshore_tol_deg: null,
  aspect_deg: null,
  preferred_tide_ft_min: null,
  preferred_tide_ft_max: null,
  preferred_tide_direction: null,
  swell_window_center_deg: null,
  swell_window_halfwidth_deg: null,
};

describe("daily_check_in preset", () => {
  it("is registered and produces loose validation conditions", () => {
    const preset = getPreset("daily_check_in");
    expect(preset!.type).toBe("daily_check_in");
    expect(preset!.group).toBe("internal");

    const conditions = preset!.buildConditions(mockBeach);
    expect(conditions).toEqual({
      swell_height_min: 0.5,
      wind_speed_max_kt: 25,
    });
  });
});
