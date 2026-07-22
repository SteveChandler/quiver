jest.mock("@/hooks/use-beach-detail-data", () => ({
  useBeachDetailData: jest.fn(),
}));
jest.mock("@/hooks/use-forecast-calibration", () => ({
  useForecastCalibration: jest.fn(() => ({ sessionSnapshots: [] })),
}));
jest.mock("@/actions/accuracy-actions", () => ({
  getYesterdayAccuracy: jest.fn(async () => null),
}));
jest.mock("@/hooks/use-intel-data", () => ({
  useIntelData: () => ({
    data: { posts: [] },
    posts: [],
    loading: false,
    error: null,
    hasData: false,
    refetch: jest.fn(),
    updateFilters: jest.fn(),
  }),
  useNearbyIntelData: () => ({
    data: { posts: [] },
    posts: [],
    loading: false,
    error: null,
    hasData: false,
    refetch: jest.fn(),
    updateFilters: jest.fn(),
  }),
}));
jest.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => <button data-testid="favorite-mock" />,
}));
jest.mock("@/components/home/HomeBeachBanner", () => ({
  HomeBeachBanner: () => <div data-testid="home-beach-banner" />,
}));
jest.mock("@/components/beach-detail/beach-alert-cta", () => ({
  BeachAlertCta: ({ beachId, beachName, compact }: any) => (
    <button
      data-testid={compact ? "beach-alert-cta-compact" : "beach-alert-cta"}
      data-beach-id={beachId}
    >
      Alerts for {beachName}
    </button>
  ),
}));
const mockSessionIntelligencePilot = jest.fn((_props: unknown) => null);
jest.mock("@/components/beach-detail/session-intelligence-pilot", () => ({
  SessionIntelligencePilot: (props: unknown) =>
    mockSessionIntelligencePilot(props),
}));
jest.mock("@/components/beach-detail/tabs/forecast-tab", () => {
  const React = require("react");

  return {
    ForecastTab: () =>
      React.createElement("div", { "data-testid": "forecast-tab" }),
  };
});

import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { useBeachDetailData } from "@/hooks/use-beach-detail-data";
import { useForecastCalibration } from "@/hooks/use-forecast-calibration";
import { getYesterdayAccuracy } from "@/actions/accuracy-actions";
import { BeachDetail } from "@/components/beach-detail";

// Helper to mock useBeachDetailData
function mockBeachDetailData(
  beach: any,
  loading: boolean,
  error: string | null
) {
  const fn = useBeachDetailData as unknown as jest.Mock;
  fn.mockReturnValue({
    beach: beach || null,
    forecasts: [],
    sources: null,
    loading,
    errors: {
      beach: error,
      forecasts: null,
      sources: null,
    },
    refetch: jest.fn(),
  });
  return fn;
}

describe("BeachDetail loading and error guards", () => {
  afterEach(() => {
    // Keep module mocks from jest.setup.js (e.g., useAuth) intact
    jest.clearAllMocks();
  });

  it("shows loader while loading and not error", () => {
    const spy = mockBeachDetailData(null, true, null);

    render(<BeachDetail id="beach-1" />);

    expect(screen.getByText(/Checking the lineup/i)).toBeInTheDocument();
    expect(screen.queryByText(/Beach data not found/i)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("shows error when finished loading and beach missing", () => {
    const spy = mockBeachDetailData(null, false, "Failed");

    render(<BeachDetail id="beach-1" />);

    // Assert the error UI by its recovery CTA for stability
    expect(
      screen.getByRole("button", { name: /Back to Map/i })
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("renders when beach exists even if forecasts empty", async () => {
    const beach = {
      id: "beach-1",
      name: "Test Beach",
      slug: "test-beach",
      lat: 0,
      lon: 0,
      city: "Test City",
      state: "CA",
      country: "USA",
      break_type: "Beach Break",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    const spy = mockBeachDetailData(beach, false, null);

    render(<BeachDetail id="beach-1" />);
    await screen.findByTestId("forecast-tab");

    // Assert the beach name is rendered to confirm content is present.
    // Zine rebuild (2026-04-28) changed the H1 from "{name} Surf Report" to "{name}".
    expect(
      screen.getByRole("heading", { name: "Test Beach" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Beach data not found/i)).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("does not start secondary calibration or accuracy fetches during initial render", async () => {
    const beach = {
      id: "beach-1",
      name: "Test Beach",
      slug: "test-beach",
      lat: 0,
      lon: 0,
      city: "Test City",
      state: "CA",
      country: "USA",
      break_type: "Beach Break",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    mockBeachDetailData(beach, false, null);

    render(<BeachDetail id="beach-1" />);

    expect(useForecastCalibration).toHaveBeenCalledWith({
      beachId: undefined,
    });
    expect(getYesterdayAccuracy).not.toHaveBeenCalled();
    await screen.findByTestId("forecast-tab");
  });

  it("keeps below-fold beach detail work behind streaming or idle gates", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/beach/[slug]/page.tsx"),
      "utf8",
    );
    const clientSource = readFileSync(
      join(process.cwd(), "app/beach/[slug]/beach-detail-client.tsx"),
      "utf8",
    );
    const detailSource = readFileSync(
      join(process.cwd(), "components/beach-detail.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("<Suspense fallback={null}>");
    expect(pageSource).toContain("<DeferredNearbyBeaches beach={beach} />");
    expect(clientSource).toContain("requestIdleCallback(run");
    expect(detailSource).toContain("secondaryDataReady && activeTab === \"sessions\"");
    expect(detailSource).toContain("secondaryDataReady && activeTab === \"forecast\"");
    expect(detailSource).toContain("if (!beach || !secondaryDataReady) return;");
  });

  it("keeps the condition alert CTA visible on beach detail", async () => {
    const beach = {
      id: "beach-1",
      name: "Test Beach",
      slug: "test-beach",
      lat: 0,
      lon: 0,
      city: "Test City",
      state: "CA",
      country: "USA",
      break_type: "Beach Break",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    mockBeachDetailData(beach, false, null);

    render(<BeachDetail id="beach-1" />);
    await screen.findByTestId("forecast-tab");

    expect(screen.getAllByText("Alerts for Test Beach").length).toBeGreaterThan(0);
  });

  it("passes authoritative surf-call availability to session intelligence", async () => {
    const beach = {
      id: "beach-1",
      name: "Test Beach",
      slug: "test-beach",
      lat: 0,
      lon: 0,
      city: "Test City",
      state: "CA",
      country: "USA",
      break_type: "Beach Break",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    mockBeachDetailData(beach, false, null);
    const recommendationAvailability = {
      state: "none",
      reasonCode: "major_event_hold",
      holdEpoch: "hold-epoch",
    } as const;

    render(
      <BeachDetail
        id="beach-1"
        surfCallReport={{ recommendationAvailability } as any}
      />,
    );
    await screen.findByTestId("forecast-tab");

    expect(mockSessionIntelligencePilot).toHaveBeenCalledWith(
      expect.objectContaining({ recommendationAvailability }),
    );
  });
});
