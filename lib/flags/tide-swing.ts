export const HOURLY_BRIDGE_ENABLED_FLAG = "HOURLY_BRIDGE_ENABLED";
export const HOURLY_BRIDGE_SURFACES_FLAG = "HOURLY_BRIDGE_SURFACES";
export const TIDE_SWING_ENABLED_FLAG = "TIDE_SWING_ENABLED";

export type HourlyBridgeSurface = "discover" | "week-scout" | "daily-call" | "scored";

const ALL_SURFACES: readonly HourlyBridgeSurface[] = ["discover", "week-scout", "daily-call", "scored"];

/** Score hourly rows between the 3-hourly forecast slots, using the hourly tide series. */
export function isHourlyBridgeEnabledFor(surface: HourlyBridgeSurface): boolean {
  if (process.env[HOURLY_BRIDGE_ENABLED_FLAG] !== "true") return false;
  const raw = (process.env[HOURLY_BRIDGE_SURFACES_FLAG] ?? "").trim();
  if (!raw) return ALL_SURFACES.includes(surface);
  return raw.split(",").map((s) => s.trim()).includes(surface);
}

/** True when any surface bridges hourly, so a client may show an hour with no stored row. */
export function isHourlyBridgeEnabledForAny(): boolean {
  return ALL_SURFACES.some(isHourlyBridgeEnabledFor);
}

/** Band-aware displayed tide points and tide-rate effects. */
export function isTideSwingEnabled(): boolean {
  return process.env[TIDE_SWING_ENABLED_FLAG] === "true";
}
