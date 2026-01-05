/**
 * Mock for CDIPService
 * Used in enhanced-forecast-service tests
 */

export class CDIPService {
  fetchBuoyData = jest.fn().mockResolvedValue(null);
  getNearestStation = jest.fn().mockResolvedValue(null);
}


