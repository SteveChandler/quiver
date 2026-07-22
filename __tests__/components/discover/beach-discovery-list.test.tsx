/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import { BeachDiscoveryList } from "@/components/discover/beach-discovery-list";
import type { SurfDiscoveryResponse } from "@/types/personalization";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/hooks/use-surf-discovery", () => ({
  useSurfDiscovery: () => ({
    discovery: null,
    loading: false,
    error: null,
    hasRecommendations: false,
  }),
}));

jest.mock("@/components/discover/beach-discovery-card", () => ({
  BeachDiscoveryCard: ({ recommendation }: any) => (
    <a
      data-testid="discovery-recommendation-card"
      href={`/beach/${recommendation.beach.id}`}
    >
      {recommendation.beach.name}
    </a>
  ),
}));

function discoveryResponse(
  recommendationAvailability?: SurfDiscoveryResponse["recommendationAvailability"],
): SurfDiscoveryResponse {
  return {
    recommendations: [
      {
        beach: {
          id: "beach-1",
          name: "Positive Query Beach",
        },
        subscores: { affinityBonus: 0 },
      },
    ],
    searchCriteria: { maxResults: 5 },
    metadata: {
      totalBeachesConsidered: 1,
      successfulForecasts: 1,
      partialSuccess: false,
      failedBeaches: 0,
      staleBeaches: 0,
      generated_at: "2026-07-19T00:00:00.000Z",
    },
    regionalCall: "",
    ...(recommendationAvailability ? { recommendationAvailability } : {}),
  } as SurfDiscoveryResponse;
}

describe("BeachDiscoveryList recommendation availability", () => {
  it("renders a neutral empty state for externally supplied explicit-none discovery", () => {
    render(
      <BeachDiscoveryList
        discoveryData={
          discoveryResponse({
            state: "none",
            reasonCode: "major_event_hold",
            holdEpoch: "hold-epoch",
          })
        }
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No Surf Spots Found" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /top surf spots for you/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("discovery-recommendation-card"),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it("preserves legacy recommendations when availability is missing", () => {
    render(<BeachDiscoveryList discoveryData={discoveryResponse()} />);

    expect(
      screen.getByRole("heading", { name: /top surf spots for you/i }),
    ).toBeVisible();
    expect(screen.getByTestId("discovery-recommendation-card")).toBeVisible();
  });
});
