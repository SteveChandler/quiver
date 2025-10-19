"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Waves, Navigation } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HERO_VIDEOS, CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

export function HeroSection() {
  const [showVideo, setShowVideo] = useState(false); // Start with video disabled for fast LCP
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  // Lazy load video after page is interactive to avoid blocking LCP
  useEffect(() => {
    const loadVideoAfterInteractive = () => {
      // Only load video after user has interacted or after a delay
      const timer = setTimeout(() => {
        if (!hasUserInteracted) {
          setShowVideo(true);
        }
      }, 3000); // Load video after 3 seconds if no interaction

      return () => clearTimeout(timer);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleCallbackId = requestIdleCallback(() => {
        loadVideoAfterInteractive();
      });
      return () => cancelIdleCallback(idleCallbackId);
    } else {
      return loadVideoAfterInteractive();
    }
  }, [hasUserInteracted]);

  // Handle user interaction to load video
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
        setShowVideo(true);
      }
    };

    window.addEventListener("scroll", handleUserInteraction, { once: true });
    window.addEventListener("click", handleUserInteraction, { once: true });
    window.addEventListener("touchstart", handleUserInteraction, {
      once: true,
    });

    return () => {
      window.removeEventListener("scroll", handleUserInteraction);
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
    };
  }, [hasUserInteracted]);

  useEffect(() => {
    if (!showVideo) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleCanPlay = () => {
      setIsVideoLoaded(true);
      setVideoError(false);
      videoElement.play().catch(console.error);
    };

    const handleVideoError = () => {
      setVideoError(true);
      setIsVideoLoaded(false);
    };

    const handleVideoEnd = () => {
      const nextIndex = (currentVideoIndex + 1) % HERO_VIDEOS.length;
      setCurrentVideoIndex(nextIndex);
    };

    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("error", handleVideoError);
    videoElement.addEventListener("ended", handleVideoEnd);
    videoElement.load();

    return () => {
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("error", handleVideoError);
      videoElement.removeEventListener("ended", handleVideoEnd);
    };
  }, [showVideo, currentVideoIndex]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      // Search for matching beach
      const response = await fetch(
        `/api/beaches/search?query=${encodeURIComponent(searchQuery.trim())}`
      );

      if (response.ok) {
        const beaches = await response.json();

        // If we found beaches, navigate to the first match using beach ID
        if (beaches && beaches.length > 0) {
          const beach = beaches[0];
          router.push(`/beach/${beach.id}`);
          return;
        }
      }

      // Fallback: if no beach found, go to map with search query
      router.push(`/map?search=${encodeURIComponent(searchQuery.trim())}`);
    } catch (error) {
      console.error("Search error:", error);
      // Fallback to map on error
      router.push(`/map?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleExploreNearby = async () => {
    if (!searchQuery.trim()) {
      router.push("/map");
      return;
    }

    // Search for beach and navigate to it
    try {
      const response = await fetch(
        `/api/beaches/search?query=${encodeURIComponent(searchQuery.trim())}`
      );
      if (response.ok) {
        const beaches = await response.json();
        if (beaches && beaches.length > 0) {
          router.push(`/beach/${beaches[0].id}`);
          return;
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    }

    // Fallback to map with search
    router.push(`/map?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <section className="relative min-h-[75svh] flex items-center justify-center overflow-clip md:overflow-visible">
      {/* Optimized Background with Gradient Fallback */}
      <div className="absolute inset-0 w-full h-full">
        {/* CSS Gradient Fallback - Always visible for fast render */}
        <div className="absolute inset-0 bg-gradient-to-br from-ocean-blue via-blue-600 to-navy-blue" />

        {/* High-performance static background image */}
        <Image
          src="/logoQuiver.png" // Using actual Quiver logo for hero background
          alt="Quiver - Ultimate Surf Community Platform"
          fill
          priority // Critical for LCP
          quality={85}
          className={`object-cover transition-opacity duration-500 ${
            showVideo && isVideoLoaded ? "opacity-20" : "opacity-60"
          }`}
          style={{ objectPosition: "center" }}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        />

        {/* Video Background - Lazy loaded with poster image */}
        {showVideo && (
          <video
            ref={videoRef}
            key={currentVideoIndex}
            muted
            playsInline
            loop
            poster="/logoQuiver.png" // Use poster for faster initial paint
            loading="lazy" // Native lazy loading hint
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              isVideoLoaded ? "opacity-100" : "opacity-0"
            }`}
            style={{ zIndex: 10 }}
            aria-label="Hero background video showcasing surf community"
            preload="none" // Don't preload video to avoid blocking LCP
          >
            <source src={HERO_VIDEOS[currentVideoIndex]} type="video/mp4" />
            {/* TODO: Add video captions for accessibility */}
          </video>
        )}

        {/* Video loading indicator */}
        {showVideo && !isVideoLoaded && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Enhanced Overlay with Gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

      {/* Hero Content - AllTrails-style Search-Centric */}
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
          className="mb-6 sm:mb-8"
        >
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by beach, spot, or region"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 text-lg bg-white text-dark-grey rounded-lg shadow-lg border-0 focus:ring-2 focus:ring-ocean-blue placeholder:text-gray-400"
            />
          </div>
        </motion.form>

        {/* Quick Action Buttons */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.4)}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
        >
          <Button
            size="lg"
            onClick={handleExploreNearby}
            className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-6 py-3 text-base font-roboto font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto"
          >
            <Navigation className="mr-2 h-5 w-5" />
            Explore Nearby
          </Button>
        </motion.div>

        {/* Feature Highlights - Compact */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.5)}
          className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 text-white/90 text-sm sm:text-base"
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <span>Discover Epic Spots</span>
          </div>
          <div className="hidden sm:block text-white/40">•</div>
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5" />
            <span>Live Conditions</span>
          </div>
          <div className="hidden sm:block text-white/40">•</div>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <span>Community Reviews</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
