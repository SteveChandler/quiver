"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FeatureGrid } from "./feature-grid";
import { PracticalTipsSection } from "./practical-tips-section";
import { QuickStats } from "./quick-stats";
import type { Beach } from "@/types/database";

interface EnhancedBeachOverviewProps {
  beach: Beach & {
    features?: string[];
    parking_tips?: string | null;
    access_tips?: string | null;
    wave_tips?: string | null;
    crowd_tips?: string | null;
    best_conditions_prose?: string | null;
    warnings?: string[];
    description?: string | null;
    local_etiquette?: string | null;
    average_rating?: number;
    review_count?: number;
  };
  className?: string;
}

export function EnhancedBeachOverview({
  beach,
  className,
}: EnhancedBeachOverviewProps) {
  const hasContent =
    beach.description ||
    beach.features?.length ||
    beach.warnings?.length ||
    beach.best_conditions_prose ||
    beach.parking_tips ||
    beach.access_tips ||
    beach.wave_tips ||
    beach.crowd_tips;

  if (!hasContent) return null;

  return (
    <div className={className}>
      {/* Quick Stats */}
      <QuickStats
        breakType={beach.break_type || undefined}
        skillLevel={beach.skill_level || undefined}
        averageRating={beach.average_rating}
        reviewCount={beach.review_count}
        className="mb-6"
      />

      {/* Feature Tags */}
      <FeatureGrid
        features={beach.features || []}
        warnings={beach.warnings || []}
        className="mb-6"
      />

      {/* Description - 2-3 paragraphs */}
      {beach.description && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-3">About This Spot</h3>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {beach.description}
            </p>
            {beach.local_etiquette && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Local Etiquette
                </h4>
                <p className="text-sm text-blue-800">{beach.local_etiquette}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Practical Tips - Expandable sections */}
      <PracticalTipsSection
        parkingTips={beach.parking_tips}
        accessTips={beach.access_tips}
        waveTips={beach.wave_tips}
        crowdTips={beach.crowd_tips}
        bestConditionsProse={beach.best_conditions_prose}
        warnings={beach.warnings}
      />
    </div>
  );
}
