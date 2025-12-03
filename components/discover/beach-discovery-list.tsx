"use client";

import React from "react";
import { BeachDiscoveryCard } from "./beach-discovery-card";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import type { SurfDiscoveryResponse } from "@/types/personalization";

interface BeachDiscoveryListProps {
  /** Maximum results to fetch (only used when discoveryData is not provided) */
  maxResults?: number;
  /** Pre-fetched discovery data - if provided, skip fetching */
  discoveryData?: SurfDiscoveryResponse | null;
  /** Loading state from parent (only used when discoveryData is provided) */
  isLoading?: boolean;
  /** Error message from parent (only used when discoveryData is provided) */
  errorMessage?: string | null;
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
  const hasRecommendations = discovery ? discovery.recommendations.length > 0 : fetchHasRecommendations;

  const handleViewBeach = (beachId: string) => {
    // Find the recommendation for this beach to get complete data for URL generation
    const recommendation = discovery?.recommendations.find(r => r.beach.id === beachId);

    if (!recommendation) {
      console.warn(`Beach ${beachId} not found in recommendations`);
      // Fallback to UUID-based route
      router.push(`/beach/${beachId}`);
      return;
    }

    // Generate proper hierarchical URL (e.g., /ca/pacific-beach-san-diego/pacific-beach)
    const beachUrl = getBeachUrlSafe({
      id: recommendation.beach.id,
      slug: recommendation.beach.slug,
      city: recommendation.beach.city,
      state: recommendation.beach.state,
    });

    if (!beachUrl) {
      console.warn(`Could not generate URL for beach ${beachId}`);
      // Fallback to UUID-based route
      router.push(`/beach/${beachId}`);
      return;
    }

    // Navigate to the beach page with source tracking
    const urlWithSource = beachUrl.includes("?")
      ? `${beachUrl}&from=surf_discovery`
      : `${beachUrl}?from=surf_discovery`;

    router.push(urlWithSource);
  };

  const handlePlanSession = (beachId: string) => {
    // Find the recommendation to get complete data including time window
    const recommendation = discovery?.recommendations.find(r => r.beach.id === beachId);

    if (!recommendation) {
      console.warn(`Beach ${beachId} not found in recommendations`);
      // Fallback to basic route
      router.push(`/sessions/new?mode=plan&beach=${beachId}`);
      return;
    }

    // Build URL with prefill parameters
    const params = new URLSearchParams({
      mode: 'plan',
      beach: recommendation.beach.id,
      beachName: recommendation.beach.name,
      startTime: recommendation.window.start.toISOString(),
      endTime: recommendation.window.end.toISOString(),
      step: '3', // Jump to Goals step (0-indexed would be 2, but using 1-indexed for clarity)
    });

    router.push(`/sessions/new?${params.toString()}`);
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

  // Success state with recommendations
  return (
    <div className="space-y-4" data-testid="beach-discovery-list">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Top Surf Spots for You
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {discovery.recommendations.length} Spot
          {discovery.recommendations.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        {discovery.recommendations.map((recommendation, index) => (
          <BeachDiscoveryCard
            key={recommendation.beach.id}
            recommendation={recommendation}
            rank={index + 1}
            onViewBeach={handleViewBeach}
            onPlanSession={handlePlanSession}
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
