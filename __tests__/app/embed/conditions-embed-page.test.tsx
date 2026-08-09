import { render, screen } from "@testing-library/react";

const mockGetBeachBySlugOrId = jest.fn();
const mockGetFreshForecastFromCache = jest.fn();
const mockForecastToConditionsData = jest.fn();

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: (...args: unknown[]) =>
    mockGetBeachBySlugOrId(...args),
}));
jest.mock("@/lib/utils/forecast-server-utils", () => ({
  getFreshForecastFromCache: (...args: unknown[]) =>
    mockGetFreshForecastFromCache(...args),
}));
jest.mock("@/lib/mappers/conditions-mappers", () => ({
  forecastToConditionsData: (...args: unknown[]) =>
    mockForecastToConditionsData(...args),
}));
jest.mock("@/lib/utils/beach-url-utils", () => ({
  buildBeachUrl: jest.fn(() => "/ca/test-city/test-beach"),
}));
jest.mock("@/hooks/use-embed-impression", () => ({
  useEmbedImpression: jest.fn(),
}));

import EmbedConditionsPage from "@/app/embed/conditions/[slug]/page";

const SLUG = "test-beach";
const BEACH = {
  id: "beach-1",
  name: "Test Beach",
  timezone: "Pacific/Honolulu",
};
const FORECAST = {
  forecast_at: "2026-08-05T10:00:00Z",
  forecast_date: "2026-08-05",
  forecast_time: "10:00:00",
};
const CONDITIONS = {
  waveHeight: "3 ft",
  wavePeriod: "12 s",
  waveDirection: "W",
};

function cacheResult({
  stale = false,
  missing = false,
  forecasts = [FORECAST],
  lastUpdated = "2026-08-05T09:30:00Z",
}: {
  stale?: boolean;
  missing?: boolean;
  forecasts?: typeof FORECAST[];
  lastUpdated?: string;
}) {
  return {
    forecasts,
    metadata: {
      cached: !missing,
      stale,
      missing,
      reason: missing ? "No forecast data in cache" : null,
      dataSource: "CDIP",
      lastUpdated,
    },
  };
}

async function renderPage() {
  const ui = await EmbedConditionsPage({
    params: Promise.resolve({ slug: SLUG }),
    searchParams: Promise.resolve({}),
  });

  return render(ui);
}

describe("conditions embed page freshness states", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBeachBySlugOrId.mockResolvedValue(BEACH);
    mockForecastToConditionsData.mockReturnValue(CONDITIONS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders fresh conditions with no as-of label", async () => {
    mockGetFreshForecastFromCache.mockResolvedValue(cacheResult({}));

    await renderPage();

    expect(screen.getByText("3 ft @ 12 s W")).toBeInTheDocument();
    expect(screen.queryByText(/^as of /i)).not.toBeInTheDocument();
    expect(mockGetFreshForecastFromCache).toHaveBeenCalledWith(
      BEACH.id,
      24,
      { allowStale: true, maxStaleHours: 24 }
    );
  });

  it("renders stale conditions with beach-local last-updated time", async () => {
    mockGetFreshForecastFromCache.mockResolvedValue(
      cacheResult({ stale: true })
    );

    await renderPage();

    expect(screen.getByText("3 ft @ 12 s W")).toBeInTheDocument();
    expect(
      screen.getByText("as of Tue, Aug 4 at 11:30 PM")
    ).toBeInTheDocument();
  });

  it("renders an honest unavailable state with a beach-page link", async () => {
    mockGetFreshForecastFromCache.mockResolvedValue(
      cacheResult({ missing: true, forecasts: [] })
    );

    await renderPage();

    expect(
      screen.getByText("Conditions are temporarily unavailable.")
    ).toBeInTheDocument();
    const href = screen
      .getByRole("link", { name: "View Test Beach forecast" })
      .getAttribute("href");
    if (!href) throw new Error("Expected unavailable-state beach link");
    const beachUrl = new URL(href);
    expect(`${beachUrl.pathname}${beachUrl.search}`).toBe(
      "/ca/test-city/test-beach?utm_source=embed&utm_medium=widget&utm_campaign=conditions"
    );
  });

  it("renders unavailable and logs the slug when forecast loading throws", async () => {
    const error = new Error("database offline");
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockGetFreshForecastFromCache.mockRejectedValue(error);

    await renderPage();

    expect(
      screen.getByText("Conditions are temporarily unavailable.")
    ).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(
      `[EmbedConditionsPage] Failed to load forecast for beach ${SLUG}:`,
      error
    );
  });
});
