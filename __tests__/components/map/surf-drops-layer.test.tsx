import { act, render, waitFor } from "@testing-library/react";
import { SurfDropsLayer } from "@/components/map/surf-drops-layer";
import type { SurfDropInView } from "@/hooks/use-surf-drops-in-view";

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
let mockDrops: SurfDropInView[] = [
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
];

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
    drops: mockDrops,
    refetch: jest.fn(),
  }),
}));

describe("SurfDropsLayer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDrops = [
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
    ];
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

    expect(element).toHaveClass("quiver-surf-drop-marker--sonar");
    expect(
      element.querySelectorAll('[data-testid="surf-drop-sonar-ring"]').length,
    ).toBe(3);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(mockPush).toHaveBeenCalledWith(
      "/drops/11111111-2222-3333-4444-555555555555",
    );
    expect(mockPush).not.toHaveBeenCalledWith("/drops/A2K7N9PQRS");
  });

  it("renders an optimistic marker before the map endpoint returns the new drop", async () => {
    mockDrops = [];
    render(
      <SurfDropsLayer
        enabled
        optimisticDrop={{
          id: "99999999-2222-3333-4444-555555555555",
          share_slug: "FRESH999",
          location_type: "custom_pin",
          lat: 32.7489,
          lon: -117.2532,
          beach_id: null,
          spot_name: null,
          general_area: "Custom beach pin",
          exact_label: "Custom beach pin",
          starts_at: "2099-07-02T14:00:00.000Z",
          ends_at: "2099-07-02T15:00:00.000Z",
          audience: "mutuals",
          creator: {
            id: "user-1",
            display_name: "You",
            avatar_url: null,
          },
          participants_count: 0,
        }}
      />,
    );

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
    expect(mockSetLngLat).toHaveBeenCalledWith([-117.2532, 32.7489]);
    const [[options]] = mockMarker.mock.calls as [[MockMarkerOptions]];
    expect(options.element.getAttribute("data-drop-id")).toBe(
      "99999999-2222-3333-4444-555555555555",
    );
  });
});
