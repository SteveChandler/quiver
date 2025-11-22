"use client";

import React from "react";
import { BeachDiscoveryCard } from "./beach-discovery-card";
import { useSurfDiscovery } from "@/hooks/use-surf-discovery";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface BeachDiscoveryListProps {
  maxResults?: number;
}

/**
 * MVP Beach Discovery List
 *
 * Fetches and displays ranked surf spot recommendations using the
 * useSurfDiscovery hook. Shows loading, error, and empty states.
 */
export function BeachDiscoveryList({ maxResults = 5 }: BeachDiscoveryListProps) {
  const router = useRouter();
  const { discovery, loading, error, hasRecommendations } = useSurfDiscovery({
    maxResults,
    immediate: true,
    enabled: true,
  });

  const handleViewBeach = (beachId: string) => {
    router.push(`/beaches/${beachId}`);
  };

  const handlePlanSession = (beachId: string) => {
    router.push(`/sessions/wizard?beachId=${beachId}`);
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
              Some beaches couldn't be analyzed. Showing {discovery.metadata.successfulForecasts}{" "}
              of {discovery.metadata.totalBeachesConsidered} beaches.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
