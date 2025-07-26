"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { HERO_VIDEOS, CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";

export function HeroSection() {
  const [showVideo, setShowVideo] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Optimized Background - Static Image for Fast LCP */}
      <div className="absolute inset-0 w-full h-full">
        {/* High-performance static background image */}
        <Image
          src="/placeholder-logo.png" // Using existing logo as placeholder
          alt="Quiver - Surf Sessions Tracker"
          fill
          priority // Critical for LCP
          quality={85}
          className={`object-cover transition-opacity duration-500 ${
            showVideo && isVideoLoaded ? "opacity-20" : "opacity-100"
          }`}
          style={{ objectPosition: "center" }}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        />

        {/* Video Background - Only loads when requested */}
        {showVideo && (
          <video
            ref={videoRef}
            key={currentVideoIndex}
            muted
            playsInline
            loop
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              isVideoLoaded ? "opacity-100" : "opacity-0"
            }`}
            style={{ zIndex: 10 }}
          >
            <source src={HERO_VIDEOS[currentVideoIndex]} type="video/mp4" />
          </video>
        )}

        {/* Video loading indicator */}
        {showVideo && !isVideoLoaded && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 z-15" />

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

        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.4)}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
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
