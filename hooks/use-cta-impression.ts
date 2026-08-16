"use client";

/**
 * useCtaImpression
 *
 * Fires a `cta_impression` event exactly once per component mount when the
 * observed element first becomes visible in the viewport. Disconnects the
 * IntersectionObserver immediately after firing to avoid any further work.
 *
 * Usage:
 *   const ref = useCtaImpression<HTMLDivElement>({
 *     ctaId: 'inline_signup_beach_detail',
 *     surface: 'beach_detail',
 *     enabled: !user,
 *   });
 *   return <div ref={ref}>...</div>;
 */

import { useEffect, useRef } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { CtaImpressionMetadata } from "@/types/implicit-preferences";

interface UseCtaImpressionOptions {
  /** Stable identifier (e.g., 'inline_signup_beach_detail') */
  ctaId: string;
  /** Surface where the CTA lives (e.g., 'beach_detail') */
  surface: string;
  /** Additional metadata to include on the impression event */
  extra?: Record<string, unknown>;
  /** Minimum viewport intersection ratio to count as an impression (default 0.5) */
  threshold?: number;
  /** Disable tracking entirely (e.g., for authenticated users when the CTA is anonymous-only) */
  enabled?: boolean;
  /** Run once alongside the impression after the element crosses the visibility threshold. */
  onImpression?: (entry: IntersectionObserverEntry) => void;
}

export function useCtaImpression<T extends HTMLElement>(
  options: UseCtaImpressionOptions,
) {
  const ref = useRef<T>(null);
  const hasFiredRef = useRef(false);
  const { track } = useTrackEvent();
  const {
    ctaId,
    surface,
    extra,
    threshold = 0.5,
    enabled = true,
    onImpression,
  } = options;

  useEffect(() => {
    if (!enabled || hasFiredRef.current) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            if (hasFiredRef.current) return;
            hasFiredRef.current = true;
            track("cta_impression", {
              metadata: {
                cta_id: ctaId,
                surface,
                viewport_pct: Math.round(entry.intersectionRatio * 100),
                ...extra,
              } as CtaImpressionMetadata,
            });
            observer.disconnect();
            onImpression?.(entry);
            return;
          }
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ctaId, surface, extra, threshold, enabled, onImpression, track]);

  return ref;
}
