/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PublicForecastAnswer } from "@/components/beach-detail/public-forecast-answer";
import { AuthenticatedForecastDecisionProvider } from "@/components/beach-detail/authenticated-forecast-decision";
import { useAuth } from "@/context/auth-context";
import type { Beach } from "@/types/database";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import {
  selectPublicForecastContextFacts,
  selectPublicForecastReportFacts,
} from "@/lib/utils/public-forecast-facts";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const beach = {
  id: "beach-1",
  name: "Oceanside Harbor",
  city: "Oceanside",
  state: "CA",
  timezone: "America/Los_Angeles",
} as Beach;

const context: ForecastRecommendationContext = {
  beachId: "beach-1",
  localDate: "2026-08-09",
  recommendationType: "best_window",
  contextType: "best_window",
  startTime: "2026-08-09T18:00:00.000Z",
  endTime: "2026-08-09T20:00:00.000Z",
  selectedWindowStart: "2026-08-09T18:00:00.000Z",
  selectedWindowEnd: "2026-08-09T20:00:00.000Z",
  displayWindowStart: "2026-08-09T18:00:00.000Z",
  displayWindowEnd: "2026-08-09T20:00:00.000Z",
  displayTimeLabel: "Best window: 11:00 AM-1:00 PM",
  selectedRowTime: "2026-08-09T19:00:00.000Z",
  waveHeight: "3 ft",
  waveHeightFt: 3,
  waveHeightRangeLabel: "2-3 ft",
  swellPeriod: "12s",
  periodSec: 12,
  swellDirection: "SW",
  primarySwellHeight: "2.5 ft",
  secondarySwellHeight: "1 ft",
  secondarySwellPeriod: "8s",
  secondarySwellDirection: "W",
  windSpeed: "5 mph",
  windDirection: "E",
  score: 78,
  confidence: 82,
  primaryDataSource: "NOAA_NWS",
  sourceDataUpdatedAt: "2026-08-09T17:00:00.000Z",
  contributingSources: ["NOAA_NWS", "NOAA_CO-OPS"],
  resolverUsed: "surf-call",
  source: "looking_ahead",
  timezone: "America/Los_Angeles",
};

const report = {
  verdict: "YES",
  bestWindowStart: "2026-08-09T18:00:00.000Z",
  bestWindowEnd: "2026-08-09T20:00:00.000Z",
  waveHeight: "3 ft",
  windSpeed: "5 mph",
  windCompass: "E",
  windType: "offshore",
  tideHeight: "3.2 ft",
  tidePhase: "rising",
  nextTideType: "High",
  forecastConfidence: 82,
  score: 78,
  whySentence: "Clean swell and light offshore wind.",
  updatedAt: "2026-08-09T17:05:00.000Z",
} as SurfCallResult;

function renderAnswer() {
  return render(
    <AuthenticatedForecastDecisionProvider beachId={beach.id}>
      <PublicForecastAnswer
        beach={beach}
        report={report}
        context={context}
        isTomorrow
        headingLevel="h1"
        returnTo="/ca/san-diego/ocean-beach"
      />
    </AuthenticatedForecastDecisionProvider>,
  );
}

describe("PublicForecastAnswer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    global.fetch = jest.fn();
  });

  it("keeps public facts in guest HTML while replacing the verdict and window with login", () => {
    renderAnswer();

    expect(screen.getByTestId("public-forecast-answer")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText(/Oceanside Harbor Surf Forecast for/)).toBeInTheDocument();
    expect(screen.getByText("2-3 ft")).toBeInTheDocument();
    expect(screen.getByText(/NOAA NWS, NOAA CO-OPS/)).toBeInTheDocument();
    expect(screen.queryByText("YES")).not.toBeInTheDocument();
    expect(screen.queryByText("11:00 AM–1:00 PM")).not.toBeInTheDocument();

    const login = screen.getByRole("link", { name: /sign in to reveal/i });
    expect(login).toHaveAttribute(
      "href",
      "/auth/sign-in?redirectTo=%2Fca%2Fsan-diego%2Focean-beach",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("projects decision values out of props sent through the static route", () => {
    const publicReport = selectPublicForecastReportFacts(report);
    const publicContext = selectPublicForecastContextFacts(context);

    expect(publicReport).not.toHaveProperty("verdict");
    expect(publicReport).not.toHaveProperty("bestWindowStart");
    expect(publicReport).not.toHaveProperty("bestWindowEnd");
    expect(publicContext).not.toHaveProperty("displayWindowStart");
    expect(publicContext).not.toHaveProperty("displayWindowEnd");
    expect(publicContext).not.toHaveProperty("displayTimeLabel");
  });

  it("fetches and renders the verdict and best window for an authenticated user", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { report, forecastContext: context, isTomorrow: true },
        }),
        { status: 200 },
      ),
    );

    renderAnswer();

    await waitFor(() => expect(screen.getByText("YES")).toBeInTheDocument());
    expect(screen.getByText("11:00 AM–1:00 PM")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in to reveal/i })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/surf/call?beachId=beach-1",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps the exact-query heading when forecast details are unavailable", () => {
    render(
      <PublicForecastAnswer
        beach={beach}
        report={null}
        context={null}
        isTomorrow={false}
        headingLevel="h1"
        returnTo="/ca/oceanside/oceanside-harbor"
      />,
    );

    expect(screen.getByRole("heading", {
      level: 1,
      name: "Oceanside Harbor Surf Forecast",
    })).toBeInTheDocument();
    expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Forecast valid at/)).not.toBeInTheDocument();
  });
});
