// lib/services/discovery/nhc-storms.ts
const FEED_URL = "https://www.nhc.noaa.gov/CurrentStorms.json";
const OK_TTL_MS = 15 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 4000;

export interface ActiveStorm {
  id: string;
  name: string;
  basin: "ep" | "cp" | "other";
  lat: number;
  lon: number;
}

function basinOf(id: string): ActiveStorm["basin"] {
  const prefix = id.slice(0, 2).toLowerCase();
  return prefix === "ep" || prefix === "cp" ? prefix : "other";
}

export function parseActiveStorms(payload: unknown): ActiveStorm[] {
  if (!payload || typeof payload !== "object") return [];
  const list = (payload as { activeStorms?: unknown }).activeStorms;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: unknown): ActiveStorm[] => {
    if (!entry || typeof entry !== "object") return [];
    const { id, name, latitudeNumeric, longitudeNumeric } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || name.trim().length === 0) return [];
    if (
      typeof latitudeNumeric !== "number" || !Number.isFinite(latitudeNumeric)
      || typeof longitudeNumeric !== "number" || !Number.isFinite(longitudeNumeric)
    ) {
      return [];
    }
    return [{ id, name: name.trim(), basin: basinOf(id), lat: latitudeNumeric, lon: longitudeNumeric }];
  });
}

/** A storm name is garnish: any feed failure yields no storms, never an error. */
export function createNhcStormClient(
  deps: { fetchImpl?: typeof fetch; now?: () => number } = {},
): { getActiveStorms(): Promise<ActiveStorm[]> } {
  const now = deps.now ?? Date.now;
  const fetchImpl: typeof fetch = deps.fetchImpl ?? (
    (...args: Parameters<typeof fetch>): ReturnType<typeof fetch> => fetch(...args)
  );
  let cached: { storms: ActiveStorm[]; expiresAt: number } | null = null;
  let inflight: Promise<ActiveStorm[]> | null = null;

  async function load(): Promise<ActiveStorm[]> {
    try {
      const response = await fetchImpl(FEED_URL, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
      if (!response.ok || response.status !== 200) throw new Error(`NHC feed returned ${response.status}`);
      const payload: unknown = await response.json();
      if (
        !payload || typeof payload !== "object"
        || !Array.isArray((payload as { activeStorms?: unknown }).activeStorms)
      ) {
        throw new Error("NHC feed has an unexpected shape");
      }
      const storms = parseActiveStorms(payload);
      cached = { storms, expiresAt: now() + OK_TTL_MS };
      return storms;
    } catch (error) {
      console.warn(
        "[nhc-storms] feed unavailable; storm names omitted",
        error instanceof Error ? error.message : "Unknown error",
      );
      cached = { storms: [], expiresAt: now() + FAILURE_TTL_MS };
      return [];
    }
  }

  return {
    async getActiveStorms(): Promise<ActiveStorm[]> {
      if (cached && cached.expiresAt > now()) return cached.storms;
      inflight ??= load().finally((): void => { inflight = null; });
      return inflight;
    },
  };
}

const defaultClient = createNhcStormClient();

export function getActiveStorms(): Promise<ActiveStorm[]> {
  return defaultClient.getActiveStorms();
}
