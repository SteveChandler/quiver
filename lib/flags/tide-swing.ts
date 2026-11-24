const HOURLY_BRIDGE_ENABLED_FLAG = "HOURLY_BRIDGE_ENABLED";
const HOURLY_BRIDGE_SURFACES_FLAG = "HOURLY_BRIDGE_SURFACES";

type HourlyBridgeSurface = "discover" | "week-scout" | "daily-call" | "scored";

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

/**
 * Enables band-aware tide points and tide-rate effects on the server and in Beach Detail.
 * Keep the literal access so Next.js can inline the value into the browser build.
 */
export function isTideSwingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TIDE_SWING_ENABLED === "true";
}
