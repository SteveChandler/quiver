/** @jest-environment node */

import {
  getBeginnerBeachesWithEditorial,
  getBeginnerConditionsData,
} from "@/actions/beginner/beginner-actions";

jest.mock("@/lib/supabase/server", () => ({
  createPublicReadClient: jest.fn(() => mockSupabase),
}));

jest.mock("@/lib/community-photos", () => ({
  getResolvedSpotPhotoMap: jest.fn(async () => new Map()),
  communityPhotoTargetKey: (target: { type: string; id: string }) =>
    `${target.type}:${target.id}`,
}));

const mockRankBeaches = jest.fn(
  async <T extends { id: string }>(
    beaches: T[],
    options?: { compare?: (left: T, right: T) => number },
  ) => [...beaches].sort(options?.compare),
);
jest.mock("@/lib/recommendations/selection", () => ({
  rankBeaches: (
    beaches: Array<{ id: string }>,
    options?: { compare?: (left: { id: string }, right: { id: string }) => number },
  ) => mockRankBeaches(beaches, options),
}));

interface MockBeachRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  timezone: string;
  average_rating: number;
  review_count: number;
  skill_level: string;
  break_type: string;
  features: string[];
  preference_model: Record<string, unknown>;
  preferred_tide_ft_min: number | null;
  preferred_tide_ft_max: number | null;
  wind_offshore_deg?: number | null;
  wind_offshore_tol_deg?: number | null;
  aspect_deg?: number | null;
  beach_editorial_content: Array<{
    content_type: string;
    content: Record<string, unknown>;
  }>;
  beach_photos: Array<{ image_url: string | null }>;
}

interface MockForecastRow {
  beach_id: string;
  forecast_at: string;
  wave_height: string | null;
  wind_speed: string | null;
  wind_direction: string | null;
  wind_direction_deg?: number | null;
  tide_status: string | null;
  tide_height: string | null;
  water_temp: string | null;
  updated_at: string;
}

const beaches: MockBeachRow[] = [];
const forecasts: MockForecastRow[] = [];

function makeChain(table: string) {
  const filters: Record<string, unknown> = {};
  let limitCount: number | null = null;

  const resolveRows = (): unknown[] => {
    if (table === "beaches") return beaches;
    if (table !== "enhanced_forecasts") return [];

    let rows = [...forecasts];
    if (typeof filters.beach_id === "string") {
      rows = rows.filter((row) => row.beach_id === filters.beach_id);
    }
    if (Array.isArray(filters.beach_id__in)) {
      rows = rows.filter((row) =>
        (filters.beach_id__in as string[]).includes(row.beach_id),
      );
    }
    rows.sort(
      (a, b) =>
        new Date(b.forecast_at).getTime() - new Date(a.forecast_at).getTime(),
    );
    return limitCount == null ? rows : rows.slice(0, limitCount);
  };

  const chain: any = {
    select: jest.fn(() => chain),
    or: jest.fn(() => chain),
    eq: jest.fn((column: string, value: unknown) => {
      filters[column] = value;
      return chain;
    }),
    in: jest.fn((column: string, value: unknown[]) => {
      filters[`${column}__in`] = value;
      return chain;
    }),
    gte: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn((count: number) => {
      limitCount = count;
      return chain;
    }),
    then: jest.fn((resolve: (value: unknown) => void) =>
      resolve({ data: resolveRows(), error: null }),
    ),
  };

  return chain;
}

const mockSupabase = {
  from: jest.fn((table: string) => makeChain(table)),
};

