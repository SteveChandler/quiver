import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  fetchNwsPoint,
  zoneCodeFromUrl,
} from "../backfill-nws-zones";

describe("backfill-nws-zones", () => {
  const scriptPath = join(__dirname, "../backfill-nws-zones.ts");

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("selects the current beaches coordinate columns", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain('.select("id, name, lat, lon")');
    expect(script).not.toContain("center_lat");
    expect(script).not.toContain("center_lng");
  });

  it("extracts UGC zone codes from NWS forecast zone URLs", () => {
    expect(
      zoneCodeFromUrl("https://api.weather.gov/zones/forecast/CAZ043")
    ).toBe("CAZ043");
    expect(
      zoneCodeFromUrl("https://api.weather.gov/zones/forecast/NCZ203")
    ).toBe("NCZ203");
    expect(zoneCodeFromUrl(undefined)).toBeNull();
    expect(zoneCodeFromUrl("https://api.weather.gov/zones/marine/PZZ750")).toBeNull();
  });

  it("fetches NWS points with rounded lat/lon and required User-Agent", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        properties: {
          forecastZone: "https://api.weather.gov/zones/forecast/CAZ043",
          cwa: "SGX",
        },
      }),
    } as Response);

    await expect(fetchNwsPoint(32.750012, -117.250078)).resolves.toEqual({
      properties: {
        forecastZone: "https://api.weather.gov/zones/forecast/CAZ043",
        cwa: "SGX",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.weather.gov/points/32.7500,-117.2501",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/geo+json",
          "User-Agent": expect.stringContaining("quiver-surf"),
        }),
      })
    );
  });
});
