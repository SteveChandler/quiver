const noStoreForecastApiPaths = new Set(["/api/forecasts/current"]);

export const isNoStoreForecastApiPath = (pathname) =>
  noStoreForecastApiPaths.has(pathname);

export const isCacheableForecastApiPath = (pathname) =>
  pathname.startsWith("/api/forecasts") && !isNoStoreForecastApiPath(pathname);
