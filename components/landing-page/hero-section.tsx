"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CONTENT } from "@/lib/constants/features";
import { HeroCarousel } from "./hero-carousel";
import HeroSearchLazy from "@/components/landing-page/hero-search-lazy";
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
    <section className="relative min-h-[75svh] flex items-center justify-center overflow-clip md:overflow-visible pt-20">
      {/* Hero Carousel Background - includes gradient overlay */}
      <HeroCarousel />

      {/* Hero Content - Search-Centric, true vertical center */}
      <div className="relative z-30 w-full max-w-3xl mx-auto px-6 text-center text-white flex flex-col items-center gap-6">
        {/* Main Headline - AllTrails style: lighter weight, tighter tracking */}
        <h1
          className="font-semibold leading-tight tracking-tight text-5xl md:text-6xl font-roboto animate-fade-in-up [text-shadow:_0_2px_8px_rgb(0_0_0_/_30%)] text-balance"
          style={{ animationDelay: "100ms" }}
        >
          {CONTENT.hero.title}
        </h1>

        {/* Supporting Subhead */}
        {CONTENT.hero.subtitle ? (
          <p
            className="text-lg md:text-xl text-white/90 max-w-2xl font-open-sans leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "150ms" }}
          >
            {CONTENT.hero.subtitle}
          </p>
        ) : null}

        {/* Search Bar - Hero Focus with lazy-loaded autocomplete */}
        <div
          className="w-full animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <HeroSearchLazy
            onFallback={navigateToMap}
            onQueryChange={setSearchQuery}
            onSelect={handleBeachSelect}
          />
        </div>

        {/* Explore Nearby Link - Simple underlined text link */}
        <Link
          href="/map"
          onClick={handleExploreClick}
          className="text-white/90 underline underline-offset-4 hover:text-white transition-colors text-base sm:text-lg animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
          Explore nearby spots
        </Link>
      </div>
    </section>
  );
}
