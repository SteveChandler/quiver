const rpcMock = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  __esModule: true,
  createClient: () => ({ rpc: rpcMock }),
}));

jest.mock("@/components/beach-card", () => ({
  BeachCard: ({ name, distance }: { name: string; distance: string }) => (
    <div data-testid="beach-card">
      {name} - {distance}
    </div>
  ),
}));

import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import { NearbyBeaches } from "@/components/NearbyBeaches";
import { SelectedBeachProvider, useSelectedBeach } from "@/state/selectedBeach";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });
}

function SelectedBeachInitializer({ children }: { children: React.ReactNode }) {
  const { setSelectedBeach } = useSelectedBeach();

  useEffect(() => {
    setSelectedBeach({
      id: "selected",
      name: "Selected Beach",
      lat: 32.71,
      lon: -117.16,
    });
  }, [setSelectedBeach]);

  return <>{children}</>;
}

describe("NearbyBeaches component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nearby beaches excluding the selected beach and formats distance", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: "selected",
          name: "Selected Beach",
          meters: 10,
        },
        {
          id: "b-1",
          name: "North Point",
          meters: 8046.72,
          rating: 4.2,
          review_count: 20,
        },
        {
          id: "b-2",
          name: "South Point",
          meters: 1609.344,
          rating: 3.5,
          reviewCount: 5,
          imageUrl: "https://example.com/south.jpg",
        },
        {
          id: "b-3",
          name: "Harbor Cove",
          meters: 40,
        },
      ],
      error: null,
    });

    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <SelectedBeachProvider>
          <SelectedBeachInitializer>
            <NearbyBeaches limit={4} />
          </SelectedBeachInitializer>
        </SelectedBeachProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("beach-card")).toHaveLength(3);
    });

    const cards = screen.getAllByTestId("beach-card");

    expect(cards[0].textContent).toContain("5.0 mi");
    expect(cards[1].textContent).toContain("1.0 mi");
    expect(cards[2].textContent).toBe("Harbor Cove - ");
    expect(cards[2].textContent?.includes("mi")).toBe(false);
  });

  it("returns null when no beach is selected", () => {
    const queryClient = createQueryClient();

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <SelectedBeachProvider>
          <NearbyBeaches limit={4} />
        </SelectedBeachProvider>
      </QueryClientProvider>
    );

    expect(container).toBeEmptyDOMElement();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
