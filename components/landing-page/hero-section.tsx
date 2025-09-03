"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Users,
  TrendingUp,
  MapPin,
  Waves,
  Eye,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { HERO_VIDEOS, CONTENT } from "@/lib/constants/features";
import { ANIMATION_VARIANTS } from "@/lib/constants/animations";
import { InteractiveHeroDemo } from "./interactive-hero-demo";

export function HeroSection() {
  const [showVideo, setShowVideo] = useState(false); // Start with video disabled for fast LCP
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
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

    window.addEventListener('scroll', handleUserInteraction, { once: true });
    window.addEventListener('click', handleUserInteraction, { once: true });
    window.addEventListener('touchstart', handleUserInteraction, { once: true });

    return () => {
      window.removeEventListener('scroll', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
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

  return (
    <section className="relative min-h-[85svh] flex items-center justify-center overflow-clip md:overflow-visible">
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
            <track 
              kind="captions" 
              src="/captions/hero-video-captions.vtt" 
              srcLang="en" 
              label="English captions"
              default
            />
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

      {/* Hero Content - Modernized */}
      <motion.div
        {...ANIMATION_VARIANTS.heroText(0.1)}
        className="relative z-30 w-full max-w-[90vw] sm:max-w-screen-sm md:max-w-3xl mx-auto px-4 sm:px-6 text-center text-white py-8 sm:py-12"
      >
        {/* Social Proof Badge */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.15)}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 sm:px-4 sm:py-2 mb-4 sm:mb-6 text-xs sm:text-sm font-medium"
        >
          <Users className="h-4 w-4" />
          <span>Join surfers near you</span>
        </motion.div>

        {/* Main Headline - More Impactful */}
        <motion.h1
          {...ANIMATION_VARIANTS.heroText(0.2)}
          className="font-bold leading-tight [text-wrap:balance] text-2xl sm:text-4xl md:text-5xl font-roboto mb-4 sm:mb-6 break-words"
        >
          {CONTENT.hero.title.map((line, index) => (
            <span key={index} className="block">
              {line}
              {index === 1 && <br className="hidden md:block" />}
            </span>
          ))}
        </motion.h1>

        {/* Enhanced Subtitle */}
        <motion.p
          {...ANIMATION_VARIANTS.heroText(0.3)}
          className="text-sm sm:text-base md:text-lg text-pretty break-words hyphens-auto leading-relaxed font-open-sans mb-6 sm:mb-8 text-white/90 px-2 sm:px-4"
        >
          {CONTENT.hero.subtitle}
        </motion.p>

        {/* 🚨 EMERGENCY INTERACTIVE DEMO - Fix 74% bounce rate */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mb-6 sm:mb-8 lg:mb-10"
        >
          <InteractiveHeroDemo />
        </motion.div>

        {/* Key Benefits Grid */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.6)}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 lg:mb-10 max-w-3xl mx-auto px-2 sm:px-0"
        >
          {CONTENT.hero.benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-3 text-xs sm:text-sm font-medium"
            >
              {benefit}
            </div>
          ))}
        </motion.div>

        {/* Enhanced CTA Section */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.8)}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          {/* Primary CTA */}
          <Button
            size="lg"
            className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 w-full sm:w-auto"
            asChild
          >
            <Link href="/auth/sign-up">
              {CONTENT.hero.cta}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          {/* Secondary CTA */}
          <Button
            size="lg"
            variant="ghost"
            className="bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/50 px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-roboto font-semibold rounded-full backdrop-blur-sm transition-all duration-300 w-full sm:w-auto"
            asChild
          >
            <Link href="/features">
              {CONTENT.hero.secondaryCta}
              <Eye className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>

        {/* Trust Signals */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.9)}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-white/80 text-xs sm:text-sm mt-4 sm:mt-6"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>Free to join • No credit card required</span>
          </div>
          <div className="hidden sm:block text-white/40">•</div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Growing surf community</span>
          </div>
        </motion.div>

        {/* Feature Icons */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(1.1)}
          className="flex justify-center items-center gap-4 sm:gap-6 md:gap-8 mt-8 sm:mt-10 lg:mt-12 text-white/60 flex-wrap"
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Community</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Waves className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Forecasts</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Spots</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Tracking</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
