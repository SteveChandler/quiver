"use client";

import { BeachDetail } from "@/components/beach-detail";
import { useAuth } from "@/context/auth-context";
import { useEffect, useState, Suspense, type ReactNode } from "react";
import { trackPublicPageView } from "@/lib/analytics";
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
}

export function BeachDetailClient({
  beach,
  slug,
  beachTimezone,
  surfReportSlot,
  surfCallReport,
  surfCallIsTomorrow,
}: BeachDetailClientProps) {
  const { user } = useAuth();
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
  }, [slug, user]);

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
