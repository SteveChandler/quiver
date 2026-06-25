import React from "react";
import { render, waitFor } from "@testing-library/react";

const mockMarkerInstances: Array<{
  addTo: jest.Mock;
  remove: jest.Mock;
  setLngLat: jest.Mock;
}> = [];

jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => ({
    on: jest.fn((event: string, callback: () => void) => {
      if (event === "load") {
        setTimeout(callback, 10);
      }
    }),
    off: jest.fn(),
    remove: jest.fn(),
    getCenter: jest.fn(() => ({ lat: 32.7493, lng: -117.2511 })),
    getZoom: jest.fn(() => 13),
    getMaxZoom: jest.fn(() => 22),
    getMinZoom: jest.fn(() => 0),
    setCenter: jest.fn(),
    setMaxBounds: jest.fn(),
    setMaxZoom: jest.fn(),
    setMinZoom: jest.fn(),
    flyTo: jest.fn(),
    easeTo: jest.fn(),
    fitBounds: jest.fn(),
    getBounds: jest.fn(() => ({
      getWest: () => -117.3,
      getSouth: () => 32.7,
      getEast: () => -117.2,
      getNorth: () => 32.8,
    })),
    getCanvasContainer: jest.fn(() => document.createElement("div")),
    getLayer: jest.fn(() => undefined),
    getStyle: jest.fn(() => ({ layers: [] })),
    addLayer: jest.fn(),
    addControl: jest.fn(),
    removeLayer: jest.fn(),
    triggerRepaint: jest.fn(),
  })),
  AttributionControl: jest.fn(() => ({ type: "attribution" })),
  Marker: jest.fn(() => {
    const marker = {
      setLngLat: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn(),
    };
    mockMarkerInstances.push(marker);
    return marker;
  }),
  Popup: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setDOMContent: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
  accessToken: "",
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

jest.mock("@/lib/utils/request-cache", () => ({
  createCachedMapFetch: jest.fn(() => jest.fn().mockResolvedValue({ data: [] })),
}));

jest.mock("@/lib/constants/ui", () => ({
  CACHE_TTL: { MAP_NEARBY_BEACHES: 300000 },
  API_BATCH_CONFIG: { BEACH_ID_BATCH_SIZE: 50 },
}));

jest.mock("@/lib/utils/map-utilities", () => ({
  getOffshorePosition: jest.fn((lat: number, lon: number) => [
    lon + 0.001,
    lat + 0.001,
  ]),
  hasViewportChanged: jest.fn(() => true),
}));

describe("InteractiveMap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkerInstances.length = 0;
  });

  it("creates distinct custom spot markers and filters invalid coordinates", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const customSpots = [
      {
        id: "spot-1",
        name: "Public Peak",
        lat: 32.75,
        lon: -117.25,
        nearestBeachId: null,
        visibility: "public",
      },
      {
        id: "spot-2",
        name: "Bad Coordinates",
        lat: Number.NaN,
        lon: -117.26,
        nearestBeachId: null,
        visibility: "public",
      },
    ];

    render(<InteractiveMap beaches={[]} customSpots={customSpots} />);

    await waitFor(() => {
      const Marker = require("mapbox-gl").Marker;
      expect(
        Marker.mock.calls.some(
          ([options]: [{ element?: HTMLElement }]) =>
            options.element?.getAttribute("data-testid") ===
            "custom-spot-marker",
        ),
      ).toBe(true);
    });

    const Marker = require("mapbox-gl").Marker;
    const customMarkerIndex = Marker.mock.calls.findIndex(
      ([options]: [{ element?: HTMLElement }]) =>
        options.element?.getAttribute("data-custom-spot-id") === "spot-1",
    );
    const markerOptions = Marker.mock.calls[customMarkerIndex][0] as {
      anchor?: string;
      element?: HTMLElement;
    };
    const marker = mockMarkerInstances[customMarkerIndex];

    expect(
      Marker.mock.calls.some(
        ([options]: [{ element?: HTMLElement }]) =>
          options.element?.getAttribute("data-custom-spot-id") === "spot-2",
      ),
    ).toBe(false);
    expect(markerOptions.anchor).toBe("center");
    expect(markerOptions.element?.style.width).toBe("14px");
    expect(markerOptions.element?.style.height).toBe("14px");
    expect(markerOptions.element).toHaveAttribute(
      "data-testid",
      "custom-spot-marker",
    );
    expect(markerOptions.element).toHaveAttribute(
      "data-custom-spot-id",
      "spot-1",
    );
    expect(markerOptions.element).toHaveAttribute("title", "Public Peak");
    expect(markerOptions.element?.style.background).toBe("rgb(255, 255, 255)");
    expect(markerOptions.element?.style.borderWidth).toBe("2.5px");
    expect(markerOptions.element?.style.borderStyle).toBe("solid");
    expect(markerOptions.element?.style.borderColor).toBe("#f78e42");
    expect(markerOptions.element?.style.cursor).toBe("pointer");
    expect(marker.setLngLat).toHaveBeenCalledWith([-117.25, 32.75]);
  });
});
