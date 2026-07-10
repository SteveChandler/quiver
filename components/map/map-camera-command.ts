import type { Beach } from "@/types/database";

export type MapCameraOwner = "initial" | "explicit-command" | "user";
export type MapCameraSource =
  | "home"
  | "last-viewed"
  | "gps"
  | "fallback"
  | "region"
  | "search"
  | "pin";
export type MapBoundsTuple = [[number, number], [number, number]];

export interface MapCameraCommand {
  id: number;
  source: MapCameraSource;
  center?: { lat: number; lon: number };
  bounds?: MapBoundsTuple;
  zoom?: number;
}

export function createCameraCommand(
  previous: MapCameraCommand | null,
  input: Omit<MapCameraCommand, "id">,
): MapCameraCommand {
  return {
    ...input,
    id: (previous?.id ?? 0) + 1,
  };
}

function hasFiniteCoordinates(beach: Beach): beach is Beach & {
  lat: number;
  lon: number;
} {
  return Number.isFinite(beach.lat) && Number.isFinite(beach.lon);
}

export function boundsFromBeaches(beaches: Beach[]): MapBoundsTuple | null {
  const validBeaches = beaches.filter(hasFiniteCoordinates);
  if (validBeaches.length < 2) return null;

  const lats = validBeaches.map((beach) => beach.lat);
  const lons = validBeaches.map((beach) => beach.lon);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lons);
  const east = Math.max(...lons);

  if (south === north || west === east) return null;

  return [[west, south], [east, north]];
}
