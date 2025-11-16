/**
 * Tests for forecast state management and error handling
 */

import {
  getForecastStateInfo,
  getStateDisplayMessage,
  isRetryableError,
  getRetryDelay,
  type ForecastDataState,
} from "@/types/forecast-states";

describe("getForecastStateInfo", () => {
  it("should return loading state when isLoading is true and no forecast", () => {
    const result = getForecastStateInfo(null, false, null, true, false);

    expect(result.state).toBe("loading");
    expect(result.message).toBe("Loading forecast");
    expect(result.canRetry).toBe(false);
  });

  it("should return refreshing state when isRefreshing is true and forecast exists", () => {
    const mockForecast = { id: "1", wave_height: "3-5 ft" };
    const result = getForecastStateInfo(mockForecast, false, null, false, true);

    expect(result.state).toBe("refreshing");
    expect(result.message).toBe("Updating forecast");
    expect(result.canRetry).toBe(false);
  });

  it("should return rate_limited state for 429 errors", () => {
    const error = new Error("HTTP 429");
    (error as any).status = 429;

    const result = getForecastStateInfo(null, false, error, false, false);

    expect(result.state).toBe("rate_limited");
    expect(result.message).toBe("Too many requests");
    expect(result.canRetry).toBe(true);
    expect(result.retryAfter).toBe(300); // 5 minutes
  });

  it("should return failed state for network errors", () => {
    const error = new Error("fetch failed");

    const result = getForecastStateInfo(null, false, error, false, false);

    expect(result.state).toBe("failed");
    expect(result.message).toBe("Unable to load forecast");
    expect(result.canRetry).toBe(true);
  });

  it("should return failed state for API errors", () => {
    const error = new Error("HTTP 500");
    (error as any).status = 500;

    const result = getForecastStateInfo(null, false, error, false, false);

    expect(result.state).toBe("failed");
    expect(result.message).toBe("Service temporarily unavailable");
    expect(result.canRetry).toBe(true);
  });

  it("should return no_coverage state when no forecast and no error", () => {
    const result = getForecastStateInfo(null, false, null, false, false);

    expect(result.state).toBe("no_coverage");
    expect(result.message).toBe("No forecast available");
    expect(result.canRetry).toBe(false);
  });

  it("should return stale state when forecast is stale", () => {
    const mockForecast = { id: "1", wave_height: "3-5 ft" };
    const result = getForecastStateInfo(mockForecast, true, null, false, false);

    expect(result.state).toBe("stale");
    expect(result.message).toBe("Forecast data is outdated");
    expect(result.canRetry).toBe(true);
  });

  it("should return available state for fresh forecast", () => {
    const mockForecast = { id: "1", wave_height: "3-5 ft" };
    const result = getForecastStateInfo(mockForecast, false, null, false, false);

    expect(result.state).toBe("available");
    expect(result.message).toBe("Forecast available");
    expect(result.canRetry).toBe(false);
  });
});

describe("getStateDisplayMessage", () => {
  it("should return correct message for loading state", () => {
    const result = getStateDisplayMessage("loading");

    expect(result.title).toBe("Loading forecast");
    expect(result.description).toContain("Fetching");
  });

  it("should return correct message for refreshing state", () => {
    const result = getStateDisplayMessage("refreshing");

    expect(result.title).toBe("Updating forecast");
    expect(result.description).toContain("Refreshing");
  });

  it("should return correct message for failed state", () => {
    const result = getStateDisplayMessage("failed");

    expect(result.title).toBe("Unable to load forecast");
    expect(result.description).toContain("error");
  });

  it("should return correct message for rate_limited state", () => {
    const result = getStateDisplayMessage("rate_limited");

    expect(result.title).toBe("Too many requests");
    expect(result.description).toContain("wait");
  });

  it("should return correct message for no_coverage state", () => {
    const result = getStateDisplayMessage("no_coverage");

    expect(result.title).toBe("No forecast available");
    expect(result.description).toContain("not currently covered");
  });

  it("should return correct message for stale state", () => {
    const result = getStateDisplayMessage("stale");

    expect(result.title).toBe("Forecast data is outdated");
    expect(result.description).toContain("may not reflect current");
  });

  it("should return correct message for unavailable state", () => {
    const result = getStateDisplayMessage("unavailable");

    expect(result.title).toBe("Data unavailable");
    expect(result.description).toContain("Unable to load");
  });

  it("should return correct message for available state", () => {
    const result = getStateDisplayMessage("available");

    expect(result.title).toBe("Forecast available");
    expect(result.description).toContain("Latest");
  });
});

describe("isRetryableError", () => {
  it("should return true for network errors", () => {
    const error = new Error("fetch failed");
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for timeout errors", () => {
    const error = new Error("timeout exceeded");
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for 429 status", () => {
    const error = new Error("HTTP 429");
    (error as any).status = 429;
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for 500 status", () => {
    const error = new Error("HTTP 500");
    (error as any).status = 500;
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for 503 status", () => {
    const error = new Error("HTTP 503");
    (error as any).status = 503;
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return false for null error", () => {
    expect(isRetryableError(null)).toBe(false);
  });

  it("should return false for undefined error", () => {
    expect(isRetryableError(undefined)).toBe(false);
  });

  it("should return false for 404 status", () => {
    const error = new Error("HTTP 404");
    (error as any).status = 404;
    expect(isRetryableError(error)).toBe(false);
  });
});

describe("getRetryDelay", () => {
  it("should return 5 minutes for rate limit errors", () => {
    const error = new Error("rate limit exceeded");
    expect(getRetryDelay(error)).toBe(300000); // 5 minutes
  });

  it("should return 5 minutes for 429 errors", () => {
    const error = new Error("HTTP 429");
    (error as any).status = 429;
    expect(getRetryDelay(error)).toBe(300000); // 5 minutes
  });

  it("should return 30 seconds for 500 errors", () => {
    const error = new Error("HTTP 500");
    (error as any).status = 500;
    expect(getRetryDelay(error)).toBe(30000); // 30 seconds
  });

  it("should return 30 seconds for 503 errors", () => {
    const error = new Error("HTTP 503");
    (error as any).status = 503;
    expect(getRetryDelay(error)).toBe(30000); // 30 seconds
  });

  it("should return 5 seconds for other errors", () => {
    const error = new Error("generic error");
    expect(getRetryDelay(error)).toBe(5000); // 5 seconds
  });

  it("should return 5 seconds for null error", () => {
    expect(getRetryDelay(null)).toBe(5000);
  });
});

describe("Edge cases", () => {
  it("should handle error without message", () => {
    const error = new Error();
    const result = getForecastStateInfo(null, false, error, false, false);

    expect(result.state).toBe("failed");
    expect(result.canRetry).toBe(true);
  });

  it("should prioritize loading over error state", () => {
    const error = new Error("test error");
    const result = getForecastStateInfo(null, false, error, true, false);

    expect(result.state).toBe("loading");
  });

  it("should prioritize refreshing over stale state", () => {
    const mockForecast = { id: "1", wave_height: "3-5 ft" };
    const result = getForecastStateInfo(mockForecast, true, null, false, true);

    expect(result.state).toBe("refreshing");
  });
});
