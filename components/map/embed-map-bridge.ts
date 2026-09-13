export type EmbedMapSwellLayerId = "combined" | "s1" | "s2" | "wind";
export type EmbedMapWaterQualityHold = "advisory" | "closure" | "held";
export const EMBED_MAP_MAX_FORECAST_TIME_INDEX = 7;

export interface EmbedMapCoordinate {
  lat: number;
  lon: number;
}

export interface EmbedMapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface EmbedMapViewport {
  center: EmbedMapCoordinate;
  zoom?: number;
  bounds?: EmbedMapBounds;
  interactionSource?: "initial" | "programmatic" | "user";
}

export type EmbedMapCommand =
  | { type: "setViewport"; payload: EmbedMapViewport }
  | { type: "setLayer"; payload: { layerId: EmbedMapSwellLayerId } }
  | { type: "setForecastTime"; payload: { index: number } }
  | { type: "setSelectedSpot"; payload: { beachId: string; lat?: number; lon?: number } }
  | { type: "focusSelectedSpot"; payload: { beachId: string } }
  | { type: "startPlacement"; payload?: EmbedMapCoordinate }
  | { type: "cancelPlacement"; payload?: Record<string, never> }
  | { type: "confirmPlacement"; payload?: Record<string, never> }
  | { type: "setTheme"; payload: { mode: "explore" | "hero" } }
  | { type: "setReducedMotion"; payload: { enabled: boolean } }
  | { type: "setFieldVisible"; payload: { visible: boolean } }
  | { type: "setForecastPlaying"; payload: { playing: boolean } }
  | { type: "auth_token"; payload: { accessToken: string | null } };

export type EmbedMapEvent =
  | { type: "ready"; payload: { viewport: EmbedMapViewport } }
  | { type: "presentationReady"; payload: Record<string, never> }
  | { type: "loadFailed"; payload: { reason: string } }
  | { type: "viewportChanged"; payload: EmbedMapViewport }
  | {
      type: "spotSelected";
      payload: {
        beachId: string;
        name: string;
        lat: number;
        lon: number;
        slug?: string | null;
        conditionSummary?: string | null;
        waterQualityHold?: EmbedMapWaterQualityHold | null;
        waveHeight?: string | null;
        swellPeriod?: string | null;
        swellDirection?: string | null;
        isCalibrated?: boolean | null;
        windSpeed?: string | null;
        windDirection?: string | null;
        tideState?: string | null;
        tideHeight?: string | null;
      };
    }
  | { type: "clusterSelected"; payload: { clusterId: number; lat: number; lon: number } }
  | { type: "mapTapped"; payload: EmbedMapCoordinate }
  | { type: "placementStarted"; payload: EmbedMapCoordinate }
  | { type: "placementChanged"; payload: EmbedMapCoordinate }
  | { type: "placementConfirmed"; payload: EmbedMapCoordinate }
  | { type: "placementCancelled"; payload: Record<string, never> }
  | { type: "forecastTimeChanged"; payload: { index: number; forecastAt?: string } }
  | { type: "renderHealth"; payload: { fps?: number; status: "ok" | "degraded" } }
  | { type: "auth_token_expired" };

const SWELL_LAYER_IDS = new Set<EmbedMapSwellLayerId>([
  "combined",
  "s1",
  "s2",
  "wind",
]);
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_ACCESS_TOKEN_LENGTH = 4096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function clampForecastTimeIndex(index: number, maxIndex: number): number {
  return Math.max(
    0,
    Math.min(maxIndex, Math.round(index)),
  );
}

function coordinateFromPayload(payload: unknown): EmbedMapCoordinate | null {
  if (!isRecord(payload)) return null;
  const lat = finiteNumber(payload.lat);
  const lon = finiteNumber(payload.lon);
  if (lat === null || lon === null) return null;
  return { lat, lon };
}

function boundsFromPayload(payload: unknown): EmbedMapBounds | undefined {
  if (!isRecord(payload)) return undefined;
  const west = finiteNumber(payload.west);
  const south = finiteNumber(payload.south);
  const east = finiteNumber(payload.east);
  const north = finiteNumber(payload.north);
  if (west === null || south === null || east === null || north === null) {
    return undefined;
  }
  return { west, south, east, north };
}

