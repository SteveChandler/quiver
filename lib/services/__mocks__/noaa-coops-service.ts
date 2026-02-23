/**
 * Mock for NOAACOOPSService
 * Used in enhanced-forecast-service tests
 */

export class NOAACOOPSService {
  fetchCOOPSData = jest.fn().mockResolvedValue({ tides: [] });
  getStationForLocation = jest.fn().mockReturnValue("9410170");
  getTideStatusAtTime = jest.fn().mockReturnValue("Rising");
  getTideHeightAtTime = jest.fn().mockReturnValue(3.5);
  getNextTideFromTime = jest.fn().mockReturnValue({ 
    type: "HIGH", 
    height: 5.2, 
    time: "2024-01-01T12:00:00Z" 
  });
}

