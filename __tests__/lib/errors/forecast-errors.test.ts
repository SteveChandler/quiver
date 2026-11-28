import {
  ApiError,
  isNoaaForecastGridExpiredError,
  isNoaaMarineForecastNotSupportedError,
  logError,
} from "@/lib/errors/forecast-errors";

describe("logError", () => {
  const apiUrl = "https://api.weather.gov/gridpoints/HFO/239,86/forecast/hourly";

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("warns for a handled retryable 503 and truncates its HTML in the log", () => {
    const body = `<HTML>${"Service unavailable ".repeat(30)}</HTML>`;
    const error = new ApiError(apiUrl, 503, body);
    const context = { beachId: "beach-1", dataSource: "weather" };
    const shortened = `${error.message.slice(0, 253)}...`;

    logError(error, context, { handled: true });

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      `[ForecastWarning] NOAA_API_ERROR: ${shortened}`,
      expect.objectContaining({
        ...context,
        context: { apiUrl, statusCode: 503 },
        isRetryable: true,
        message: shortened,
        stack: expect.stringContaining(`ApiError: ${shortened}\n`),
      }),
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(error.message).toBe(`API request failed: 503 ${body}`);
  });

  it.each([400, 429])("keeps a handled HTTP %i at error level", (status) => {
    logError(new ApiError(apiUrl, status, "Unexpected response"), {}, { handled: true });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`API request failed: ${status}`),
      expect.objectContaining({ context: { apiUrl, statusCode: status } }),
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("keeps an unhandled retryable 503 at error level", () => {
    logError(new ApiError(apiUrl, 503, "Service unavailable"));

    expect(console.error).toHaveBeenCalledWith(
      "[ForecastError] NOAA_API_ERROR: API request failed: 503 Service unavailable",
      expect.objectContaining({ isRetryable: true }),
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("keeps a non-ForecastError at error level", () => {
    logError(new Error("Weather fetch failed"), {}, { handled: true });

    expect(console.error).toHaveBeenCalledWith(
      "[Error] Weather fetch failed",
      expect.objectContaining({ message: "Weather fetch failed" }),
    );
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("forecast-errors NOAA helpers", () => {
  describe("isNoaaMarineForecastNotSupportedError", () => {
    it("returns true for gridpoints hourly 404 MarineForecastNotSupported", () => {
      const err = new ApiError(
        "https://api.weather.gov/gridpoints/SGX/53,18/forecast/hourly",
        404,
        JSON.stringify({
          title: "Marine Forecast Not Supported",
          type: "https://api.weather.gov/problems/MarineForecastNotSupported",
          status: 404,
        })
      );

      expect(isNoaaMarineForecastNotSupportedError(err)).toBe(true);
    });

    it("returns true for gridpoints non-hourly 404 MarineForecastNotSupported", () => {
      const err = new ApiError(
        "https://api.weather.gov/gridpoints/SGX/53,18/forecast",
        404,
        JSON.stringify({
          title: "Marine Forecast Not Supported",
          type: "https://api.weather.gov/problems/MarineForecastNotSupported",
          status: 404,
        })
      );

      expect(isNoaaMarineForecastNotSupportedError(err)).toBe(true);
    });

    it("returns false for non-ApiError inputs", () => {
      expect(isNoaaMarineForecastNotSupportedError(new Error("nope"))).toBe(false);
    });
  });
  describe("isNoaaForecastGridExpiredError", () => {
    const expiredBody = JSON.stringify({
      title: "Forecast Grid Expired",
      type: "https://api.weather.gov/problems/ForecastGridExpired",
      status: 503,
      detail: "The requested forecast grid was issued 2026-10-20T18:44:40+00:00 and has expired.",
    });

    it("returns true for a gridpoints 503 ForecastGridExpired", () => {
      const err = new ApiError("https://api.weather.gov/gridpoints/SGX/53,34/forecast/hourly", 503, expiredBody);
      expect(isNoaaForecastGridExpiredError(err)).toBe(true);
    });

    it("returns false for other 503s and other endpoints", () => {
      const unavailable = new ApiError(
        "https://api.weather.gov/gridpoints/HFO/239,86/forecast/hourly",
        503,
        JSON.stringify({ title: "Service Unavailable", type: "https://api.weather.gov/problems/ServiceUnavailable", status: 503 })
      );
      expect(isNoaaForecastGridExpiredError(unavailable)).toBe(false);
      expect(isNoaaForecastGridExpiredError(new ApiError("https://api.weather.gov/points/33.6,-117.9", 503, expiredBody))).toBe(false);
      expect(isNoaaForecastGridExpiredError(new Error("Forecast Grid Expired"))).toBe(false);
    });
  });
});
