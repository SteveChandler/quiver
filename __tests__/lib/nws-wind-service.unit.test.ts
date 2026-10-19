/** @jest-environment node */
import { apiClient } from "@/lib/utils/api-retry";
import {
  NwsWindService,
  parseNwsWindDirectionDeg,
  parseNwsWindSpeedMs,
} from "@/lib/services/nws-wind-service";

jest.mock("@/lib/utils/api-retry", () => ({ apiClient: { fetchNOAAData: jest.fn() } }));

describe("per-run NWS grid fetches", () => {
  const hourlyUrl = "https://api.weather.gov/gridpoints/SGX/53,34/forecast/hourly";
  const fallbackUrl = "https://api.weather.gov/gridpoints/SGX/53,34/forecast";
  const periods = [10, 11, 12].map(hour => ({ startTime: `2026-09-09T${hour}:00:00Z`, windSpeed: "10 mph", windDirection: "NW" }));
  const params = (lat: number, startHour: number, endHour: number): Parameters<NwsWindService['fetchHourlyWindPoints']>[0] => ({
    lat, lon: -117, start: new Date(`2026-09-09T${startHour}:00:00Z`), end: new Date(`2026-09-09T${endHour}:00:00Z`),
  });
  const fetch = jest.mocked(apiClient.fetchNOAAData);
  beforeEach(() => fetch.mockReset());

  it('shares an in-flight grid request while filtering each beach window independently', async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { release = resolve; });
    fetch.mockImplementation(async url => url.includes('/points/')
      ? Response.json({ properties: { forecastHourly: hourlyUrl } }) : pending.then(response => response.clone()));
    const service = new NwsWindService();
    const cache = new Map();
    const requests = [service.fetchHourlyWindPoints(params(32, 10, 11), cache),
      service.fetchHourlyWindPoints(params(32.001, 11, 12), cache)];
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(fetch.mock.calls.filter(([url]) => url === hourlyUrl)).toHaveLength(1);
    release(Response.json({ properties: { periods } }));
    const [first, second] = await Promise.all(requests);
    expect(first.map(point => point.ts)).toEqual(['2026-09-09T10:00:00.000Z', '2026-09-09T11:00:00.000Z']);
    expect(second.map(point => point.ts)).toEqual(['2026-09-09T11:00:00.000Z', '2026-09-09T12:00:00.000Z']);
    expect(first[0]).toMatchObject({ wind_speed_ms: 10 * 0.44704, wind_direction_deg: 315 });
    await service.fetchHourlyWindPoints(params(32.002, 10, 12), cache);
    expect(fetch.mock.calls.filter(([url]) => url === hourlyUrl)).toHaveLength(1);
    await service.fetchHourlyWindPoints(params(32, 10, 12), new Map());
    expect(fetch.mock.calls.filter(([url]) => url === hourlyUrl)).toHaveLength(2);
    await service.fetchHourlyWindPoints(params(32, 10, 12));
    expect(fetch.mock.calls.filter(([url]) => url === hourlyUrl)).toHaveLength(3);
  });

  it.each(['empty', 'unsupported'])('shares hourly %s results and the fallback without changing the points', async outcome => {
    fetch.mockImplementation(async url => {
      if (url.includes('/points/')) return Response.json({ properties: { forecastHourly: hourlyUrl, forecast: fallbackUrl } });
      if (url === hourlyUrl) return outcome === 'empty'
        ? Response.json({ properties: { periods: [] } })
        : Response.json({ title: 'Marine Forecast Not Supported' }, { status: 404 });
      return Response.json({ properties: { periods } });
    });
    const service = new NwsWindService();
    const cache = new Map();
    const results = await Promise.all([service.fetchHourlyWindPoints(params(32, 10, 12), cache),
      service.fetchHourlyWindPoints(params(32.001, 10, 12), cache)]);
    expect(results[0]).toHaveLength(3);
    expect(results[1]).toEqual(results[0]);
    expect(fetch.mock.calls.filter(([url]) => url === hourlyUrl)).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => url === fallbackUrl)).toHaveLength(1);
  });

  it('retains a rejected grid promise for the run and rejects every caller', async () => {
    fetch.mockImplementation(async url => {
      if (url.includes('/points/')) return Response.json({ properties: { forecastHourly: hourlyUrl } });
      throw new Error('grid outage');
    });
    const service = new NwsWindService();
    const cache = new Map();
    const results = await Promise.allSettled([service.fetchHourlyWindPoints(params(32, 10, 12), cache),
      service.fetchHourlyWindPoints(params(32.001, 10, 12), cache)]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    await expect(service.fetchHourlyWindPoints(params(32.002, 10, 12), cache)).rejects.toThrow('grid outage');
    expect(fetch.mock.calls.filter(([url]) => url === hourlyUrl)).toHaveLength(1);
  });
});

describe("nws-wind-service parsing", () => {
  describe("parseNwsWindDirectionDeg", () => {
    it("parses cardinal/ordinal directions", () => {
      expect(parseNwsWindDirectionDeg("N")).toBe(0);
      expect(parseNwsWindDirectionDeg("NW")).toBe(315);
      expect(parseNwsWindDirectionDeg("SSE")).toBe(157.5);
      expect(parseNwsWindDirectionDeg("  w  ")).toBe(270);
    });

    it("returns null for variable/unknown directions", () => {
      expect(parseNwsWindDirectionDeg("VRB")).toBeNull();
      expect(parseNwsWindDirectionDeg("VARIABLE")).toBeNull();
      expect(parseNwsWindDirectionDeg("")).toBeNull();
      expect(parseNwsWindDirectionDeg("Northwest")).toBeNull();
    });

    it("accepts numeric degrees", () => {
      expect(parseNwsWindDirectionDeg("0")).toBe(0);
      expect(parseNwsWindDirectionDeg("360")).toBe(0);
      expect(parseNwsWindDirectionDeg("-45")).toBe(315);
    });
  });

  describe("parseNwsWindSpeedMs", () => {
    it("parses mph values", () => {
      const ms = parseNwsWindSpeedMs("10 mph");
      expect(ms).not.toBeNull();
      expect(ms!).toBeCloseTo(10 * 0.44704, 5);
    });

    it("parses mph ranges (average)", () => {
      const ms = parseNwsWindSpeedMs("5 to 15 mph");
      expect(ms).not.toBeNull();
      expect(ms!).toBeCloseTo(((5 + 15) / 2) * 0.44704, 5);
    });

    it("parses knots", () => {
      const ms = parseNwsWindSpeedMs("15 kt");
      expect(ms).not.toBeNull();
      expect(ms!).toBeCloseTo(15 * 0.514444, 5);
    });

    it("handles Calm", () => {
      expect(parseNwsWindSpeedMs("Calm")).toBe(0);
      expect(parseNwsWindSpeedMs("calm")).toBe(0);
    });

    it("returns null when unit is unknown", () => {
      expect(parseNwsWindSpeedMs("10")).toBeNull();
      expect(parseNwsWindSpeedMs("")).toBeNull();
      expect(parseNwsWindSpeedMs("Light")).toBeNull();
    });
  });
});












