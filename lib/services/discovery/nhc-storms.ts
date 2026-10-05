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

function warningMessage(error: unknown): string {
  try {
    const message: unknown = error instanceof Error ? error.message : undefined;
    return typeof message === "string" ? message : "Unknown error";
  } catch {
    return "Unknown error";
  }
}

function copyStorms(storms: readonly ActiveStorm[]): ActiveStorm[] {
  return storms.map((storm: ActiveStorm): ActiveStorm => ({ ...storm }));
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

  function failureExpiresAt(startedAt: number): number {
    try {
      return now() + FAILURE_TTL_MS;
    } catch {
      // Keep back-off in the injected clock's time base if it becomes unavailable.
      return startedAt + FAILURE_TTL_MS;
    }
  }

  async function load(startedAt: number): Promise<ActiveStorm[]> {
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
      if (storms.length === 0 && (payload as { activeStorms: unknown[] }).activeStorms.length > 0) {
        throw new Error("NHC feed contains no parseable storms");
      }
      cached = { storms, expiresAt: now() + OK_TTL_MS };
      return storms;
    } catch (error) {
      cached = { storms: [], expiresAt: failureExpiresAt(startedAt) };
      try {
        console.warn(
          "[nhc-storms] feed unavailable; storm names omitted",
          warningMessage(error),
        );
      } catch {
        return [];
      }
      return [];
    }
  }

  return {
    async getActiveStorms(): Promise<ActiveStorm[]> {
      try {
        const timestamp = now();
        if (cached && cached.expiresAt > timestamp) return copyStorms(cached.storms);
        inflight ??= load(timestamp).finally((): void => { inflight = null; });
        return copyStorms(await inflight);
      } catch {
        return [];
      }
    },
  };
}

const defaultClient = createNhcStormClient();

export function getActiveStorms(): Promise<ActiveStorm[]> {
  return defaultClient.getActiveStorms();
}