function makeBeach(overrides: Partial<MockBeachRow>): MockBeachRow {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    city: "Huntington Beach",
    state: "CA",
    timezone: "America/Los_Angeles",
    average_rating: 4,
    review_count: 10,
    skill_level: "beginner",
    break_type: "beach",
    features: ["sand bottom", "beginner sandy beachbreak"],
    preference_model: {
      beginner_window: {
        model: "socal_sandy_beginner",
        beginner_fit: "primary",
        ideal_wave_height_ft: { min: 1, max: 2 },
        acceptable_wave_height_ft: { min: 0.5, max: 3 },
        preferred_tide_stage: ["low", "rising", "mid"],
        avoid_high_tide_under_ft: 2,
        best_time_local: { start: "06:00", end: "10:00" },
        max_beginner_wind_mph: 10,
      },
    },
    preferred_tide_ft_min: 0.5,
    preferred_tide_ft_max: 3,
    // Faces west, so offshore blows from the east.
    aspect_deg: 270,
    beach_editorial_content: [
      {
        content_type: "beginner_notes",
        content: {
          description: "Small, clean mornings with low-to-mid tide.",
          why_beginners_love_it: ["Soft inside reforms"],
          logistics: {
            parking: "Arrive early",
            walk_distance: "Short walk",
            lifeguards: true,
            best_hours: "6-10am",
            facilities: "Restrooms nearby",
          },
        },
      },
    ],
    beach_photos: [],
    ...overrides,
  };
}

function makeForecast(overrides: Partial<MockForecastRow>): MockForecastRow {
  return {
    beach_id: "beach-1",
    forecast_at: "2026-05-22T14:00:00Z",
    wave_height: "1.5",
    wind_speed: "4 mph",
    wind_direction: "E",
    tide_status: "Rising",
    tide_height: "1.8",
    water_temp: "64",
    updated_at: "2026-05-22T13:30:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRankBeaches.mockImplementation(
    async <T extends { id: string }>(
      beaches: T[],
      options?: { compare?: (left: T, right: T) => number },
    ) => [...beaches].sort(options?.compare),
  );
  beaches.length = 0;
  forecasts.length = 0;
});

