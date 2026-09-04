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
const mockLoadFavoriteBeaches = jest.fn().mockResolvedValue(new Set<string>());
const mockFetchNearbyBeaches = jest.fn().mockResolvedValue({ data: [] });
type MockViewport = { lat: number; lng: number; zoom: number };
const mockHasViewportChanged = jest.fn(
  (_next: MockViewport, _previous: MockViewport | null): boolean => true,
);
let mockUser: { id: string } | null = null;
let mockMapCenter = { lat: 32.7493, lng: -117.2511 };
let mockMapZoom = 13;
let mockAutoLoadMap = true;
let mockMapBoundsAvailable = true;
let mockTilesLoaded = true;
let mockStyleLayers: Array<{ id: string }> = [];
const mockQueryRenderedFeatures = jest.fn((): unknown[] => [{}]);
const mockProject = jest.fn((_lngLat: [number, number]) => ({ x: 400, y: 300 }));

jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => ({
    on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      (mockMapHandlers[event] ??= []).push(callback);
      if (event === "load" && mockAutoLoadMap) {
        setTimeout(callback, 10);
      }
    }),
    off: jest.fn(),
    remove: jest.fn(),
    getCenter: jest.fn(() => ({
      ...mockMapCenter,
      toArray: (): [number, number] => [mockMapCenter.lng, mockMapCenter.lat],
    })),
    getZoom: jest.fn(() => mockMapZoom),
    getMaxZoom: jest.fn(() => 22),
    getMinZoom: jest.fn(() => 0),
    setCenter: jest.fn(),
    setMaxBounds: jest.fn(),
    setMaxZoom: jest.fn(),
    setMinZoom: jest.fn(),
    flyTo: jest.fn(),
    easeTo: jest.fn(),
    fitBounds: jest.fn(),
    resize: jest.fn(),
    getBounds: jest.fn(() =>
      mockMapBoundsAvailable
        ? {
            getWest: () => -117.3,
            getSouth: () => 32.7,
            getEast: () => -117.2,
            getNorth: () => 32.8,
          }
        : null,
    ),
    getCanvasContainer: jest.fn(() => document.createElement("div")),
    getLayer: jest.fn(() => undefined),
    getStyle: jest.fn(() => ({ layers: mockStyleLayers })),
    getCanvas: jest.fn(() => ({ clientWidth: 800, clientHeight: 600 })),
    project: mockProject,
    queryRenderedFeatures: mockQueryRenderedFeatures,
    areTilesLoaded: jest.fn(() => mockTilesLoaded),
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

jest.mock("@/components/map/map-favorites-loader", () => ({
  loadFavoriteBeaches: (...args: unknown[]) => mockLoadFavoriteBeaches(...args),
}));

jest.mock("@/lib/utils/request-cache", () => ({
  createCachedMapFetch: jest.fn(() => mockFetchNearbyBeaches),
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
  hasViewportChanged: (next: MockViewport, previous: MockViewport | null) =>
    mockHasViewportChanged(next, previous),
}));

