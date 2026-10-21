import {
  ApiError,
  isNoaaForecastGridExpiredError,
  isNoaaMarineForecastNotSupportedError,
} from "@/lib/errors/forecast-errors";

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
