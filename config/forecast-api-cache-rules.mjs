const noStoreForecastApiPaths = new Set([
  "/api/forecasts/current",
  "/api/forecasts/bulk",
  "/api/forecasts/point",
]);

export const isNoStoreForecastApiPath = (pathname) =>
  noStoreForecastApiPaths.has(pathname) ||
  pathname.startsWith("/api/forecasts/scored/");

export const isCacheableForecastApiPath = (pathname) =>
  pathname.startsWith("/api/forecasts") && !isNoStoreForecastApiPath(pathname);
