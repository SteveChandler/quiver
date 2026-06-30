import {
  parseEmbedMapCommand,
  serializeEmbedMapEvent,
} from "@/components/map/embed-map-bridge";

describe("embed map bridge", () => {
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
  });
});
