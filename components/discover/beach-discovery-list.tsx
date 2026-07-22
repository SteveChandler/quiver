"use client";

import React from "react";
import { BeachDiscoveryCard } from "./beach-discovery-card";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SurfDiscoveryRecommendation, SurfDiscoveryResponse } from "@/types/personalization";
import { buildRecommendationLogUrl } from "@/lib/recommendations/attribution";

interface BeachDiscoveryListProps {
  /** Maximum results to fetch (only used when discoveryData is not provided) */
  maxResults?: number;
  /** Pre-fetched discovery data - if provided, skip fetching */
  discoveryData?: SurfDiscoveryResponse | null;
  /** Loading state from parent (only used when discoveryData is provided) */
  isLoading?: boolean;
  /** Error message from parent (only used when discoveryData is provided) */
  errorMessage?: string | null;
  /** Beach ID to exclude from the list (e.g. the top pick used by another card) */
  excludeBeachId?: string | null;
  /** Optional explicit "Use my location" CTA wiring (no auto-prompt) */
  onUseMyLocation?: () => void;
  showUseMyLocationCta?: boolean;
  geoLoading?: boolean;
  geoError?: string | null;
}

/**
 * MVP Beach Discovery List
 *
 * Displays ranked surf spot recommendations. Can either fetch its own data
 * via useSurfDiscovery hook, or accept pre-fetched data from parent to
 * avoid duplicate API calls.
 */
export function BeachDiscoveryList({
  maxResults = 5,
  discoveryData,
  isLoading: externalLoading,
  errorMessage: externalError,
  excludeBeachId,
  onUseMyLocation,
  showUseMyLocationCta,
  geoLoading,
  geoError,
}: BeachDiscoveryListProps) {
  const router = useRouter();

  // Only fetch if no discoveryData was provided from parent
  const shouldFetch = discoveryData === undefined;
  const {
    discovery: fetchedDiscovery,
    loading: fetchLoading,
    error: fetchError,
    hasRecommendations: fetchHasRecommendations,
  } = useSurfDiscovery({
    maxResults,
    immediate: shouldFetch,
    enabled: shouldFetch,
  });

  // Use provided data or fetched data
  const discovery = discoveryData ?? fetchedDiscovery;
  const loading = discoveryData !== undefined ? (externalLoading ?? false) : fetchLoading;
  const error = discoveryData !== undefined ? externalError : fetchError;
  const recommendationsUnavailable =
    discovery?.recommendationAvailability?.state === "none";
  const hasRecommendations =
    !recommendationsUnavailable &&
    (discovery
      ? discovery.recommendations.length > 0
      : fetchHasRecommendations);

  const handleLogSession = (
    recommendation: SurfDiscoveryRecommendation,
    rank: number
  ) => {
    router.push(
      buildRecommendationLogUrl({
        recommendation,
        rank,
        surface: "discover_list",
      })
    );
  };

  // Loading state
  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Discovering the best surf spots...
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Analyzing conditions and your preferences
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-600" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-900">
                Unable to Discover Spots
              </h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!hasRecommendations) {
    return (
      <Card className="w-full">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Search className="h-12 w-12 text-gray-400" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                No Surf Spots Found
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Try adding some favorite beaches or setting a home beach
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state with recommendations - discovery is guaranteed non-null here
  if (!discovery) return null;

  // Always display 3 spots here (best effort). Prefer discovery (low affinity) and exclude the top pick.
  const displayedRecommendations = (() => {
    const orderedUnique: SurfDiscoveryRecommendation[] = [];
    const seen = new Set<string>();
    for (const r of discovery.recommendations) {
      const id = r.beach.id;
      if (seen.has(id)) continue;
      seen.add(id);
      orderedUnique.push(r);
    }

    const filtered = excludeBeachId
      ? orderedUnique.filter((r) => r.beach.id !== excludeBeachId)
      : orderedUnique;

    const newToYou = filtered.filter((r) => (r.subscores?.affinityBonus ?? 0) <= 0);
    const familiar = filtered.filter((r) => (r.subscores?.affinityBonus ?? 0) > 0);

    const picks = [...newToYou, ...familiar].slice(0, 3);

    // If we still can't fill 3, allow the excluded beach as a last resort.
    if (picks.length < 3 && excludeBeachId) {
      const excluded = orderedUnique.find((r) => r.beach.id === excludeBeachId);
      if (excluded && !picks.some((r) => r.beach.id === excluded.beach.id)) {
        picks.push(excluded);
      }
    }

    return picks;
  })();

  return (
    <div className="space-y-4" data-testid="beach-discovery-list">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Top Surf Spots for You
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {displayedRecommendations.length} Spot
          {displayedRecommendations.length !== 1 ? "s" : ""}
        </p>

        {showUseMyLocationCta && onUseMyLocation && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Want more nearby discovery?
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={onUseMyLocation}
              disabled={geoLoading}
            >
              {geoLoading ? "Detecting…" : "Use my location"}
            </Button>
          </div>
        )}

        {geoError && (
          <p className="text-xs text-yellow-700 mt-2">
            {geoError}
          </p>
        )}
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        {displayedRecommendations.map((recommendation, index) => (
          <BeachDiscoveryCard
            key={recommendation.beach.id}
            recommendation={recommendation}
            rank={index + 1}
            onLogSession={handleLogSession}
          />
        ))}
      </div>

      {/* Metadata */}
      {discovery.metadata.partialSuccess && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-sm text-yellow-800">
              Some beaches couldn&apos;t be analyzed. Showing {discovery.metadata.successfulForecasts}{" "}
              of {discovery.metadata.totalBeachesConsidered} beaches.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
