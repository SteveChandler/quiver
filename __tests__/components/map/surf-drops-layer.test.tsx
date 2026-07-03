import { act, render, waitFor } from "@testing-library/react";
import { SurfDropsLayer } from "@/components/map/surf-drops-layer";

const mockPush = jest.fn();
const mockSetLngLat = jest.fn().mockReturnThis();
const mockAddTo = jest.fn().mockReturnThis();
const mockRemove = jest.fn();
interface MockMarkerOptions {
  element: HTMLElement;
}

const mockMarker = jest.fn((_options: MockMarkerOptions) => ({
  setLngLat: mockSetLngLat,
  addTo: mockAddTo,
  remove: mockRemove,
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("mapbox-gl", () => ({
  __esModule: true,
  default: {
    Marker: mockMarker,
  },
  Marker: mockMarker,
}));

jest.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => false,
}));

jest.mock("@/hooks/use-surf-drops-in-view", () => ({
  useSurfDropsInView: () => ({
    drops: [
      {
        id: "11111111-2222-3333-4444-555555555555",
        share_slug: "A2K7N9PQRS",
        location_type: "custom_pin",
        lat: 32.749,
        lon: -117.253,
        beach_id: null,
        spot_name: null,
        general_area: "North County SD",
        exact_label: "Secret stairs",
        starts_at: "2099-07-02T14:00:00.000Z",
        ends_at: "2099-07-02T15:00:00.000Z",
        audience: "mutuals",
        creator: {
          id: "user-1",
          display_name: "Maya",
          avatar_url: null,
        },
        participants_count: 2,
      },
    ],
    refetch: jest.fn(),
  }),
}));

describe("SurfDropsLayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as typeof window & { __quiverMap?: unknown }).__quiverMap;
  });

  it("routes marker clicks to the UUID-backed drop detail page", async () => {
    render(<SurfDropsLayer enabled />);

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("quiver:map-ready", { detail: { map: { id: "map" } } }),
      );
      window.dispatchEvent(
        new CustomEvent("quiver:map-bounds-change", {
          detail: {
            west: -117.4,
            south: 32.6,
            east: -117.1,
            north: 32.9,
          },
        }),
      );
    });

    await waitFor(() => expect(mockMarker).toHaveBeenCalledTimes(1));
    const [[options]] = mockMarker.mock.calls as [[MockMarkerOptions]];
    const element = options.element;

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(mockPush).toHaveBeenCalledWith(
      "/drops/11111111-2222-3333-4444-555555555555",
    );
    expect(mockPush).not.toHaveBeenCalledWith("/drops/A2K7N9PQRS");
  });
});
