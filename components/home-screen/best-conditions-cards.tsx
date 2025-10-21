"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getBestBeachesNearHome } from "@/actions/beach/best-beaches-simple";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Waves, Wind, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { BeachRecommendation } from "@/types/beach-recommendations";

export function BestConditionsCards() {
  console.log("[BestConditionsCards] 🎯 Component rendering!");
  const router = useRouter();

  const fetchData = useCallback(async () => {
    console.log("[BestConditionsCards] 📞 Calling getBestBeachesNearHome");
    return await getBestBeachesNearHome();
  }, []);

  const { data: result, loading, error } = useDataFetcher(fetchData);

  // Debug logging
  console.log("[BestConditionsCards] Loading:", loading);
  console.log("[BestConditionsCards] Error:", error);
  console.log("[BestConditionsCards] Result:", result);

  if (loading) {
    return <BestConditionsCardsSkeleton />;
  }

  if (error) {
    // Show error state instead of hiding
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Best Conditions Near You</h3>
          <p className="text-sm text-muted-foreground">
            Top surf spots within 10 miles right now
          </p>
        </div>
        <div className="p-8 bg-red-50 border-2 border-red-200 rounded-lg text-center">
          <p className="text-lg font-medium text-red-900">
            Error loading beaches: {error}
          </p>
        </div>
      </div>
    );
  }

  if (!result?.success || !result.data || result.data.length === 0) {
    console.log("[BestConditionsCards] No beaches found:", {
      hasResult: !!result,
      success: result?.success,
      hasData: !!result?.data,
      dataLength: result?.data?.length,
    });
    return null; // Hide if no beaches within range
  }

  const beaches = result.data as BeachRecommendation[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Best Conditions Near You</h3>
          <p className="text-sm text-muted-foreground">
            Top surf spots within 10 miles right now
          </p>
        </div>
      </div>

      {/* Horizontal Scrollable Cards */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
        {beaches.map((beach) => (
          <Card
            key={beach.id}
            className="flex-shrink-0 w-[280px] sm:w-[320px] cursor-pointer hover:shadow-lg transition-shadow snap-start"
            onClick={() => router.push(`/beach/${beach.id}`)}
          >
            {/* Beach Image */}
            <div className="relative h-48 w-full bg-gray-200">
              {beach.image_url ? (
                <Image
                  src={beach.image_url}
                  alt={beach.name}
                  fill
                  className="object-cover rounded-t-lg"
                  sizes="(max-width: 640px) 280px, 320px"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                  <Waves className="h-12 w-12 text-blue-400" />
                </div>
              )}
              {beach.is_hidden_gem && (
                <Badge className="absolute top-3 right-3 bg-purple-500 hover:bg-purple-600">
                  Hidden Gem
                </Badge>
              )}
            </div>

            <CardContent className="p-4 space-y-3">
              {/* Beach Name & Location */}
              <div>
                <h4 className="font-semibold text-lg line-clamp-1">
                  {beach.name}
                </h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>📍</span> {beach.location} · {beach.distance_miles} mi
                </p>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                {/* Wave Height */}
                <div className="flex items-center gap-2 text-sm">
                  <Waves className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="font-medium">{beach.wave_height}</span>
                  <span className="text-muted-foreground">
                    {beach.wave_direction}
                  </span>
                </div>

                {/* Wind */}
                <div className="flex items-center gap-2 text-sm">
                  <Wind className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-muted-foreground line-clamp-1">
                    {beach.wind_description}
                  </span>
                </div>

                {/* Tide */}
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <span className="text-muted-foreground line-clamp-1">
                    {beach.tide_status}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={getSkillLevelColor(beach.skill_level)}
                >
                  {beach.skill_level}
                </Badge>
                <Badge
                  variant="outline"
                  className={getCrowdLevelColor(beach.crowd_level)}
                >
                  <span className="mr-1">👥</span>
                  {beach.crowd_level}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BestConditionsCardsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-4 w-64 bg-gray-200 animate-pulse rounded" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="flex-shrink-0 w-[280px] sm:w-[320px]">
            <div className="h-48 bg-gray-200 animate-pulse rounded-t-lg" />
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4" />
                <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 bg-gray-200 animate-pulse rounded" />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-20 bg-gray-200 animate-pulse rounded" />
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getSkillLevelColor(level: string): string {
  const colors: Record<string, string> = {
    Beginner: "bg-green-50 text-green-700 border-green-200",
    Intermediate: "bg-blue-50 text-blue-700 border-blue-200",
    Advanced: "bg-orange-50 text-orange-700 border-orange-200",
    Expert: "bg-red-50 text-red-700 border-red-200",
  };
  return colors[level] || colors.Intermediate;
}

function getCrowdLevelColor(level: string): string {
  const colors: Record<string, string> = {
    Uncrowded: "bg-green-50 text-green-700 border-green-200",
    Moderate: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Crowded: "bg-red-50 text-red-700 border-red-200",
  };
  return colors[level] || colors.Moderate;
}
