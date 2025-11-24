"use client";

import { useCallback } from "react";
import Link from "next/link";
import { SectionWrapper } from "./section-wrapper";
import { SurfSpotCard, SurfSpotCardProps } from "./surf-spot-card";
import { CONTENT } from "@/lib/constants/features";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { FALLBACK_IMAGE_BY_NAME } from "@/lib/constants/featured-beaches-config";

interface Beach {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  slug?: string | null;
  photo_url?: string | null;
}

export function SurfHighlightsSection() {
  const fetchBeaches = useCallback(async (): Promise<SurfSpotCardProps[]> => {
    try {
      const response = await fetch("/api/beaches/featured");
      if (!response.ok) {
        throw new Error("Failed to fetch beaches");
      }
      const result = await response.json();
      const beaches: Beach[] = result.data || result;

      // Track used image URLs to prevent duplicates
      const usedImages = new Set<string>();
      const DEFAULT_FALLBACK = "/sunsetBeach.jpg";

      // Transform beaches into surf spot cards with mock conditions
      // Prioritize beaches with actual photos, then unique fallback images
      const spotCards = beaches
        .map((beach, index) => {
          // Determine the image URL
          let imageUrl: string;

          if (beach.photo_url) {
            // Use actual photo from database (proxied for external URLs)
            imageUrl = getProxiedImageUrl(beach.photo_url);
          } else if (FALLBACK_IMAGE_BY_NAME[beach.name]) {
            // Use fallback image if available and not already used
            const fallbackUrl = FALLBACK_IMAGE_BY_NAME[beach.name];
            imageUrl = usedImages.has(fallbackUrl) ? DEFAULT_FALLBACK : fallbackUrl;
          } else {
            // Use default fallback
            imageUrl = DEFAULT_FALLBACK;
          }

          usedImages.add(imageUrl);

          return {
            id: beach.id,
            name: beach.name,
            location: beach.city && beach.state ? `${beach.city}, ${beach.state}` : beach.city || beach.state || "California",
            slug: beach.slug,
            city: beach.city,
            state: beach.state,
            imageUrl,
            swellHeight: getMockSwellHeight(index),
            swellDirection: getMockSwellDirection(index),
            windSpeed: getMockWindSpeed(index),
            tideStatus: getMockTideStatus(index),
            difficulty: getMockDifficulty(index),
            crowdLevel: getMockCrowdLevel(index),
            delay: index,
          };
        })
        .slice(0, 8); // Only take first 8 for display

      return spotCards;
    } catch (error) {
      console.error("Error fetching beaches:", error);
      return [];
    }
  }, []);

  const { data: surfSpots, loading } = useDataFetcher(fetchBeaches);

  // Mock data generators (replace with real API data in production)
  function getMockSwellHeight(index: number): string {
    const heights = ["2-3 ft", "3-5 ft", "4-6 ft", "1-2 ft", "5-7 ft"];
    return heights[index % heights.length];
  }

  function getMockSwellDirection(index: number): string {
    const directions = ["W", "SW", "NW", "S", "WSW"];
    return directions[index % directions.length];
  }

  function getMockWindSpeed(index: number): string {
    const speeds = [
      "5-10 mph offshore",
      "Light offshore",
      "10-15 mph",
      "Calm",
          "5 mph offshore",
        ];
        return speeds[index % speeds.length];
      }

  function getMockTideStatus(index: number): string {
    const tides = ["Rising", "High tide", "Mid tide", "Low tide", "Falling"];
    return tides[index % tides.length];
  }

  function getMockDifficulty(index: number): SurfSpotCardProps["difficulty"] {
    const levels: SurfSpotCardProps["difficulty"][] = [
      "Beginner",
      "Intermediate",
      "Advanced",
      "Expert",
    ];
    return levels[index % levels.length];
  }

  function getMockCrowdLevel(index: number): SurfSpotCardProps["crowdLevel"] {
    const crowds: SurfSpotCardProps["crowdLevel"][] = [
      "Uncrowded",
      "Moderate",
      "Crowded",
    ];
    return crowds[index % crowds.length];
  }

  return (
    <SectionWrapper
      title={CONTENT.sections.surfHighlights.title}
      subtitle={CONTENT.sections.surfHighlights.subtitle}
      centerContent
      className="py-20 px-4 bg-gradient-to-b from-white to-blue-50"
    >
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-80 bg-gray-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {surfSpots && surfSpots.length > 0 ? (
              surfSpots.map((spot) => <SurfSpotCard key={spot.id} {...spot} />)
            ) : (
              <div className="col-span-full text-center py-12 text-gray-500">
                No surf spots available at the moment.
              </div>
            )}
          </div>

          {/* CTA */}
          <div
            className="text-center animate-fade-in-up"
            style={{ animationDelay: "400ms" }}
          >
            <Button
              size="lg"
              className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-8 py-4 text-lg font-roboto font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
              asChild
            >
              <Link href="/map">
                Explore All Surf Spots
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </>
      )}
    </SectionWrapper>
  );
}
