import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import { TideWarningBanner } from "@/components/forecast/tide-warning-banner";
import { TideVerifiedBadge } from "@/components/forecast/tide-verified-badge";
import { TideNextExtreme } from "@/components/forecast/tide-next-extreme";
import {
  TideHourlyTable,
  TideHourlyTableCompact,
} from "@/components/forecast/tide-hourly-table";
import { TideDiagnosticsPanel } from "@/components/forecast/tide-diagnostics-panel";
import type {
  TideWarning,
  TideDiagnostics,
  TideHourlyPoint,
} from "@/types/tide-diagnostics";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("TideWarningBanner", () => {
  const mockWarnings: TideWarning[] = [
    {
      type: "fallback_station",
      message: "Using fallback station",
      severity: "info",
      dismissible: true,
    },
  ];

  it("renders warnings correctly", () => {
    render(<TideWarningBanner warnings={mockWarnings} />);

    expect(screen.getByText("Using fallback station")).toBeInTheDocument();
  });

  it("renders nothing when warnings array is empty", () => {
    const { container } = render(<TideWarningBanner warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("allows dismissing warnings", () => {
    const onDismiss = jest.fn();
    render(<TideWarningBanner warnings={mockWarnings} onDismiss={onDismiss} />);

    const dismissButtons = screen.getAllByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissButtons[0]);

    // Warning should be hidden after dismissal
    expect(screen.queryByText("Using fallback station")).not.toBeInTheDocument();
  });

  it("sorts warnings by severity", () => {
    const mixedWarnings: TideWarning[] = [
      { type: "partial_data", message: "Info message", severity: "info", dismissible: false },
      { type: "api_error", message: "Error message", severity: "error", dismissible: false },
      { type: "partial_data", message: "Warning message", severity: "warning", dismissible: false },
    ];

    render(<TideWarningBanner warnings={mixedWarnings} />);

    const alerts = screen.getAllByRole("alert");
    // Error should be first
    expect(alerts[0]).toHaveTextContent("Error message");
  });
});

describe("TideVerifiedBadge", () => {
  it('renders verified status correctly', () => {
    render(
      <TideVerifiedBadge
        status="verified"
        tooltip="All checks passed"
        confidenceScore={95}
      />
    );

    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it('renders partial status correctly', () => {
    render(
      <TideVerifiedBadge
        status="partial"
        tooltip="Some issues detected"
        confidenceScore={70}
      />
    );

    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it('renders unverified status correctly', () => {
    render(
      <TideVerifiedBadge
        status="unverified"
        tooltip="Data quality issues"
        confidenceScore={30}
      />
    );

    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("shows confidence score when enabled", () => {
    render(
      <TideVerifiedBadge
        status="verified"
        tooltip=""
        confidenceScore={89}
        showConfidence
      />
    );

    expect(screen.getByText("89%")).toBeInTheDocument();
  });
});

describe("TideNextExtreme", () => {
  const now = new Date();
  const nextHigh = {
    time: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3 hours from now
    height: 5.2,
  };
  const nextLow = {
    time: new Date(now.getTime() + 9 * 60 * 60 * 1000), // 9 hours from now
    height: 0.8,
  };

  it("renders next high and low tides", () => {
    render(
      <TideNextExtreme
        nextHigh={nextHigh}
        nextLow={nextLow}
        minutesToHigh={180}
        minutesToLow={540}
        now={now}
      />
    );

    expect(screen.getByText(/High Tide/i)).toBeInTheDocument();
    expect(screen.getByText(/Low Tide/i)).toBeInTheDocument();
    // formatTideHeight now returns combined strings like "5.2ft" and "0.8ft"
    expect(screen.getByText("5.2ft")).toBeInTheDocument();
    expect(screen.getByText("0.8ft")).toBeInTheDocument();
  });

  it("orders cards by soonest tide first (low before high when low is sooner)", () => {
    const laterHigh = {
      time: new Date(now.getTime() + 9 * 60 * 60 * 1000),
      height: 5.2,
    };
    const soonerLow = {
      time: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      height: 0.8,
    };

    render(
      <TideNextExtreme
        nextHigh={laterHigh}
        nextLow={soonerLow}
        minutesToHigh={540}
        minutesToLow={180}
        now={now}
      />
    );

    const cardsContainer = screen.getByTestId("next-tides-cards");
    const cards = Array.from(cardsContainer.children);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute("data-testid", "next-tide-low");
    expect(cards[1]).toHaveAttribute("data-testid", "next-tide-high");
  });

  it("shows duration until next tide", () => {
    render(
      <TideNextExtreme
        nextHigh={nextHigh}
        nextLow={nextLow}
        minutesToHigh={180}
        minutesToLow={540}
        now={now}
      />
    );

    expect(screen.getByText(/in 3h/)).toBeInTheDocument();
    expect(screen.getByText(/in 9h/)).toBeInTheDocument();
  });

  it("renders nothing when no data", () => {
    const { container } = render(
      <TideNextExtreme
        nextHigh={null}
        nextLow={null}
        minutesToHigh={null}
        minutesToLow={null}
        now={now}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe("TideHourlyTable", () => {
  const now = new Date();
  const mockData: TideHourlyPoint[] = [
    { time: new Date(now), height: 3.2, trend: "rising", isCurrent: true },
    { time: new Date(now.getTime() + 3600000), height: 4.1, trend: "rising" },
    { time: new Date(now.getTime() + 7200000), height: 4.8, trend: "peak", isHigh: true },
    { time: new Date(now.getTime() + 10800000), height: 4.5, trend: "falling" },
    { time: new Date(now.getTime() + 14400000), height: 3.8, trend: "falling" },
  ];

  it("renders table with correct number of rows", () => {
    render(<TideHourlyTable data={mockData} now={now} />);

    const rows = screen.getAllByTestId("tide-table-row");
    expect(rows).toHaveLength(5);
  });

  it("highlights current hour", () => {
    render(<TideHourlyTable data={mockData} now={now} />);

    expect(screen.getByText("(Now)")).toBeInTheDocument();
  });

  it("marks high tide rows", () => {
    render(<TideHourlyTable data={mockData} now={now} />);

    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<TideHourlyTable data={[]} now={now} />);

    expect(screen.getByText(/No hourly tide data available/)).toBeInTheDocument();
  });

  it("limits rows to maxRows", () => {
    render(<TideHourlyTable data={mockData} now={now} maxRows={3} />);

    const rows = screen.getAllByTestId("tide-table-row");
    expect(rows).toHaveLength(3);
  });

  it("keeps the hourly table horizontally scrollable and keyboard reachable", () => {
    render(<TideHourlyTable data={mockData} now={now} />);

    const scrollRegion = screen.getByTestId("tide-hourly-table-scroll");

    expect(scrollRegion).toHaveClass("overflow-x-auto");
    expect(scrollRegion).not.toHaveClass("overflow-hidden");
    expect(scrollRegion).toHaveAttribute("role", "region");
    expect(scrollRegion).toHaveAttribute("aria-label", "Hourly tide data");
    expect(scrollRegion).toHaveAttribute("tabIndex", "0");
  });
});

describe("TideHourlyTableCompact", () => {
  const now = new Date();
  const mockData: TideHourlyPoint[] = [
    { time: new Date(now), height: 3.2, trend: "rising" },
    { time: new Date(now.getTime() + 3600000), height: 4.1, trend: "rising" },
    { time: new Date(now.getTime() + 7200000), height: 4.8, trend: "peak", isHigh: true },
    { time: new Date(now.getTime() + 10800000), height: 4.5, trend: "falling" },
  ];

  it("uses one column on small screens and two columns from md up", () => {
    render(<TideHourlyTableCompact data={mockData} now={now} />);

    const grid = screen.getByTestId("tide-hourly-table-compact-grid");

    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2");
  });

  it("keeps both compact tables horizontally scrollable and keyboard reachable", () => {
    render(<TideHourlyTableCompact data={mockData} now={now} />);

    const scrollRegions = [
      screen.getByTestId("tide-hourly-table-compact-left-scroll"),
      screen.getByTestId("tide-hourly-table-compact-right-scroll"),
    ];

    scrollRegions.forEach((scrollRegion) => {
      expect(scrollRegion).toHaveClass("overflow-x-auto");
      expect(scrollRegion).not.toHaveClass("overflow-hidden");
      expect(scrollRegion).toHaveAttribute("role", "region");
      expect(scrollRegion).toHaveAttribute("aria-label");
      expect(scrollRegion).toHaveAttribute("tabIndex", "0");
    });
  });
});

describe("TideDiagnosticsPanel", () => {
  const mockDiagnostics: TideDiagnostics = {
    stationId: "9410170",
    stationName: "San Diego",
    isPrimaryStation: true,
    beachName: "Ocean Beach",
    datum: "MLLW",
    units: "feet",
    timezone: "GMT→America/Los_Angeles (UTC-8)",
    nowHeightFromSource: 3.5,
    nowHeightInterpolated: 3.48,
    interpolationMethod: "linear",
    nextHigh: { time: new Date(), height: 5.2 },
    nextLow: { time: new Date(), height: 0.8 },
    minutesToNextHigh: 180,
    minutesToNextLow: 540,
    rawSample: [
      { t: "2025-12-19 05:11", v: "3.71", type: "H" },
      { t: "2025-12-19 09:33", v: "2.52", type: "L" },
    ],
    totalPredictions: 15,
    sourceUrl: "https://api.tidesandcurrents.noaa.gov/...",
    stationPageUrl: "https://tidesandcurrents.noaa.gov/...",
    dataFreshness: "fresh",
    lastFetchTime: new Date(),
    cacheHit: false,
    cacheTtlRemaining: 1800,
    isValidated: true,
    validationErrors: [],
    verificationStatus: "verified",
    confidenceScore: 95,
  };

  it("renders header correctly", () => {
    render(
      <TideDiagnosticsPanel
        diagnostics={mockDiagnostics}
        isOpen={false}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText("NOAA CO-OPS Tide Data")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("expands when clicked", () => {
    const onToggle = jest.fn();
    render(
      <TideDiagnosticsPanel
        diagnostics={mockDiagnostics}
        isOpen={false}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("shows station details when expanded", () => {
    render(
      <TideDiagnosticsPanel
        diagnostics={mockDiagnostics}
        isOpen={true}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText(/San Diego/)).toBeInTheDocument();
    expect(screen.getByText(/9410170/)).toBeInTheDocument();
    expect(screen.getByText(/MLLW/)).toBeInTheDocument();
  });

  it("shows raw sample when expanded", () => {
    render(
      <TideDiagnosticsPanel
        diagnostics={mockDiagnostics}
        isOpen={true}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText("2025-12-19 05:11")).toBeInTheDocument();
    expect(screen.getByText("3.71")).toBeInTheDocument();
  });

  it("shows validation errors when present", () => {
    const diagnosticsWithErrors = {
      ...mockDiagnostics,
      isValidated: false,
      validationErrors: ["Failed to fetch tide data"],
      verificationStatus: "unverified" as const,
    };

    render(
      <TideDiagnosticsPanel
        diagnostics={diagnosticsWithErrors}
        isOpen={true}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText("Failed to fetch tide data")).toBeInTheDocument();
    expect(screen.getByText("Validation Errors")).toBeInTheDocument();
  });

  it("shows success message when validation passes", () => {
    render(
      <TideDiagnosticsPanel
        diagnostics={mockDiagnostics}
        isOpen={true}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText("All validation checks passed")).toBeInTheDocument();
  });
});
