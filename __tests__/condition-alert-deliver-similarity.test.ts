/**
 * @jest-environment node
 *
 * Unit tests for the similarity_match branch of the shared push formatter
 * that condition-alert-deliver uses to turn alert_queue rows into push
 * notification copy.
 *
 * The delivery cron reads alert_queue rows whose conditions_snapshot was
 * stamped with alert_type = 'similarity_match' by the /api/cron/similarity-
 * alerts route. formatPushNotification detects those rows and emits copy
 * per the Phase 2 spec:
 *
 *   title: "{beachName} · {score} {label} {weekday} {time}"
 *   body:  "Conditions match your profile today."
 */

import { formatPushNotification } from "@/lib/alerts/push-formatter";
import type { MatchingWindow } from "@/lib/alerts/types";

describe("formatPushNotification: similarity_match branch", () => {
  function makeSimilarityMatch(
    overrides: Partial<MatchingWindow> = {},
  ): MatchingWindow {
    // Thursday 2026-04-23 at 06:00 America/Los_Angeles → 13:00 UTC.
    const forecastAt = "2026-04-23T13:00:00.000Z";
    return {
      rule_id: "rule-1",
      rule_name: "Similarity match at Torrey Pines",
      beach_id: "beach-1",
      beach_name: "Torrey Pines",
      beach_timezone: "America/Los_Angeles",
      window_start: forecastAt,
      window_end: forecastAt,
      best_hour: forecastAt,
      best_score: 8.4,
      conditions_snapshot: {
        alert_type: "similarity_match",
        score: 8.4,
        label: "EPIC",
        forecast_at: forecastAt,
        rule_id: "rule-1",
      },
      notify_email: true,
      notify_push: true,
      ...overrides,
    };
  }

  it("uses the similarity push copy when conditions_snapshot.alert_type is 'similarity_match'", () => {
    const match = makeSimilarityMatch();
    const { title, body, data } = formatPushNotification([match]);

    // Title format: "{beach} · {score} {label} {weekday} {time}"
    expect(title).toContain("Torrey Pines");
    expect(title).toContain("8.4");
    expect(title).toContain("EPIC");
    expect(title).toContain("Thursday");
    expect(title).toMatch(/6\s?[AP]M|6am|6AM|6 AM/i);

    // Body is generic — the cron doesn't stamp wind/wave context in
    // conditions_snapshot so we don't fabricate it here.
    expect(body).toBe("Conditions match your profile today.");

    // data payload exposes the beach + alert type for deep-linking.
    expect(data).toMatchObject({
      type: "similarity_match",
      beach_id: "beach-1",
      forecast_at: "2026-04-23T13:00:00.000Z",
    });
  });

  it("formats score to one decimal place", () => {
    const match = makeSimilarityMatch({
      conditions_snapshot: {
        alert_type: "similarity_match",
        score: 7.8456,
        label: "GOOD",
        forecast_at: "2026-04-23T13:00:00.000Z",
        rule_id: "rule-1",
      },
    });
    const { title } = formatPushNotification([match]);
    expect(title).toContain("7.8");
    expect(title).not.toContain("7.8456");
  });

  it("falls back to the condition-alert title when the match is not similarity_match", () => {
    const nonSim: MatchingWindow = {
      rule_id: "rule-2",
      rule_name: "Glass off",
      beach_id: "beach-2",
      beach_name: "Blacks",
      beach_timezone: "America/Los_Angeles",
      window_start: "2026-04-23T13:00:00.000Z",
      window_end: "2026-04-23T15:00:00.000Z",
      best_hour: "2026-04-23T14:00:00.000Z",
      best_score: 0,
      conditions_snapshot: { wave_height: 3, swell_1_period: 14 },
      notify_email: true,
      notify_push: true,
    };
    const { title, data } = formatPushNotification([nonSim]);
    expect(title).toBe("Conditions lining up today");
    expect(data.type).toBe("forecast_alert");
    expect(data.forecast_at).toBe("2026-04-23T14:00:00.000Z");
  });
});
