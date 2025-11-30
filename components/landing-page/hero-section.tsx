"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { CONTENT } from "@/lib/constants/features";
import { HeroCarousel } from "./hero-carousel";
import HeroSearchLazy from "./hero-search-lazy";
import type { Beach } from "@/types/database";

export function HeroSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const navigateToMap = (query?: string) => {
    const trimmed = query?.trim();
    const url =
      trimmed && trimmed.length > 0
        ? `/map?search=${encodeURIComponent(trimmed)}`
        : "/map";
    router.push(url);
  };

  const handleBeachSelect = (beach: Beach) => {
    // Navigate to map with the selected beach name as search query
    navigateToMap(beach.name);
  };

  const handleExploreClick = async (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    event.preventDefault();
    navigateToMap(searchQuery);
  };

  return (
    <section className="relative min-h-[75svh] flex items-center justify-center overflow-clip md:overflow-visible pt-16">
      {/* Hero Carousel Background */}
      <HeroCarousel />

      {/* Enhanced Overlay with Gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60 z-20" />

      {/* Hero Content - Search-Centric */}
      <div className="relative z-30 w-full max-w-[90vw] sm:max-w-screen-sm md:max-w-4xl mx-auto px-4 sm:px-6 text-center text-white py-8 sm:py-12 animate-fade-in-up">
        {/* Main Headline - Bold and Simple */}
        <h1
          className="font-bold leading-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-roboto mb-6 sm:mb-8 animate-fade-in-up"
          style={{ animationDelay: "100ms" }}
        >
          {CONTENT.hero.title}
        </h1>

        {/* Search Bar - Hero Focus with lazy-loaded autocomplete */}
        <div
          className="mb-4 sm:mb-6 animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <div className="relative max-w-2xl mx-auto">
            <HeroSearchLazy
              onFallback={navigateToMap}
              onQueryChange={setSearchQuery}
              onSelect={handleBeachSelect}
            />
          </div>
        </div>

        {/* Explore Nearby Link */}
        <div
          className="text-center animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
          <Button
            variant="link"
            asChild
            className="text-white underline underline-offset-4 hover:text-white/90 text-base sm:text-lg p-0 h-auto font-normal"
          >
            <Link href="/map" onClick={handleExploreClick}>
              Explore nearby spots
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
