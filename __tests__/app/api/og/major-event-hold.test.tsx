/**
 * @jest-environment node
 */

import { isValidElement, type ReactNode } from "react";

let mockCapturedImageElement: unknown = null;

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown) => {
    mockCapturedImageElement = element;
    return new Response("mock-png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));
jest.mock("@/lib/services/beach-query-service", () => ({
  getBeachByIdFromDb: jest.fn(),
}));
jest.mock("@/actions/spot/spot-surf-report-actions", () => ({
  getSpotSurfReportPublic: jest.fn(),
}));
jest.mock("@/lib/utils/forecast-service-utils", () => ({
  getBatchFreshForecastsFromCache: jest.fn(),
}));
jest.mock("@/lib/recommendations/major-event-hold/service", () => ({
  evaluateMajorEventHoldCandidates: jest.fn(),
}));
jest.mock("@/lib/recommendations/selection", () => ({
  selectBeach: jest.fn(async (beach: { id: string }) => beach),
}));

import { getSpotSurfReportPublic } from "@/actions/spot/spot-surf-report-actions";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import { getBeachByIdFromDb } from "@/lib/services/beach-query-service";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { selectBeach } from "@/lib/recommendations/selection";

const SATURDAY_BEACH_ID = "11111111-1111-4111-8111-111111111111";
const SUNDAY_BEACH_ID = "22222222-2222-4222-8222-222222222222";
const SATURDAY_START = "2026-07-25T15:00:00.000Z";
const SATURDAY_END = "2026-07-25T18:00:00.000Z";
const FORGED_SATURDAY_END = "2026-07-25T15:30:00.000Z";
const SUNDAY_START = "2026-07-26T15:00:00.000Z";
const SUNDAY_END = "2026-07-26T18:00:00.000Z";

function capturedProps(): Record<string, unknown> {
  if (!isValidElement(mockCapturedImageElement)) {
    throw new Error("Expected captured ImageResponse element");
  }
  return mockCapturedImageElement.props as Record<string, unknown>;
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (!isValidElement(node)) return "";
  return textContent((node.props as { children?: ReactNode }).children);
}

function allowAllCandidates({
  candidates,
}: {
  candidates: Array<{ candidateId: string }>;
}) {
  return candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    evaluation: {
      outcome: "allow",
      holdIds: [],
      holdEpoch: "og-hold-epoch",
    },
    recommendationAvailability: {
      state: "available",
      holdEpoch: "og-hold-epoch",
    },
  }));
}

function forecastRow(
  beachId: string,
  forecastAt: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    beach_id: beachId,
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    wave_height: "4.5",
    wave_period: "14",
    wave_direction: "SW",
    wind_speed: "5",
    wind_direction: "E",
    tide_status: "Rising",
    confidence_score: 90,
    ...overrides,
  };
}

function mockExactWeekendServerData(): void {
  (getBeachByIdFromDb as jest.Mock).mockImplementation(async (beachId) => ({
    success: true,
    data: {
      id: beachId,
      name:
        beachId === SATURDAY_BEACH_ID
          ? "Server Saturday"
          : "Server Sunday",
      slug: "server-beach",
      timezone:
        beachId === SATURDAY_BEACH_ID
          ? "America/Los_Angeles"
          : "Pacific/Honolulu",
    },
  }));
  (getBatchFreshForecastsFromCache as jest.Mock).mockResolvedValue(
    new Map([
      [
        SATURDAY_BEACH_ID,
        {
          forecasts: [
            forecastRow(SATURDAY_BEACH_ID, SATURDAY_START, {
              confidence_score: 10,
            }),
            forecastRow(SATURDAY_BEACH_ID, SATURDAY_END),
          ],
        },
      ],
      [
        SUNDAY_BEACH_ID,
        {
          forecasts: [
            forecastRow(SUNDAY_BEACH_ID, SUNDAY_START, {
              confidence_score: 10,
              wave_height: "3.5",
              wave_period: "12",
              wave_direction: "W",
              wind_speed: "7",
              wind_direction: "NE",
              tide_status: "Falling",
            }),
            forecastRow(SUNDAY_BEACH_ID, SUNDAY_END, {
              wave_height: "3.5",
              wave_period: "12",
              wave_direction: "W",
              wind_speed: "7",
              wind_direction: "NE",
              tide_status: "Falling",
            }),
          ],
        },
      ],
    ]),
  );
}

