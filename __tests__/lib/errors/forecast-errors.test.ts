import { ApiError, isNoaaMarineForecastNotSupportedError } from "@/lib/errors/forecast-errors";

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
});


