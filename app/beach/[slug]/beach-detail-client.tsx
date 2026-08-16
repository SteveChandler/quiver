"use client";

import { BeachDetail } from "@/components/beach-detail";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { trackPublicPageView } from "@/lib/analytics";
import { useTrackEvent } from "@/hooks/use-track-event";
import { inferHomeBreakFromView } from "@/actions/onboarding-actions";
import type { Beach } from "@/types/database";

import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import type { ZineBeachPhoto } from "@/components/beach-detail/zine/types";
import type { ZineHeroHeadingLevel } from "@/components/beach-detail/zine/zine-hero";

interface BeachDetailClientProps {
  beach: Beach;
  slug: string;
  beachTimezone?: string | null;
  surfCallReport?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;
  defaultTab?: "overview" | "forecast" | "reviews" | "intel" | "sessions";
  defaultSubTab?: "today" | "tides" | "conditions";
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
  beachPhoto?: ZineBeachPhoto | null;
  heroHeadingLevel?: ZineHeroHeadingLevel;
  heroForecastSlot?: ReactNode;
  beforeTabsContent?: ReactNode;
  afterTabsContent?: ReactNode;
  freeGrowthPhaseEnabled?: boolean;
}

export function BeachDetailClient({
  beach,
  slug,
  beachTimezone,
  surfCallReport,
  surfCallIsTomorrow,
  defaultTab,
  defaultSubTab,
  amenities,
  waterQuality,
  beachPhoto,
  heroHeadingLevel,
  heroForecastSlot,
  beforeTabsContent,
  afterTabsContent,
  freeGrowthPhaseEnabled,
}: BeachDetailClientProps) {
  const { user } = useAuth();
  const { track } = useTrackEvent();
  const mountTime = useRef(Date.now());
  const beachIdRef = useRef<string | null>(null);
  const beachNameRef = useRef<string | null>(null);
  const [personalizationData, setPersonalizationData] = useState<{
    score: PersonalizedScore | null;
    affinityData: { sessionCount: number; lastSurfed: Date } | null;
    isLoading: boolean;
    error: boolean;
  }>({
    score: null,
    affinityData: null,
    isLoading: false,
    error: false,
  });
  const [effectiveSurfCallReport, setEffectiveSurfCallReport] = useState<SurfCallResult | null>(
    surfCallReport ?? null,
  );
  const [effectiveSurfCallIsTomorrow, setEffectiveSurfCallIsTomorrow] = useState<boolean>(
    surfCallIsTomorrow ?? false,
  );
  const [personalizationReady, setPersonalizationReady] = useState(false);

  useEffect(() => {
    setEffectiveSurfCallReport(surfCallReport ?? null);
  }, [surfCallReport]);

  useEffect(() => {
    setEffectiveSurfCallIsTomorrow(surfCallIsTomorrow ?? false);
  }, [surfCallIsTomorrow]);

  useEffect(() => {
    setPersonalizationReady(false);
    const run = (): void => setPersonalizationReady(true);

    if (
      typeof window !== "undefined" &&
      "requestIdleCallback" in window &&
      typeof window.requestIdleCallback === "function"
    ) {
      const handle = window.requestIdleCallback(run, { timeout: 1800 });
      return () => {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(handle);
        }
      };
    }

    const timeout = window.setTimeout(run, 600);
    return () => window.clearTimeout(timeout);
  }, [beach?.id]);

  // Keep refs in sync with beach data
  useEffect(() => {
    if (beach?.id) {
      beachIdRef.current = beach.id;
      beachNameRef.current = beach.name;
    }
  }, [beach?.id, beach?.name]);

  useEffect(() => {
    // Track public page view
    if (!user) {
      trackPublicPageView("beach-detail", { slug });
    }

    // beach_view tracking is handled by BeachDetailContent via useTrackEvent

    // Lazy home-break inference: if the user is signed in and hasn't picked a
    // home break yet, claim this beach as their home. Idempotent server-side —
    // only writes if home_beach_id IS NULL. Fire-and-forget so it never blocks
    // the page render. Reads beach.id via beachIdRef to match the existing
    // pattern used for duration tracking below and avoid an exhaustive-deps
    // warning without re-firing the effect on prop churn.
    // See Fix 5 in plans/majestic-squishing-newell.md.
    const inferBeachId = beachIdRef.current;
    if (user && inferBeachId) {
      void inferHomeBreakFromView(inferBeachId).catch((err) => {
        // Non-fatal — the user's session still works without a home break.
        console.warn("inferHomeBreakFromView failed:", err);
      });
    }

    // Capture mount time for cleanup function
    const startTime = mountTime.current;

    // Track duration on unmount
    return () => {
      const id = beachIdRef.current;
      if (id) {
        const duration = Date.now() - startTime;
        if (duration > 3000) {
          track('beach_view', {
            beachId: id,
            metadata: {
              duration_ms: duration,
              forecast_viewed: true,
              beach_name: beachNameRef.current ?? undefined,
            },
            debounceMs: 0, // Force fire on unmount
          });
        }
      }
    };
  }, [slug, user, track]);

  useEffect(() => {
    if (!user || !beach?.id || !personalizationReady) return;

    const controller = new AbortController();

    const fetchPersonalizedSurfCall = async () => {
      try {
        const res = await fetch(`/api/surf/call?beachId=${beach.id}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;

        const json = await res.json();
        const data = json?.data;
        if (!data?.report) return;

        setEffectiveSurfCallReport(data.report);
        setEffectiveSurfCallIsTomorrow(Boolean(data.isTomorrow));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    };

    void fetchPersonalizedSurfCall();

    return () => controller.abort();
  }, [user, beach?.id, personalizationReady]);

  return (
    <>
      <BeachDetail
        id={beach.id}
        publicMode={!user}
        initialBeach={beach}
        beachTimezone={beachTimezone}
        surfCallReport={effectiveSurfCallReport}
        surfCallIsTomorrow={effectiveSurfCallIsTomorrow}
        defaultTab={defaultTab}
        defaultSubTab={defaultSubTab}
        amenities={amenities}
        waterQuality={waterQuality}
        beachPhoto={beachPhoto}
        heroHeadingLevel={heroHeadingLevel}
        heroForecastSlot={heroForecastSlot}
        beforeTabsContent={beforeTabsContent}
        afterTabsContent={afterTabsContent}
        freeGrowthPhaseEnabled={freeGrowthPhaseEnabled}
        personalizationData={personalizationData}
        onPersonalizationRequest={(forecast, baseScore) => {
          // BeachDetail will call this when it has forecast data and wants personalization
          if (!user || !personalizationReady || personalizationData.isLoading) {
            return;
          }

          setPersonalizationData(prev => ({ ...prev, isLoading: true, error: false }));

          // Safe fetch wrapper that doesn't cause console errors for graceful degradation
          const safeFetch = async <T,>(url: string, options?: RequestInit): Promise<T | null> => {
            try {
              const res = await fetch(url, options);
              if (!res.ok) return null;
              return await res.json();
            } catch {
              return null;
            }
          };

          // Fetch personalized score and affinity data in parallel
          Promise.all([
            safeFetch<{ data: typeof personalizationData.score }>('/api/beach/personalized-score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                beachId: beach.id,
                baseScore,
                forecast,
              }),
            }),
            safeFetch<{ data: typeof personalizationData.affinityData }>(`/api/user/beach-affinity?beachId=${beach.id}`)
          ])
            .then(([scoreResponse, affinityResponse]) => {
              setPersonalizationData({
                score: scoreResponse?.data || null,
                affinityData: affinityResponse?.data || null,
                isLoading: false,
                error: !scoreResponse?.data,
              });
            })
            .catch(() => {
              // Silent fail - personalization is optional enhancement
              setPersonalizationData(prev => ({
                ...prev,
                isLoading: false,
                error: true,
              }));
            });
        }}
      />
    </>
  );
}
