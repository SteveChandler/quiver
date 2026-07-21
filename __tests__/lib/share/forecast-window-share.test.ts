import {
  buildForecastWindowOgImagePath,
  buildForecastWindowShareMetadata,
  loadForecastWindowShareMetadata,
  normalizeForecastWindowParam,
} from "@/lib/share/forecast-window-share";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const FORECAST_AT = "2026-06-03T16:15:00.000Z";

const beach = {
  id: BEACH_ID,
  name: "Server Beach",
  slug: "server-beach",
  city: "La Jolla",
  state: "CA",
  country: "USA",
  timezone: "America/Los_Angeles",
};

const forecast = {
  beach_id: BEACH_ID,
  forecast_at: FORECAST_AT,
  wave_height: "4.5",
  wave_height_om: null,
  swell_1_period: "18",
  swell_1_direction: "SW",
  swell_direction: null,
  wind_speed: "10",
  wind_direction: "SW",
  tide_height: "2.7 ft",
  tide_status: "Rising",
};

function allowCandidates({
  candidates,
}: {
  candidates: Array<{ candidateId: string }>;
}) {
  return candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    evaluation: {
      outcome: "allow",
      holdIds: [],
      holdEpoch: "share-hold-epoch",
    },
    recommendationAvailability: {
      state: "available",
      holdEpoch: "share-hold-epoch",
    },
  }));
}

function shareDependencies(options?: {
  beach?: typeof beach | null;
  forecast?: typeof forecast | null;
  decisions?: ReturnType<typeof allowCandidates>;
}) {
  const resolvedBeach =
    options && Object.prototype.hasOwnProperty.call(options, "beach")
      ? options.beach
      : beach;
  const resolvedForecast =
    options && Object.prototype.hasOwnProperty.call(options, "forecast")
      ? options.forecast
      : forecast;
  return {
    loadBeach: jest.fn().mockResolvedValue(resolvedBeach),
    loadForecast: jest.fn().mockResolvedValue(resolvedForecast),
    evaluateHoldCandidates: jest
      .fn()
      .mockImplementation(
        options?.decisions
          ? async () => options.decisions
          : async (input) => allowCandidates(input),
      ),
  };
}

async function loadWith(
  dependencies: ReturnType<typeof shareDependencies>,
  overrides: Partial<
    Parameters<typeof loadForecastWindowShareMetadata>[0]
  > = {},
) {
  return (loadForecastWindowShareMetadata as any)(
    {
      slug: "server-beach",
      window: FORECAST_AT,
      windowLabel: "Fake ready window",
      conditions: "99 ft · Perfect query conditions",
      ...overrides,
    },
    dependencies,
  );
}

