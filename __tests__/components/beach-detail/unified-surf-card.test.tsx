import React from "react";
import { render, screen } from "@testing-library/react";
import { UnifiedSurfCard } from "@/components/beach-detail/unified-surf-card";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

// Mock time formatting utilities
jest.mock("@/lib/utils/time-formatting", () => ({
  formatTimeInTimezone: jest.fn((_date, _tz) => "8:00 AM"),
  formatTimeCasual: jest.fn(() => "around 9am"),
}));

// Mock share utilities
jest.mock("@/lib/share/build-share-card-url", () => ({
  buildSurfCallShareUrl: jest.fn(() => "https://share-url.com/surf-call"),
}));

// Mock share sheet component
jest.mock("@/components/share/share-sheet", () => ({
  ShareSheet: () => <div data-testid="share-sheet" />,
}));

// Mock UI components - must include ALL named exports used by the component
jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="surf-card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock icons used by the component
jest.mock("lucide-react", () => ({
  Clock: () => <svg data-testid="clock-icon" />,
  AlertCircle: () => <svg data-testid="alert-circle-icon" />,
  Share2: () => <svg data-testid="share2-icon" />,
}));

describe("UnifiedSurfCard", () => {
  // SurfCallResult uses string | null for dates, not Date objects
  const createMockSurfCall = (
    overrides: Partial<SurfCallResult> = {}
  ): SurfCallResult => ({
    verdict: "YES",
    bestWindowStart: "2026-02-10T08:00:00",
    bestWindowEnd: "2026-02-10T11:00:00",
    peakTime: "2026-02-10T09:30:00",
    windowMinutes: 180,
    shortWindow: false,
    lowForecastConfidence: false,
    forecastConfidence: 0.85,
    score: 75,
    waveHeight: "3-4 ft",
    windDescription: "Light offshore",
    windSpeed: "5 mph",
    windCompass: "NE",
    windType: "offshore",
    tideDescription: "Rising mid tide",
    tidePhase: "rising",
    tideHeight: null,
    nextTideType: "high",
    nextTideAt: "2026-02-10T14:00:00",
    trendTags: [],
    whySentence: "Clean conditions with light offshore winds.",
    updatedAt: "2026-02-10T06:00:00",
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("YES Verdict", () => {
    it("shows 'Best Time to Surf Today' for YES verdict", () => {
      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/Best Time to Surf Today/i)).toBeInTheDocument();
    });

    it("shows window time range for YES verdict", () => {
      const { formatTimeInTimezone } = require("@/lib/utils/time-formatting");
      formatTimeInTimezone.mockImplementation((dateStr: string, _tz: string) => {
        if (dateStr === "2026-02-10T06:00:00") return "6:00 AM";
        if (dateStr === "2026-02-10T08:00:00") return "8:00 AM";
        if (dateStr === "2026-02-10T11:00:00") return "11:00 AM";
        return "12:00 PM";
      });

      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/8:00 AM/)).toBeInTheDocument();
      expect(screen.getByText(/11:00 AM/)).toBeInTheDocument();
    });

    it("shows conditions text for YES verdict", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        waveHeight: "4-5 ft",
        windDescription: "Light offshore",
        tidePhase: "rising",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/4-5 ft/)).toBeInTheDocument();
      expect(screen.getByText(/Light offshore/)).toBeInTheDocument();
      expect(screen.getByText(/Rising/)).toBeInTheDocument();
    });

    it("shows whySentence for YES verdict", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        whySentence: "Perfect glassy conditions with clean swell.",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(
        screen.getByText("Perfect glassy conditions with clean swell.")
      ).toBeInTheDocument();
    });
  });

  describe("NO Verdict", () => {
    it("shows 'No good surf window today' for NO verdict", () => {
      const surfCall = createMockSurfCall({
        verdict: "NO",
        whySentence: "Onshore winds all day.",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(
        screen.getByText(/No good surf window today/i)
      ).toBeInTheDocument();
    });

    it("shows whySentence for NO verdict", () => {
      const surfCall = createMockSurfCall({
        verdict: "NO",
        whySentence: "Strong onshore winds and choppy conditions.",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(
        screen.getByText("Strong onshore winds and choppy conditions.")
      ).toBeInTheDocument();
    });

    it("does not show time window UI for NO verdict", () => {
      const surfCall = createMockSurfCall({
        verdict: "NO",
        whySentence: "Poor conditions all day.",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      // NO verdict renders a simpler card without "Window" heading
      expect(screen.queryByText("Window")).not.toBeInTheDocument();
    });
  });

  describe("Tomorrow vs Today", () => {
    it("shows 'tomorrow' instead of 'today' for YES verdict when isTomorrow=true", () => {
      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
          isTomorrow={true}
        />
      );

      expect(
        screen.getByText(/Best Time to Surf Tomorrow/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Best Time to Surf Today/i)
      ).not.toBeInTheDocument();
    });

    it("shows 'tomorrow' instead of 'today' for NO verdict when isTomorrow=true", () => {
      const surfCall = createMockSurfCall({
        verdict: "NO",
        whySentence: "Poor conditions.",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
          isTomorrow={true}
        />
      );

      expect(
        screen.getByText(/No good surf window tomorrow/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/No good surf window today/i)
      ).not.toBeInTheDocument();
    });

    it("defaults to 'today' when isTomorrow is not provided", () => {
      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/Best Time to Surf Today/i)).toBeInTheDocument();
    });
  });

  describe("Trend Tags", () => {
    it("renders trend tag spans for each trendTag", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        trendTags: ["Winds Dropping", "Clean Swell"],
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText("Winds Dropping")).toBeInTheDocument();
      expect(screen.getByText("Clean Swell")).toBeInTheDocument();
    });

    it("does not render trend tag section when trendTags is empty", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        trendTags: [],
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(
        screen.queryByLabelText("Condition trends")
      ).not.toBeInTheDocument();
    });

    it("renders single trend tag", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        trendTags: ["Winds Dropping"],
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText("Winds Dropping")).toBeInTheDocument();
      const list = screen.getByLabelText("Condition trends");
      expect(list.querySelectorAll("li")).toHaveLength(1);
    });
  });

  describe("Confidence and Window Indicators", () => {
    it("shows low confidence warning when lowForecastConfidence=true", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        lowForecastConfidence: true,
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/Low Confidence/i)).toBeInTheDocument();
    });

    it("does not show low confidence warning when lowForecastConfidence=false", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        lowForecastConfidence: false,
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.queryByText(/Low Confidence/i)).not.toBeInTheDocument();
    });

    it("shows short window indicator when shortWindow=true", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        shortWindow: true,
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/Short window/i)).toBeInTheDocument();
    });

    it("does not show short window indicator when shortWindow=false", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        shortWindow: false,
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.queryByText(/Short window/i)).not.toBeInTheDocument();
    });

    it("shows both indicators when both lowForecastConfidence and shortWindow are true", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        lowForecastConfidence: true,
        shortWindow: true,
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/Low Confidence/i)).toBeInTheDocument();
      expect(screen.getByText(/Short window/i)).toBeInTheDocument();
    });
  });

  describe("Peak Time Display", () => {
    it("shows 'Best at' text for windows > 180 minutes with peakTime", () => {
      const { formatTimeCasual } = require("@/lib/utils/time-formatting");
      formatTimeCasual.mockReturnValue("around 9:30am");

      const surfCall = createMockSurfCall({
        verdict: "YES",
        windowMinutes: 240, // 4 hours, > 180
        peakTime: "2026-02-10T09:30:00",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.getByText(/Best at/i)).toBeInTheDocument();
      expect(screen.getByText(/around 9:30am/i)).toBeInTheDocument();
    });

    it("does not show 'Best at' for windows <= 180 minutes", () => {
      const surfCall = createMockSurfCall({
        verdict: "YES",
        windowMinutes: 180, // Exactly 3 hours
        peakTime: "2026-02-10T09:30:00",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.queryByText(/Best at/i)).not.toBeInTheDocument();
    });

    it("does not show 'Best at' when peakTime is null", () => {
      const { formatTimeCasual } = require("@/lib/utils/time-formatting");
      formatTimeCasual.mockReturnValue(null);

      const surfCall = createMockSurfCall({
        verdict: "YES",
        windowMinutes: 240,
        peakTime: null,
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      expect(screen.queryByText(/Best at/i)).not.toBeInTheDocument();
    });
  });

  describe("Share Sheet Integration", () => {
    it("renders ShareSheet component", () => {
      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
          beachSlug="test-beach"
        />
      );

      expect(screen.getByTestId("share-sheet")).toBeInTheDocument();
    });

    it("builds share URL with correct parameters", () => {
      const {
        buildSurfCallShareUrl,
      } = require("@/lib/share/build-share-card-url");
      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Ocean Beach"
          beachTimezone="America/Los_Angeles"
          beachSlug="ocean-beach"
        />
      );

      expect(buildSurfCallShareUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          beach: "Ocean Beach",
          verdict: "YES",
        })
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined beachSlug gracefully", () => {
      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
          beachSlug={undefined}
        />
      );

      expect(screen.getByTestId("surf-card")).toBeInTheDocument();
    });

    it("handles undefined beachTimezone gracefully", () => {
      const surfCall = createMockSurfCall({ verdict: "YES" });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone={undefined}
        />
      );

      expect(screen.getByTestId("surf-card")).toBeInTheDocument();
    });

    it("renders MAYBE verdict with valid window like YES", () => {
      const surfCall = createMockSurfCall({
        verdict: "MAYBE",
        whySentence: "Conditions are marginal but potentially surfable.",
      });

      render(
        <UnifiedSurfCard
          surfCall={surfCall}
          beachName="Test Beach"
          beachTimezone="America/Los_Angeles"
        />
      );

      // MAYBE with valid window renders the full card (same as YES)
      expect(screen.getByText(/Best Time to Surf Today/i)).toBeInTheDocument();
      expect(
        screen.getByText("Conditions are marginal but potentially surfable.")
      ).toBeInTheDocument();
    });
  });
});
