import { formatPushNotification } from "@/lib/alerts/push-formatter";
import type { MatchingWindow } from "@/lib/alerts/types";

function makeMatch(overrides: Partial<MatchingWindow> = {}): MatchingWindow {
  return {
    rule_id: "r1", rule_name: "Glass-Off",
    beach_id: "b1", beach_name: "Blacks Beach", beach_timezone: "America/Los_Angeles",
    window_start: "2026-04-01T14:00:00Z", window_end: "2026-04-01T17:00:00Z",
    best_hour: "2026-04-01T15:30:00Z", best_score: 0.8,
    conditions_snapshot: { wave_height: 4, swell_1_period: 14, wind_speed: 5, tide_height: 3.2, tide_status: "rising" },
    notify_email: true, notify_push: true,
    ...overrides,
  };
}

describe("formatPushNotification", () => {
  it("formats single beach with rich detail", () => {
    const result = formatPushNotification([makeMatch()]);
    expect(result.title).toBe("Conditions lining up today");
    expect(result.body).toContain("Blacks Beach");
    expect(result.body.length).toBeLessThanOrEqual(150);
  });

  it("formats two beaches", () => {
    const matches = [makeMatch(), makeMatch({ beach_name: "Trestles", beach_id: "b2" })];
    const result = formatPushNotification(matches);
    expect(result.body).toContain("Blacks Beach");
    expect(result.body).toContain("Trestles");
  });

  it("caps at 2 beaches with 'and N more'", () => {
    const matches = [
      makeMatch(),
      makeMatch({ beach_name: "Trestles", beach_id: "b2" }),
      makeMatch({ beach_name: "Malibu", beach_id: "b3" }),
    ];
    const result = formatPushNotification(matches);
    expect(result.body).toContain("and 1 more");
    expect(result.body).not.toContain("Malibu");
  });

  it("body stays under 150 characters", () => {
    const matches = [
      makeMatch({ beach_name: "Very Long Beach Name That Goes On" }),
      makeMatch({ beach_name: "Another Extremely Long Beach Name Here", beach_id: "b2" }),
    ];
    const result = formatPushNotification(matches);
    expect(result.body.length).toBeLessThanOrEqual(150);
  });
});
