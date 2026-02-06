/**
 * Tests for Beach Discovery Card Component
 *
 * Verifies date/time display, card rendering, and user interactions.
 * Critical test: Ensures valid Date objects are formatted correctly.
 *
 * All dates use explicit UTC timestamps so that Intl.DateTimeFormat with
 * "America/Los_Angeles" produces deterministic PST/PDT output regardless
 * of the machine's local timezone.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachDiscoveryCard } from "@/components/discover/beach-discovery-card";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock the personalization hook
jest.mock("@/hooks/use-beach-personalization", () => ({
  useBeachPersonalization: jest.fn(),
}));

import { useBeachPersonalization } from "@/hooks/use-beach-personalization";

describe("BeachDiscoveryCard - Date/Time Display", () => {
  const mockBeach = {
    id: "beach-1",
    name: "Pipeline",
    slug: "pipeline",
    description: "Famous surf spot",
    center_lat: 21.6644,
    center_lng: -158.0531,
    country: "USA",
    region: "Hawaii",
    spot_id: "spot-1",
    primary_swell_window_min: 270,
    primary_swell_window_max: 315,
    photo_url: null,
    photo_attribution: null,
    ideal_wind_direction: "E",
    ideal_tide: "Mid",
    difficulty: "expert",
    break_type: "reef",
    best_seasons: ["winter"],
    hazards: ["shallow reef"],
    facilities: [],
    camping: false,
    parking: null,
    crowd_level: "very-crowded",
    timezone: "Pacific/Honolulu",
    created_at: new Date().toISOString(),
  } as any;

  const createMockRecommendation = (
    startDate: Date,
    endDate: Date,
    overrides: Partial<SurfDiscoveryRecommendation> = {}
  ): SurfDiscoveryRecommendation => ({
    beach: mockBeach,
    forecast: {} as EnhancedForecastEntity,
    score: 85,
    matchQuality: "excellent",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 15,
      windAlignment: 15,
      tideFit: 10,
      affinityBonus: 10,
      distancePenalty: 0,
    },
    window: {
      start: startDate,
      end: endDate,
      tide: "Rising",
      wind: "10 mph E",
      waveHeight: "4-5 ft",
      wavePeriod: "12s",
      dataSource: "CDIP",
      confidence: 85,
      timezone: "America/Los_Angeles",
    },
    // Summary no longer contains embedded "Best at {time}" - time is formatted by UI
    summary: "Excellent match at Pipeline - 4-5 ft with 10 mph E.",
    reasons: ["Good swell direction", "Light offshore wind", "Rising tide"],
    warnings: [],
    generated_at: new Date().toISOString(),
    ...overrides,
  });

  const mockOnPlanSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock personalization hook to return no personalization by default
    (useBeachPersonalization as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  describe("Valid Date Rendering", () => {
    it("should display properly formatted date range with valid Date objects", () => {
      // 4:00 PM PST = UTC midnight Jan 16, 7:00 PM PST = UTC 3:00 AM Jan 16
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Should display formatted time range
      const timeRange = screen.getByText(/Wed 4:00 PM - 7:00 PM/);
      expect(timeRange).toBeInTheDocument();
    });

    it("should NOT display 'Invalid Date' in time range", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Should NOT contain "Invalid Date" anywhere
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    });

    it("should display different start and end times (not same time twice)", () => {
      // 4:00 PM PST = UTC midnight, 7:00 PM PST = UTC 3:00 AM
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Component formats via formatBeachTimeRange with "America/Los_Angeles" timezone
      const timeRangeText = "Wed 4:00 PM - 7:00 PM";
      expect(screen.getByText(timeRangeText)).toBeInTheDocument();
    });

    it("should display summary text from recommendation", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      // Summary no longer contains embedded time - time is formatted separately by UI
      const summary = "Excellent match at Pipeline - 4-5 ft with 10 mph E.";
      const recommendation = createMockRecommendation(startDate, endDate, {
        summary,
      });

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Summary should be displayed as-is (without embedded time)
      expect(
        screen.getByText(/Excellent match at Pipeline/)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle early morning times (e.g., 6:00 AM)", () => {
      // 6:00 AM PST = 14:00 UTC, 9:00 AM PST = 17:00 UTC
      const startDate = new Date("2025-01-15T14:00:00Z");
      const endDate = new Date("2025-01-15T17:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Should display morning time correctly
      expect(screen.getByText(/Wed 6:00 AM - 9:00 AM/)).toBeInTheDocument();
    });

    it("should handle times crossing midnight (e.g., 11 PM - 2 AM)", () => {
      // 11:00 PM PST Jan 15 = 07:00 UTC Jan 16, 2:00 AM PST Jan 16 = 10:00 UTC Jan 16
      const startDate = new Date("2025-01-16T07:00:00Z");
      const endDate = new Date("2025-01-16T10:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // When crossing midnight, formatBeachTimeRange shows weekday on both for clarity
      // e.g., "Wed 11:00 PM - Thu 2:00 AM"
      expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
      // Look for PM/AM pattern to verify time is displayed
      expect(
        screen.getByText(/\d{1,2}:\d{2}\s(AM|PM)\s-\s/i)
      ).toBeInTheDocument();
    });

    it("should handle noon times (12:00 PM)", () => {
      // 12:00 PM PST = 20:00 UTC, 3:00 PM PST = 23:00 UTC
      const startDate = new Date("2025-01-15T20:00:00Z");
      const endDate = new Date("2025-01-15T23:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Should display noon correctly
      expect(screen.getByText(/Wed 12:00 PM - 3:00 PM/)).toBeInTheDocument();
    });
  });

  describe("Component Structure and Interactions", () => {
    it("should render beach name", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      expect(screen.getByText("Pipeline")).toBeInTheDocument();
    });

    it("should display score and match quality", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      expect(screen.getByText("85")).toBeInTheDocument();
      expect(screen.getByText("Excellent")).toBeInTheDocument();
    });

    it("should show 'Top Pick' badge for rank 1", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      expect(screen.getByText("Top Pick")).toBeInTheDocument();
      // Source label should be shown (CDIP/NOAA_BUOY => Live)
      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("should display wave height and wind conditions", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      expect(screen.getByText("4-5 ft")).toBeInTheDocument();
      expect(screen.getByText("10 mph E")).toBeInTheDocument();
    });

    it("should display reasons when provided", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      expect(screen.getByText("Good swell direction")).toBeInTheDocument();
      expect(screen.getByText("Light offshore wind")).toBeInTheDocument();
    });

    it("should display warnings when provided", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate, {
        warnings: ["Strong current", "Shallow reef"],
      });

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      expect(screen.getByText("Strong current")).toBeInTheDocument();
      expect(screen.getByText("Shallow reef")).toBeInTheDocument();
    });

    it("should display distance when provided", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate, {
        distanceMiles: 5.7,
      });

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      expect(screen.getByText("6 miles away")).toBeInTheDocument();
    });

    it("should call onPlanSession when Plan Session button is clicked", async () => {
      const user = userEvent.setup();
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      const planButton = screen.getByRole("button", { name: /Plan Session/ });
      await user.click(planButton);

      expect(mockOnPlanSession).toHaveBeenCalledWith("beach-1");
      expect(mockOnPlanSession).toHaveBeenCalledTimes(1);
    });

    it("should render View Beach link to the beach page", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      const viewLink = screen.getByRole("link", { name: /View Beach/ });
      // URL should include tracking param from surf_discovery
      expect(viewLink).toHaveAttribute(
        "href",
        "/beach/pipeline?from=surf_discovery"
      );
    });

    it("should display PersonalizedBadge when personalization is active", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      // Mock personalization hook to return personalized data
      (useBeachPersonalization as jest.Mock).mockReturnValue({
        data: {
          score: 92,
          personalized: true,
          breakdown: {
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 5,
            affinity: 2,
          },
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Should display the personalized badge
      expect(
        screen.getByTestId("personalized-badge-container")
      ).toBeInTheDocument();
      expect(screen.getByText("92% Match")).toBeInTheDocument();
    });

    it("should NOT display PersonalizedBadge when personalization is not active", () => {
      const startDate = new Date("2025-01-16T00:00:00Z");
      const endDate = new Date("2025-01-16T03:00:00Z");
      const recommendation = createMockRecommendation(startDate, endDate);

      // Default mock already returns null data (no personalization)

      render(
        <BeachDiscoveryCard
          recommendation={recommendation}
          rank={1}
          onPlanSession={mockOnPlanSession}
        />
      );

      // Should NOT display the personalized badge
      expect(
        screen.queryByTestId("personalized-badge-container")
      ).not.toBeInTheDocument();
    });
  });
});
