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

  it("serializes events for React Native WebView", () => {
    expect(
      serializeEmbedMapEvent({
        type: "placementChanged",
        payload: { lat: 32.87, lon: -117.25 },
      }),
    ).toBe('{"type":"placementChanged","payload":{"lat":32.87,"lon":-117.25}}');
  });
});
