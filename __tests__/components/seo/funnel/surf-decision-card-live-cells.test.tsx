import { render, screen } from "@testing-library/react";

import { SurfDecisionCard } from "@/components/seo/funnel/SurfDecisionCard";
import type { SeoDecisionConfig } from "@/lib/seo/funnel-pages";

const mockGetBeachesBySlug = jest.fn();
const mockGetSpotSurfReportPublic = jest.fn();

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachesBySlug: (...args: unknown[]) => mockGetBeachesBySlug(...args),
}));
jest.mock("@/lib/services/spot-surf-report-service", () => ({
  getSpotSurfReportPublic: (...args: unknown[]) => mockGetSpotSurfReportPublic(...args),
}));
jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: () => "America/Los_Angeles",
}));

const decision: SeoDecisionConfig = {
  primarySpotSlug: "scripps-pier",
  fallbackSpotName: "Scripps",
  nearbySpotSlugs: [],
  boardCall: "Start with a fish.",
  wetsuitCall: "Fullsuit most of the year.",
  tideRisk: "The beach shape can get touchy around steeper tide swings.",
  windRisk: "Morning glass is the best bet.",
  crowdParkingNote: "Parking fills early.",
};

function report(overrides: Record<string, unknown>) {
  return {
    report: {
      verdict: "YES",
      score: 62,
      waveHeight: "2-3 ft",
      bestWindowStart: null,
      bestWindowEnd: null,
      peakTime: null,
      windDescription: "Light offshore",
      tideDescription: "Rising mid tide",
      whySentence: "Clean and fun.",
      ...overrides,
    },
  };
}

async function renderCard(): Promise<void> {
  render(await SurfDecisionCard({ decision }));
}

describe("SurfDecisionCard live cells", () => {
  beforeEach(() => {
    mockGetBeachesBySlug.mockResolvedValue({
      success: true,
      data: [{ id: "b1", slug: "scripps-pier", name: "Scripps Pier", lat: 32.86, lon: -117.25 }],
    });
  });

  it("shows the live wind and tide readings when present", async () => {
    mockGetSpotSurfReportPublic.mockResolvedValue(report({}));
    await renderCard();

    expect(screen.getByText("Light offshore")).toBeInTheDocument();
    expect(screen.getByText("Rising mid tide")).toBeInTheDocument();
  });

  it("hides the risk cell instead of showing editorial text as a live reading", async () => {
    mockGetSpotSurfReportPublic.mockResolvedValue(
      report({ windDescription: "Unknown", tideDescription: null }),
    );
    await renderCard();

    expect(screen.getByText("2-3 ft")).toBeInTheDocument();
    expect(screen.queryByText("Wind risk")).not.toBeInTheDocument();
    expect(screen.queryByText("Tide risk")).not.toBeInTheDocument();
    expect(screen.queryByText(decision.windRisk)).not.toBeInTheDocument();
    expect(screen.queryByText(decision.tideRisk)).not.toBeInTheDocument();
  });

  it("keeps the guide text when the card says live conditions are unavailable", async () => {
    mockGetSpotSurfReportPublic.mockResolvedValue(null);
    await renderCard();

    expect(screen.getByText(/Live Quiver conditions are temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByText(decision.windRisk)).toBeInTheDocument();
    expect(screen.getByText(decision.tideRisk)).toBeInTheDocument();
  });
});