describe("beginner actions", () => {
  it("ranks an ideal sandy beginner window above a higher-rated high-tide spot", async () => {
    beaches.push(
      makeBeach({
        id: "high-rated-high-tide",
        name: "High Rated High Tide",
        slug: "high-rated-high-tide",
        average_rating: 5,
      }),
      makeBeach({
        id: "lower-rated-good-tide",
        name: "Lower Rated Good Tide",
        slug: "lower-rated-good-tide",
        average_rating: 4,
      }),
    );
    forecasts.push(
      makeForecast({
        beach_id: "high-rated-high-tide",
        tide_status: "High",
        tide_height: "5.4",
      }),
      makeForecast({ beach_id: "lower-rated-good-tide" }),
    );

    const result = await getBeginnerBeachesWithEditorial(
      "huntington-beach",
      "ca",
    );

    expect(result.map((beach) => beach.name)).toEqual([
      "Lower Rated Good Tide",
      "High Rated High Tide",
    ]);
  });

  it("uses the ranked sandy beginner spot for the right-now badge", async () => {
    beaches.push(
      makeBeach({
        id: "high-rated-high-tide",
        name: "High Rated High Tide",
        slug: "high-rated-high-tide",
        average_rating: 5,
      }),
      makeBeach({
        id: "lower-rated-good-tide",
        name: "Lower Rated Good Tide",
        slug: "lower-rated-good-tide",
        average_rating: 4,
      }),
    );
    forecasts.push(
      makeForecast({
        beach_id: "high-rated-high-tide",
        tide_status: "High",
        tide_height: "5.4",
      }),
      makeForecast({ beach_id: "lower-rated-good-tide" }),
    );

    const result = await getBeginnerConditionsData("huntington-beach", "ca");

    expect(result.badge?.spotName).toBe("Lower Rated Good Tide");
    expect(result.badge?.status).toBe("great");
    expect(result.rightNow?.metrics.tide.status).toBe("good");
    expect(result.rightNow?.beginnerVerdict).toMatchObject({
      rating: "ideal",
      reasons: expect.arrayContaining([
        { factor: "Wave size", detail: "Ideal 1-2 ft learner surf" },
        { factor: "Wind", detail: "Light wind" },
        { factor: "Tide", detail: "Low-to-mid tide fit" },
        { factor: "Time window", detail: "Best morning glass window" },
      ]),
    });
  });

  it("treats missing wind telemetry as neutral: the other inputs decide the rating", async () => {
    beaches.push(makeBeach({}));
    forecasts.push(makeForecast({ wind_speed: null }));

    const result = await getBeginnerConditionsData("huntington-beach", "ca");

    expect(result.badge?.status).toBe("great");
    expect(result.badge?.wind).toBeNull();
    expect(result.rightNow?.metrics.wind).toBeUndefined();
    expect(result.rightNow?.beginnerVerdict.rating).toBe("ideal");
    expect(result.rightNow?.beginnerVerdict.reasons.map((r) => r.factor)).not.toContain("Wind");
  });

  describe("summary with an early weekday crowd", () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date(2026, 4, 20, 7, 0) });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("lets the other inputs make a strong learner window without claiming clean wind", async () => {
      beaches.push(makeBeach({}));
      forecasts.push(makeForecast({ wind_speed: null }));

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.rightNow?.summary).toMatch(/strong learner window/);
      expect(result.rightNow?.summary).not.toMatch(/clean/i);
    });

    it("keeps the clean wording when a light wind is known", async () => {
      beaches.push(makeBeach({}));
      forecasts.push(makeForecast({}));

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.rightNow?.summary).toBe("Small, clean, early, and low-to-mid tide - a strong learner window");
    });
  });

  describe("wind that can't be judged against the beach", () => {
    function makeNonModelBeach(overrides: Partial<MockBeachRow> = {}): MockBeachRow {
      return makeBeach({ preference_model: {}, ...overrides });
    }

    it("does not let a speed with no direction change the beginner verdict", async () => {
      beaches.push(makeBeach({}));
      forecasts.push(makeForecast({ wind_speed: "13 mph", wind_direction: null }));

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.badge?.status).toBe("great");
      expect(result.badge?.wind).toBe("13 mph");
      expect(result.rightNow?.metrics.wind).toBeUndefined();
      expect(result.rightNow?.beginnerVerdict.rating).toBe("ideal");
      expect(result.rightNow?.beginnerVerdict.reasons.map((r) => r.factor)).not.toContain("Wind");
    });

    it("shows only the speed when the beach has no orientation", async () => {
      beaches.push(makeBeach({ aspect_deg: null }));
      forecasts.push(makeForecast({ wind_speed: "13 mph", wind_direction: "W" }));

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.badge?.wind).toBe("13 mph");
      expect(result.rightNow?.metrics.wind).toBeUndefined();
      expect(result.rightNow?.beginnerVerdict.rating).toBe("ideal");
    });

    it("drops speed-only chop labels and verdicts outside the beginner model", async () => {
      beaches.push(makeNonModelBeach());
      forecasts.push(makeForecast({ wind_speed: "20 mph", wind_direction: null }));

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.badge?.status).toBe("great");
      expect(result.rightNow?.metrics.wind).toBeUndefined();
      expect(result.rightNow?.beginnerVerdict.reasons.map((r) => r.factor)).not.toContain("Wind");
    });

    it("keeps judging a known wind outside the beginner model", async () => {
      beaches.push(makeNonModelBeach());
      forecasts.push(makeForecast({ wind_speed: "13 mph", wind_direction: "E" }));

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.badge?.status).toBe("fair");
      expect(result.badge?.wind).toBe("13 mph e");
      expect(result.rightNow?.metrics.wind).toMatchObject({ label: "Moderate chop", status: "caution" });
    });

    it("treats a calm reading as known even without a direction", async () => {
      beaches.push(makeBeach({ aspect_deg: null }));
      forecasts.push(makeForecast({ wind_speed: "2 mph", wind_direction: null }));

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.rightNow?.metrics.wind).toMatchObject({ value: "2 mph", label: "Light wind" });
    });

    it("does not rank a beach down for wind it can't judge", async () => {
      beaches.push(
        makeBeach({ id: "windy-unknown", name: "Windy Unknown", slug: "windy-unknown", average_rating: 5 }),
        makeBeach({ id: "light-known", name: "Light Known", slug: "light-known", average_rating: 4 }),
      );
      forecasts.push(
        makeForecast({ beach_id: "windy-unknown", wind_speed: "13 mph", wind_direction: null }),
        makeForecast({ beach_id: "light-known" }),
      );

      const result = await getBeginnerConditionsData("huntington-beach", "ca");

      expect(result.badge?.spotName).toBe("Windy Unknown");
    });
  });
});
