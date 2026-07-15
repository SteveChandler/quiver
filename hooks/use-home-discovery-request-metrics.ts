import { useCallback, useEffect, useRef } from "react";
import type { TimeSlot } from "@/types/personalization";

export type HomeDiscoveryRequestSource =
  | "primary"
  | "fallback"
  | `prefetch:${TimeSlot}`;

type HomeDiscoveryWindow = Window & {
  __quiverHomeDiscoveryRequestCount?: number;
};

const HOME_DISCOVERY_MARK_PREFIX = "quiver:home:discovery-request:";

function clearStaleHomeDiscoveryMarks(): void {
  if (
    typeof performance === "undefined" ||
    typeof performance.getEntriesByType !== "function" ||
    typeof performance.clearMarks !== "function"
  ) {
    return;
  }

  try {
    for (const entry of performance.getEntriesByType("mark")) {
      if (entry.name.startsWith(HOME_DISCOVERY_MARK_PREFIX)) {
        performance.clearMarks(entry.name);
      }
    }
  } catch {
    // Debug-only metrics cleanup must never affect home rendering.
  }
}

export function useHomeDiscoveryRequestMetrics(): (
  source: HomeDiscoveryRequestSource
) => void {
  const requestCountRef = useRef(0);

  useEffect(() => {
    requestCountRef.current = 0;
    clearStaleHomeDiscoveryMarks();
    if (typeof window !== "undefined") {
      (window as HomeDiscoveryWindow).__quiverHomeDiscoveryRequestCount = 0;
    }
  }, []);

  return useCallback((source: HomeDiscoveryRequestSource): void => {
    requestCountRef.current += 1;
    const count = requestCountRef.current;

    if (typeof window !== "undefined") {
      (window as HomeDiscoveryWindow).__quiverHomeDiscoveryRequestCount = count;
    }

    if (typeof performance !== "undefined" && typeof performance.mark === "function") {
      try {
        performance.mark(`${HOME_DISCOVERY_MARK_PREFIX}${count}:${source}`);
      } catch {
        // Custom performance marks are debug-only and must never affect home.
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[Home] discovery request count", { count, source });
    }
  }, []);
}
