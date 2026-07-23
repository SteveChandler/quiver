/**
 * @jest-environment node
 */

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

const holdProof = {
  hold_id: "22222222-2222-4222-8222-222222222222",
  hold_record_id: "33333333-3333-4333-8333-333333333333",
  hold_valid_until: "2026-08-02T18:00:00.000Z",
};

type SignalModeCase = {
  signal: "forecast_trend" | "official_advisory" | "corroborated";
  mode: "shadow" | "enforce";
  physicalValues: "required" | "null";
  officialRefs: "empty" | "required";
  holdProof: "present" | "missing";
  result: "accept" | "reject";
};

const signalModeCases: SignalModeCase[] = [
  {
    signal: "forecast_trend",
    mode: "shadow",
    physicalValues: "required",
    officialRefs: "empty",
    holdProof: "missing",
    result: "accept",
  },
  {
    signal: "official_advisory",
    mode: "shadow",
    physicalValues: "null",
    officialRefs: "required",
    holdProof: "missing",
    result: "accept",
  },
  {
    signal: "corroborated",
    mode: "shadow",
    physicalValues: "required",
    officialRefs: "required",
    holdProof: "missing",
    result: "accept",
  },
  {
    signal: "forecast_trend",
    mode: "enforce",
    physicalValues: "required",
    officialRefs: "empty",
    holdProof: "present",
    result: "reject",
  },
  {
    signal: "official_advisory",
    mode: "enforce",
    physicalValues: "null",
    officialRefs: "required",
    holdProof: "missing",
    result: "reject",
  },
  {
    signal: "official_advisory",
    mode: "enforce",
    physicalValues: "null",
    officialRefs: "required",
    holdProof: "present",
    result: "accept",
  },
  {
    signal: "corroborated",
    mode: "enforce",
    physicalValues: "required",
    officialRefs: "required",
    holdProof: "missing",
    result: "reject",
  },
  {
    signal: "corroborated",
    mode: "enforce",
    physicalValues: "required",
    officialRefs: "required",
    holdProof: "present",
    result: "accept",
  },
];

function acceptsMajorSwellNotificationPayload(payload: unknown): boolean {
  try {
    parseMajorSwellNotificationPayload(payload);
    return true;
  } catch {
    return false;
  }
}

describe("major swell notification contract", () => {
  it.each(signalModeCases)(
    "$signal $mode with $physicalValues physical values, $officialRefs official refs, and $holdProof hold proof: $result",
    ({ signal, mode, physicalValues, officialRefs, holdProof: proof, result }) => {
      const payload = {
        ...base,
        ...(physicalValues === "required"
          ? physicalEvent
          : {
              event_start_date: null,
              peak_date: null,
              peak_height_ft: null,
              peak_period_s: null,
              forecast_at: null,
            }),
        awareness_mode: mode,
        automation_enabled: mode === "enforce",
        awareness_signal: signal,
        official_evidence_refs:
          officialRefs === "required"
            ? ["official:nws_alert:high-surf"]
            : [],
        enforcement: proof === "present" ? holdProof : null,
      };

      const original = structuredClone(payload);
      expect(acceptsMajorSwellNotificationPayload(payload)).toBe(
        result === "accept",
      );
      expect(payload).toEqual(original);
    },
  );

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

  it.each([
    "official:rip_current_risks:11111111-1111-4111-8111-111111111111",
    "official:nws_alert:https://api.weather.gov/alerts/high-surf",
  ])("accepts recognized official evidence reference %s", (officialRef) => {
    expect(parseMajorSwellNotificationPayload({
      ...base,
      event_start_date: null,
      peak_date: null,
      peak_height_ft: null,
      peak_period_s: null,
      forecast_at: null,
      awareness_signal: "official_advisory",
      official_evidence_refs: [officialRef],
      enforcement: null,
    })).toMatchObject({
      awareness_signal: "official_advisory",
      official_evidence_refs: [officialRef],
    });
  });

  it.each(["source:unrecognized:alert", "official:other_producer:alert"])(
    "rejects unrecognized official-only evidence reference %s",
    (officialRef) => {
      expect(() => parseMajorSwellNotificationPayload({
        ...base,
        event_start_date: null,
        peak_date: null,
        peak_height_ft: null,
        peak_period_s: null,
        forecast_at: null,
        awareness_signal: "official_advisory",
        official_evidence_refs: [officialRef],
        enforcement: null,
      })).toThrow();
    },
  );

  it("rejects unrecognized corroborated evidence references", () => {
    expect(() => parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      awareness_signal: "corroborated",
      official_evidence_refs: ["arbitrary-but-nonempty"],
      enforcement: null,
    })).toThrow();
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

  it("strips benign legacy metadata while normalizing recognized fields", () => {
    const parsed = parseMajorSwellNotificationPayload({
      ...base,
      ...physicalEvent,
      schema_version: undefined,
      awareness_signal: "forecast_trend",
      official_evidence_refs: [],
      delivery_attempt: 2,
      metadata: { queued_by: "legacy-worker" },
    });

    expect(parsed).not.toHaveProperty("delivery_attempt");
    expect(parsed).not.toHaveProperty("metadata");
    expect(parsed).toMatchObject({
      schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
      awareness_signal: "forecast_trend",
      enforcement: null,
    });
  });
});
