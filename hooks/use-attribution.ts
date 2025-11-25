/**
 * useAttribution Hook
 *
 * Provides access to attribution data (UTM parameters, referrer, etc.)
 * for analytics tracking and user acquisition analysis.
 *
 * Features:
 * - Captures attribution on first render
 * - Persists to cookies for cross-session tracking
 * - Provides formatted data for analytics events
 * - First-touch attribution model
 *
 * @example
 * ```tsx
 * function SignUpForm() {
 *   const { attribution, getAnalyticsParams } = useAttribution();
 *
 *   const handleSubmit = async (data) => {
 *     // Include attribution in signup event
 *     track("sign_up", {
 *       ...data,
 *       ...getAnalyticsParams(),
 *     });
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  captureAttribution,
  getAttributionFromCookies,
  getAttributionForAnalytics,
  type AttributionData,
} from "@/lib/attribution";

interface UseAttributionOptions {
  /**
   * Whether to capture attribution on mount
   * @default true
   */
  captureOnMount?: boolean;

  /**
   * Whether to overwrite existing attribution values
   * @default false (first-touch model)
   */
  overwrite?: boolean;
}

interface UseAttributionReturn {
  /**
   * Current attribution data
   */
  attribution: AttributionData;

  /**
   * Whether attribution has been captured/loaded
   */
  isReady: boolean;

  /**
   * Get attribution data formatted for analytics events
   * @param options.prefix - Optional prefix for keys (e.g., "user_")
   * @param options.includeTimestamp - Include first_touch_ts
   */
  getAnalyticsParams: (options?: {
    prefix?: string;
    includeTimestamp?: boolean;
  }) => Record<string, string>;

  /**
   * Manually refresh attribution from cookies
   */
  refresh: () => void;

  /**
   * Check if user came from a specific source
   */
  isFromSource: (source: string) => boolean;

  /**
   * Check if user came from a specific campaign
   */
  isFromCampaign: (campaign: string) => boolean;

  /**
   * Check if any attribution data exists
   */
  hasAttribution: boolean;
}

export function useAttribution(
  options: UseAttributionOptions = {}
): UseAttributionReturn {
  const { captureOnMount = true, overwrite = false } = options;

  const [attribution, setAttribution] = useState<AttributionData>({
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: null,
    first_touch_ts: null,
    landing_page: null,
  });
  const [isReady, setIsReady] = useState(false);

  // Capture attribution on mount
  useEffect(() => {
    if (captureOnMount) {
      const captured = captureAttribution({ overwrite });
      setAttribution(captured);
    } else {
      // Just read existing cookies
      const existing = getAttributionFromCookies();
      setAttribution(existing);
    }
    setIsReady(true);
  }, [captureOnMount, overwrite]);

  // Refresh attribution from cookies
  const refresh = useCallback(() => {
    const current = getAttributionFromCookies();
    setAttribution(current);
  }, []);

  // Get analytics-formatted params
  const getAnalyticsParams = useCallback(
    (opts?: { prefix?: string; includeTimestamp?: boolean }) => {
      return getAttributionForAnalytics(opts);
    },
    []
  );

  // Check if from specific source
  const isFromSource = useCallback(
    (source: string) => {
      return attribution.utm_source?.toLowerCase() === source.toLowerCase();
    },
    [attribution.utm_source]
  );

  // Check if from specific campaign
  const isFromCampaign = useCallback(
    (campaign: string) => {
      return attribution.utm_campaign?.toLowerCase() === campaign.toLowerCase();
    },
    [attribution.utm_campaign]
  );

  // Check if any attribution exists
  const hasAttribution = useMemo(() => {
    return !!(
      attribution.utm_source ||
      attribution.utm_medium ||
      attribution.utm_campaign ||
      attribution.referrer
    );
  }, [
    attribution.utm_source,
    attribution.utm_medium,
    attribution.utm_campaign,
    attribution.referrer,
  ]);

  return {
    attribution,
    isReady,
    getAnalyticsParams,
    refresh,
    isFromSource,
    isFromCampaign,
    hasAttribution,
  };
}

export type { AttributionData };

