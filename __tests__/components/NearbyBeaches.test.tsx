const rpcMock = jest.fn();
const countryLookupMock = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  __esModule: true,
  createClient: () => ({
    rpc: rpcMock,
    from: () => ({
      select: () => ({ in: countryLookupMock }),
    }),
  }),
}));

jest.mock("@/components/beach-card", () => ({
  BeachCard: ({ name, distance }: { name: string; distance?: string }) => (
    <div data-testid="beach-card">
      {name} - {distance ?? ""}
    </div>
  ),
}));

import React, { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

import { NearbyBeaches } from "@/components/NearbyBeaches";
import {
  SelectedBeachProvider,
  useSelectedBeach,
} from "@/state/selectedBeach";
import type { SelectedBeach as SelectedBeachState } from "@/state/selectedBeach";

interface SelectedBeachInitializerProps {
  children: React.ReactNode;
  initialBeach: SelectedBeachState;
  onReady?: (setSelectedBeach: (beach: SelectedBeachState | null) => void) => void;
}

function SelectedBeachInitializer({
  children,
  initialBeach,
  onReady,
}: SelectedBeachInitializerProps) {
  const { setSelectedBeach } = useSelectedBeach();

  useEffect(() => {
    setSelectedBeach(initialBeach);
    onReady?.(setSelectedBeach);
  }, [initialBeach, onReady, setSelectedBeach]);

  return <>{children}</>;
}

describe("NearbyBeaches component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    countryLookupMock.mockImplementation((_column: string, ids: string[]) =>
      Promise.resolve({
        data: ids.map((id) => ({ id, country: "USA" })),
        error: null,
      }),
    );
  });

  it("renders nearby beaches excluding the selected beach and formats distance", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: "selected",
          name: "Selected Beach",
          meters: 10,
          lat: 32.71,
          lon: -117.16,
        },
        {
          id: "b-1",
          name: "North Point",
          meters: 8046.72,
          lat: 32.78,
          lon: -117.23,
          rating: 4.2,
          review_count: 20,
        },
        {
          id: "b-2",
          name: "South Point",
          meters: 1609.344,
          lat: 32.72,
          lon: -117.21,
          rating: 3.5,
          reviewCount: 5,
          imageUrl: "https://example.com/south.jpg",
        },
        {
          id: "b-3",
          name: "Harbor Cove",
          meters: 40,
          lat: 32.715,
          lon: -117.165,
        },
        {
          id: "b-4",
          name: "Hidden Reef",
          meters: null,
          lat: null,
          lon: null,
        },
      ],
      error: null,
    });

    render(
      <SelectedBeachProvider>
          <SelectedBeachInitializer
            initialBeach={{
              id: "selected",
              name: "Selected Beach",
              lat: 32.71,
              lon: -117.16,
            }}
          >
            <NearbyBeaches limit={4} />
          </SelectedBeachInitializer>
        </SelectedBeachProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("beach-card")).toHaveLength(4);
    });

    const cards = screen.getAllByTestId("beach-card");

    expect(cards[0].textContent).toContain("6.3 miles away");
    expect(cards[1].textContent).toContain("3.0 miles away");
    expect(cards[2].textContent).toContain("0.5 miles away");
    expect(cards[3].textContent).toBe("Hidden Reef - ");
  });

  it("recomputes distances when the selected beach changes", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            id: "selected",
            name: "Selected Beach",
            lat: 32.71,
            lon: -117.16,
            meters: 10,
          },
          {
            id: "b-1",
            name: "North Point",
            lat: 32.78,
            lon: -117.23,
            meters: 8046.72,
          },
          {
            id: "b-2",
            name: "South Point",
            lat: 32.72,
            lon: -117.21,
            meters: 1609.344,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "selected-2",
            name: "Second Beach",
            lat: 32.82,
            lon: -117.3,
            meters: 12,
          },
          {
            id: "b-1",
            name: "North Point",
            lat: 32.78,
            lon: -117.23,
            meters: 8046.72,
          },
          {
            id: "b-2",
            name: "South Point",
            lat: 32.72,
            lon: -117.21,
            meters: 1609.344,
          },
        ],
        error: null,
      });

    let updateSelected: ((beach: SelectedBeachState | null) => void) | null = null;

    render(
      <SelectedBeachProvider>
        <SelectedBeachInitializer
          initialBeach={{
            id: "selected",
            name: "Selected Beach",
            lat: 32.71,
            lon: -117.16,
          }}
          onReady={(setter) => {
            updateSelected = setter;
          }}
        >
          <NearbyBeaches limit={4} />
        </SelectedBeachInitializer>
      </SelectedBeachProvider>
    );

    await waitFor(() => {
      const initialCard = screen.getAllByTestId("beach-card")[0];
      expect(initialCard.textContent).toContain("6.3 miles away");
    });

    act(() => {
      updateSelected?.({
        id: "selected-2",
        name: "Second Beach",
        lat: 32.82,
        lon: -117.3,
      });
    });

    await waitFor(() => {
      const cards = screen.getAllByTestId("beach-card");
      expect(cards[0].textContent).toContain("4.9 miles away");
      expect(cards[1].textContent).toContain("8.7 miles away");
    });
  });

  it("returns null when no beach is selected", () => {
    const { container } = render(
      <SelectedBeachProvider>
        <NearbyBeaches limit={4} />
      </SelectedBeachProvider>
    );

    expect(container).toBeEmptyDOMElement();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
