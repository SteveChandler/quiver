import type { Beach } from "@/types/database";

interface BeachApiEnvelope {
  success?: boolean;
  data?: Beach[] | { beaches?: Beach[] };
  error?: string;
  message?: string;
}

interface BeachClientResult {
  success: boolean;
  data?: Beach[];
  error?: string;
  fallbackUsed?: boolean;
}

function errorMessage(payload: BeachApiEnvelope, fallback: string): string {
  return payload.error ?? payload.message ?? fallback;
}

export async function getBeaches(): Promise<BeachClientResult> {
  try {
    const response = await fetch("/api/beaches", {
      headers: { Accept: "application/json" },
    });
    const payload = (await response.json()) as BeachApiEnvelope;
    const data = Array.isArray(payload.data)
      ? payload.data
      : payload.data?.beaches;

    if (!response.ok || payload.success === false || !Array.isArray(data)) {
      return {
        success: false,
        error: errorMessage(payload, "Failed to fetch beaches"),
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch beaches",
    };
  }
}

export async function getNearbyBeaches(
  latitude: number,
  longitude: number,
  radiusMiles = 50,
  signal?: AbortSignal,
): Promise<BeachClientResult> {
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      maxDistance: String(radiusMiles),
      limit: "50",
    });
    const response = await fetch(`/api/beaches/nearby?${params.toString()}`, {
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    const payload = (await response.json()) as BeachApiEnvelope;

    if (!response.ok || payload.success === false || !Array.isArray(payload.data)) {
      return {
        success: false,
        error: errorMessage(payload, "Failed to fetch nearby beaches"),
      };
    }

    return { success: true, data: payload.data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch nearby beaches",
    };
  }
}
