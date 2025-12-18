import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NearbyBeachChips } from "@/components/home-screen/nearby-beach-chips";

// Mock useGeolocation to control permission flow
jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => ({
    coords: null,
    loading: false,
    error: null,
    requestLocation: jest.fn(),
    setLastBeach: jest.fn(),
  }),
}));

describe("NearbyBeachChips", () => {
  it("shows CTA before permission", () => {
    const onSelect = jest.fn();
    render(<NearbyBeachChips onSelect={onSelect} />);
    expect(screen.getByText(/Use my location/i)).toBeInTheDocument();
  });
});
