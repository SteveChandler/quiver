import { render, screen } from "@testing-library/react";
import { SpotSurfReport } from "@/components/spots/spot-surf-report";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

const mockUseAuth = jest.fn();
jest.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

function makeReport(overrides: Partial<SurfCallResult> = {}): SurfCallResult {
  return {
    verdict: "YES",
    bestWindowStart: "2025-01-15T13:00:00Z",
    bestWindowEnd: "2025-01-15T15:00:00Z",
    windowMinutes: 120,
    shortWindow: false,
    waveHeight: "3-5 ft",
    windDescription: "Light offshore",
    windSpeed: "5-8 mph",
    windCompass: "NE",
    windType: "offshore",
    tideDescription: "Rising",
    tidePhase: "rising",
    nextTideType: "high",
    nextTideAt: "2025-01-15T14:30:00Z",
    whySentence: "Clean conditions with light offshore winds.",
    forecastConfidence: 0.85,
    lowForecastConfidence: false,
    score: 75,
    peakTime: null,
    trendTags: [],
    updatedAt: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

describe("SpotSurfReport", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
  });

  describe("Auth-aware sign-in link", () => {
    it("shows sign-in link when not authenticated", () => {
      mockUseAuth.mockReturnValue({ user: null });
      render(
        <SpotSurfReport
          report={makeReport()}
          spotName="Blacks Beach"
        />
      );

      const link = screen.getByText("Sign in for your call (board + level)");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", "/auth/sign-in");
    });

    it("hides sign-in link when authenticated", () => {
      mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
      render(
        <SpotSurfReport
          report={makeReport()}
          spotName="Blacks Beach"
        />
      );

      expect(
        screen.queryByText("Sign in for your call (board + level)")
      ).not.toBeInTheDocument();
    });
  });

  describe("Best window display based on verdict", () => {
    it("shows Best window label when verdict is YES", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "YES" })} spotName="Swamis" />
      );

      expect(screen.getByText("Best window")).toBeInTheDocument();
    });

    it("shows Best window label when verdict is MAYBE", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "MAYBE" })} spotName="Swamis" />
      );

      expect(screen.getByText("Best window")).toBeInTheDocument();
    });

    it("hides Best window label when verdict is NO", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "NO" })} spotName="Swamis" />
      );

      expect(screen.queryByText("Best window")).not.toBeInTheDocument();
    });

    it("still shows wave height when verdict is NO", () => {
      render(
        <SpotSurfReport
          report={makeReport({ verdict: "NO", waveHeight: "1-2 ft" })}
          spotName="Swamis"
        />
      );

      expect(screen.getByText("1-2 ft")).toBeInTheDocument();
    });

    it("still shows wind info when verdict is NO", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            windSpeed: "15-20 mph",
            windCompass: "SW",
            windType: "onshore",
          })}
          spotName="Swamis"
        />
      );

      expect(screen.getByText("SW 15-20 mph (onshore)")).toBeInTheDocument();
    });

    it("still shows tide info when verdict is NO", () => {
      render(
        <SpotSurfReport
          report={makeReport({ verdict: "NO", tidePhase: "falling" })}
          spotName="Swamis"
        />
      );

      expect(screen.getByText(/Falling/)).toBeInTheDocument();
    });
  });

  describe("Separator rendering", () => {
    it("renders no separators when only wave height exists", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: "3 ft",
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: null,
          })}
          spotName="Test"
        />
      );

      expect(screen.getByText("3 ft")).toBeInTheDocument();
      expect(screen.queryByText("·")).not.toBeInTheDocument();
    });

    it("renders separator between wave height and wind", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: "3 ft",
            windSpeed: "10 mph",
            windCompass: "N",
            windType: null,
            tidePhase: null,
          })}
          spotName="Test"
        />
      );

      expect(screen.getByText("3 ft")).toBeInTheDocument();
      expect(screen.getByText("N 10 mph")).toBeInTheDocument();
      expect(screen.getAllByText("·")).toHaveLength(1);
    });

    it("renders no leading separator when only wind exists with NO verdict", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: "2025-01-15T13:00:00Z",
            bestWindowEnd: "2025-01-15T15:00:00Z",
            waveHeight: null,
            windSpeed: "10 mph",
            windCompass: "N",
            windType: null,
            tidePhase: null,
          })}
          spotName="Test"
        />
      );

      expect(screen.getByText("N 10 mph")).toBeInTheDocument();
      expect(screen.queryByText("·")).not.toBeInTheDocument();
    });

    it("renders no leading separator when only tide exists with NO verdict", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: "2025-01-15T13:00:00Z",
            bestWindowEnd: "2025-01-15T15:00:00Z",
            waveHeight: null,
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: "rising",
            nextTideType: null,
            nextTideAt: null,
          })}
          spotName="Test"
        />
      );

      expect(screen.getByText("Rising")).toBeInTheDocument();
      expect(screen.queryByText("·")).not.toBeInTheDocument();
    });

    it("renders separators between all items for YES verdict", () => {
      render(
        <SpotSurfReport
          report={makeReport({ verdict: "YES" })}
          spotName="Test"
        />
      );

      // Best window + wave height + wind + tide = 3 separators
      expect(screen.getAllByText("·")).toHaveLength(3);
    });
  });

  describe("General rendering", () => {
    it("renders the verdict badge", () => {
      render(
        <SpotSurfReport report={makeReport({ verdict: "YES" })} spotName="Test" />
      );

      expect(screen.getByText("YES")).toBeInTheDocument();
    });

    it("renders why sentence", () => {
      render(
        <SpotSurfReport
          report={makeReport({ whySentence: "Good conditions expected." })}
          spotName="Test"
        />
      );

      expect(screen.getByText("Good conditions expected.")).toBeInTheDocument();
    });

    it("renders tomorrow heading when isTomorrow is true", () => {
      render(
        <SpotSurfReport
          report={makeReport()}
          spotName="Test"
          isTomorrow={true}
        />
      );

      expect(screen.getByText("Tomorrow\u2019s Surf Call")).toBeInTheDocument();
    });

    it("renders today heading by default", () => {
      render(
        <SpotSurfReport report={makeReport()} spotName="Test" />
      );

      expect(screen.getByText("Today\u2019s Surf Call")).toBeInTheDocument();
    });

    it("does not render conditions row when no data exists", () => {
      render(
        <SpotSurfReport
          report={makeReport({
            verdict: "NO",
            bestWindowStart: null,
            bestWindowEnd: null,
            waveHeight: null,
            windSpeed: null,
            windDescription: "Unknown",
            tidePhase: null,
          })}
          spotName="Test"
        />
      );

      // Only heading and verdict should exist, no conditions
      const section = screen.getByRole("region");
      expect(section.querySelectorAll(".mt-4")).toHaveLength(0);
    });
  });
});
