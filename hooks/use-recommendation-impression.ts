"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import type { RecommendationImpressionInput } from "@/lib/recommendations/impressions";
import { buildRecommendationImpressionKey } from "@/lib/recommendations/impressions";

const seenImpressionKeys = new Set<string>();
const pendingImpressions = new Map<string, RecommendationImpressionInput>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushPendingImpressions(): void {
  const entries = Array.from(pendingImpressions.entries());
  pendingImpressions.clear();
  flushTimer = null;

  if (entries.length === 0) return;

  void fetch("/api/recommendation-impressions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      impressions: entries.map(([, impression]) => impression),
    }),
  })
    .then((response) => {
      if (response.ok) return;
      entries.forEach(([entryKey]) => seenImpressionKeys.delete(entryKey));
    })
    .catch(() => {
      entries.forEach(([entryKey]) => seenImpressionKeys.delete(entryKey));
    });
}

function queueRecommendationImpression(
  key: string,
  impression: RecommendationImpressionInput
): void {
  pendingImpressions.set(key, impression);
  if (flushTimer) return;
  flushTimer = setTimeout(flushPendingImpressions, 0);
}

export function useRecommendationImpression<TElement extends Element>(
  impression: RecommendationImpressionInput | null
) {
  const { user } = useAuth();
  const elementRef = useRef<TElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = useMemo(
    () =>
      impression && user?.id
        ? buildRecommendationImpressionKey(user.id, impression)
        : null,
    [impression, user?.id]
  );

  useEffect(() => {
    if (!impression || !user?.id || !key || seenImpressionKeys.has(key)) return;
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const clearPending = (): void => {
      if (!timeoutRef.current) return;
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.5) {
          clearPending();
          return;
        }

        if (timeoutRef.current) return;
        timeoutRef.current = setTimeout(() => {
          if (seenImpressionKeys.has(key)) return;
          seenImpressionKeys.add(key);
          queueRecommendationImpression(key, impression);
        }, 500);
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(element);

    return () => {
      clearPending();
      observer.disconnect();
    };
  }, [impression, key, user?.id]);

  return elementRef;
}
