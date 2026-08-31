const noStoreForecastApiPaths = new Set([
  "/api/forecasts/current",
  "/api/forecasts/bulk",
  "/api/forecasts/update-enhanced",
]);

export const isNoStoreForecastApiPath = (pathname) =>
  noStoreForecastApiPaths.has(pathname) ||
  pathname.startsWith("/api/forecasts/scored/");

export const isCacheableForecastApiPath = (pathname) =>
  pathname.startsWith("/api/forecasts") && !isNoStoreForecastApiPath(pathname);

export const isCacheableRuntimeImage = (pathname, destination) =>
  destination === "image" && !pathname.startsWith("/api/");
