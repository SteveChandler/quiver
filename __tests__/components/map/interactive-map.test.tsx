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
const mockTrackEvent = jest.fn();
let mockUser: { id: string } | null = null;
let mockMapCenter = { lat: 32.7493, lng: -117.2511 };

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
    getCenter: jest.fn(() => mockMapCenter),
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
  useTrackEvent: () => ({ track: mockTrackEvent }),
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
    mockMapCenter = { lat: 32.7493, lng: -117.2511 };
    delete (
      window as typeof window & {
        __quiverMapDebugCenter?: { lat: number; lon: number };
      }
    ).__quiverMapDebugCenter;
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
    setMaxBounds: jest.Mock;
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

    const maxBoundsCallsBeforeInterruption =
      getMapInstance().setMaxBounds.mock.calls.length;
    act(() => {
      mockMapHandlers.dragstart[0]({ originalEvent: new MouseEvent("mousedown") });
    });
    expect(onUserCameraInteraction).toHaveBeenCalledWith({
      action: "pan",
      center: { lat: 32.7493, lon: -117.2511 },
      phase: "start",
    });
    await waitFor(() => {
      expect(getMapInstance().setMaxBounds.mock.calls.length).toBeGreaterThan(
        maxBoundsCallsBeforeInterruption,
      );
    });

    act(() => {
      mockMapHandlers.zoomstart[0]({ type: "zoomstart" });
    });
    expect(onUserCameraInteraction).toHaveBeenCalledTimes(1);

    act(() => {
      mockMapHandlers.zoomstart[0]({
        originalEvent: new WheelEvent("wheel"),
      });
    });
    expect(onUserCameraInteraction).toHaveBeenLastCalledWith({
      action: "zoom",
      center: { lat: 32.7493, lon: -117.2511 },
      phase: "start",
    });
  });

  it("reports only a user gesture's final moveend center", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const onUserCameraInteraction = jest.fn();
    render(
      <InteractiveMap beaches={[]} onUserCameraInteraction={onUserCameraInteraction} />,
    );

    await waitFor(() => expect(mockMapHandlers.moveend).toHaveLength(1));
    mockMapCenter = { lat: 21.28, lng: -157.85 };
    act(() => mockMapHandlers.moveend[0]());
    expect(onUserCameraInteraction).not.toHaveBeenCalled();

    mockMapCenter = { lat: 32.75, lng: -117.25 };
    act(() => {
      mockMapHandlers.dragstart[0]({ originalEvent: new MouseEvent("mousedown") });
    });
    mockMapCenter = { lat: 21.29, lng: -157.86 };
    act(() => mockMapHandlers.moveend[0]());

    expect(onUserCameraInteraction).toHaveBeenNthCalledWith(1, {
      action: "pan",
      center: { lat: 32.75, lon: -117.25 },
      phase: "start",
    });
    expect(onUserCameraInteraction).toHaveBeenNthCalledWith(2, {
      action: "pan",
      center: { lat: 21.29, lon: -157.86 },
      phase: "end",
    });
  });

  it("exposes the first validated absolute hourly envelope for an embed", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const onHourlyTimelineLoaded = jest.fn();
    const timeline = {
      timestamps: [
        "2026-07-10T20:00:00.000Z",
        "2026-07-10T21:00:00.000Z",
      ],
      partitionsByBeach: { "beach-1": [null, null] },
      hasMore: false,
      nextStart: null,
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {}, hourlySwellTimeline: timeline } }),
    })) as jest.Mock;

    render(
      <InteractiveMap
        beaches={[{ id: "beach-1", name: "Beach", lat: 32.75, lon: -117.25 } as import("@/types/database").Beach]}
        onHourlyTimelineLoaded={onHourlyTimelineLoaded}
        swellTimelineMode="hourly"
      />,
    );

    await waitFor(() => {
      expect(onHourlyTimelineLoaded).toHaveBeenCalledWith(timeline);
    });
  });

  it("does not carry a prior hourly frame into a missing absolute timestamp", async () => {
    const interactiveMapModule = await import("@/components/map/interactive-map");
    const resolve = (interactiveMapModule as Record<string, unknown>).partitionAtAbsoluteTimelineIndex;
    const firstFrame = { swell1Height: 2 };
    const timeline = {
      timestamps: [
        "2026-07-10T20:00:00.000Z",
        "2026-07-10T21:00:00.000Z",
        "2026-07-10T22:00:00.000Z",
      ],
      partitionsByBeach: { "beach-1": [firstFrame, null, { swell1Height: 4 }] },
      hasMore: false,
      nextStart: null,
    };
    const partition = typeof resolve === "function"
      ? resolve(timeline, "beach-1", 1)
      : firstFrame;

    expect(partition).toBeUndefined();

    const malformedTimestampPartition = typeof resolve === "function"
      ? resolve(
        {
          ...timeline,
          timestamps: ["not-a-timestamp"],
          partitionsByBeach: { "beach-1": [firstFrame] },
        },
        "beach-1",
        0,
      )
      : firstFrame;
    expect(malformedTimestampPartition).toBeUndefined();

    const nonHourlyTimestampPartition = typeof resolve === "function"
      ? resolve(
        {
          ...timeline,
          timestamps: ["2026-07-10T20:30:00.000Z"],
          partitionsByBeach: { "beach-1": [firstFrame] },
        },
        "beach-1",
        0,
      )
      : firstFrame;
    expect(nonHourlyTimestampPartition).toBeUndefined();

    const mismatchedPartition = typeof resolve === "function"
      ? resolve(
        {
          ...timeline,
          partitionsByBeach: { "beach-1": [firstFrame] },
        },
        "beach-1",
        0,
      )
      : firstFrame;
    expect(mismatchedPartition).toBeUndefined();
  });

  it("clears the debug center during map setup and cleanup", async () => {
    const mapWindow = window as typeof window & {
      __quiverMapDebugCenter?: { lat: number; lon: number };
    };
    mapWindow.__quiverMapDebugCenter = { lat: 1, lon: 2 };
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    const { unmount } = render(<InteractiveMap beaches={[]} />);

    expect(mapWindow.__quiverMapDebugCenter).toBeUndefined();
    act(() => {
      mockMapHandlers.moveend[0]();
    });
    expect(mapWindow.__quiverMapDebugCenter).toEqual({
      lat: 32.7493,
      lon: -117.2511,
    });

    unmount();
    expect(mapWindow.__quiverMapDebugCenter).toBeUndefined();
  });

  it("only settles leash suspension at the latest command target", async () => {
    const { cameraCommandContainsCenter } = await import(
      "@/components/map/interactive-map"
    );
    const latestCommand = {
      id: 2,
      source: "gps" as const,
      center: { lat: 32.7702, lon: -117.2525 },
    };

    expect(
      cameraCommandContainsCenter(latestCommand, {
        lat: 20.6106,
        lng: -157.5,
      }),
    ).toBe(false);
    expect(
      cameraCommandContainsCenter(latestCommand, {
        lat: 32.7702,
        lng: -117.2525,
      }),
    ).toBe(true);
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

  function timelineResponse(
    beachIds: string[],
    start: string,
    hours: number,
    hasMore: boolean,
  ): Record<string, unknown> {
    const startEpoch = Date.parse(start);
    const timestamps = Array.from({ length: hours }, (_, index) =>
      new Date(startEpoch + index * 60 * 60 * 1000).toISOString());
    return {
      data: {
        forecasts: {},
        hourlySwellTimeline: {
          timestamps,
          partitionsByBeach: Object.fromEntries(
            beachIds.map((id) => [id, timestamps.map(() => null)]),
          ),
          hasMore,
          nextStart: hasMore
            ? new Date(startEpoch + hours * 60 * 60 * 1000).toISOString()
            : null,
        },
      },
    };
  }

  it("reloads a same-count beach replacement but not stable equivalent ordering", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.test");
      const ids = (url.searchParams.get("beachIds") ?? "").split(",").filter(Boolean);
      return {
        ok: true,
        status: 200,
        json: async () => timelineResponse(ids, "2026-07-10T20:00:00.000Z", 8, false),
      } as Response;
    });
    const beach = (id: string) => ({
      id,
      name: id,
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach);
    const { rerender } = render(
      <InteractiveMap beaches={[beach("a"), beach("b")]} swellTimelineMode="expandable-hourly" />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    rerender(
      <InteractiveMap beaches={[beach("b"), beach("a")]} swellTimelineMode="expandable-hourly" />,
    );
    await act(async () => Promise.resolve());
    expect(global.fetch).toHaveBeenCalledTimes(1);

    rerender(
      <InteractiveMap beaches={[beach("a"), beach("c")]} swellTimelineMode="expandable-hourly" />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain("beachIds=a%2Cc");
  });

  it("tracks bounded scrub, play, and pause actions with local-time horizon metadata and no tick spam", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.test");
      const ids = (url.searchParams.get("beachIds") ?? "").split(",").filter(Boolean);
      return {
        ok: true,
        status: 200,
        json: async () => timelineResponse(ids, "2026-07-10T20:00:00.000Z", 10, false),
      } as Response;
    });
    render(
      <InteractiveMap
        beaches={[{ id: "a", name: "A", lat: 21.28, lon: -157.85 } as import("@/types/database").Beach]}
        showSwellField
        swellTimelineMode="expandable-hourly"
        viewTimezone="Pacific/Honolulu"
      />,
    );
    const slider = await screen.findByRole("slider", { name: "Forecast time" });
    fireEvent.change(slider, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Play forecast timeline" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause forecast timeline" }));

    const timelineCalls = () => mockTrackEvent.mock.calls.filter(
      ([event, options]) => event === "map_interaction"
        && String(options?.metadata?.action).startsWith("timeline_"),
    );
    expect(timelineCalls().map(([, options]) => options.metadata.action)).toEqual([
      "timeline_scrub",
      "timeline_play",
      "timeline_pause",
    ]);
    expect(timelineCalls()[0][1]).toMatchObject({
      debounceMs: 250,
      metadata: {
        active_timestamp_utc: "2026-07-10T21:00:00.000Z",
        timezone: "Pacific/Honolulu",
        active_local_hour: "2026-07-10T11:00",
        loaded_horizon_hours: 10,
      },
    });
    const callCount = timelineCalls().length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(timelineCalls()).toHaveLength(callCount);
    expect(mockUser).toBeNull();
  });

  it.each([
    ["success", true],
    ["exhausted", false],
    ["failure", true],
  ] as const)("emits one requested and one %s extension result", async (result, hasMore) => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.test");
      const ids = (url.searchParams.get("beachIds") ?? "").split(",").filter(Boolean);
      const isExtension = url.searchParams.has("timelineStart");
      return {
        ok: true,
        status: 200,
        json: async () => isExtension
          ? timelineResponse(
            result === "failure" ? ["unexpected-beach"] : ids,
            "2026-07-11T04:00:00.000Z",
            4,
            hasMore,
          )
          : timelineResponse(ids, "2026-07-10T20:00:00.000Z", 8, true),
      } as Response;
    });
    render(
      <InteractiveMap
        beaches={[{ id: "a", name: "A", lat: 21.28, lon: -157.85 } as import("@/types/database").Beach]}
        showSwellField
        swellTimelineMode="expandable-hourly"
        viewTimezone="Pacific/Honolulu"
      />,
    );
    const slider = await screen.findByRole("slider", { name: "Forecast time" });
    fireEvent.change(slider, { target: { value: "3" } });
    await waitFor(() => {
      const extensionResults = mockTrackEvent.mock.calls
        .filter(([, options]) => options?.metadata?.action === "timeline_extend")
        .map(([, options]) => options.metadata.extension_result);
      expect(extensionResults).toEqual(["requested", result]);
    });
  });
});
