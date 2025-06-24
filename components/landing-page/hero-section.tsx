"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HERO_VIDEOS, CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

export function HeroSection() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Set loading state when video changes
    setIsVideoLoading(true);
    setVideoError(false);

    const handleLoadStart = () => {
      setIsVideoLoading(true);
    };

    const handleCanPlay = () => {
      setIsVideoLoading(false);
      setVideoError(false);
      // Auto-play the video
      videoElement.play().catch(console.error);
    };

    const handleVideoError = () => {
      setVideoError(true);
      setIsVideoLoading(false);
    };

    const handleVideoEnd = () => {
      setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % HERO_VIDEOS.length);
    };

    // Add event listeners
    videoElement.addEventListener("loadstart", handleLoadStart);
    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("error", handleVideoError);
    videoElement.addEventListener("ended", handleVideoEnd);

    // Load the video
    videoElement.load();

    // Cleanup function
    return () => {
      videoElement.removeEventListener("loadstart", handleLoadStart);
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("error", handleVideoError);
      videoElement.removeEventListener("ended", handleVideoEnd);
    };
  }, [currentVideoIndex]); // Re-run when video index changes

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 w-full h-full">
        {/* Fallback background image */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center bg-[url('/placeholder.jpg')]"
          style={{ zIndex: videoError || isVideoLoading ? 10 : 1 }}
        />

        {/* Loading state */}
        {isVideoLoading && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          </div>
        )}

        {/* Video element */}
        {!videoError && (
          <video
            ref={videoRef}
            key={currentVideoIndex}
            muted
            playsInline
            className="w-full h-full object-cover"
            poster="/placeholder.jpg"
            style={{ zIndex: isVideoLoading ? 1 : 10 }}
          >
            <source src={HERO_VIDEOS[currentVideoIndex]} type="video/mp4" />
          </video>
        )}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 z-5" />

      {/* Hero Content */}
      <motion.div
        {...ANIMATION_VARIANTS.heroText(0.1)}
        className="relative z-30 text-center text-white px-4 max-w-4xl mx-auto"
      >
        <motion.h1
          {...ANIMATION_VARIANTS.heroText(0.2)}
          className="text-5xl md:text-7xl font-roboto font-bold mb-6 leading-tight"
        >
          {CONTENT.hero.title.map((line, index) => (
            <span key={index}>
              {line}
              {index < CONTENT.hero.title.length - 1 && <br />}
            </span>
          ))}
        </motion.h1>

        <motion.p
          {...ANIMATION_VARIANTS.heroText(0.3)}
          className="text-xl md:text-2xl font-open-sans mb-8 text-white/90"
        >
          {CONTENT.hero.subtitle}
        </motion.p>

        <motion.div {...ANIMATION_VARIANTS.heroText(0.4)}>
          <Button
            size="lg"
            className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            asChild
          >
            <Link href="/auth/sign-up">
              {CONTENT.hero.cta}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