describe("InteractiveMap", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkerInstances.length = 0;
    for (const key of Object.keys(mockMapHandlers)) delete mockMapHandlers[key];
    mockUser = null;
    mockFetchNearbyBeaches.mockResolvedValue({ data: [] });
    mockHasViewportChanged.mockReturnValue(true);
    mockMapCenter = { lat: 32.7493, lng: -117.2511 };
    mockMapZoom = 13;
    mockAutoLoadMap = true;
    mockMapBoundsAvailable = true;
    mockTilesLoaded = true;
    mockStyleLayers = [];
    mockQueryRenderedFeatures.mockImplementation(() => [{}]);
    mockProject.mockImplementation(() => ({ x: 400, y: 300 }));
    delete (
      window as typeof window & {
        __quiverMapDebugCenter?: { lat: number; lon: number };
      }
    ).__quiverMapDebugCenter;
    const markerDebugWindow = window as typeof window & {
      __quiverMapMarkerRebuildCount?: number;
      __quiverMapVisibleMarkerCount?: number;
    };
    delete markerDebugWindow.__quiverMapMarkerRebuildCount;
    delete markerDebugWindow.__quiverMapVisibleMarkerCount;
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
    easeTo: jest.Mock;
    fitBounds: jest.Mock;
    getCenter: jest.Mock;
    setMaxBounds: jest.Mock;
    setMaxZoom: jest.Mock;
    resize: jest.Mock;
  } {
    const Map = require("mapbox-gl").Map;
    return Map.mock.results[Map.mock.results.length - 1].value;
  }

  it("allows beach-level zoom while the swell-field leash is active", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    render(
      <InteractiveMap
        beaches={[{
          id: "ocean-beach",
          name: "Ocean Beach",
          lat: 32.7493,
          lon: -117.2511,
        } as import("@/types/database").Beach]}
        showSwellField
      />,
    );

    await waitFor(() => {
      expect(getMapInstance().setMaxZoom).toHaveBeenCalledWith(16);
    });
  });

  it("replaces the loading overlay with a retryable error after a fatal map failure", async () => {
    mockAutoLoadMap = false;
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const onMapLoadFailure = jest.fn();
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    render(<InteractiveMap beaches={[]} onMapLoadFailure={onMapLoadFailure} />);

    act(() => {
      mockMapHandlers.error[0]({ error: new Error("401 Unauthorized access token") });
    });

    expect(screen.getByTestId("map-error-overlay")).toHaveAttribute("role", "alert");
    expect(screen.queryByTestId("map-loading-overlay")).not.toBeInTheDocument();
    expect(onMapLoadFailure).toHaveBeenCalledWith("token_invalid");
    const mapRegion = screen.getByRole("region", { hidden: true });
    expect(mapRegion).toHaveAttribute("inert");
    expect(mapRegion).toHaveAttribute("aria-hidden", "true");

    const retryButton = screen.getByRole("button", { name: "Retry map" });
    expect(retryButton).toHaveFocus();
    act(() => mockMapHandlers.load[0]?.());
    expect(screen.getByTestId("map-error-overlay")).toBeInTheDocument();
    expect(retryButton).toHaveFocus();
    fireEvent.click(retryButton);
    const Map = require("mapbox-gl").Map;
    await waitFor(() => expect(Map).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("map-loading-overlay")).toHaveAttribute("role", "status");
    act(() => mockMapHandlers.load.at(-1)?.());
    await waitFor(() => expect(mapRegion).toHaveFocus());
    expect(mapRegion).not.toHaveAttribute("inert");
    expect(mapRegion).toHaveAttribute("aria-hidden", "false");
    consoleError.mockRestore();
  });

  it("ends silent map loading with a retryable timeout state", async () => {
    jest.useFakeTimers();
    mockAutoLoadMap = false;
    const onMapLoadFailure = jest.fn();
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    render(<InteractiveMap beaches={[]} onMapLoadFailure={onMapLoadFailure} />);

    act(() => {
      jest.advanceTimersByTime(15_000);
    });

    expect(screen.getByTestId("map-error-overlay")).toBeInTheDocument();
    expect(onMapLoadFailure).toHaveBeenCalledWith("timeout");
    act(() => mockMapHandlers.idle[0]?.());
    expect(screen.getByTestId("map-error-overlay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry map" })).toHaveFocus();
    jest.useRealTimers();
  });

  it("starts forecast loading before the Mapbox style is ready", async () => {
    mockAutoLoadMap = false;
    const originalFetch = global.fetch;
    let resolveForecast: ((response: Response) => void) | null = null;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveForecast = resolve;
        }),
    );
    const beach = {
      id: "preloaded-beach",
      name: "Preloaded Beach",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;
    mockFetchNearbyBeaches.mockResolvedValue({ data: [beach] });
    const onMapPresentationReady = jest.fn();

    try {
      const { InteractiveMap } = await import("@/components/map/interactive-map");
      render(
        <InteractiveMap
          disableBeachClustering
          initialCenter={[mockMapCenter.lat, mockMapCenter.lng]}
          onMapPresentationReady={onMapPresentationReady}
        />,
      );

      await waitFor(() => expect(mockFetchNearbyBeaches).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId("map-loading-overlay")).toBeInTheDocument();
      expect(screen.getByTestId("map-preload-preview")).toBeInTheDocument();
      expect(screen.getAllByTestId("map-preload-marker")).toHaveLength(1);
      expect(mockMarkerInstances).toHaveLength(0);

      await act(async () => {
        resolveForecast?.({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              forecasts: { [beach.id]: 2.5 },
              displayForecasts: { [beach.id]: { label: "2-3ft" } },
              conditionSummaries: { [beach.id]: "GOOD" },
              swellPartitions: {},
            },
          }),
        } as Response);
      });

      expect(mockMarkerInstances).toHaveLength(0);
      await waitFor(() =>
        expect(screen.getByTestId("map-preload-marker")).toHaveAttribute(
          "data-condition-summary",
          "GOOD",
        ),
      );
      expect(screen.getByTestId("map-preload-marker")).toHaveTextContent("2-3ft");

      mockMapCenter = { lat: 32.7494, lng: -117.2512 };
      act(() => mockMapHandlers.load[0]?.());
      await waitFor(() => expect(mockMarkerInstances.length).toBeGreaterThan(0));
      expect(onMapPresentationReady).toHaveBeenCalledTimes(1);
      expect(mockFetchNearbyBeaches).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("map-preload-preview")).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("keeps the mount-time forecast load across Mapbox's initial moveend", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {} } }),
    }) as unknown as typeof fetch;
    mockHasViewportChanged.mockImplementation(
      (nextViewport: MockViewport, previousViewport: MockViewport | null) => {
        if (!previousViewport) return true;
        return (
          Math.abs(nextViewport.lat - previousViewport.lat) > 0.01 ||
          Math.abs(nextViewport.lng - previousViewport.lng) > 0.01 ||
          Math.abs(nextViewport.zoom - previousViewport.zoom) >= 1
        );
      },
    );

    try {
      const { InteractiveMap } = await import("@/components/map/interactive-map");
      render(
        <InteractiveMap initialCenter={[32.7493, -117.2511]} initialZoom={13} />,
      );

      await waitFor(() => expect(mockFetchNearbyBeaches).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      mockMapCenter = { lat: 32.7494, lng: -117.2512 };
      act(() => mockMapHandlers.moveend[0]());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1_600));
      });

      expect(mockHasViewportChanged).toHaveBeenCalledWith(
        { lat: 32.7494, lon: -117.2512, zoom: 13 },
        { lat: 32.7493, lon: -117.2511, zoom: 13 },
      );
      expect(mockFetchNearbyBeaches).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("keeps the mount-time forecast load across native's first camera correction", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {} } }),
    }) as unknown as typeof fetch;
    mockHasViewportChanged.mockImplementation(
      (nextViewport: MockViewport, previousViewport: MockViewport | null) => {
        if (!previousViewport) return true;
        return (
          Math.abs(nextViewport.lat - previousViewport.lat) > 0.01 ||
          Math.abs(nextViewport.lng - previousViewport.lng) > 0.01 ||
          Math.abs(nextViewport.zoom - previousViewport.zoom) >= 1
        );
      },
    );

    try {
      const { InteractiveMap } = await import("@/components/map/interactive-map");
      render(
        <InteractiveMap
          initialCenter={[32.7493, -117.2511]}
          initialZoom={13}
          regionViewport={{
            region: "native",
            key: "native-1",
            center: [32.88, -117.25],
            zoom: 13,
          }}
        />,
      );

      await waitFor(() => expect(mockFetchNearbyBeaches).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(getMapInstance().easeTo).toHaveBeenCalled());

      mockMapCenter = { lat: 32.88, lng: -117.25 };
      act(() => mockMapHandlers.moveend[0]());
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1_600));
      });

      expect(mockHasViewportChanged).toHaveBeenCalledWith(
        { lat: 32.88, lon: -117.25, zoom: 13 },
        { lat: 32.88, lon: -117.25, zoom: 13 },
      );
      expect(mockFetchNearbyBeaches).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

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

  it("restores the swell overlay after the map style loads", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    render(
      <InteractiveMap
        beaches={[]}
        showSwellField
        swellLayerId="s1"
      />,
    );

    await waitFor(() => expect(mockMapHandlers["style.load"]).toHaveLength(1));
    const map = getMapInstance() as ReturnType<typeof getMapInstance> & {
      addLayer: jest.Mock;
    };
    await waitFor(() => expect(map.addLayer).toHaveBeenCalled());
    const initialAdds = map.addLayer.mock.calls.length;

    act(() => mockMapHandlers["style.load"][0]());

    await waitFor(() => {
      expect(map.addLayer.mock.calls.length).toBeGreaterThan(initialAdds);
    });
  });

  it("resizes Mapbox when its container changes size", async () => {
    let resizeCallback: ResizeObserverCallback | null = null;
    global.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
      resizeCallback = callback;
      return {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      } as ResizeObserver;
    }) as unknown as typeof ResizeObserver;
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    render(<InteractiveMap beaches={[]} />);

    await waitFor(() => expect(resizeCallback).not.toBeNull());
    act(() => resizeCallback?.([], {} as ResizeObserver));

    await waitFor(() => expect(getMapInstance().resize).toHaveBeenCalled());
  });

  it("gives Mapbox a dedicated empty container while React overlays stay outside it", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    render(<InteractiveMap beaches={[]} />);

    const Map = require("mapbox-gl").Map;
    await waitFor(() => expect(Map).toHaveBeenCalled());
    const container = Map.mock.calls.at(-1)?.[0]?.container as HTMLElement;

    expect(container).toHaveAttribute("aria-label", "Interactive surf map");
    expect(container.childElementCount).toBe(0);
    expect(screen.getByTestId("map-loading-overlay")).not.toBe(container);
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

  it("does not reapply stale beach bounds after a cross-region command and drag", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    render(
      <InteractiveMap
        beaches={[{
          id: "san-diego",
          name: "San Diego",
          lat: 32.75,
          lon: -117.25,
        } as import("@/types/database").Beach]}
        showSwellField
        cameraCommand={{
          id: 1,
          source: "region",
          center: { lat: 21.28, lon: -157.85 },
        }}
      />,
    );

    await waitFor(() => expect(getMapInstance().flyTo).toHaveBeenCalled());
    mockMapCenter = { lat: 21.28, lng: -157.85 };
    act(() => {
      mockMapHandlers.dragstart[0]({ originalEvent: new MouseEvent("mousedown") });
      mockMapHandlers.moveend[0]();
    });

    await waitFor(() => {
      expect(getMapInstance().setMaxBounds.mock.calls.at(-1)?.[0]).toBeNull();
    });
  });

  it("starts a replacement forecast load after a sub-threshold camera command", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {} } }),
    }) as unknown as typeof fetch;
    const beach = {
      id: "san-diego",
      name: "San Diego",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;
    const beaches = [beach];
    const { rerender } = render(<InteractiveMap beaches={beaches} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    act(() => mockMapHandlers.moveend[0]());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_600));
    });
    const requestsBeforeCommand = (global.fetch as jest.Mock).mock.calls.length;

    rerender(
      <InteractiveMap
        beaches={beaches}
        cameraCommand={{
          id: 7,
          source: "region",
          center: { lat: 32.754, lon: -117.247 },
        }}
      />,
    );
    await waitFor(() => expect(getMapInstance().flyTo).toHaveBeenCalled());
    mockMapCenter = { lat: 32.754, lng: -117.247 };
    act(() => mockMapHandlers.moveend[0]());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_600));
    });

    expect(global.fetch).toHaveBeenCalledTimes(requestsBeforeCommand + 1);
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

  it("commits current enrichment before the full hourly timeline resolves", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const originalFetch = global.fetch;
    const onDisplayForecastsChange = jest.fn();
    const onHourlyTimelineLoaded = jest.fn();
    const currentPartition = {
      s1Dir: 270,
      s1PeriodS: 14,
      s1HeightFt: 3.9,
      s2Dir: 200,
      s2PeriodS: 8,
      s2HeightFt: 1.9,
      windDir: 310,
      windMph: 12,
    };
    const timeline = {
      timestamps: ["2026-07-10T20:00:00.000Z"],
      partitionsByBeach: { "beach-1": [null] },
      hasMore: false,
      nextStart: null,
    };
    let resolveCurrent!: (response: Response) => void;
    let resolveTimeline!: (response: Response) => void;
    const deferredCurrent = new Promise<Response>((resolve) => {
      resolveCurrent = resolve;
    });
    const deferredTimeline = new Promise<Response>((resolve) => {
      resolveTimeline = resolve;
    });
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.test");
      if (url.searchParams.get("timeline") === "hourly") {
        return deferredTimeline;
      }
      return deferredCurrent;
    }) as jest.Mock;

    const { unmount } = render(
      <InteractiveMap
        beaches={[{ id: "beach-1", name: "Beach", lat: 32.75, lon: -117.25 } as import("@/types/database").Beach]}
        onDisplayForecastsChange={onDisplayForecastsChange}
        onHourlyTimelineLoaded={onHourlyTimelineLoaded}
        swellTimelineMode="hourly"
      />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    expect(onDisplayForecastsChange).toHaveBeenCalledTimes(1);
    expect(onDisplayForecastsChange.mock.calls[0][0].size).toBe(0);

    await act(async () => {
      resolveCurrent({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            forecasts: { "beach-1": 3.9 },
            displayForecasts: { "beach-1": { label: "3-4ft" } },
            swellPartitions: { "beach-1": currentPartition },
          },
        }),
      } as Response);
      await deferredCurrent;
    });
    await waitFor(() => {
      expect(onDisplayForecastsChange).toHaveBeenCalledWith(
        expect.objectContaining({ get: expect.any(Function) }),
      );
    });
    expect(onDisplayForecastsChange.mock.calls[1][0].get("beach-1")).toEqual({
      label: "3-4ft",
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    expect(onHourlyTimelineLoaded).not.toHaveBeenCalledWith(timeline);

    await act(async () => {
      resolveTimeline({
        ok: true,
        status: 200,
        json: async () => ({ data: { forecasts: {}, hourlySwellTimeline: timeline } }),
      } as Response);
      await deferredTimeline;
    });
    await waitFor(() => {
      expect(onHourlyTimelineLoaded).toHaveBeenCalledWith(timeline);
    });
    expect(onDisplayForecastsChange).toHaveBeenCalledTimes(2);
    unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    global.fetch = originalFetch;
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

  it("interpolates absolute hourly partitions at a fractional playback position", async () => {
    const interactiveMapModule = await import("@/components/map/interactive-map");
    const resolve = interactiveMapModule.partitionAtAbsoluteTimelinePosition;
    const timeline = {
      timestamps: [
        "2026-07-10T20:00:00.000Z",
        "2026-07-10T21:00:00.000Z",
      ],
      partitionsByBeach: {
        "beach-1": [
          {
            s1Dir: 350, s1PeriodS: 10, s1HeightFt: 2,
            s2Dir: null, s2PeriodS: null, s2HeightFt: null,
            windDir: null, windMph: null,
          },
          {
            s1Dir: 10, s1PeriodS: 14, s1HeightFt: 4,
            s2Dir: null, s2PeriodS: null, s2HeightFt: null,
            windDir: null, windMph: null,
          },
        ],
      },
      hasMore: false,
      nextStart: null,
    };

    expect(resolve(timeline, "beach-1", 0.5)).toEqual(expect.objectContaining({
      s1HeightFt: 3,
      s1PeriodS: 12,
    }));
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
        lon: -157.5,
      }),
    ).toBe(false);
    expect(
      cameraCommandContainsCenter(latestCommand, {
        lat: 32.7702,
        lon: -117.2525,
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
      expect(mockLoadFavoriteBeaches).toHaveBeenCalledWith("user-1");
    });

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

    await waitFor(() => {
      expect(mockLoadFavoriteBeaches).toHaveBeenCalledWith("user-1");
    });

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

  it("reuses stable beach markers across equivalent cluster updates", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const beach = {
      id: "beach-1",
      name: "Stable Beach",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;
    const { rerender } = render(
      <InteractiveMap beaches={[beach]} disableBeachClustering />,
    );

    const Marker = require("mapbox-gl").Marker;
    await waitFor(() => {
      expect(
        Marker.mock.calls.filter(
          ([options]: [{ element?: HTMLElement }]) =>
            options.element?.getAttribute("data-beach-id") === beach.id,
        ),
      ).toHaveLength(1);
    });

    const markerCallIndex = Marker.mock.calls.findIndex(
      ([options]: [{ element?: HTMLElement }]) =>
        options.element?.getAttribute("data-beach-id") === beach.id,
    );
    const marker = mockMarkerInstances[markerCallIndex];
    const rebuildCount = (
      window as typeof window & { __quiverMapMarkerRebuildCount?: number }
    ).__quiverMapMarkerRebuildCount;

    rerender(
      <InteractiveMap beaches={[{ ...beach }]} disableBeachClustering />,
    );

    expect(
      Marker.mock.calls.filter(
        ([options]: [{ element?: HTMLElement }]) =>
          options.element?.getAttribute("data-beach-id") === beach.id,
      ),
    ).toHaveLength(1);
    expect(marker.remove).not.toHaveBeenCalled();
    expect(
      (
        window as typeof window & {
          __quiverMapMarkerRebuildCount?: number;
        }
      ).__quiverMapMarkerRebuildCount,
    ).toBe(rebuildCount);
    expect(
      (window as typeof window & { __quiverMapVisibleMarkerCount?: number })
        .__quiverMapVisibleMarkerCount,
    ).toBe(1);
  });

  it("reuses a stable cluster marker when equivalent beaches are reindexed", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const beaches = [
      {
        id: "beach-1",
        name: "Cluster Beach One",
        lat: 32.75,
        lon: -117.25,
      },
      {
        id: "beach-2",
        name: "Cluster Beach Two",
        lat: 32.7501,
        lon: -117.2501,
      },
    ] as import("@/types/database").Beach[];
    const { rerender } = render(<InteractiveMap beaches={beaches} />);

    const Marker = require("mapbox-gl").Marker;
    await waitFor(() => {
      expect(
        Marker.mock.calls.filter(
          ([options]: [{ element?: HTMLElement }]) =>
            options.element?.getAttribute("data-testid") === "cluster-marker",
        ),
      ).not.toHaveLength(0);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const clusterMarkerCallIndexes = Marker.mock.calls.reduce(
      (
        indexes: number[],
        [options]: [{ element?: HTMLElement }],
        index: number,
      ) => {
        if (options.element?.getAttribute("data-testid") === "cluster-marker") {
          indexes.push(index);
        }
        return indexes;
      },
      [],
    );
    const markerCallIndex = clusterMarkerCallIndexes.at(-1);
    if (markerCallIndex === undefined) {
      throw new Error("Expected a settled cluster marker");
    }
    const marker = mockMarkerInstances[markerCallIndex];
    const clusterMarkerCallCount = clusterMarkerCallIndexes.length;
    const rebuildCount = (
      window as typeof window & { __quiverMapMarkerRebuildCount?: number }
    ).__quiverMapMarkerRebuildCount;

    rerender(
      <InteractiveMap beaches={beaches.map((beach) => ({ ...beach }))} />,
    );

    expect(
      Marker.mock.calls.filter(
        ([options]: [{ element?: HTMLElement }]) =>
          options.element?.getAttribute("data-testid") === "cluster-marker",
      ),
    ).toHaveLength(clusterMarkerCallCount);
    expect(marker.remove).not.toHaveBeenCalled();
    expect(
      (
        window as typeof window & {
          __quiverMapMarkerRebuildCount?: number;
        }
      ).__quiverMapMarkerRebuildCount,
    ).toBe(rebuildCount);
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
        expect.objectContaining({ id: beach.id }),
        expect.objectContaining({ tideState: null, tideHeight: null }),
      );
      expect(calloutMarkerCallCount()).toBe(1);

      fireEvent.click(getBeachMarkerBadge(beach.id));
      expect(onLocationClick).toHaveBeenCalledTimes(1);
    });

    it("passes the displayed spot conditions to the embed host", async () => {
      const { InteractiveMap } = await import(
        "@/components/map/interactive-map"
      );
      const onLocationClick = jest.fn();
      const onDisplayForecastsChange = jest.fn();
      const heldBeach = {
        ...beach,
        waterQualityHold: "advisory",
      } as typeof beach & { waterQualityHold: "advisory" };
      const partition = {
        s1Dir: 280,
        swellDirOm: 292.5,
        s1PeriodS: 13.6,
        s1HeightFt: 2.4,
        s2Dir: null,
        s2PeriodS: null,
        s2HeightFt: null,
        windDir: 270,
        windMph: 5.6,
      };
      global.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            forecasts: { [beach.id]: 2.4 },
            displayForecasts: { [beach.id]: { label: "2-3ft" } },
            waterTemps: {},
            conditionScores: { [beach.id]: 82 },
            conditionSummaries: { [beach.id]: "GOOD" },
            isCalibrated: { [beach.id]: false },
            swellPartitions: { [beach.id]: partition },
            hourlySwellTimeline: {
              timestamps: ["2026-07-10T20:00:00.000Z"],
              partitionsByBeach: { [beach.id]: [partition] },
              hasMore: false,
              nextStart: null,
            },
          },
        }),
      })) as jest.Mock;

      render(
        <InteractiveMap
          beaches={[heldBeach]}
          autoNavigateOnMarkerClick={false}
          disableBeachClustering
          markerDisplay="points"
          showConditionsOnTap
          swellTimelineMode="hourly"
          swellTimelineIndex={0}
          onDisplayForecastsChange={onDisplayForecastsChange}
          onLocationClick={onLocationClick}
        />
      );

      await waitFor(() => {
        expect(onDisplayForecastsChange).toHaveBeenCalledWith(
          expect.objectContaining({ get: expect.any(Function) }),
        );
        expect(getBeachMarkerBadge(beach.id)).toHaveAttribute(
          "data-marker-badge",
          "true",
        );
      });

      fireEvent.click(getBeachMarkerBadge(beach.id));

      expect(onLocationClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: beach.id }),
        {
          conditionSummary: "WATER QUALITY ADVISORY",
          waterQualityHold: "advisory",
          waveHeight: "2-3ft",
          swellPeriod: "14s",
          swellDirection: "W",
          isCalibrated: false,
          windSpeed: "6 mph",
          windDirection: "W",
          tideState: null,
          tideHeight: null,
        },
      );
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

  it.each([
    ["advanced", "advanced"],
    [undefined, null],
  ] as const)("forwards skill %s on the initial bulk request", async (skillLevel, expected) => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { forecasts: {} } }),
    });

    render(
      <InteractiveMap
        beaches={[{
          id: "beach-1",
          name: "Mission Beach",
          lat: 32.77,
          lon: -117.25,
        } as import("@/types/database").Beach]}
        skillLevel={skillLevel}
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const requestUrl = new URL(
      String((global.fetch as jest.Mock).mock.calls[0][0]),
      "https://example.test",
    );
    expect(requestUrl.searchParams.get("skillLevel")).toBe(expected);
  });

  it("keeps the swell field in a truthful loading state until the initial forecast resolves", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    let resolveFetch: ((response: Response) => void) | null = null;
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <InteractiveMap
        beaches={[
          {
            id: "beach-1",
            name: "Mission Beach",
            lat: 32.77,
            lon: -117.25,
          } as import("@/types/database").Beach,
        ]}
        showSwellField
        swellTimelineMode="expandable-hourly"
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const requestUrl = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(requestUrl).toContain("timelineHours=48");
    expect(screen.getByTestId("swell-field-loading-note")).toBeInTheDocument();
    expect(screen.queryByTestId("swell-field-empty-note")).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch?.({
        ok: true,
        status: 200,
        json: async () =>
          timelineResponse(
            ["beach-1"],
            "2026-07-10T20:00:00.000Z",
            48,
            false,
          ),
      } as Response);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("swell-field-loading-note")).not.toBeInTheDocument();
      expect(screen.getByTestId("swell-field-empty-note")).toHaveAttribute(
        "role",
        "status",
      );
      expect(screen.getByTestId("swell-field-empty-note")).toHaveTextContent(
        "No swell data for this forecast hour",
      );
      expect(screen.getByTestId("swell-field-empty-note")).toHaveStyle({
        bottom: "12px",
      });
    });
  });

  it("rebuilds an owed swell mask on sourcedata without waiting for idle", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockStyleLayers = [{ id: "water" }];
    mockHasViewportChanged.mockReturnValue(false);
    mockTilesLoaded = false;
    mockQueryRenderedFeatures.mockImplementation(() =>
      mockQueryRenderedFeatures.mock.calls.length % 2 === 0 ? [{}] : [],
    );
    const partition = {
      s1Dir: 250,
      s1PeriodS: 13,
      s1HeightFt: 3,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: 280,
      windMph: 6,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          swellPartitions: { "san-diego": partition },
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: { "san-diego": [partition] },
            hasMore: false,
            nextStart: null,
          },
        },
      }),
    }) as unknown as typeof fetch;
    const beach = {
      id: "san-diego",
      name: "San Diego",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;

    render(
      <InteractiveMap
        beaches={[beach]}
        showSwellField
        swellLayerId="s1"
        swellTimelineMode="expandable-hourly"
      />,
    );

    // The provisional field build still queries and masks while tiles are stalled.
    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalled());
    await waitFor(() => expect(mockMapHandlers["style.load"].length).toBeGreaterThan(1));
    await waitFor(() => expect(mockMapHandlers.sourcedata.length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const queriesAfterBuild = mockQueryRenderedFeatures.mock.calls.length;
    expect(queriesAfterBuild).toBeGreaterThan(0);

    const fire = (event: string): void => {
      act(() => {
        for (const handler of mockMapHandlers[event]) handler();
      });
    };

    // A sourcedata event rebuilds and re-masks once tiles finish, with no idle event.
    mockTilesLoaded = true;
    fire("sourcedata");
    await waitFor(() =>
      expect(mockQueryRenderedFeatures.mock.calls.length).toBeGreaterThan(queriesAfterBuild),
    );
    const queriesAfterTiles = mockQueryRenderedFeatures.mock.calls.length;

    // A style reload invalidates the cached verdicts and owes one more remask.
    fire("style.load");
    jest.useFakeTimers();
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    fire("data");
    await waitFor(() =>
      expect(mockQueryRenderedFeatures.mock.calls.length).toBeGreaterThan(
        queriesAfterTiles,
      ),
    );
    const queriesAfterStyle = mockQueryRenderedFeatures.mock.calls.length;

    // Loaded tiles can still have no queryable water features until rendered.
    mockQueryRenderedFeatures.mockReturnValue([]);
    fire("style.load");
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    fire("data");
    const queriesAfterRejectedPass = mockQueryRenderedFeatures.mock.calls.length;
    expect(queriesAfterRejectedPass).toBeGreaterThan(queriesAfterStyle);
    mockQueryRenderedFeatures.mockReturnValue([{}]);
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    fire("data");
    const queriesAfterRecovery = mockQueryRenderedFeatures.mock.calls.length;
    expect(queriesAfterRecovery).toBeGreaterThan(queriesAfterRejectedPass);
    fire("data");
    expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(queriesAfterRecovery);
    jest.useRealTimers();
  });

  it("reuses cached cell verdicts across moveend and queries only missing cells", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockStyleLayers = [{ id: "water" }];
    mockHasViewportChanged.mockReturnValue(false);
    mockProject.mockImplementation(([lon]: [number, number]) => ({
      x: lon === -117.2 ? 900 : 400,
      y: 300,
    }));
    const partition = {
      s1Dir: 250,
      s1PeriodS: 13,
      s1HeightFt: 3,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: null,
      windMph: null,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          swellPartitions: { "san-diego": partition },
        },
      }),
    }) as unknown as typeof fetch;

    render(
      <InteractiveMap
        beaches={[{
          id: "san-diego",
          name: "San Diego",
          lat: 32.75,
          lon: -117.25,
        } as import("@/types/database").Beach]}
        showSwellField
        swellLayerId="s1"
      />,
    );

    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(132));
    mockProject.mockImplementation(() => ({ x: 400, y: 300 }));
    act(() => {
      for (const handler of mockMapHandlers.moveend) handler();
    });
    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(144));

    act(() => {
      for (const handler of mockMapHandlers.moveend) handler();
    });
    expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(144);
  });

  it("invalidates cached water verdicts when the integer zoom bucket changes", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockStyleLayers = [{ id: "water" }];
    mockHasViewportChanged.mockReturnValue(false);
    const partition = {
      s1Dir: 250,
      s1PeriodS: 13,
      s1HeightFt: 3,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: null,
      windMph: null,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { forecasts: {}, swellPartitions: { "san-diego": partition } },
      }),
    }) as unknown as typeof fetch;

    render(
      <InteractiveMap
        beaches={[{
          id: "san-diego",
          name: "San Diego",
          lat: 32.75,
          lon: -117.25,
        } as import("@/types/database").Beach]}
        showSwellField
        swellLayerId="s1"
      />,
    );

    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(144));
    mockMapZoom = 13.9;
    act(() => {
      for (const handler of mockMapHandlers.moveend) handler();
    });
    expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(144);

    mockMapZoom = 14;
    act(() => {
      for (const handler of mockMapHandlers.moveend) handler();
    });
    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(288));
  });

  it("updates a playback field from its cached grid without querying warm mask verdicts", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockStyleLayers = [{ id: "water" }];
    const first = {
      s1Dir: 250,
      s1PeriodS: 10,
      s1HeightFt: 2,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: null,
      windMph: null,
    };
    const second = { ...first, s1PeriodS: 16, s1HeightFt: 5 };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          swellPartitions: { "san-diego": first },
          swellPartitionTimeline: { "san-diego": [first, second] },
        },
      }),
    }) as unknown as typeof fetch;
    const beach = {
      id: "san-diego",
      name: "San Diego",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;
    const props = (swellTimelineIndex: number) => ({
      beaches: [beach],
      showSwellField: true,
      swellLayerId: "s1" as const,
      swellTimelineSteps: ["Now", "+3h"],
      swellTimelineIndex,
    });
    const { rerender } = render(<InteractiveMap {...props(0)} />);

    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(144));
    rerender(<InteractiveMap {...props(1)} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(144);
  });

  it("throttles repeated owed swell mask retries to once per second", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockStyleLayers = [{ id: "water" }];
    mockHasViewportChanged.mockReturnValue(false);
    mockQueryRenderedFeatures.mockReturnValue([]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          swellPartitions: {
            "san-diego": {
              s1Dir: 250,
              s1PeriodS: 13,
              s1HeightFt: 3,
              s2Dir: null,
              s2PeriodS: null,
              s2HeightFt: null,
              windDir: 280,
              windMph: 6,
            },
          },
        },
      }),
    }) as unknown as typeof fetch;

    render(
      <InteractiveMap
        beaches={[
          {
            id: "san-diego",
            name: "San Diego",
            lat: 32.75,
            lon: -117.25,
          } as import("@/types/database").Beach,
        ]}
        showSwellField
        swellLayerId="s1"
      />,
    );

    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalled());
    await waitFor(() => expect(mockMapHandlers.data.length).toBeGreaterThan(0));
    const fire = (event: "data" | "sourcedata"): void => {
      act(() => {
        for (const handler of mockMapHandlers[event]) handler();
      });
    };

    const queriesAfterBuild = mockQueryRenderedFeatures.mock.calls.length;
    fire("data");
    await waitFor(() =>
      expect(mockQueryRenderedFeatures.mock.calls.length).toBeGreaterThan(
        queriesAfterBuild,
      ),
    );
    const queriesAfterFirstRetry = mockQueryRenderedFeatures.mock.calls.length;
    jest.useFakeTimers();

    for (let event = 0; event < 10; event += 1) {
      fire(event % 2 === 0 ? "sourcedata" : "data");
    }
    expect(mockQueryRenderedFeatures).toHaveBeenCalledTimes(
      queriesAfterFirstRetry,
    );

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    fire("data");
    await waitFor(() =>
      expect(mockQueryRenderedFeatures.mock.calls.length).toBeGreaterThan(
        queriesAfterFirstRetry,
      ),
    );
    jest.useRealTimers();
  });

  it("retries an owed swell mask on the fallback timer", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockStyleLayers = [{ id: "water" }];
    mockHasViewportChanged.mockReturnValue(false);
    mockTilesLoaded = false;
    mockQueryRenderedFeatures.mockImplementation(() =>
      mockQueryRenderedFeatures.mock.calls.length % 2 === 0 ? [{}] : [],
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          swellPartitions: {
            "san-diego": {
              s1Dir: 250,
              s1PeriodS: 13,
              s1HeightFt: 3,
              s2Dir: null,
              s2PeriodS: null,
              s2HeightFt: null,
              windDir: 280,
              windMph: 6,
            },
          },
        },
      }),
    }) as unknown as typeof fetch;

    render(
      <InteractiveMap
        beaches={[
          {
            id: "san-diego",
            name: "San Diego",
            lat: 32.75,
            lon: -117.25,
          } as import("@/types/database").Beach,
        ]}
        showSwellField
        swellLayerId="s1"
      />,
    );

    await waitFor(() => expect(mockQueryRenderedFeatures).toHaveBeenCalled());
    const queriesAfterBuild = mockQueryRenderedFeatures.mock.calls.length;
    mockTilesLoaded = true;

    await waitFor(
      () =>
        expect(mockQueryRenderedFeatures.mock.calls.length).toBeGreaterThan(
          queriesAfterBuild,
        ),
      { timeout: 2_000 },
    );
  });

  it("does not deadlock loaded swell data when map bounds are briefly unavailable", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockMapBoundsAvailable = false;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: { "beach-1": 3 },
          swellPartitions: {
            "beach-1": {
              s1Dir: 250,
              s1PeriodS: 13,
              s1HeightFt: 3,
              s2Dir: null,
              s2PeriodS: null,
              s2HeightFt: null,
              windDir: 280,
              windMph: 6,
            },
          },
        },
      }),
    }) as unknown as typeof fetch;

    render(
      <InteractiveMap
        beaches={[
          {
            id: "beach-1",
            name: "Mission Beach",
            lat: 32.77,
            lon: -117.25,
          } as import("@/types/database").Beach,
        ]}
        showSwellField
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.queryByTestId("swell-field-loading-note")).not.toBeInTheDocument();
      expect(screen.queryByTestId("swell-field-empty-note")).not.toBeInTheDocument();
    });
  });

  it.each([
    {
      label: "a 500 response",
      response: {
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response,
    },
    {
      label: "a malformed hourly envelope",
      response: {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            forecasts: {},
            hourlySwellTimeline: {
              timestamps: ["not-a-time"],
              partitionsByBeach: { "beach-1": [] },
              hasMore: false,
              nextStart: null,
            },
          },
        }),
      } as Response,
    },
  ])("labels $label as unavailable instead of empty", async ({ response }) => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    global.fetch = jest.fn().mockResolvedValue(response);

    render(
      <InteractiveMap
        beaches={[
          {
            id: "beach-1",
            name: "Mission Beach",
            lat: 32.77,
            lon: -117.25,
          } as import("@/types/database").Beach,
        ]}
        showSwellField
        swellTimelineMode="expandable-hourly"
      />,
    );

    expect(
      await screen.findByTestId("swell-field-unavailable-note"),
    ).toHaveAttribute("role", "status");
    expect(screen.queryByTestId("swell-field-empty-note")).not.toBeInTheDocument();
  });

  it("aborts a stale forecast request before loading a replacement beach set", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const signals: AbortSignal[] = [];
    global.fetch = jest.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signals.push(signal);
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }
          if (signals.length === 1) return;
          const url = new URL(String(input), "https://example.test");
          const ids = (url.searchParams.get("beachIds") ?? "")
            .split(",")
            .filter(Boolean);
          resolve({
            ok: true,
            status: 200,
            json: async () =>
              timelineResponse(ids, "2026-07-10T20:00:00.000Z", 8, false),
          } as Response);
        }),
    ) as unknown as typeof fetch;
    const beach = (id: string) => ({
      id,
      name: id,
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach);
    const { rerender } = render(
      <InteractiveMap
        beaches={[beach("a")]}
        swellTimelineMode="expandable-hourly"
      />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    rerender(
      <InteractiveMap
        beaches={[beach("b")]}
        swellTimelineMode="expandable-hourly"
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("repopulates on auth generation changes and discards the stale account response", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const signals: AbortSignal[] = [];
    let accessToken = "account-a-token";
    let authGeneration = 0;
    let resolveFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      if (signals.length === 1) return firstResponse;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: { forecasts: { a: 7 } } }),
      } as Response);
    }) as unknown as typeof fetch;
    const getAccessToken = (): string => accessToken;
    const getAuthGeneration = (): number => authGeneration;
    const onWaveHeightsChange = jest.fn();
    const beaches = [{
      id: "a",
      name: "A",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach];
    const { rerender } = render(
      <InteractiveMap
        authGeneration={0}
        beaches={beaches}
        getAccessToken={getAccessToken}
        getAuthGeneration={getAuthGeneration}
        onWaveHeightsChange={onWaveHeightsChange}
      />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    accessToken = "account-b-token";
    authGeneration = 1;
    rerender(
      <InteractiveMap
        authGeneration={1}
        beaches={beaches}
        getAccessToken={getAccessToken}
        getAuthGeneration={getAuthGeneration}
        onWaveHeightsChange={onWaveHeightsChange}
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveFirst({
        ok: true,
        status: 200,
        json: async () => ({ data: { forecasts: { a: 3 } } }),
      } as Response);
      await firstResponse;
    });
    await waitFor(() => {
      expect(
        onWaveHeightsChange.mock.calls.some(([waveHeights]) => waveHeights.get("a") === 7),
      ).toBe(true);
    });
    expect(signals[0].aborted).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer account-a-token",
    });
    expect((global.fetch as jest.Mock).mock.calls[1][1].headers).toEqual({
      Authorization: "Bearer account-b-token",
    });
    expect(
      onWaveHeightsChange.mock.calls.some(([waveHeights]) => waveHeights.get("a") === 3),
    ).toBe(false);
  });

  it("aborts and invalidates a stale forecast request when the region viewport changes", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const signals: AbortSignal[] = [];
    global.fetch = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          signals.push(signal);
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    ) as unknown as typeof fetch;
    const beach = {
      id: "san-diego",
      name: "San Diego",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;
    const { rerender } = render(
      <InteractiveMap beaches={[beach]} swellTimelineMode="expandable-hourly" />,
    );
    await waitFor(() => expect(signals).toHaveLength(1));

    rerender(
      <InteractiveMap
        beaches={[beach]}
        swellTimelineMode="expandable-hourly"
        regionViewport={{
          region: "Oahu",
          key: "oahu",
          center: [21.28, -157.85],
          zoom: 11,
        }}
      />,
    );

    await waitFor(() => expect(signals[0].aborted).toBe(true));
    expect(getMapInstance().easeTo).toHaveBeenCalledWith({
      center: [-157.85, 21.28],
      zoom: 11,
      duration: 800,
    });
  });

  it("removes the prior coast's swell state as soon as a new region is requested", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const onHourlyTimelineLoaded = jest.fn();
    const partition = {
      s1Dir: 250,
      s1PeriodS: 13,
      s1HeightFt: 3,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: 280,
      windMph: 6,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          swellPartitions: { "san-diego": partition },
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: { "san-diego": [partition] },
            hasMore: false,
            nextStart: null,
          },
        },
      }),
    }) as unknown as typeof fetch;
    const beach = {
      id: "san-diego",
      name: "San Diego",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;
    const { rerender } = render(
      <InteractiveMap
        beaches={[beach]}
        showSwellField
        swellTimelineMode="expandable-hourly"
        onHourlyTimelineLoaded={onHourlyTimelineLoaded}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("swell-field-loading-note")).not.toBeInTheDocument();
      expect(screen.getByTestId("swell-day-timeline")).toBeInTheDocument();
    });

    rerender(
      <InteractiveMap
        beaches={[beach]}
        showSwellField
        swellTimelineMode="expandable-hourly"
        onHourlyTimelineLoaded={onHourlyTimelineLoaded}
        regionViewport={{
          region: "Oahu",
          key: "oahu",
          center: [21.28, -157.85],
          zoom: 11,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("swell-field-loading-note")).toBeInTheDocument();
      expect(screen.queryByTestId("swell-day-timeline")).not.toBeInTheDocument();
    });
    expect(onHourlyTimelineLoaded).toHaveBeenLastCalledWith(null);
  });

  it("keeps enriched state during the initial native viewport correction", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const partition = {
      s1Dir: 250,
      s1PeriodS: 13,
      s1HeightFt: 3,
      s2Dir: null,
      s2PeriodS: null,
      s2HeightFt: null,
      windDir: 280,
      windMph: 6,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          forecasts: {},
          swellPartitions: { "san-diego": partition },
          hourlySwellTimeline: {
            timestamps: ["2026-07-10T20:00:00.000Z"],
            partitionsByBeach: { "san-diego": [partition] },
            hasMore: false,
            nextStart: null,
          },
        },
      }),
    }) as unknown as typeof fetch;
    const beach = {
      id: "san-diego",
      name: "San Diego",
      lat: 32.75,
      lon: -117.25,
    } as import("@/types/database").Beach;
    const { rerender } = render(
      <InteractiveMap
        beaches={[beach]}
        showSwellField
        swellTimelineMode="expandable-hourly"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("swell-field-loading-note")).not.toBeInTheDocument();
      expect(screen.getByTestId("swell-day-timeline")).toBeInTheDocument();
    });

    rerender(
      <InteractiveMap
        beaches={[beach]}
        showSwellField
        swellTimelineMode="expandable-hourly"
        regionViewport={{
          region: "native",
          key: "native-1",
          center: [32.78, -117.26],
          zoom: 11.5,
        }}
      />,
    );

    await waitFor(() => {
      expect(getMapInstance().easeTo).toHaveBeenCalledWith({
        center: [-117.26, 32.78],
        zoom: 11.5,
        duration: 800,
      });
    });
    expect(screen.queryByTestId("swell-field-loading-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("swell-day-timeline")).toBeInTheDocument();
  });

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

  it("reloads the same viewport when the timeline focus beach changes", async () => {
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
    const beaches = Array.from({ length: 10 }, (_, index) => ({
      id: `a${index}`,
      name: `Beach ${index}`,
      lat: 32.75,
      lon: -117.25,
    })) as import("@/types/database").Beach[];
    const { rerender } = render(
      <InteractiveMap
        beaches={beaches}
        swellTimelineMode="expandable-hourly"
        timelineFocusBeachId="a0"
      />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    rerender(
      <InteractiveMap
        beaches={beaches}
        swellTimelineMode="expandable-hourly"
        timelineFocusBeachId="a9"
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const firstUrl = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]), "https://example.test");
    const secondUrl = new URL(String((global.fetch as jest.Mock).mock.calls[1][0]), "https://example.test");
    expect(firstUrl.searchParams.get("timelineBeachIds")?.split(",")).toContain("a0");
    expect(secondUrl.searchParams.get("timelineBeachIds")?.split(",")).toContain("a9");
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
        getAccessToken={() => "signed-user-token"}
        showSwellField
        skillLevel="advanced"
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
    for (const [requestUrl, requestInit] of (global.fetch as jest.Mock).mock.calls) {
      expect(new URL(String(requestUrl), "https://example.test").searchParams.get("skillLevel"))
        .toBe("advanced");
      expect(requestInit).toEqual(expect.objectContaining({
        headers: { Authorization: "Bearer signed-user-token" },
      }));
    }
  });
});
