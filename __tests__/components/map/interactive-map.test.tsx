import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockMarkerInstances: Array<{
  addTo: jest.Mock;
  remove: jest.Mock;
  setLngLat: jest.Mock;
}> = [];
const mockMapHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};
const mockRouterPush = jest.fn();
const mockTrackSignupCtaClick = jest.fn();
let mockUser: { id: string } | null = null;

jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => ({
    on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      (mockMapHandlers[event] ??= []).push(callback);
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
  usePathname: () => "/map",
  useRouter: () => ({ push: mockRouterPush, refresh: jest.fn() }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="auth-modal" /> : null,
}));

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: (...args: unknown[]) =>
    mockTrackSignupCtaClick(...args),
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
    for (const key of Object.keys(mockMapHandlers)) delete mockMapHandlers[key];
    mockUser = null;
  });

  function getLastCustomSpotMarkerElement(id: string): HTMLElement {
    const Marker = require("mapbox-gl").Marker;
    const matchingCalls = Marker.mock.calls.filter(
      ([options]: [{ element?: HTMLElement }]) =>
        options.element?.getAttribute("data-custom-spot-id") === id,
    );

    return matchingCalls[matchingCalls.length - 1][0].element;
  }

  function getMapInstance(): {
    flyTo: jest.Mock;
    getCenter: jest.Mock;
  } {
    const Map = require("mapbox-gl").Map;
    return Map.mock.results[Map.mock.results.length - 1].value;
  }

  it("applies each camera command once and reports real camera gestures", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const onUserCameraInteraction = jest.fn();
    const command = {
      id: 1,
      source: "region" as const,
      center: { lat: 21.28, lon: -157.85 },
    };
    const { rerender } = render(
      <InteractiveMap
        beaches={[]}
        cameraCommand={command}
        onUserCameraInteraction={onUserCameraInteraction}
      />,
    );

    await waitFor(() => {
      expect(getMapInstance().flyTo).toHaveBeenCalledWith({
        center: [-157.85, 21.28],
        zoom: 13,
        duration: 800,
      });
    });

    rerender(
      <InteractiveMap
        beaches={[]}
        cameraCommand={command}
        onUserCameraInteraction={onUserCameraInteraction}
      />,
    );
    expect(getMapInstance().flyTo).toHaveBeenCalledTimes(1);

    act(() => {
      mockMapHandlers.dragstart[0]({ originalEvent: new MouseEvent("mousedown") });
    });
    expect(onUserCameraInteraction).toHaveBeenCalledWith({
      action: "pan",
      center: { lat: 32.7493, lon: -117.2511 },
    });
  });

  it("does not delegate map clicks from markers or conditions callouts", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const onMapClick = jest.fn();
    render(<InteractiveMap beaches={[]} onMapClick={onMapClick} />);

    const marker = document.createElement("div");
    marker.dataset.testid = "beach-marker";
    const callout = document.createElement("div");
    callout.dataset.conditionsCallout = "true";

    act(() => {
      mockMapHandlers.click[0]({
        lngLat: { lat: 32.75, lng: -117.25 },
        originalEvent: { target: marker },
      });
      mockMapHandlers.click[0]({
        lngLat: { lat: 32.75, lng: -117.25 },
        originalEvent: { target: callout },
      });
    });
    expect(onMapClick).not.toHaveBeenCalled();
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

  it("opens the auth modal instead of navigating when an anonymous user clicks a custom spot", async () => {
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
    ];

    render(<InteractiveMap beaches={[]} customSpots={customSpots} />);

    await waitFor(() => {
      expect(getLastCustomSpotMarkerElement("spot-1")).toHaveAttribute(
        "data-testid",
        "custom-spot-marker",
      );
    });

    const markerElement = getLastCustomSpotMarkerElement("spot-1");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const stopPropagationSpy = jest.spyOn(event, "stopPropagation");

    fireEvent(markerElement, event);

    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockTrackSignupCtaClick).toHaveBeenCalledWith({
      source: "custom-spot-spot-1",
      cta_type: "custom_spot_marker",
    });
    expect(await screen.findByTestId("auth-modal")).toBeInTheDocument();
  });

  it("navigates to the custom spot detail route when an authenticated user clicks a custom spot", async () => {
    mockUser = { id: "user-1" };
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
    ];

    render(<InteractiveMap beaches={[]} customSpots={customSpots} />);

    await waitFor(() => {
      expect(getLastCustomSpotMarkerElement("spot-1")).toHaveAttribute(
        "data-testid",
        "custom-spot-marker",
      );
    });

    fireEvent.click(getLastCustomSpotMarkerElement("spot-1"));

    expect(mockRouterPush).toHaveBeenCalledWith("/custom-spots/spot-1");
    expect(mockTrackSignupCtaClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
  });

  it("uses the current user after auth state changes without rebuilding the custom spot marker", async () => {
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
    ];
    const { rerender } = render(
      <InteractiveMap beaches={[]} customSpots={customSpots} />,
    );

    await waitFor(() => {
      expect(getLastCustomSpotMarkerElement("spot-1")).toHaveAttribute(
        "data-testid",
        "custom-spot-marker",
      );
    });

    mockUser = { id: "user-1" };
    rerender(<InteractiveMap beaches={[]} customSpots={customSpots} />);

    const Marker = require("mapbox-gl").Marker;
    const matchingCalls = Marker.mock.calls.filter(
      ([options]: [{ element?: HTMLElement }]) =>
        options.element?.getAttribute("data-custom-spot-id") === "spot-1",
    );
    expect(matchingCalls).toHaveLength(1);

    fireEvent.click(getLastCustomSpotMarkerElement("spot-1"));

    expect(mockRouterPush).toHaveBeenCalledWith("/custom-spots/spot-1");
    expect(mockTrackSignupCtaClick).not.toHaveBeenCalled();
  });

  it("reuses stable custom spot markers and removes only missing ids", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const spotOne = {
      id: "spot-1",
      name: "Public Peak",
      lat: 32.75,
      lon: -117.25,
      nearestBeachId: null,
      visibility: "public",
    };
    const spotTwo = {
      id: "spot-2",
      name: "Inside Bowl",
      lat: 32.76,
      lon: -117.26,
      nearestBeachId: null,
      visibility: "public",
    };

    const { rerender } = render(
      <InteractiveMap beaches={[]} customSpots={[spotOne, spotTwo]} />,
    );

    await waitFor(() => {
      expect(getLastCustomSpotMarkerElement("spot-1")).toHaveAttribute(
        "data-testid",
        "custom-spot-marker",
      );
      expect(getLastCustomSpotMarkerElement("spot-2")).toHaveAttribute(
        "data-testid",
        "custom-spot-marker",
      );
    });

    const firstMarker = mockMarkerInstances.find((marker, index) => {
      const Marker = require("mapbox-gl").Marker;
      const options = Marker.mock.calls[index]?.[0] as { element?: HTMLElement };
      return options.element?.getAttribute("data-custom-spot-id") === "spot-1";
    });
    const secondMarker = mockMarkerInstances.find((marker, index) => {
      const Marker = require("mapbox-gl").Marker;
      const options = Marker.mock.calls[index]?.[0] as { element?: HTMLElement };
      return options.element?.getAttribute("data-custom-spot-id") === "spot-2";
    });
    if (!firstMarker || !secondMarker) {
      throw new Error("Expected both custom spot markers to be created");
    }

    rerender(<InteractiveMap beaches={[]} customSpots={[spotOne]} />);

    expect(firstMarker.remove).not.toHaveBeenCalled();
    expect(secondMarker.remove).toHaveBeenCalledTimes(1);
    expect(
      (window as typeof window & { __quiverMapVisibleMarkerCount?: number })
        .__quiverMapVisibleMarkerCount,
    ).toBe(1);
  });

  describe("conditions callout during forecast playback", () => {
    const beach = {
      id: "beach-1",
      name: "Test Beach",
      lat: 32.75,
      lon: -117.25,
    } as unknown as import("@/types/database").Beach;

    function calloutMarkerCallCount(): number {
      const Marker = require("mapbox-gl").Marker;
      return Marker.mock.calls.filter(
        ([options]: [{ element?: HTMLElement }]) =>
          options.element?.getAttribute("data-conditions-callout") === "true",
      ).length;
    }

    function getBeachMarkerBadge(beachId: string): HTMLElement {
      const Marker = require("mapbox-gl").Marker;
      const matchingCalls = Marker.mock.calls.filter(
        ([options]: [{ element?: HTMLElement }]) =>
          options?.element?.getAttribute("data-beach-id") === beachId
      );
      const wrapper = matchingCalls[matchingCalls.length - 1]?.[0]
        ?.element as HTMLElement | undefined;
      const badge = wrapper?.querySelector<HTMLElement>(
        '[data-marker-badge="true"]'
      );
      if (!badge) throw new Error(`No tappable badge for beach ${beachId}`);
      return badge;
    }

    function fireMapClick(lng: number, lat: number): void {
      for (const handler of mockMapHandlers["click"] ?? []) {
        handler({ lngLat: { lng, lat } });
      }
    }

    it("does not rebuild the open callout for fractional index ticks within the same step", async () => {
      const { InteractiveMap } = await import(
        "@/components/map/interactive-map"
      );
      const onWaveHeightsChange = jest.fn();
      const renderProps = (index: number) => ({
        beaches: [beach],
        showConditionsOnTap: true,
        swellTimelineSteps: ["Now", "+3h", "+6h"],
        swellTimelineIndex: index,
        onWaveHeightsChange,
      });
      const { rerender } = render(<InteractiveMap {...renderProps(0)} />);

      // Both click handlers (generic map click + conditions tap) register once
      // the map reports ready; the conditions one is the second. Also wait for
      // the beach loader to settle — it swaps the partitions map identity, which
      // legitimately refreshes an open callout and would skew the counts below.
      await waitFor(() => {
        expect(mockMapHandlers["click"]?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(onWaveHeightsChange).toHaveBeenCalled();
      });
      // The loader's state commit lands via a scheduler macrotask; yield one so
      // the partitions-map identity is settled before the callout opens.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      fireMapClick(-117.25, 32.75);
      expect(calloutMarkerCallCount()).toBe(1);

      // Playback advances a fractional index every 80ms; ticks that round to the
      // same displayed step must not tear down and rebuild the callout marker.
      rerender(<InteractiveMap {...renderProps(0.08)} />);
      rerender(<InteractiveMap {...renderProps(0.16)} />);
      rerender(<InteractiveMap {...renderProps(0.24)} />);
      expect(calloutMarkerCallCount()).toBe(1);

      // Crossing the rounding boundary into the next step refreshes exactly once.
      rerender(<InteractiveMap {...renderProps(0.56)} />);
      expect(calloutMarkerCallCount()).toBe(2);

      // Further ticks within the new step stay put again.
      rerender(<InteractiveMap {...renderProps(0.64)} />);
      rerender(<InteractiveMap {...renderProps(0.72)} />);
      expect(calloutMarkerCallCount()).toBe(2);
    });

    it("notifies the embed host when a pin opens, but not when it toggles off", async () => {
      const { InteractiveMap } = await import(
        "@/components/map/interactive-map"
      );
      const onLocationClick = jest.fn();

      render(
        <InteractiveMap
          beaches={[beach]}
          autoNavigateOnMarkerClick={false}
          disableBeachClustering
          markerDisplay="points"
          showConditionsOnTap
          onLocationClick={onLocationClick}
        />
      );

      await waitFor(() => {
        expect(getBeachMarkerBadge(beach.id)).toHaveAttribute(
          "data-marker-badge",
          "true"
        );
      });

      fireEvent.click(getBeachMarkerBadge(beach.id));
      expect(onLocationClick).toHaveBeenCalledTimes(1);
      expect(onLocationClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: beach.id })
      );
      expect(calloutMarkerCallCount()).toBe(1);

      fireEvent.click(getBeachMarkerBadge(beach.id));
      expect(onLocationClick).toHaveBeenCalledTimes(1);
    });
  });
});
