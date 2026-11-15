import type { TideExtreme } from "./types";

const BASE_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const INITIAL_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 10 * 60_000;
const inFlight = new Map<string, Promise<DatagetterPayload>>();
let cooldownUntil = 0;
let cooldownMs = INITIAL_COOLDOWN_MS;

interface DatagetterPayload {
  predictions?: TideExtreme[];
  data?: Array<{ t: string; v: string }>;
  error?: { message?: string };
}

export class NoaaTideRequestError extends Error {
  constructor(message: string, readonly status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "NoaaTideRequestError";
  }
}

export function buildDatagetterUrl(params: URLSearchParams): string {
  const identified = new URLSearchParams(params);
  identified.set("application", "Quiver");
  return `${BASE_URL}?${identified.toString()}`;
}

export async function fetchDatagetter(url: string, timeoutMs = 20_000): Promise<DatagetterPayload> {
  const pending = inFlight.get(url);
  if (pending) return pending;
  if (Date.now() < cooldownUntil) {
    throw new NoaaTideRequestError("NOAA tide request cooling down");
  }

  const request = (async (): Promise<DatagetterPayload> => {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Quiver/1.0 (+https://quiversurf.app)" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new NoaaTideRequestError(
        error instanceof Error ? error.message : "NOAA tide fetch failed",
        undefined,
        { cause: error },
      );
    }
    if (!response.ok) {
      if ((response.status === 403 || response.status === 429 || response.status >= 500) &&
          Date.now() >= cooldownUntil) {
        cooldownUntil = Date.now() + cooldownMs;
        cooldownMs = Math.min(cooldownMs * 2, MAX_COOLDOWN_MS);
      }
      const body = await response.text?.().catch(() => "");
      throw new NoaaTideRequestError(
        `NOAA tide failed: ${response.status}${body ? ` - ${body.slice(0, 300)}` : ""}`,
        response.status,
      );
    }
    const data: DatagetterPayload = await response.json();
    cooldownUntil = 0;
    cooldownMs = INITIAL_COOLDOWN_MS;
    return data;
  })();
  inFlight.set(url, request);
  try {
    return await request;
  } finally {
    inFlight.delete(url);
  }
}
