/**
 * Mock for NOAAWaveWatchService
 * Used in enhanced-forecast-service tests
 */

export class NOAAWaveWatchService {
  fetchWaveWatchForecast = jest.fn().mockResolvedValue({
    lat: 32.7,
    lng: -117.2,
    forecast: [],
  });

  getWaveDirectionText = jest.fn().mockReturnValue("W");
}





