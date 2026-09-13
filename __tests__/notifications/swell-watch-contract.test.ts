/**
 * @jest-environment node
 */

import v1Fixture from "../fixtures/swell-watch-v1.json";
import v2Fixture from "../fixtures/swell-watch-v2.json";
import {
  buildSwellWatchCopy,
  buildSwellWatchDedupeKey,
  parseSwellWatchNotificationPayload,
  toSwellWatchClientData,
} from "@/lib/notifications/types/swell-watch-v2";

describe("Swell Watch v1/v2 notification contract", () => {
  it("normalizes the existing v1 payload without fabricating regional identity or timing", () => {
    const parsed = parseSwellWatchNotificationPayload(v1Fixture);
    expect(parsed).toMatchObject({
      kind: "v1",
      beach_id: v1Fixture.beach_id,
      forecast_at: v1Fixture.forecast_at,
      title: v1Fixture.title,
      body: v1Fixture.body,
    });
    expect(parsed).not.toHaveProperty("regional_event_id");
    expect(buildSwellWatchDedupeKey(parsed)).toBeNull();
  });

  it("accepts only the strict v2 allowlist and preserves rank-independent S2 matching context", () => {
    const parsed = parseSwellWatchNotificationPayload(v2Fixture);
    expect(parsed).toMatchObject({
      kind: "v2",
      regional_event_id: "22222222-2222-4222-8222-222222222222",
      beach_id: v2Fixture.beach_id,
      forecast_at: v2Fixture.forecast_at,
      target_partition: {
        period_s: 13,
        direction_deg: 170,
      },
    });
    expect(v1Fixture.peak_period_s).toBe(9);
    expect(buildSwellWatchDedupeKey(parsed)).toBe(
      "swell_watch:22222222-2222-4222-8222-222222222222",
    );
    expect(() => parseSwellWatchNotificationPayload({
      ...v2Fixture,
      device_token: "must-never-reach-a-client",
      user_id: "must-never-reach-a-client",
      relationship: "favorite",
      source_evidence: "internal-only",
      hold_state: "armed",
      operator_id: "internal-only",
    })).toThrow();
    expect(() => parseSwellWatchNotificationPayload({
      ...v2Fixture,
      target_partition: { ...v2Fixture.target_partition, rank: "s2" },
    })).toThrow();
  });

  it.each([
    ["invalid v2 version", { ...v2Fixture, schema_version: "swell-watch-notification.v3" }],
    ["missing regional UUID", (() => {
      const { regional_event_id: _regionalEventId, ...withoutRegionalEvent } = v2Fixture;
      return withoutRegionalEvent;
    })()],
    ["invalid arrival timestamp", { ...v2Fixture, arrival_at: "not-a-timestamp" }],
    ["peak before arrival", { ...v2Fixture, peak_at: "2026-09-07T18:00:00.000Z" }],
    ["nested target extra field", {
      ...v2Fixture,
      target_partition: { ...v2Fixture.target_partition, source_evidence: "internal-only" },
    }],
  ])("rejects %s without downgrading to v1", (_name, payload) => {
    expect(() => parseSwellWatchNotificationPayload(payload)).toThrow();
  });

  it.each(["height_m", "period_s", "direction_deg"] as const)(
    "rejects non-finite target partition %s values",
    (field) => {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(() => parseSwellWatchNotificationPayload({
          ...v2Fixture,
          target_partition: { ...v2Fixture.target_partition, [field]: value },
        })).toThrow();
      }
    },
  );

  it("builds exact, timing-only, deterministic copy and omits unknown timing", () => {
    expect(buildSwellWatchCopy({
      arrivalAt: "2026-09-08T15:00:00.000Z",
      peakAt: "2026-09-09T18:00:00.000Z",
      timezone: "America/Los_Angeles",
    })).toEqual({
      title: "Swell incoming.",
      body: "Productivity has been cancelled. Arrives Tuesday. Peaks Wednesday.",
    });
    expect(buildSwellWatchCopy({ arrivalAt: null, peakAt: null })).toEqual({
      title: "Swell incoming.",
      body: "Productivity has been cancelled.",
    });
    const truncated = buildSwellWatchCopy({
      arrivalAt: "2026-09-08T15:00:00.000Z",
      peakAt: "2026-09-09T18:00:00.000Z",
      timezone: "UTC",
      maxBodyLength: 41,
    });
    expect(truncated.body).toBe("Productivity has been cancelled. Arrives…");
    expect(truncated.body).not.toMatch(/13|170|swell_1|combined/i);
    expect(() => buildSwellWatchCopy({ arrivalAt: null, peakAt: null, maxBodyLength: 0 })).toThrow();
    expect(() => buildSwellWatchCopy({ arrivalAt: null, peakAt: null, maxBodyLength: Number.POSITIVE_INFINITY })).toThrow();
    expect(buildSwellWatchCopy({ arrivalAt: null, peakAt: null, maxBodyLength: 1 })).toEqual({
      title: "Swell incoming.",
      body: "…",
    });
  });

  it("uses validated beach-local time and omits timing for unknown timezone context", () => {
    const input = {
      arrivalAt: "2026-09-08T01:00:00.000Z",
      peakAt: "2026-09-09T01:00:00.000Z",
      timezone: "America/Los_Angeles",
    };
    const priorTimezone = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const utcHostCopy = buildSwellWatchCopy(input);
      process.env.TZ = "Pacific/Honolulu";
      const honoluluHostCopy = buildSwellWatchCopy(input);
      expect(utcHostCopy).toEqual({
        title: "Swell incoming.",
        body: "Productivity has been cancelled. Arrives Monday. Peaks Tuesday.",
      });
      expect(honoluluHostCopy).toEqual(utcHostCopy);
    } finally {
      if (priorTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = priorTimezone;
    }
    expect(buildSwellWatchCopy({
      arrivalAt: input.arrivalAt,
      peakAt: input.peakAt,
      timezone: "not/a-timezone",
    })).toEqual({
      title: "Swell incoming.",
      body: "Productivity has been cancelled.",
    });
    expect(parseSwellWatchNotificationPayload({
      ...v2Fixture,
      copy_context: { beach_timezone: "not/a-timezone" },
    })).toMatchObject({
      kind: "v2",
      title: "Swell incoming.",
      body: "Productivity has been cancelled.",
    });
  });

  it("emits only client-safe v2 data and retains the v1 beach/time fallback", () => {
    const v2 = parseSwellWatchNotificationPayload(v2Fixture);
    const v1 = parseSwellWatchNotificationPayload(v1Fixture);
    expect(toSwellWatchClientData(v2)).toEqual({
      type: "swell_watch",
      version: "2",
      regional_event_id: "22222222-2222-4222-8222-222222222222",
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_slug: "blacks",
      forecast_at: "2026-09-08T15:00:00.000Z",
      target_partition: v2Fixture.target_partition,
      arrival_at: "2026-09-08T15:00:00.000Z",
      peak_at: "2026-09-09T18:00:00.000Z",
    });
    expect(toSwellWatchClientData(v1)).toEqual({
      type: "swell_watch",
      beach_id: "11111111-1111-4111-8111-111111111111",
      beach_slug: "blacks",
      forecast_at: "2026-09-08T15:00:00.000Z",
    });
    expect(JSON.stringify(toSwellWatchClientData(v2))).not.toMatch(
      /device|user|relationship|evidence|hold|operator|token/i,
    );
  });

  it("revalidates normalized v2 values instead of trusting their discriminator or copy", () => {
    const normalized = parseSwellWatchNotificationPayload(v2Fixture);
    if (normalized.kind !== "v2") throw new Error("Expected v2 fixture");

    const malformedPayloads = [
      { ...normalized, kind: "v1" as const },
      { ...normalized, schema_version: "swell-watch-notification.v3" },
      (() => {
        const { regional_event_id: _regionalEventId, ...withoutRegionalEvent } = normalized;
        return withoutRegionalEvent;
      })(),
      {
        ...normalized,
        target_partition: {
          ...normalized.target_partition,
          source_evidence: "must-never-reach-a-client",
        },
      },
    ];
    for (const payload of malformedPayloads) {
      expect(() => toSwellWatchClientData(payload)).toThrow();
    }

    const rebuilt = toSwellWatchClientData({
      ...normalized,
      title: "Forged title",
      body: "Forged body",
    });
    expect(rebuilt).toMatchObject({
      type: "swell_watch",
      version: "2",
      regional_event_id: v2Fixture.regional_event_id,
    });
    expect(JSON.stringify(rebuilt)).not.toContain("Forged");
  });
});
