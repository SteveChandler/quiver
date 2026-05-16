"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const VIDEO_SRC =
  "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/media/videos/hero-golden-hour.mp4";
const POSTER_SRC = "/images/hero/hero-golden-hour-poster.webp";

const HERO_IMAGES = [
  {
    src: "/images/hero/hero-5-aerial-ocean.webp",
    alt: "Aerial view of turquoise ocean waves",
  },
  {
    src: "/images/hero/hero-4-beach-sunset.webp",
    alt: "California beach sunset with golden sky",
  },
  {
    src: "/images/hero/hero-3-windansea.webp",
    alt: "Windansea Beach surf shack at golden hour",
  },
  {
    src: "/images/hero/hero-2-barrel-wave.webp",
    alt: "Surfer riding inside a turquoise barrel wave",
  },
];

const KEN_BURNS_CLASSES = [
  "animate-ken-burns-zoom-in motion-reduce:animate-none",
  "animate-ken-burns-zoom-out motion-reduce:animate-none",
  "animate-ken-burns-slow-pan motion-reduce:animate-none",
];

const IMAGE_DURATION = 8000;

export function HeroVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState<"video" | "images">("video");
  const [imageIndex, setImageIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const reducedMotion = useReducedMotion();

  const clearImageInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startImageInterval = useCallback(() => {
    clearImageInterval();
    intervalRef.current = setInterval(() => {
      setImageIndex((prev) => {
        if (prev >= HERO_IMAGES.length - 1) {
          // Clear interval synchronously to prevent extra tick before re-render
          clearImageInterval();
          setPhase("video");
          return 0;
        }
        return prev + 1;
      });
    }, IMAGE_DURATION);
  }, [clearImageInterval]);

  // When phase changes to video, replay video
  useEffect(() => {
    if (phase === "video") {
      clearImageInterval();
      const video = videoRef.current;
      if (video && !reducedMotion) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    } else {
      startImageInterval();
    }

    return clearImageInterval;
  }, [phase, clearImageInterval, startImageInterval, reducedMotion]);

  // Handle video ended → switch to images
  const handleVideoEnded = useCallback(() => {
    setImageIndex(0);
    setPhase("images");
  }, []);

  // Pause/resume on tab visibility
  useEffect(() => {
    function handleVisibilityChange() {
      const video = videoRef.current;
      if (document.hidden) {
        video?.pause();
        clearImageInterval();
      } else if (!reducedMotion) {
        if (phase === "video" && video) {
          video.play().catch(() => {});
        } else if (phase === "images") {
          startImageInterval();
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [phase, reducedMotion, clearImageInterval, startImageInterval]);

  // Pause video when user prefers reduced motion
  useEffect(() => {
    if (reducedMotion) {
      videoRef.current?.pause();
      clearImageInterval();
    }
  }, [reducedMotion, clearImageInterval]);

  // If video errors, skip directly to images
  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setImageIndex(0);
    setPhase("images");
  }, []);

  if (reducedMotion) {
    return (
      <div className="absolute inset-0 z-0">
        <Image
          src={POSTER_SRC}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#111635]/45" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Video layer — purely decorative background loop, no informational content */}
      {!videoError && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="metadata"
          poster={POSTER_SRC}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          role="presentation"
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms] ${
            phase === "video" ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      )}

      {/* Image layers */}
      {HERO_IMAGES.map((image, idx) => {
        const isActive = phase === "images" && imageIndex === idx;
        return (
          <div
            key={image.src}
            className={`absolute inset-0 transition-opacity duration-[1500ms] ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!isActive}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="100vw"
              priority={idx === 0}
              className={`object-cover ${
                isActive ? KEN_BURNS_CLASSES[idx % KEN_BURNS_CLASSES.length] : ""
              }`}
            />
          </div>
        );
      })}

      {/* Overlay */}
      <div className="absolute inset-0 bg-[#111635]/45" />
    </div>
  );
}
