"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SectionWrapper } from "./section-wrapper";
import { SurfSpotCard, SurfSpotCardProps } from "./surf-spot-card";
import { CONTENT } from "@/lib/constants/features";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface Beach {
  id: string;
  name: string;
  city?: string;
  state?: string;
  photo_url?: string | null;
}

export function SurfHighlightsSection() {
  const fetchBeaches = useCallback(async (): Promise<SurfSpotCardProps[]> => {
    try {
      const response = await fetch("/api/beaches/featured");
      if (!response.ok) {
        throw new Error("Failed to fetch beaches");
      }
      const beaches: Beach[] = await response.json();

      // Transform beaches into surf spot cards with mock conditions
      // In production, you'd fetch real conditions from the forecast API
      return beaches.slice(0, 8).map((beach, index) => ({
        id: beach.id,
        name: beach.name,
        location: `${beach.city || "California"}, ${beach.state || "CA"}`,
        imageUrl: beach.photo_url,
        swellHeight: getMockSwellHeight(index),
        swellDirection: getMockSwellDirection(index),
        windSpeed: getMockWindSpeed(index),
        tideStatus: getMockTideStatus(index),
        difficulty: getMockDifficulty(index),
        crowdLevel: getMockCrowdLevel(index),
        isHiddenGem: index % 5 === 0,
        delay: index,
      }));
    } catch (error) {
      console.error("Error fetching beaches:", error);
      // Return fallback data for landing page
      return getFallbackSpots();
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

  function getFallbackSpots(): SurfSpotCardProps[] {
    return [
      {
        id: "1",
        name: "Black's Beach",
        location: "La Jolla, CA",
        imageUrl: "/images/blacks.jpg",
        swellHeight: "4-6 ft",
        swellDirection: "W",
        windSpeed: "5-10 mph offshore",
        tideStatus: "Mid tide",
        difficulty: "Advanced",
        crowdLevel: "Moderate",
        isHiddenGem: false,
        delay: 0,
      },
      {
        id: "2",
        name: "Swami's",
        location: "Encinitas, CA",
        imageUrl: "/images/Winter-Swamis.jpg",
        swellHeight: "3-5 ft",
        swellDirection: "SW",
        windSpeed: "Light offshore",
        tideStatus: "Rising",
        difficulty: "Intermediate",
        crowdLevel: "Crowded",
        isHiddenGem: false,
        delay: 1,
      },
      {
        id: "3",
        name: "Tourmaline",
        location: "Pacific Beach, CA",
        imageUrl: "/images/tourmaline.png",
        swellHeight: "2-3 ft",
        swellDirection: "W",
        windSpeed: "Calm",
        tideStatus: "High tide",
        difficulty: "Beginner",
        crowdLevel: "Moderate",
        isHiddenGem: false,
        delay: 2,
      },
      {
        id: "4",
        name: "Windansea",
        location: "La Jolla, CA",
        imageUrl: "/images/windandsea-surf-shack-sunset.jpg",
        swellHeight: "5-7 ft",
        swellDirection: "NW",
        windSpeed: "10-15 mph",
        tideStatus: "Low tide",
        difficulty: "Expert",
        crowdLevel: "Crowded",
        isHiddenGem: true,
        delay: 3,
      },
    ];
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
            {(surfSpots || getFallbackSpots()).map((spot) => (
              <SurfSpotCard key={spot.id} {...spot} />
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
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
          </motion.div>
        </>
      )}
    </SectionWrapper>
  );
}
