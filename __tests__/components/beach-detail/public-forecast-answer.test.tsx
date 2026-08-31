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

const nearbyBeaches = [
  {
    id: "backup-1",
    name: "Swami's",
    slug: "swamis",
    city: "Encinitas",
    state: "CA",
    country: "USA",
  },
  {
    id: "backup-2",
    name: "Ocean Beach",
    slug: "ocean-beach",
    city: "San Diego",
    state: "CA",
    country: "USA",
  },
  {
    id: "backup-3",
    name: "Pipeline",
    slug: "pipeline",
    city: "Haleiwa",
    state: "HI",
    country: "USA",
  },
] as Beach[];

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

function renderAnswer({
  answerBeach = beach,
  answerReport = report,
  answerContext = context,
  tomorrow = true,
  backups = nearbyBeaches,
  publicWindow,
}: {
  answerBeach?: Beach;
  answerReport?: SurfCallResult | null;
  answerContext?: ForecastRecommendationContext | null;
  tomorrow?: boolean;
  backups?: Beach[];
  publicWindow?: { start: string | null; end: string | null };
} = {}) {
  return render(
    <AuthenticatedForecastDecisionProvider beachId={beach.id}>
      <PublicForecastAnswer
        beach={answerBeach}
        report={answerReport}
        context={answerContext}
        isTomorrow={tomorrow}
        publicDecisionWindow={publicWindow ?? {
          start: answerReport?.bestWindowStart ?? null,
          end: answerReport?.bestWindowEnd ?? null,
        }}
        nearbyBeaches={backups}
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

  it("renders every live decision field and three buildBeachUrl backup links for guests", () => {
    renderAnswer();

    expect(screen.getByTestId("public-forecast-answer")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText(/Oceanside Harbor Surf Forecast for/)).toBeInTheDocument();
    expect(screen.getByText("2-3 ft")).toBeInTheDocument();
    expect(screen.getByText("11:00 AM–1:00 PM")).toBeInTheDocument();
    expect(screen.getByText("5 mph E offshore")).toBeInTheDocument();
    expect(screen.getByText("3.2 ft rising next high")).toBeInTheDocument();
    expect(screen.getByText(/NOAA NWS, NOAA CO-OPS/)).toBeInTheDocument();
    expect(screen.queryByText("YES")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in to reveal/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Swami's" })).toHaveAttribute(
      "href",
      "/ca/encinitas/swamis",
    );
    expect(screen.getByRole("link", { name: "Ocean Beach" })).toHaveAttribute(
      "href",
      "/ca/san-diego/ocean-beach",
    );
    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute(
      "href",
      "/hi/haleiwa/pipeline",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["Best window", { ...report, bestWindowStart: null, bestWindowEnd: null }],
    ["Wind", { ...report, windSpeed: null, windCompass: null, windType: null }],
    [
      "Tide",
      { ...report, tideHeight: null, tidePhase: null, nextTideType: null },
    ],
    ["Surf", { ...report, waveHeight: null }],
  ])("omits %s without rendering a substitute", (label, answerReport) => {
    const answerContext = {
      ...context,
      ...(label === "Best window"
        ? { displayWindowStart: null, displayWindowEnd: null }
        : {}),
      ...(label === "Wind" ? { windSpeed: null, windDirection: null } : {}),
      ...(label === "Surf" ? { waveHeight: null, waveHeightRangeLabel: null } : {}),
    };

    renderAnswer({ answerReport, answerContext, backups: [] });

    expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(screen.queryByText(/no clean window|check current|refresh|check the app/i)).not.toBeInTheDocument();
  });

  it("uses the stored beach timezone and distinguishes today from tomorrow", () => {
    renderAnswer({
      answerBeach: { ...beach, timezone: "Pacific/Honolulu" },
      answerContext: { ...context, timezone: "America/New_York" },
      tomorrow: false,
      backups: [],
    });

    expect(screen.getByText("8:00 AM–10:00 AM")).toBeInTheDocument();
    expect(screen.queryByText("Tomorrow")).not.toBeInTheDocument();
  });

  it("renders fewer than three backups and omits the section when none exist", () => {
    const { rerender } = renderAnswer({ backups: nearbyBeaches.slice(0, 2) });

    expect(screen.getByText("Nearby backups")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Swami's|Ocean Beach/ })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Pipeline" })).not.toBeInTheDocument();

    rerender(
      <PublicForecastAnswer
        beach={beach}
        report={report}
        context={context}
        isTomorrow={false}
        publicDecisionWindow={{
          start: report.bestWindowStart,
          end: report.bestWindowEnd,
        }}
        nearbyBeaches={[]}
        headingLevel="h1"
        returnTo="/ca/san-diego/ocean-beach"
      />,
    );
    expect(screen.queryByText("Nearby backups")).not.toBeInTheDocument();
  });

  it("keeps personalized decisions out of the projected public report", () => {
    const publicReport = selectPublicForecastReportFacts(report);
    const publicContext = selectPublicForecastContextFacts(context);

    expect(publicReport).not.toHaveProperty("verdict");
    expect(publicReport).not.toHaveProperty("bestWindowStart");
    expect(publicReport).not.toHaveProperty("bestWindowEnd");
    expect(publicContext).not.toHaveProperty("displayWindowStart");
    expect(publicContext).not.toHaveProperty("displayWindowEnd");
    expect(publicContext).not.toHaveProperty("displayTimeLabel");
  });

  it("does not combine an authenticated no-candidate call with the public window", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            report: {
              ...report,
              verdict: "NO",
              bestWindowStart: null,
              bestWindowEnd: null,
              score: 0,
              whySentence: "No personalized surf candidate was available for this call.",
            },
            forecastContext: null,
            isTomorrow: false,
          },
        }),
        { status: 200 },
      ),
    );

    renderAnswer({
      publicWindow: {
        start: "2026-08-09T15:00:00.000Z",
        end: "2026-08-09T15:30:00.000Z",
      },
    });

    await waitFor(() => expect(screen.getByText("NO")).toBeInTheDocument());
    expect(screen.getByText(/No personalized surf candidate was available/)).toBeInTheDocument();
    expect(screen.queryByText("8:00 AM–8:30 AM")).not.toBeInTheDocument();
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
    expect(screen.queryByText("0/100")).not.toBeInTheDocument();
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
        publicDecisionWindow={{ start: null, end: null }}
        nearbyBeaches={nearbyBeaches.slice(0, 2)}
        headingLevel="h1"
        returnTo="/ca/oceanside/oceanside-harbor"
      />,
    );

    expect(screen.getByRole("heading", {
      level: 1,
      name: "Oceanside Harbor Surf Forecast",
    })).toBeInTheDocument();
    // The route supplies publicDecisionWindow as an object literal on every beach
    // page, so this empty case is reachable on all 346 of them. It must explain
    // itself rather than render nothing.
    expect(
      screen.getByText(/Current forecast details are temporarily unavailable/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Forecast valid at/)).not.toBeInTheDocument();
    expect(screen.queryByText("Best window")).not.toBeInTheDocument();
    expect(screen.getByText("Nearby backups")).toBeInTheDocument();
  });
});