describe("forecast-window-share", () => {
  it("returns neutral fallback metadata for invalid or opaque window values", () => {
    const metadata = buildForecastWindowShareMetadata({
      slug: "scripps",
      window: "opaque-window-id",
    });

    expect(normalizeForecastWindowParam("opaque-window-id")).toBeNull();
    expect(metadata.isFallback).toBe(true);
    expect(metadata.title).toBe("Open Quiver Surf Window");
    expect(metadata.description).toContain("Open this surf window in Quiver");
  });

  it("cannot authorize positive copy from a timestamp, label, or conditions alone", () => {
    const metadata = buildForecastWindowShareMetadata({
      slug: "fake-beach",
      beachName: "Fake Ready Beach",
      timezone: "America/Los_Angeles",
      window: FORECAST_AT,
      windowLabel: "3:30-6:00 PM",
      conditions: "20 ft · Perfect · Go now",
      waveHeight: "20 ft",
      conditionSegments: ["Perfect", "Go now"],
    });

    expect(metadata.isFallback).toBe(true);
    expect(metadata.forecastAt).toBeNull();
    expect(metadata.windowLabel).toBeNull();
    expect(metadata.title).toBe("Open Quiver Surf Window");
    expect(JSON.stringify(metadata)).not.toMatch(
      /lining up|ready beach|3:30-6:00|20 ft|perfect|go now/i,
    );
  });

  it("uses only an exact allowed server beach and forecast interval for positive copy", async () => {
    const dependencies = shareDependencies();

    const metadata = await loadWith(dependencies);

    expect(metadata.title).toBe("Server Beach 9:15 AM is lining up");
    expect(metadata.description).toContain("4.5 ft");
    expect(metadata.windowLabel).toBe("9:15 AM");
    expect(metadata.waveHeight).toBe("4.5 ft");
    expect(metadata.conditionRow).toContain("18s SW");
    expect(JSON.stringify(metadata)).not.toMatch(
      /Fake ready window|99 ft|Perfect query conditions/i,
    );
    expect(dependencies.loadBeach).toHaveBeenCalledWith("server-beach");
    expect(dependencies.loadForecast).toHaveBeenCalledWith(
      BEACH_ID,
      FORECAST_AT,
    );
    expect(dependencies.evaluateHoldCandidates).toHaveBeenCalledWith({
      candidates: [
        {
          candidateId: `forecast-window-share:${BEACH_ID}:${FORECAST_AT}`,
          beachId: BEACH_ID,
          startsAt: FORECAST_AT,
          endsAt: "2026-06-03T17:15:00.000Z",
        },
      ],
      profileExperience: null,
    });
  });

  it("keeps an exact server row neutral when its local display timezone is unavailable", async () => {
    const dependencies = shareDependencies({
      beach: { ...beach, timezone: null } as never,
    });

    const metadata = await loadWith(dependencies);

    expect(metadata.title).toBe("Current surf conditions at Server Beach");
    expect(metadata.windowLabel).toBeNull();
    expect(metadata.waveHeight).toBe("4.5 ft");
    expect(metadata.description).not.toMatch(/lining up|ready|window/i);
  });

  it("keeps query-only and database-miss input neutral", async () => {
    const dependencies = shareDependencies({ beach: null });

    const metadata = await loadWith(dependencies, {
      slug: "fake-ready-beach",
    });

    expect(metadata.title).toBe("Open Quiver Surf Window");
    expect(metadata.forecastAt).toBeNull();
    expect(metadata.windowLabel).toBeNull();
    expect(JSON.stringify(metadata)).not.toMatch(
      /lining up|Fake ready window|99 ft|Perfect query conditions/i,
    );
    expect(dependencies.loadForecast).not.toHaveBeenCalled();
    expect(dependencies.evaluateHoldCandidates).not.toHaveBeenCalled();
  });

  it.each([
    [
      "held",
      {
        candidateId: `forecast-window-share:${BEACH_ID}:${FORECAST_AT}`,
        evaluation: {
          outcome: "explicit_none",
          reasonCode: "major_event_hold",
          holdIds: ["hold-1"],
          expiresAt: "2026-06-04T00:00:00.000Z",
          holdEpoch: "share-hold-epoch",
        },
        recommendationAvailability: {
          state: "none",
          reasonCode: "major_event_hold",
          expiresAt: "2026-06-04T00:00:00.000Z",
          holdEpoch: "share-hold-epoch",
        },
      },
    ],
    [
      "unresolved",
      {
        candidateId: `forecast-window-share:${BEACH_ID}:${FORECAST_AT}`,
        evaluation: {
          outcome: "explicit_none",
          reasonCode: "hold_state_unavailable",
          holdIds: [],
          holdEpoch: "share-hold-epoch",
        },
        recommendationAvailability: {
          state: "none",
          reasonCode: "hold_state_unavailable",
          holdEpoch: "share-hold-epoch",
        },
      },
    ],
  ])(
    "neutralizes positive window copy when public hold resolution is %s",
    async (_label, decision) => {
      const dependencies = shareDependencies({
        decisions: [decision] as never,
      });

      const metadata = await loadWith(dependencies);

      expect(metadata.title).toBe("Current surf conditions at Server Beach");
      expect(metadata.windowLabel).toBeNull();
      expect(metadata.waveHeight).toBe("4.5 ft");
      expect(metadata.conditionRow).toContain("18s SW");
      expect(metadata.description).not.toMatch(/lining up|ready|window/i);
      expect(JSON.stringify(metadata)).not.toMatch(
        /Fake ready window|99 ft|Perfect query conditions|major_event_hold|hold_state_unavailable/i,
      );
    },
  );

  it("builds an OG image path without untrusted preview copy or tracking params", () => {
    const path = buildForecastWindowOgImagePath({
      slug: "scripps",
      window: FORECAST_AT,
      windowLabel: "Fake ready window",
      conditions: "99 ft · Go now",
    });

    expect(path).toMatch(/^\/api\/og\/forecast-window\?/);
    expect(path).toContain("slug=scripps");
    expect(path).toContain("window=2026-06-03T16%3A15%3A00.000Z");
    expect(path).not.toMatch(/label=|conditions=|utm_/);
  });
});
