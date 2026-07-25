import type { EnhancedForecastEntity } from "@/types/forecast";
import {
  evaluateMajorSwellAwarenessShadow,
  type OfficialSwellAdvisoryEvidence,
} from "@/lib/recommendations/major-swell-awareness/shadow-evaluator";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const TIMEZONE = "America/Los_Angeles";
const NOW = new Date("2026-07-01T15:00:00.000Z");

function forecast(
  dayOffset: number,
  waveHeight: string,
  period: string,
): EnhancedForecastEntity {
  const date = new Date("2026-07-01T19:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return {
    id: `forecast-${dayOffset}`,
    beach_id: BEACH_ID,
    forecast_at: date.toISOString(),
    wave_height: waveHeight,
    wave_period: period,
    swell_1_period: period,
  } as EnhancedForecastEntity;
}

function hurricaneAdvisory(
  overrides: Partial<OfficialSwellAdvisoryEvidence> = {},
): OfficialSwellAdvisoryEvidence {
  return {
    evidenceRef: "official:nws-alert:hurricane-swell-1",
    kind: "tropical_cyclone",
    startsAt: "2026-07-04T00:00:00.000Z",
    endsAt: "2026-07-08T00:00:00.000Z",
    beachIds: [BEACH_ID],
    ...overrides,
  };
}

describe("evaluateMajorSwellAwarenessShadow", () => {
  it("detects a major long-period forecast trend without changing automation state", () => {
    const result = evaluateMajorSwellAwarenessShadow({
      beachId: BEACH_ID,
      forecasts: [
        forecast(0, "2 ft", "8s"),
        forecast(1, "2 ft", "8s"),
        forecast(2, "2 ft", "8s"),
        forecast(3, "7 ft", "16s"),
        forecast(4, "8 ft", "15s"),
      ],
      timezone: TIMEZONE,
      now: NOW,
      officialAdvisories: [],
    });

    expect(result).toMatchObject({
      mode: "shadow",
      automationEnabled: false,
      signal: "forecast_trend",
      severity: "major",
      event: {
        peakHeightFt: 8,
        peakPeriodS: 15,
        baselineHeightFt: 2,
      },
      officialEvidenceRefs: [],
      wouldSuppressCohorts: ["beginner", "intermediate", "unknown"],
    });
  });

  it("corroborates a hurricane swell with official advisory evidence", () => {
    const result = evaluateMajorSwellAwarenessShadow({
      beachId: BEACH_ID,
      forecasts: [
        forecast(0, "2 ft", "8s"),
        forecast(1, "2 ft", "8s"),
        forecast(2, "2 ft", "8s"),
        forecast(3, "7 ft", "16s"),
        forecast(4, "8 ft", "15s"),
      ],
      timezone: TIMEZONE,
      now: NOW,
      officialAdvisories: [hurricaneAdvisory()],
    });

    expect(result).toMatchObject({
      signal: "corroborated",
      severity: "major",
      officialEvidenceRefs: ["official:nws-alert:hurricane-swell-1"],
      automationEnabled: false,
    });
  });

  it("reports a relevant official high-surf advisory even before the trend is visible", () => {
    const result = evaluateMajorSwellAwarenessShadow({
      beachId: BEACH_ID,
      forecasts: [
        forecast(0, "2 ft", "8s"),
        forecast(1, "2 ft", "8s"),
        forecast(2, "2 ft", "8s"),
      ],
      timezone: TIMEZONE,
      now: NOW,
      officialAdvisories: [
        hurricaneAdvisory({
          kind: "high_surf",
          evidenceRef: "official:nws-alert:high-surf-1",
        }),
      ],
    });

    expect(result).toMatchObject({
      signal: "official_advisory",
      severity: "major",
      event: null,
      officialEvidenceRefs: ["official:nws-alert:high-surf-1"],
    });
  });

  it("ignores expired, unrelated, and malformed advisory evidence", () => {
    const result = evaluateMajorSwellAwarenessShadow({
      beachId: BEACH_ID,
      forecasts: [
        forecast(0, "2 ft", "8s"),
        forecast(1, "2 ft", "8s"),
        forecast(2, "2 ft", "8s"),
      ],
      timezone: TIMEZONE,
      now: NOW,
      officialAdvisories: [
        hurricaneAdvisory({
          endsAt: "2026-06-30T00:00:00.000Z",
        }),
        hurricaneAdvisory({
          beachIds: ["22222222-2222-4222-8222-222222222222"],
        }),
        {
          ...hurricaneAdvisory(),
          evidenceRef: "",
        },
      ],
    });

    expect(result).toEqual({
      mode: "shadow",
      automationEnabled: false,
      signal: "none",
      severity: null,
      event: null,
      officialEvidenceRefs: [],
      wouldSuppressCohorts: [],
    });
  });

  it("keeps a smaller long-period rise significant rather than major", () => {
    const result = evaluateMajorSwellAwarenessShadow({
      beachId: BEACH_ID,
      forecasts: [
        forecast(0, "1 ft", "8s"),
        forecast(1, "1 ft", "8s"),
        forecast(2, "4 ft", "13s"),
        forecast(3, "4 ft", "13s"),
      ],
      timezone: TIMEZONE,
      now: NOW,
      officialAdvisories: [],
    });

    expect(result).toMatchObject({
      signal: "forecast_trend",
      severity: "significant",
      automationEnabled: false,
    });
  });
});
