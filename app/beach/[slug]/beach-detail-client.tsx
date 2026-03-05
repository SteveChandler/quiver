"use client";

import { BeachDetail } from "@/components/beach-detail";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState, useRef, type ReactNode } from "react";
import { trackPublicPageView } from "@/lib/analytics";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { Beach } from "@/types/database";

import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";

interface BeachDetailClientProps {
  beach: Beach;
  slug: string;
  beachTimezone?: string | null;
  surfReportSlot?: ReactNode;
  surfCallReport?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;
  defaultTab?: "overview" | "forecast" | "reviews" | "intel" | "sessions";
  defaultSubTab?: "today" | "tides" | "conditions";
  amenities?: BeachAmenities | null;
  waterQuality?: WaterQuality | null;
}

export function BeachDetailClient({
  beach,
  slug,
  beachTimezone,
  surfReportSlot,
  surfCallReport,
  surfCallIsTomorrow,
  defaultTab,
  defaultSubTab,
  amenities,
  waterQuality,
}: BeachDetailClientProps) {
  const { user } = useAuth();
  const { track } = useTrackEvent();
  const mountTime = useRef(Date.now());
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

  useEffect(() => {
    // Track public page view
    if (!user) {
      trackPublicPageView("beach-detail", { slug });
    }

    // Track beach view for all visitors (authed + anonymous)
    if (beach?.id) {
      track('beach_view', {
        beachId: beach.id,
        metadata: { referrer: document.referrer },
      });
    }

    // Capture mount time for cleanup function
    const startTime = mountTime.current;

    // Track duration on unmount
    return () => {
      if (beach?.id) {
        const duration = Date.now() - startTime;
        if (duration > 3000) {
          track('beach_view', {
            beachId: beach.id,
            metadata: {
              duration_ms: duration,
              forecast_viewed: true
            },
            debounceMs: 0, // Force fire on unmount
          });
        }
      }
    };
  }, [slug, user, beach?.id, track]);

  return (
    <>
      <BeachDetail
        id={beach.id}
        publicMode={!user}
        initialBeach={beach}
        beachTimezone={beachTimezone}
        surfReportSlot={surfReportSlot}
        surfCallReport={surfCallReport}
        surfCallIsTomorrow={surfCallIsTomorrow}
        defaultTab={defaultTab}
        defaultSubTab={defaultSubTab}
        amenities={amenities}
        waterQuality={waterQuality}
        personalizationData={personalizationData}
        onPersonalizationRequest={(forecast, baseScore) => {
          // BeachDetail will call this when it has forecast data and wants personalization
          if (!user || personalizationData.isLoading) return;

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
