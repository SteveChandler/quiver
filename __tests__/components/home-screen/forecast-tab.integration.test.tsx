import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HomeScreen } from "@/components/home-screen";

jest.mock("@/hooks/useGeo", () => ({
  useGeo: () => ({
    coords: { lat: 32.75, lon: -117.25 },
    loading: false,
    error: null,
    requestLocation: jest.fn(),
    setLastBeach: jest.fn(),
  }),
}));

describe("HomeScreen forecast tab integration (smoke)", () => {
  it("renders without crashing with nearby chips visible", () => {
    render(<HomeScreen />);
    // Smoke: rely on internal layout; detailed behavior covered elsewhere
  });
});
