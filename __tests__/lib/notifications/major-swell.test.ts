import {
  MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  parseMajorSwellNotificationPayload,
} from "@/lib/notifications/types/major-swell";

const physicalEvent = {
  event_start_date: "2026-08-01",
  peak_date: "2026-08-02",
  peak_height_ft: 8,
  peak_period_s: 16,
  forecast_at: "2026-08-02T15:00:00.000Z",
};

const base = {
  schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  beach_id: "11111111-1111-4111-8111-111111111111",
  beach_slug: "blacks",
  beach_name: "Black's Beach",
  awareness_mode: "shadow" as const,
  automation_enabled: false as const,
  awareness_severity: "major" as const,
  would_suppress_cohorts: ["beginner", "intermediate", "unknown"] as const,
  title: "Swell incoming — Black's Beach",
  body: "A major swell is approaching.",
};

describe("major swell notification contract", () => {
  it("accepts forecast-trend evidence with physical values", () => {
    expect(parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      awareness_signal: "forecast_trend",
      official_evidence_refs: [],
      enforcement: null,
    })).toMatchObject({ awareness_signal: "forecast_trend" });
  });

  it("accepts official-only evidence without invented physical values", () => {
    expect(parseMajorSwellNotificationPayload({
      ...base,
      event_start_date: null,
      peak_date: null,
      peak_height_ft: null,
      peak_period_s: null,
      forecast_at: null,
      awareness_signal: "official_advisory",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      enforcement: null,
    })).toMatchObject({
      awareness_signal: "official_advisory",
      peak_height_ft: null,
    });
  });

  it("rejects corroborated evidence when physical values are missing", () => {
    expect(() => parseMajorSwellNotificationPayload({
      ...base,
      event_start_date: null,
      peak_date: null,
      peak_height_ft: null,
      peak_period_s: null,
      forecast_at: null,
      awareness_signal: "corroborated",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      enforcement: null,
    })).toThrow();
  });

  it("rejects enforce mode without durable hold proof", () => {
    expect(() => parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      awareness_mode: "enforce",
      automation_enabled: true,
      awareness_signal: "corroborated",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      enforcement: null,
    })).toThrow();
  });

  it("accepts enforce mode with complete durable hold proof", () => {
    expect(parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      awareness_mode: "enforce",
      automation_enabled: true,
      awareness_signal: "corroborated",
      official_evidence_refs: ["official:nws_alert:high-surf"],
      enforcement: {
        hold_id: "22222222-2222-4222-8222-222222222222",
        hold_record_id: "33333333-3333-4333-8333-333333333333",
        hold_valid_until: "2026-08-02T18:00:00.000Z",
      },
    })).toMatchObject({
      awareness_mode: "enforce",
      enforcement: {
        hold_id: "22222222-2222-4222-8222-222222222222",
      },
    });
  });

  it("rejects a versioned payload instead of adapting it as legacy", () => {
    expect(() => parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      schema_version: 1,
      awareness_signal: "forecast_trend",
      official_evidence_refs: [],
      enforcement: null,
    })).toThrow();
  });

  it("normalizes a queued unversioned forecast-trend payload", () => {
    const parsed = parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      schema_version: undefined,
      awareness_signal: "forecast_trend",
      official_evidence_refs: [],
    });
    expect(parsed.schema_version).toBe(
      MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
    );
    expect(parsed.enforcement).toBeNull();
  });
});
