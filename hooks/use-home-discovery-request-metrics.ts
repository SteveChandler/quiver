import { useCallback, useEffect, useMemo, useRef } from "react";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";

type HomeDiscoveryRequestSource = "primary" | "fallback";

type HomeDiscoveryWindow = Window & {
  __quiverHomeDiscoveryRequestCount?: number;
};

const HOME_DISCOVERY_MARK_PREFIX = "quiver:home:discovery-request:";
const HOME_CALL_RENDERED_MARK_PREFIX = "quiver:home:call-rendered:";

function createHomeLoadId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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
      if (
        entry.name.startsWith(HOME_DISCOVERY_MARK_PREFIX) ||
        entry.name.startsWith(HOME_CALL_RENDERED_MARK_PREFIX)
      ) {
        performance.clearMarks(entry.name);
      }
    }
  } catch {
    // Debug-only metrics cleanup must never affect home rendering.
  }
}

interface HomeDiscoveryMetrics {
  /** A discovery request is starting for this home load. */
  recordRequest: (source: HomeDiscoveryRequestSource) => void;
  /**
   * A surf call just became visible. `recheck` is true when an earlier call
   * was already shown on this home load (a resume or expiry refresh).
   */
  recordCallRendered: (details: { recheck: boolean }) => void;
}

export function useHomeDiscoveryRequestMetrics(): HomeDiscoveryMetrics {
  const requestCountRef = useRef(0);
  const lastRequestStartedAtRef = useRef<number | null>(null);
  const homeLoadIdRef = useRef<string | null>(null);
  if (homeLoadIdRef.current === null) {
    homeLoadIdRef.current = createHomeLoadId();
  }

  useEffect(() => {
    requestCountRef.current = 0;
    lastRequestStartedAtRef.current = null;
    clearStaleHomeDiscoveryMarks();
    if (typeof window !== "undefined") {
      (window as HomeDiscoveryWindow).__quiverHomeDiscoveryRequestCount = 0;
    }
  }, []);

  const recordRequest = useCallback((source: HomeDiscoveryRequestSource): void => {
    requestCountRef.current += 1;
    lastRequestStartedAtRef.current = Date.now();
    const count = requestCountRef.current;

    if (typeof window !== "undefined") {
      (window as HomeDiscoveryWindow).__quiverHomeDiscoveryRequestCount = count;
    }

    captureClientPostHogEventAfterConsent("home_discovery_request", {
      home_load_id: homeLoadIdRef.current,
      request_number: count,
      source,
    });

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

  // Time to call is the number users feel. It pairs with the request above
  // through home_load_id + request_number.
  const recordCallRendered = useCallback(({ recheck }: { recheck: boolean }): void => {
    const startedAt = lastRequestStartedAtRef.current;
    const sinceNavigation =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? Math.round(performance.now())
        : null;

    captureClientPostHogEventAfterConsent("home_call_rendered", {
      home_load_id: homeLoadIdRef.current,
      request_number: requestCountRef.current,
      recheck,
      ms_since_request: startedAt === null ? null : Date.now() - startedAt,
      ms_since_navigation: sinceNavigation,
    });

    if (typeof performance !== "undefined" && typeof performance.mark === "function") {
      try {
        performance.mark(`${HOME_CALL_RENDERED_MARK_PREFIX}${requestCountRef.current}`);
      } catch {
        // Custom performance marks are debug-only and must never affect home.
      }
    }
  }, []);

  return useMemo(
    () => ({ recordRequest, recordCallRendered }),
    [recordRequest, recordCallRendered],
  );
}
