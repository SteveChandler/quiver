"use client";

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { Waves, Users, Car, MapPin, Star, Plus, Loader2 } from "lucide-react";
import { getBeachReviewStats } from "@/actions/beach-review-actions";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { ReviewStats } from "@/lib/review-stats-utils";

interface BeachReviewSummaryProps {
  beachId: string;
  onWriteReview?: () => void;
  refreshTrigger?: number;
}

export function BeachReviewSummary({
  beachId,
  onWriteReview,
  refreshTrigger,
}: BeachReviewSummaryProps) {
  const { user } = useAuth();
  const fetchStats = useCallback(async (): Promise<ReviewStats | null> => {
    const result = await getBeachReviewStats(beachId);
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch review stats");
  }, [beachId]);

  const {
    data: stats,
    loading,
    refetch,
  } = useDataFetcher<ReviewStats | null>(fetchStats, { immediate: true });

  useEffect(() => {
    // Refetch when the parent triggers a refresh (e.g., after writing a review)
    if (typeof refreshTrigger !== "undefined") {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  if (loading) {
    return (
      <div
        id="reviews-ratings-section"
        className="rounded-3xl border border-blue-100/60 bg-white/95 p-6 shadow-lg"
      >
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-ocean-blue" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalReviews = stats.total_reviews;
  const averageOverall = stats.average_overall ?? 0;

  const categories = [
    {
      name: "Wave Quality",
      value: stats.average_wave_quality ?? 0,
      icon: <Waves className="h-4 w-4" />,
    },
    {
      name: "Crowd Level",
      value: stats.average_crowd_density ?? 0,
      icon: <Users className="h-4 w-4" />,
    },
    {
      name: "Parking",
      value: stats.average_parking ?? 0,
      icon: <Car className="h-4 w-4" />,
    },
    {
      name: "Accessibility",
      value: stats.average_accessibility ?? 0,
      icon: <MapPin className="h-4 w-4" />,
    },
  ];

  const distribution = stats.distribution || [];
  const distributionGradients: Record<number, string> = {
    5: "from-ocean-blue to-blue-500",
    4: "from-blue-400 to-blue-300",
    3: "from-amber-400 to-amber-300",
    2: "from-orange-400 to-orange-300",
    1: "from-red-400 to-red-300",
  };

  if (totalReviews === 0) {
    return (
      <div
        id="reviews-ratings-section"
        className="rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100/60 bg-blue-50/70 p-6">
          <h2 className="flex items-center gap-2 text-lg font-roboto font-semibold text-dark-grey">
            <Star className="h-5 w-5 text-yellow-500" /> Reviews & Ratings
          </h2>
          {user && onWriteReview && (
            <Button
              onClick={onWriteReview}
              size="sm"
              className="bg-ocean-blue text-white hover:bg-ocean-blue/90"
            >
              <Plus className="mr-2 h-4 w-4" /> Write a review
            </Button>
          )}
        </div>
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <Star className="h-12 w-12 text-yellow-500/60" />
          <p className="text-lg font-medium text-dark-grey">No reviews yet</p>
          <p className="text-sm">Be the first to share how this spot breaks.</p>
          {user && onWriteReview && (
            <Button
              onClick={onWriteReview}
              size="sm"
              className="bg-ocean-blue text-white hover:bg-ocean-blue/90"
            >
              <Plus className="mr-2 h-4 w-4" /> Write the first review
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      id="reviews-ratings-section"
      className="rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100/60 bg-blue-50/80 p-6">
        <h2 className="flex items-center gap-2 text-lg font-roboto font-semibold text-dark-grey">
          <Star className="h-5 w-5 text-yellow-500" /> Reviews & Ratings
        </h2>
        {user && onWriteReview && (
          <Button
            onClick={onWriteReview}
            size="sm"
            className="bg-ocean-blue text-white hover:bg-ocean-blue/90"
          >
            <Plus className="mr-2 h-4 w-4" /> Write a review
          </Button>
        )}
      </div>
      <div className="grid gap-8 p-6 lg:grid-cols-[280px,1fr]">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Overall score
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-roboto font-extrabold text-ocean-blue">
                {averageOverall.toFixed(1)}
              </span>
              <StarRating rating={Math.round(averageOverall)} size="lg" />
            </div>
            <p className="text-sm text-muted-foreground">
              Based on {totalReviews}{" "}
              {totalReviews === 1 ? "review" : "reviews"}
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Ratings spread
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-blue-100">
              {distribution
                .filter((item) => item.count > 0)
                .map((item) => (
                  <div
                    key={item.rating}
                    className={`h-full bg-gradient-to-r ${
                      distributionGradients[item.rating]
                    }`}
                    style={{
                      flexGrow: item.count,
                      flexBasis: 0,
                      minWidth: item.count ? "6px" : undefined,
                    }}
                  />
                ))}
            </div>
            <div className="mt-1 grid grid-cols-5 gap-2 text-center text-xs font-medium text-muted-foreground">
              {distribution.map((item) => (
                <div key={item.rating}>
                  <div className="font-semibold text-dark-grey">
                    {item.rating}★
                  </div>
                  <div>{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Rating breakdown
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {categories.map((category) => {
                const percent = Math.min(
                  100,
                  Math.max(0, (category.value / 5) * 100)
                );
                return (
                  <div
                    key={category.name}
                    className="rounded-2xl border border-blue-100/60 bg-blue-50/60 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean-blue/10 text-ocean-blue">
                          {category.icon}
                        </div>
                        <span className="text-sm font-semibold text-dark-grey">
                          {category.name}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-ocean-blue">
                        {category.value.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-ocean-blue to-blue-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