describe("major-event hold OG routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedImageElement = null;
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    }) as jest.Mock;
    (evaluateMajorEventHoldCandidates as jest.Mock).mockImplementation(
      allowAllCandidates,
    );
  });

  it("keeps a query-only surf call neutral and uncached", async () => {
    const route = await import("@/app/api/og/surf-call/route");
    const response = await route.GET(
      new Request(
        "http://localhost:3000/api/og/surf-call?beach=Fake+Beach&score=99&window=7-10am&message=Go+now",
      ) as never,
    );

    expect(route.dynamic).toBe("force-dynamic");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(capturedProps()).toMatchObject({
      title: "Check current surf conditions",
      subtitle: expect.stringMatching(/wave, wind, and tide/i),
    });
    expect(JSON.stringify(capturedProps())).not.toMatch(
      /Fake Beach|99|7-10am|Go now/i,
    );
    expect(getBeachByIdFromDb).not.toHaveBeenCalled();
  });

  it("uses only an exact allowed server beach and surf-call window for positive copy", async () => {
    (getBeachByIdFromDb as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: SATURDAY_BEACH_ID,
        name: "Server Beach",
        slug: "server-beach",
      },
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValue({
      report: {
        verdict: "YES",
        bestWindowStart: SATURDAY_START,
        bestWindowEnd: SATURDAY_END,
        waveHeight: "4-6 ft",
        windDescription: "Light offshore",
        whySentence: "Clean server forecast",
        score: 86,
        peakTime: "8:00 AM",
        trendTags: [],
        lowForecastConfidence: false,
        recommendationAvailability: {
          state: "available",
          holdEpoch: "og-hold-epoch",
        },
      },
    });
    const route = await import("@/app/api/og/surf-call/route");
    await route.GET(
      new Request(
        `http://localhost:3000/api/og/surf-call?beachId=${SATURDAY_BEACH_ID}&startsAt=${encodeURIComponent(SATURDAY_START)}&endsAt=${encodeURIComponent(SATURDAY_END)}&beach=Fake+Beach&score=99`,
      ) as never,
    );

    expect(capturedProps()).toMatchObject({
      title: "Server Beach is lining up",
      subtitle: expect.stringContaining("8.6/10"),
    });
    expect(JSON.stringify(capturedProps())).not.toMatch(/Fake Beach|9\.9\/10/i);
  });

  it("keeps confidence inert for an exact authorized surf call", async () => {
    (getBeachByIdFromDb as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: SATURDAY_BEACH_ID, name: "Server Beach" },
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValue({
      report: {
        verdict: "YES",
        bestWindowStart: SATURDAY_START,
        bestWindowEnd: SATURDAY_END,
        score: 86,
        lowForecastConfidence: true,
        recommendationAvailability: {
          state: "available",
          holdEpoch: "og-hold-epoch",
        },
      },
    });
    const route = await import("@/app/api/og/surf-call/route");
    await route.GET(
      new Request(
        `http://localhost:3000/api/og/surf-call?beachId=${SATURDAY_BEACH_ID}&startsAt=${encodeURIComponent(SATURDAY_START)}&endsAt=${encodeURIComponent(SATURDAY_END)}`,
      ) as never,
    );

    expect(capturedProps()).toMatchObject({
      title: "Server Beach is lining up",
      subtitle: expect.stringContaining("8.6/10"),
    });
    expect(JSON.stringify(capturedProps())).not.toMatch(/confidence/i);
  });

  it("keeps a query-only weekend card neutral and uncached", async () => {
    const route = await import("@/app/api/og/weekend-wave-check/route");
    const response = await route.GET(
      new Request(
        "http://localhost:3000/api/og/weekend-wave-check?sat_verdict=Go&sat_beach=Fake+Jetty&best_day=Saturday&best_window=Fake+Jetty+at+7am",
      ) as never,
    );
    const text = textContent(mockCapturedImageElement as ReactNode);

    expect(route.dynamic).toBe("force-dynamic");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(text).toMatch(/swell and safety awareness/i);
    expect(text).toMatch(/wave, wind, and tide/i);
    expect(text).not.toMatch(/Fake Jetty|Best day|Best call|\bGo\b/i);
  });

  it("renders weekend spot/window copy from exact allowed server rows without confidence behavior", async () => {
    mockExactWeekendServerData();
    const route = await import("@/app/api/og/weekend-wave-check/route");
    await route.GET(
      new Request(
        `http://localhost:3000/api/og/weekend-wave-check?sat_beach_id=${SATURDAY_BEACH_ID}&sat_starts_at=${encodeURIComponent(SATURDAY_START)}&sat_ends_at=${encodeURIComponent(SATURDAY_END)}&sun_beach_id=${SUNDAY_BEACH_ID}&sun_starts_at=${encodeURIComponent(SUNDAY_START)}&sun_ends_at=${encodeURIComponent(SUNDAY_END)}&sat_beach=Fake+Saturday&sun_beach=Fake+Sunday&sat_summary=Go+now`,
      ) as never,
    );
    const text = textContent(mockCapturedImageElement as ReactNode);

    expect(text).toMatch(/Server Saturday/);
    expect(text).toMatch(/Server Sunday/);
    expect(text).toMatch(/4\.5 ft|3\.5 ft/);
    expect(text).toMatch(/Server Sunday · 5:00 AM HST/);
    expect(text).not.toMatch(/3:00 PM UTC/);
    expect(text).not.toMatch(/Fake Saturday|Fake Sunday|Go now|confidence/i);
    expect(evaluateMajorEventHoldCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ profileExperience: null }),
    );
    expect(selectBeach).toHaveBeenCalledTimes(2);
  });

  it("neutralizes a weekend card when the query end is not the next server forecast instant", async () => {
    mockExactWeekendServerData();
    const route = await import("@/app/api/og/weekend-wave-check/route");
    await route.GET(
      new Request(
        `http://localhost:3000/api/og/weekend-wave-check?sat_beach_id=${SATURDAY_BEACH_ID}&sat_starts_at=${encodeURIComponent(SATURDAY_START)}&sat_ends_at=${encodeURIComponent(FORGED_SATURDAY_END)}&sun_beach_id=${SUNDAY_BEACH_ID}&sun_starts_at=${encodeURIComponent(SUNDAY_START)}&sun_ends_at=${encodeURIComponent(SUNDAY_END)}`,
      ) as never,
    );
    const text = textContent(mockCapturedImageElement as ReactNode);

    expect(text).toMatch(/swell and safety awareness/i);
    expect(text).not.toMatch(/Server Saturday|Server Sunday|Best call|\bGo\b/i);
    expect(evaluateMajorEventHoldCandidates).not.toHaveBeenCalled();
  });

  it.each(["database", "forecast", "policy"] as const)(
    "keeps the weekend card neutral on a %s error",
    async (failure) => {
      mockExactWeekendServerData();
      if (failure === "database") {
        (getBeachByIdFromDb as jest.Mock).mockRejectedValue(
          new Error("database unavailable"),
        );
      } else if (failure === "forecast") {
        (getBatchFreshForecastsFromCache as jest.Mock).mockRejectedValue(
          new Error("forecast unavailable"),
        );
      } else {
        (evaluateMajorEventHoldCandidates as jest.Mock).mockRejectedValue(
          new Error("policy unavailable"),
        );
      }
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const route = await import("@/app/api/og/weekend-wave-check/route");
      const response = await route.GET(
        new Request(
          `http://localhost:3000/api/og/weekend-wave-check?sat_beach_id=${SATURDAY_BEACH_ID}&sat_starts_at=${encodeURIComponent(SATURDAY_START)}&sat_ends_at=${encodeURIComponent(SATURDAY_END)}&sun_beach_id=${SUNDAY_BEACH_ID}&sun_starts_at=${encodeURIComponent(SUNDAY_START)}&sun_ends_at=${encodeURIComponent(SUNDAY_END)}`,
        ) as never,
      );
      const text = textContent(mockCapturedImageElement as ReactNode);

      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(text).not.toMatch(/Server Saturday|Server Sunday|Best call|\bGo\b/i);
      errorSpy.mockRestore();
    },
  );
});
