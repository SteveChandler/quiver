import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import {
  parseEmbedMapCommand,
  serializeEmbedMapEvent,
} from "@/components/map/embed-map-bridge";
import type { HourlySwellTimeline } from "@/app/api/forecasts/bulk/route";
import type { MapSpotConditions } from "@/components/map/interactive-map";
import type { Beach } from "@/types/database";

let mockSearchParams = new URLSearchParams();
let mockInteractiveMapProps: Record<string, unknown> = {};

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock("next/dynamic", () => () => {
  return function MockInteractiveMap(props: Record<string, unknown>) {
    mockInteractiveMapProps = props;
    return null;
  };
});

function hourlyTimeline(): HourlySwellTimeline {
  const timestamps = Array.from(
    { length: 43 },
    (_, index) => new Date(Date.UTC(2026, 6, 10, 20 + index)).toISOString(),
  );

  return {
    timestamps,
    partitionsByBeach: { "beach-1": timestamps.map(() => null) },
    hasMore: false,
    nextStart: null,
  };
}

describe("embed map bridge", () => {
  it.each([
    ["skill=advanced", "advanced"],
    ["", undefined],
  ])("passes the embed skill hint to the map for %s", async (query, expected) => {
    mockSearchParams = new URLSearchParams(query);
    delete window.ReactNativeWebView;
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");
    const view = render(React.createElement(EmbedMapClient));

    expect(mockInteractiveMapProps.skillLevel).toBe(expected);
    view.unmount();
  });

  it("parses viewport commands from JSON", () => {
    expect(
      parseEmbedMapCommand(
        JSON.stringify({
          type: "setViewport",
          payload: {
            center: { lat: 32.87, lon: -117.25 },
            zoom: 12.7,
            bounds: { west: -118, south: 32, east: -117, north: 33 },
          },
        }),
      ),
    ).toEqual({
      type: "setViewport",
      payload: {
        center: { lat: 32.87, lon: -117.25 },
        zoom: 12.7,
        bounds: { west: -118, south: 32, east: -117, north: 33 },
      },
    });
  });

  it("rejects invalid layer commands", () => {
    expect(
      parseEmbedMapCommand({
        type: "setLayer",
        payload: { layerId: "rainbow" },
      }),
    ).toBeNull();
  });

  it("rounds forecast time indexes", () => {
    expect(
      parseEmbedMapCommand({
        type: "setForecastTime",
        payload: { index: 3.6 },
      }),
    ).toEqual({
      type: "setForecastTime",
      payload: { index: 4 },
    });
  });

  it("clamps forecast time indexes to the exposed timeline range", () => {
    expect(
      parseEmbedMapCommand({
        type: "setForecastTime",
        payload: { index: 99 },
      }),
    ).toEqual({
      type: "setForecastTime",
      payload: { index: 7 },
    });
    expect(
      parseEmbedMapCommand({
        type: "setForecastTime",
        payload: { index: -1 },
      }),
    ).toEqual({
      type: "setForecastTime",
      payload: { index: 0 },
    });
  });

  it("accepts hourly forecast indexes when the embed exposes an hourly range", () => {
    expect(
      parseEmbedMapCommand(
        { type: "setForecastTime", payload: { index: 42 } },
        42,
      ),
    ).toEqual({
      type: "setForecastTime",
      payload: { index: 42 },
    });
  });

  it("parses field-visibility commands", () => {
    expect(
      parseEmbedMapCommand({ type: "setFieldVisible", payload: { visible: false } }),
    ).toEqual({ type: "setFieldVisible", payload: { visible: false } });
    expect(
      parseEmbedMapCommand({ type: "setFieldVisible", payload: { visible: "no" } }),
    ).toBeNull();
  });

  it("parses forecast playback commands", () => {
    expect(
      parseEmbedMapCommand({ type: "setForecastPlaying", payload: { playing: true } }),
    ).toEqual({ type: "setForecastPlaying", payload: { playing: true } });
    expect(
      parseEmbedMapCommand({ type: "setForecastPlaying", payload: {} }),
    ).toBeNull();
  });

  it("strictly validates auth token commands", () => {
    expect(
      parseEmbedMapCommand({
        type: "auth_token",
        payload: { accessToken: "header.payload.signature" },
      }),
    ).toEqual({
      type: "auth_token",
      payload: { accessToken: "header.payload.signature" },
    });
    expect(
      parseEmbedMapCommand({ type: "auth_token", payload: { accessToken: null } }),
    ).toEqual({ type: "auth_token", payload: { accessToken: null } });
    const maxLengthToken = `${"a".repeat(4092)}.b.c`;
    expect(parseEmbedMapCommand({
      type: "auth_token",
      payload: { accessToken: maxLengthToken },
    })).toEqual({ type: "auth_token", payload: { accessToken: maxLengthToken } });
    for (const payload of [
      { accessToken: 123 },
      {},
      { accessToken: "header.payload" },
      { accessToken: "header.pay+load.signature" },
      { accessToken: `${"a".repeat(4093)}.b.c` },
      { accessToken: "header.payload.signature", extra: true },
    ]) {
      expect(parseEmbedMapCommand({ type: "auth_token", payload })).toBeNull();
    }
  });

  it("ignores auth tokens in a plain browser document", async () => {
    delete window.ReactNativeWebView;
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");
    const view = render(React.createElement(EmbedMapClient));
    const getAccessToken = mockInteractiveMapProps.getAccessToken as () => string | null;

    act(() => {
      document.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({
          type: "auth_token",
          payload: { accessToken: "header.payload.signature" },
        }),
      }));
    });

    expect(getAccessToken()).toBeNull();
    expect(mockInteractiveMapProps.authGeneration).toBe(0);
    view.unmount();
  });

  it("accepts auth tokens only from the native document channel", async () => {
    const postMessage = jest.fn();
    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage },
    });
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");
    const view = render(React.createElement(EmbedMapClient));
    const getAccessToken = mockInteractiveMapProps.getAccessToken as () => string | null;

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({
          type: "auth_token",
          payload: { accessToken: "window.payload.token" },
        }),
        source: window,
      }));
    });
    expect(getAccessToken()).toBeNull();

    act(() => {
      document.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({
          type: "auth_token",
          payload: { accessToken: "native.payload.token" },
        }),
      }));
    });
    expect(getAccessToken()).toBe("native.payload.token");
    expect(mockInteractiveMapProps.authGeneration).toBe(1);

    act(() => {
      for (const payload of [
        { accessToken: "invalid" },
        { accessToken: `${"a".repeat(4093)}.b.c` },
        { accessToken: "other.payload.token", extra: true },
      ]) {
        document.dispatchEvent(new MessageEvent("message", {
          data: JSON.stringify({ type: "auth_token", payload }),
        }));
      }
      window.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({ type: "auth_token", payload: { accessToken: null } }),
        source: window,
      }));
      window.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({
          type: "auth_token",
          payload: { accessToken: "replacement.payload.token" },
        }),
        source: window,
      }));
    });
    expect(getAccessToken()).toBe("native.payload.token");
    expect(mockInteractiveMapProps.authGeneration).toBe(1);

    act(() => {
      document.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({ type: "auth_token", payload: { accessToken: null } }),
      }));
    });
    expect(getAccessToken()).toBeNull();
    expect(mockInteractiveMapProps.authGeneration).toBe(2);

    view.unmount();
  });

  it("emits auth token expiry through the native bridge", async () => {
    const postMessage = jest.fn();
    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage },
    });
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");
    render(React.createElement(EmbedMapClient));
    const onAuthTokenExpired = mockInteractiveMapProps.onAuthTokenExpired as () => void;

    act(() => onAuthTokenExpired());

    expect(postMessage).toHaveBeenCalledWith('{"type":"auth_token_expired"}');
  });

  it("parses a bounded marker-focus command", () => {
    expect(
      parseEmbedMapCommand({
        type: "focusSelectedSpot",
        payload: { beachId: "beach-1" },
      }),
    ).toEqual({
      type: "focusSelectedSpot",
      payload: { beachId: "beach-1" },
    });
    expect(
      parseEmbedMapCommand({ type: "focusSelectedSpot", payload: {} }),
    ).toBeNull();
  });

  it("returns focus to the selected marker when native closes its sheet", async () => {
    mockSearchParams = new URLSearchParams();
    const marker = document.createElement("div");
    marker.setAttribute("data-testid", "beach-marker");
    marker.setAttribute("data-beach-id", "beach-1");
    const button = document.createElement("button");
    button.setAttribute("data-marker-badge", "true");
    marker.appendChild(button);
    document.body.appendChild(marker);

    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");
    const view = render(React.createElement(EmbedMapClient));

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: JSON.stringify({
          type: "focusSelectedSpot",
          payload: { beachId: "beach-1" },
        }),
        source: window,
      }));
    });

    expect(document.activeElement).toBe(button);
    view.unmount();
    marker.remove();
  });

  it("serializes events for React Native WebView", () => {
    expect(
      serializeEmbedMapEvent({
        type: "placementChanged",
        payload: { lat: 32.87, lon: -117.25 },
      }),
    ).toBe('{"type":"placementChanged","payload":{"lat":32.87,"lon":-117.25}}');
    expect(
      serializeEmbedMapEvent({ type: "forecastTimeChanged", payload: { index: 2 } }),
    ).toBe('{"type":"forecastTimeChanged","payload":{"index":2}}');
    expect(
      serializeEmbedMapEvent({
        type: "viewportChanged",
        payload: {
          center: { lat: 32.87, lon: -117.25 },
          interactionSource: "user",
        },
      }),
    ).toBe(
      '{"type":"viewportChanged","payload":{"center":{"lat":32.87,"lon":-117.25},"interactionSource":"user"}}',
    );
    expect(
      serializeEmbedMapEvent({
        type: "forecastTimeChanged",
        payload: { index: 42, forecastAt: "2026-07-12T14:00:00.000Z" },
      }),
    ).toBe(
      '{"type":"forecastTimeChanged","payload":{"index":42,"forecastAt":"2026-07-12T14:00:00.000Z"}}',
    );
  });

  it("posts map bounds provenance from the live embed callback", async () => {
    const postMessage = jest.fn();
    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage },
    });
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");
    const view = render(React.createElement(EmbedMapClient));
    const onMapReady = mockInteractiveMapProps.onMapReady as () => void;
    const onBoundsChange = mockInteractiveMapProps.onBoundsChange as (
      bounds: { west: number; south: number; east: number; north: number },
      metadata: { interactionSource: "initial" | "programmatic" | "user" },
    ) => void;

    act(() => onMapReady());
    postMessage.mockClear();
    act(() => onBoundsChange(
      { west: -117.5, south: 32.6, east: -117.4, north: 32.7 },
      { interactionSource: "user" },
    ));

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      type: "viewportChanged",
      payload: {
        center: { lat: 32.65, lon: -117.45 },
        bounds: { west: -117.5, south: 32.6, east: -117.4, north: 32.7 },
        zoom: 11.5,
        interactionSource: "user",
      },
    });
    view.unmount();
  });

  it("posts an enriched spotSelected payload from the map's displayed conditions", async () => {
    mockSearchParams = new URLSearchParams("lat=32.86&lon=-117.25");
    const postMessage = jest.fn();
    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage },
    });
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");
    const beach = {
      id: "beach-1",
      name: "Blacks Beach",
      lat: 32.88,
      lon: -117.25,
      slug: "blacks-beach",
    } as Beach;
    const conditions: MapSpotConditions = {
      conditionSummary: "WATER QUALITY ADVISORY",
      waterQualityHold: "advisory",
      waveHeight: "2-3ft",
      swellPeriod: "14s",
      swellDirection: "WNW",
      isCalibrated: false,
      windSpeed: "6 mph",
      windDirection: "W",
      tideState: null,
      tideHeight: null,
    };

    render(React.createElement(EmbedMapClient));

    const onLocationClick = mockInteractiveMapProps.onLocationClick as
      | ((selectedBeach: Beach, selectedConditions: MapSpotConditions) => void)
      | undefined;
    expect(onLocationClick).toEqual(expect.any(Function));

    act(() => {
      onLocationClick?.(beach, conditions);
    });

    expect(postMessage.mock.calls.map(([message]) => JSON.parse(message))).toContainEqual({
      type: "spotSelected",
      payload: {
        beachId: "beach-1",
        name: "Blacks Beach",
        lat: 32.88,
        lon: -117.25,
        slug: "blacks-beach",
        conditionSummary: "WATER QUALITY ADVISORY",
        waterQualityHold: "advisory",
        waveHeight: "2-3ft",
        swellPeriod: "14s",
        swellDirection: "WNW",
        isCalibrated: false,
        windSpeed: "6 mph",
        windDirection: "W",
        tideState: null,
        tideHeight: null,
      },
    });
  });

  it("posts presentationReady after the useful map surface is assembled", async () => {
    const postMessage = jest.fn();
    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage },
    });
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");

    render(React.createElement(EmbedMapClient));
    const onMapPresentationReady = mockInteractiveMapProps.onMapPresentationReady as
      | (() => void)
      | undefined;

    act(() => {
      onMapPresentationReady?.();
    });

    expect(postMessage).toHaveBeenCalledWith(
      '{"type":"presentationReady","payload":{}}',
    );
  });

  it("keeps legacy native forecast events index-only", async () => {
    mockSearchParams = new URLSearchParams("timeIndex=99");
    const postMessage = jest.fn();
    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage },
    });
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");

    render(React.createElement(EmbedMapClient));

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        '{"type":"forecastTimeChanged","payload":{"index":7}}',
      );
    });
  });

  it("re-emits an hourly step once when its server timestamp arrives", async () => {
    mockSearchParams = new URLSearchParams(
      "timeline=hourly&timeIndex=42&timezone=America/New_York",
    );
    const postMessage = jest.fn();
    Object.defineProperty(window, "ReactNativeWebView", {
      configurable: true,
      value: { postMessage },
    });
    const { EmbedMapClient } = await import("@/app/embed/map/embed-map-client");

    render(React.createElement(EmbedMapClient));

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        '{"type":"forecastTimeChanged","payload":{"index":42}}',
      );
    });

    const onHourlyTimelineLoaded = mockInteractiveMapProps.onHourlyTimelineLoaded as
      | ((timeline: HourlySwellTimeline | null) => void)
      | undefined;
    expect(onHourlyTimelineLoaded).toEqual(expect.any(Function));

    act(() => {
      onHourlyTimelineLoaded?.(hourlyTimeline());
    });

    const expected = {
      type: "forecastTimeChanged",
      payload: { index: 42, forecastAt: "2026-07-12T14:00:00.000Z" },
    };
    await waitFor(() => {
      expect(postMessage.mock.calls.map(([message]) => JSON.parse(message))).toContainEqual(expected);
    });
    const timestampEvents = postMessage.mock.calls.filter(([message]) =>
      JSON.parse(message).payload.forecastAt === "2026-07-12T14:00:00.000Z",
    );

    act(() => {
      onHourlyTimelineLoaded?.(hourlyTimeline());
    });

    expect(
      postMessage.mock.calls.filter(([message]) =>
        JSON.parse(message).payload.forecastAt === "2026-07-12T14:00:00.000Z",
      ),
    ).toHaveLength(timestampEvents.length);
  });
});
