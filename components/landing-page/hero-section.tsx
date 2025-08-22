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
          alt="Quiver - Ultimate Surf Community Platform"
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

      {/* Enhanced Overlay with Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60 z-15" />

      {/* Hero Content - Modernized */}
      <motion.div
        {...ANIMATION_VARIANTS.heroText(0.1)}
        className="relative z-30 text-center text-white px-4 max-w-5xl mx-auto"
      >
        {/* Social Proof Badge */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.15)}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 text-sm font-medium"
        >
          <Users className="h-4 w-4" />
          <span>Join surfers near you</span>
        </motion.div>

        {/* Main Headline - More Impactful */}
        <motion.h1
          {...ANIMATION_VARIANTS.heroText(0.2)}
          className="text-5xl md:text-7xl lg:text-8xl font-roboto font-bold mb-6 leading-tight"
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
          className="text-xl md:text-2xl lg:text-3xl font-open-sans mb-8 text-white/90 max-w-3xl mx-auto leading-relaxed"
        >
          {CONTENT.hero.subtitle}
        </motion.p>

        {/* 🚨 EMERGENCY INTERACTIVE DEMO - Fix 74% bounce rate */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mb-10"
        >
          <InteractiveHeroDemo />
        </motion.div>

        {/* Key Benefits Grid */}
        <motion.div
          {...ANIMATION_VARIANTS.heroText(0.6)}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 max-w-3xl mx-auto"
        >
          {CONTENT.hero.benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-sm font-medium"
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
            className="bg-ocean-blue hover:bg-ocean-blue/90 text-white px-8 py-4 text-lg font-roboto font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
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
            className="bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/50 px-8 py-4 text-lg font-roboto font-semibold rounded-full backdrop-blur-sm transition-all duration-300"
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
          className="flex flex-col sm:flex-row items-center justify-center gap-4 text-white/80 text-sm"
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
          className="flex justify-center items-center gap-8 mt-12 text-white/60"
        >
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="text-sm">Community</span>
          </div>
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5" />
            <span className="text-sm">Forecasts</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <span className="text-sm">Spots</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm">Tracking</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