function viewportFromPayload(payload: unknown): EmbedMapViewport | null {
  if (!isRecord(payload)) return null;
  const center = coordinateFromPayload(payload.center);
  if (!center) return null;
  const zoom = finiteNumber(payload.zoom) ?? undefined;
  return {
    center,
    ...(zoom !== undefined ? { zoom } : {}),
    bounds: boundsFromPayload(payload.bounds),
  };
}

export function parseEmbedMapCommand(
  data: unknown,
  maxForecastTimeIndex = EMBED_MAP_MAX_FORECAST_TIME_INDEX,
): EmbedMapCommand | null {
  let parsed = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
  const payload = parsed.payload;

  switch (parsed.type) {
    case "setViewport": {
      const viewport = viewportFromPayload(payload);
      return viewport ? { type: "setViewport", payload: viewport } : null;
    }
    case "setLayer": {
      if (!isRecord(payload) || !SWELL_LAYER_IDS.has(payload.layerId as EmbedMapSwellLayerId)) {
        return null;
      }
      return {
        type: "setLayer",
        payload: { layerId: payload.layerId as EmbedMapSwellLayerId },
      };
    }
    case "setForecastTime": {
      if (!isRecord(payload)) return null;
      const index = finiteNumber(payload.index);
      return index === null
        ? null
        : {
            type: "setForecastTime",
            payload: { index: clampForecastTimeIndex(index, maxForecastTimeIndex) },
          };
    }
    case "setSelectedSpot": {
      if (!isRecord(payload) || typeof payload.beachId !== "string") return null;
      const lat = finiteNumber(payload.lat);
      const lon = finiteNumber(payload.lon);
      return {
        type: "setSelectedSpot",
        payload: {
          beachId: payload.beachId,
          ...(lat !== null ? { lat } : {}),
          ...(lon !== null ? { lon } : {}),
        },
      };
    }
    case "focusSelectedSpot": {
      if (!isRecord(payload) || typeof payload.beachId !== "string") return null;
      return {
        type: "focusSelectedSpot",
        payload: { beachId: payload.beachId },
      };
    }
    case "startPlacement": {
      const point = coordinateFromPayload(payload);
      return {
        type: "startPlacement",
        ...(point ? { payload: point } : {}),
      };
    }
    case "cancelPlacement":
      return { type: "cancelPlacement", payload: {} };
    case "confirmPlacement":
      return { type: "confirmPlacement", payload: {} };
    case "setTheme": {
      if (!isRecord(payload)) return null;
      if (payload.mode !== "explore" && payload.mode !== "hero") return null;
      return { type: "setTheme", payload: { mode: payload.mode } };
    }
    case "setReducedMotion": {
      if (!isRecord(payload) || typeof payload.enabled !== "boolean") return null;
      return { type: "setReducedMotion", payload: { enabled: payload.enabled } };
    }
    case "setFieldVisible": {
      if (!isRecord(payload) || typeof payload.visible !== "boolean") return null;
      return { type: "setFieldVisible", payload: { visible: payload.visible } };
    }
    case "setForecastPlaying": {
      if (!isRecord(payload) || typeof payload.playing !== "boolean") return null;
      return { type: "setForecastPlaying", payload: { playing: payload.playing } };
    }
    case "auth_token": {
      const payloadKeys = isRecord(payload) ? Reflect.ownKeys(payload) : [];
      if (
        !isRecord(payload) ||
        payloadKeys.length !== 1 ||
        payloadKeys[0] !== "accessToken" ||
        (payload.accessToken !== null &&
          (typeof payload.accessToken !== "string" ||
            payload.accessToken.length > MAX_ACCESS_TOKEN_LENGTH ||
            !JWT_PATTERN.test(payload.accessToken)))
      ) {
        return null;
      }
      return { type: "auth_token", payload: { accessToken: payload.accessToken } };
    }
    default:
      return null;
  }
}

export function serializeEmbedMapEvent(event: EmbedMapEvent): string {
  return JSON.stringify(event);
}
