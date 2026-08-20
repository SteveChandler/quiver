/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PublicForecastHourly } from "@/components/beach-detail/public-forecast-hourly";
import { AuthenticatedForecastDecisionProvider } from "@/components/beach-detail/authenticated-forecast-decision";
import { useAuth } from "@/context/auth-context";
import type { ForecastRecommendationContext } from "@/lib/services/forecast-recommendation-context";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const report = {
  verdict: "YES",
  score: 84,
  bestWindowStart: "2026-08-15T14:00:00.000Z",
  bestWindowEnd: "2026-08-15T16:00:00.000Z",
} as SurfCallResult;

const context = {
  timezone: "America/Los_Angeles",
  selectedRowTime: "2026-08-15T15:00:00.000Z",
  displayWindowStart: "2026-08-15T14:00:00.000Z",
  displayWindowEnd: "2026-08-15T16:00:00.000Z",
} as ForecastRecommendationContext;

const forecastHours = [
  {
    forecast_at: "2026-08-15T13:00:00.000Z",
    wave_height: "2 ft",
    swell_1_height: "2 ft",
    swell_1_period: "17s",
    swell_1_direction: "SW",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_speed: "4 mph",
    wind_direction: "N",
    tide_height: "3.0 ft",
    tide_status: "Rising",
    confidence_score: 91,
  },
  {
    forecast_at: "2026-08-15T15:00:00.000Z",
    wave_height: "3 ft",
    swell_1_height: "2 ft",
    swell_1_period: "17s",
    swell_1_direction: "SW",
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_speed: "4 mph",
    wind_direction: "N",
    tide_height: "3.2 ft",
    tide_status: "Rising",
    confidence_score: 92,
  },
];

describe("PublicForecastHourly", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    global.fetch = jest.fn();
  });

  function renderHourly() {
    return render(
      <AuthenticatedForecastDecisionProvider beachId="beach-1">
        <PublicForecastHourly
          beachName="Del Mar"
          forecastHours={forecastHours}
          context={context}
          forecastDay="today"
          returnTo="/ca/san-diego/del-mar"
        />
      </AuthenticatedForecastDecisionProvider>,
    );
  }

  it("keeps hourly facts public but omits the marker and highlight for guests", () => {
    renderHourly();

    expect(screen.getByText("2 ft")).toBeInTheDocument();
    expect(screen.getByText("3 ft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Best window")).not.toBeInTheDocument();
    for (const row of screen.getAllByTestId("public-forecast-hour")) {
      expect(row).not.toHaveClass("bg-[#F7E7BE]");
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("marks matching rows after fetching the authenticated decision", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { report, forecastContext: context, isTomorrow: false },
        }),
        { status: 200 },
      ),
    );

    renderHourly();

    await waitFor(() => expect(screen.getByText("Best window")).toBeInTheDocument());
    expect(document.body).not.toHaveTextContent("84/100");
    expect(screen.getByRole("columnheader", { name: "Quiver call" })).toBeInTheDocument();

    const rows = screen.getAllByTestId("public-forecast-hour");
    expect(within(rows[0]).queryByText("Best window")).not.toBeInTheDocument();
    expect(within(rows[1]).getByText("Best window")).toBeInTheDocument();
    expect(rows[0]).not.toHaveClass("bg-[#F7E7BE]");
    expect(rows[1]).toHaveClass("bg-[#F7E7BE]");
  });

  it("keeps today's rows separate from a tomorrow recommendation", async () => {
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
    renderHourly();

    expect(screen.getByText("Today by time")).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText("Best window")).not.toBeInTheDocument();
  });
});
