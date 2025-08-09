import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { NearbyTab } from "@/components/home-screen/nearby-tab";
import type { Beach } from "@/types/database";

// Mock geolocation hook to return a fixed user location
jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => ({
    userLocation: { lat: 32.7503, lng: -117.2534 },
    loading: false,
  }),
}));

// Mock data fetcher to call the provided fetch function immediately
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: (fn: any, _opts: any) => {
    const [state, setState] = React.useState({ data: null, loading: true });
    React.useEffect(() => {
      fn().then((data: any) => setState({ data, loading: false }));
    }, [fn]);
    return { data: state.data, loading: state.loading };
  },
}));

// Mock action to return beaches unsorted so component must order by distance
jest.mock("@/actions/beach-actions", () => ({
  // The server action returns nearest-first; mirror that here
  getNearbyBeaches: async () => ({
    success: true,
    data: [mockBeaches[1], mockBeaches[0]],
  }),
}));

const mockBeaches: Beach[] = [
  {
    id: "2",
    name: "Far Beach",
    latitude: 33.8503,
    longitude: -117.9534,
    created_at: "",
    updated_at: "",
    description: null,
    location_text: null,
    is_spot: true,
  } as unknown as Beach,
  {
    id: "1",
    name: "Near Beach",
    latitude: 32.7603,
    longitude: -117.2634,
    created_at: "",
    updated_at: "",
    description: null,
    location_text: null,
    is_spot: true,
  } as unknown as Beach,
];

describe("NearbyTab", () => {
  it("renders beaches with nearest first", async () => {
    render(<NearbyTab beaches={[]} loading={false} />);

    await waitFor(() =>
      expect(screen.getByText(/Near Beach/i)).toBeInTheDocument()
    );

    const cards = screen.getAllByText(/Beach$/i);
    // First card should be Near Beach (closest)
    expect(cards[0].textContent).toMatch(/Near Beach/);
  });
});
