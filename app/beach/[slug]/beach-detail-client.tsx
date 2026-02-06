"use client";

import { BeachDetail } from "@/components/beach-detail";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState, useRef, Suspense, type ReactNode } from "react";
import { trackPublicPageView } from "@/lib/analytics";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { Beach } from "@/types/database";
import AuthGate from "@/components/auth/auth-gate";
import type { PersonalizedScore } from "@/lib/services/personalized-scoring-service";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";

interface BeachDetailClientProps {
  beach: Beach;
  slug: string;
  beachTimezone?: string | null;
  surfReportSlot?: ReactNode;
  surfCallReport?: SurfCallResult | null;
  surfCallIsTomorrow?: boolean;
  defaultTab?: "overview" | "forecast" | "reviews" | "intel" | "sessions";
  defaultSubTab?: "today" | "tides" | "conditions";
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

    // Track beach view for implicit preferences
    if (user && beach?.id) {
      track('beach_view', {
        beachId: beach.id,
        metadata: { referrer: document.referrer },
      });
    }

    // Capture mount time for cleanup function
    const startTime = mountTime.current;

    // Track duration on unmount
    return () => {
      if (user && beach?.id) {
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
      <Suspense fallback={null}>
        <AuthGate block />
      </Suspense>
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
        personalizationData={personalizationData}
        onPersonalizationRequest={(forecast, baseScore) => {
          // BeachDetail will call this when it has forecast data and wants personalization
          if (!user || personalizationData.isLoading) return;

          setPersonalizationData(prev => ({ ...prev, isLoading: true, error: false }));

          // Fetch personalized score and affinity data in parallel
          Promise.all([
            fetch('/api/beach/personalized-score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                beachId: beach.id,
                baseScore,
                forecast,
              }),
            }).then(res => res.ok ? res.json() : null),
            fetch(`/api/user/beach-affinity?beachId=${beach.id}`)
              .then(res => res.ok ? res.json() : null)
              .catch(() => null)
          ])
            .then(([scoreResponse, affinityResponse]) => {
              setPersonalizationData({
                score: scoreResponse?.data || null,
                affinityData: affinityResponse?.data || null,
                isLoading: false,
                error: !scoreResponse?.data,
              });
            })
            .catch(error => {
              console.error('Failed to calculate personalization:', error);
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
