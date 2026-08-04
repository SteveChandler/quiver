import { fetchCustomSpotAtmosphericForecast } from "@/lib/services/custom-spot-atmospheric-forecast";
import { NOAAWeatherDataSource } from "@/lib/services/forecast/data-source-manager";

jest.mock("@/lib/services/forecast/data-source-manager", () => ({
  NOAAWeatherDataSource: jest.fn(),
}));

const mockFetchWeatherData = jest.fn();
const MockNOAAWeatherDataSource = NOAAWeatherDataSource as jest.MockedClass<
  typeof NOAAWeatherDataSource
>;

describe("fetchCustomSpotAtmosphericForecast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockNOAAWeatherDataSource.mockImplementation(() => ({
      fetchWeatherData: mockFetchWeatherData,
    }) as unknown as NOAAWeatherDataSource);
  });

  it("keeps NWS wind and weather fields without adding marine values", async () => {
    mockFetchWeatherData.mockResolvedValue({
      periods: [{
        startTime: "2026-07-31T12:00:00.000Z",
        temperature: 70,
        windSpeed: "5 to 10 mph",
        windDirection: "WNW",
        shortForecast: "Mostly sunny",
      }],
    });

    const result = await fetchCustomSpotAtmosphericForecast({ lat: 33.5, lon: -118.5 });

    expect(result).toMatchObject({
      windSpeed: "5 to 10 mph",
      windDirection: "WNW",
      windDirectionDeg: 292.5,
      temperatureF: 70,
      summary: "Mostly sunny",
    });
    expect(result).not.toHaveProperty("waveHeight");
    expect(mockFetchWeatherData).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 33.5, longitude: -118.5 }),
      1,
    );
  });
});
