"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import { HeroCarousel } from "./hero-carousel";

export function HeroSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const navigateToMap = (query?: string) => {
    const url = query
      ? `/map?search=${encodeURIComponent(query)}`
      : "/map";
    router.push(url);
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
  };

  const performSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      navigateToMap();
      return;
    }

    try {
      const response = await fetch(
        `/api/beaches/search?query=${encodeURIComponent(trimmed)}`
      );

      if (response.ok) {
        const beaches = await response.json();

        if (Array.isArray(beaches) && beaches.length > 0) {
          const beach = beaches[0];
          if (beach?.id) {
            router.push(`/beach/${beach.id}`);
            return;
          }
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    }

    navigateToMap(trimmed);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    await performSearch(searchQuery);
  };

  const handleExploreClick = async (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    if (!searchQuery.trim()) {
      return;
    }
    event.preventDefault();
    await performSearch(searchQuery);
  };

  return (
    <section className="relative min-h-[75svh] flex items-center justify-center overflow-clip md:overflow-visible pt-16">
      {/* Hero Carousel Background */}
      <HeroCarousel />

      {/* Enhanced Overlay with Gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60 z-20" />

      {/* Hero Content - Search-Centric */}
      <motion.div
        {...ANIMATION_VARIANTS.heroText(0.1)}
        className="relative z-30 w-full max-w-[90vw] sm:max-w-screen-sm md:max-w-4xl mx-auto px-4 sm:px-6 text-center text-white py-8 sm:py-12"
      >
        {/* Main Headline - Bold and Simple */}
        <motion.h1
          {...ANIMATION_VARIANTS.heroText(0.2)}
          className="font-bold leading-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-roboto mb-6 sm:mb-8"
        >
          {CONTENT.hero.title}
        </motion.h1>

        {/* Search Bar - Hero Focus */}
        <motion.form
          {...ANIMATION_VARIANTS.heroText(0.3)}
          onSubmit={handleSearch}
          className="mb-4 sm:mb-6"
        >
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by beach, spot, or region"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 text-lg bg-white text-dark-grey rounded-full shadow-lg border-0 focus:ring-2 focus:ring-ocean-blue placeholder:text-gray-400"
            />
          </div>
        </motion.form>

        {/* Explore Nearby Link */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.4)}
          className="text-center"
        >
          <Button
            variant="link"
            asChild
            className="text-white underline underline-offset-4 hover:text-white/90 text-base sm:text-lg p-0 h-auto font-normal"
          >
            <a href="/map" onClick={handleExploreClick}>
              Explore nearby spots
            </a>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
