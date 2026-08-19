import { formatPushNotification } from "@/lib/alerts/push-formatter";
import type { MatchingWindow } from "@/lib/alerts/types";

function makeMatch(overrides: Partial<MatchingWindow> = {}): MatchingWindow {
  return {
    rule_id: "r1",
    rule_name: "Glass-Off",
    beach_id: "b1",
    beach_name: "Blacks Beach",
    beach_timezone: "America/Los_Angeles",
    window_start: "2026-04-01T14:00:00Z",
    window_end: "2026-04-01T17:00:00Z",
    best_hour: "2026-04-01T15:30:00Z",
    best_score: 0.8,
    conditions_snapshot: {
      wave_height: 4,
      swell_1_period: 14,
      wind_speed: 5,
      tide_height: 3.2,
      tide_status: "rising",
    },
    notify_email: true,
    notify_push: true,
    ...overrides,
  };
}

describe("formatPushNotification", () => {
  it("single-match title is dynamic — beach + window, not the old static string", () => {
    const result = formatPushNotification([makeMatch()]);
    expect(result.title).not.toBe("Conditions lining up today");
    expect(result.title).toContain("Blacks Beach");
    // 7-10 AM PDT for the 14:00-17:00Z window, with an en-dash + shared meridiem.
    expect(result.title).toContain("7–10 AM");
  });

  it("single-match title carries a quality word from best_score", () => {
    const result = formatPushNotification([makeMatch({ best_score: 0.92 })]);
    expect(result.title).toContain("Pumping");
  });

  it("canonical MAYBE/NO intent overrides quality words", () => {
    const maybe = formatPushNotification([makeMatch({ best_score: 0.92 })], "maybe");
    const no = formatPushNotification([makeMatch({ best_score: 0.92 })], "no");

    expect(maybe.title).toContain("Worth a look");
    expect(maybe.title).not.toMatch(/Pumping|Firing/);
    expect(no.title).toContain("Not ideal");
    expect(no.title).not.toMatch(/Pumping|Firing/);
  });

  it("canonical GO intent controls the title even when the snapshot score is low", () => {
    const result = formatPushNotification([makeMatch({ best_score: 0.2 })], "go");

    expect(result.title).toContain("Firing");
    expect(result.title).not.toContain("Rideable");
  });

  it("single-match quality word reflects mid and low bands", () => {
    const mid = formatPushNotification([makeMatch({ best_score: 0.55 })]);
    expect(mid.title).toContain("Looking good");
    const low = formatPushNotification([makeMatch({ best_score: 0.2 })]);
    expect(low.title).toContain("Rideable");
  });

  it("formats single beach with rich detail", () => {
    const result = formatPushNotification([makeMatch()]);
    expect(result.body).toContain("Blacks Beach");
    expect(result.data.forecast_at).toBe("2026-04-01T15:30:00Z");
    expect(result.body.length).toBeLessThanOrEqual(150);
  });

  it("uses the same units + rounding as the email (mph from knots, ft bracket)", () => {
    // Same snapshot the email tests use for the user's flagged 2026-05-03 case.
    const result = formatPushNotification([
      makeMatch({
        conditions_snapshot: {
          wave_height: 1.1,
          wave_period: 5,
          swell_1_period: 5,
          wind_speed: 4.34488, // knots
          tide_status: "Rising",
        },
      }),
    ]);
    expect(result.body).toContain("1-2ft @ 5s");
    expect(result.body).toContain("5 mph");
    expect(result.body).not.toContain("kt"); // no raw knots
    expect(result.body).not.toContain("4.34488"); // no raw float
  });

  it("prefers wave_period over swell_1_period when both are present", () => {
    const result = formatPushNotification([
      makeMatch({
        conditions_snapshot: {
          wave_height: 4,
          wave_period: 12,
          swell_1_period: 8, // ignored — wave_period wins
          wind_speed: 5,
        },
      }),
    ]);
    expect(result.body).toContain("@ 12s");
  });

  it("includes beginner rationale when present and it fits the budget", () => {
    const result = formatPushNotification([
      makeMatch({
        conditions_snapshot: {
          wave_height: 1.5,
          wave_period: 6,
          wind_speed: 3,
          beginner_window_reason: "beginner-friendly",
        },
      }),
    ]);

    expect(result.body).toContain("beginner-friendly");
    expect(result.body.length).toBeLessThanOrEqual(150);
  });

  it("labels a beginner window honestly instead of calling small surf firing", () => {
    const result = formatPushNotification([
      makeMatch({
        best_score: 0.8,
        beach_name: "Mission Beach",
        conditions_snapshot: {
          wave_height: 1.5,
          wave_period: 14,
          wind_speed: 2,
          beginner_window_reason: "beginner-friendly",
        },
      }),
    ]);

    expect(result.title).toBe("Beginner-friendly — Mission Beach, 7–10 AM");
    expect(result.title).not.toContain("Firing");
    expect(result.body).toContain("1-2ft @ 14s");
  });

  it("drops the beginner rationale rather than triggering the truncation fallback", () => {
    const result = formatPushNotification([
      makeMatch({
        // Long enough that core + ", beginner-friendly" exceeds 150 chars
        // while core alone stays within budget.
        beach_name:
          "A Fairly Long Surf Spot Name Here On The Far North Coast Region Near The Old Wooden Pier And Boat Ramp Landing",
        conditions_snapshot: {
          wave_height: 4.5,
          wave_period: 14,
          wind_speed: 5,
          beginner_window_reason:
            "small waves, light wind, morning window, rising tide.",
        },
      }),
    ]);
    // Core data survives; the reason is dropped, nothing hard-truncated.
    expect(result.body).toContain("4-5ft @ 14s");
    expect(result.body).toContain("6 mph");
    expect(result.body).not.toContain("beginner-friendly");
    expect(result.body).not.toContain("...");
    expect(result.body.length).toBeLessThanOrEqual(150);
  });

  it("falls back to swell_1_period when wave_period is missing", () => {
    const result = formatPushNotification([
      makeMatch({
        conditions_snapshot: {
          wave_height: 4,
          swell_1_period: 8,
          wind_speed: 5,
        },
      }),
    ]);
    expect(result.body).toContain("@ 8s");
  });

  it("multi-match title leads with the best-score beach + count", () => {
    const matches = [
      makeMatch({ beach_name: "Trestles", beach_id: "b2", best_score: 0.9 }),
      makeMatch({ beach_name: "Malibu", beach_id: "b3", best_score: 0.7 }),
      makeMatch({ beach_name: "Blacks Beach", beach_id: "b1", best_score: 0.6 }),
    ];
    const result = formatPushNotification(matches);
    expect(result.title).not.toBe("Conditions lining up today");
    expect(result.title).toContain("Trestles");
    expect(result.title).toContain("2 more");
  });

  it("multi-match title sorts defensively when matches are not best-first", () => {
    const matches = [
      makeMatch({ beach_name: "Malibu", beach_id: "b3", best_score: 0.5 }),
      makeMatch({ beach_name: "Trestles", beach_id: "b2", best_score: 0.95 }),
    ];
    const result = formatPushNotification(matches);
    expect(result.title).toContain("Trestles");
    expect(result.title).toContain("1 more");
  });

  it("keeps an explicitly canonical primary match first", () => {
    const lowerScorePrimary = makeMatch({
      rule_id: "canonical-rule",
      beach_name: "Canonical Beach",
      beach_id: "canonical-beach",
      best_score: 0.4,
      best_hour: "2026-04-01T16:30:00Z",
    });
    const higherScoreOther = makeMatch({
      rule_id: "score-rule",
      beach_name: "Score Beach",
      beach_id: "score-beach",
      best_score: 0.95,
    });

    const result = formatPushNotification(
      [higherScoreOther, lowerScorePrimary],
      "maybe",
      lowerScorePrimary,
    );

    expect(result.title).toContain("Canonical Beach");
    expect(result.body.startsWith("Canonical Beach")).toBe(true);
    expect(result.data).toMatchObject({
      beach_id: "canonical-beach",
      forecast_at: "2026-04-01T16:30:00Z",
    });
  });

  it("formats two beaches", () => {
    const matches = [
      makeMatch(),
      makeMatch({ beach_name: "Trestles", beach_id: "b2" }),
    ];
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
      makeMatch({
        beach_name: "Another Extremely Long Beach Name Here",
        beach_id: "b2",
      }),
    ];
    const result = formatPushNotification(matches);
    expect(result.body.length).toBeLessThanOrEqual(150);
  });
});
