import {
  DAILY_CALL_SCHEMA_VERSION,
  parseDailyCallPayload,
} from "@/lib/notifications/types/daily-call";

const validPayload = {
  schema_version: DAILY_CALL_SCHEMA_VERSION,
  beach_id: "11111111-1111-4111-8111-111111111111",
  beach_slug: "blacks",
  beach_name: "Black's",
  alert_date: "2026-09-18",
  window_start: "2026-09-18T14:15:00.000Z",
  window_end: "2026-09-18T16:40:00.000Z",
  window_local: "7:15–~9:40",
  drivers: [
    {
      kind: "wind" as const,
      edge: "end" as const,
      at: "2026-09-18T16:40:00.000Z",
      approximate: true,
      label: "Offshore through ~9:40",
    },
  ],
  wave_height_ft: 3,
  wave_period_s: 13,
  swell_dir: "SW",
  wind_label: "Light offshore",
  tide_label: "Rising to a 9:52 high",
  reason: "Offshore through ~9:40, then it turns.",
  title: "Wind stays polite. Blacks 7:15–9:40",
  title_id: "daily-wind-1",
  comparison: null,
  swell_event_key: null,
  decision_id: "decision-1",
  session_decision: { verdict: "go" },
};

describe("dailyCallPayloadSchema", () => {
  it("parses a valid daily call payload", () => {
    expect(parseDailyCallPayload(validPayload)).toEqual(validPayload);
  });

  it("rejects titles over 40 Unicode characters", () => {
    expect(() =>
      parseDailyCallPayload({ ...validPayload, title: "x".repeat(41) }),
    ).toThrow();
  });
});
