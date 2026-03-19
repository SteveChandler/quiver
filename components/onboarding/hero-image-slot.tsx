"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface HeroImageSlotProps {
  className?: string;
}

export function HeroImageSlot({ className }: HeroImageSlotProps) {
  const reducedMotion = useReducedMotion();
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      {/* Video hero (loops), falls back to static image, then gradient */}
      {!videoError && !reducedMotion ? (
        <video
          ref={videoRef}
          src="/videos/onboarding-hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover object-center"
          onError={() => setVideoError(true)}
        />
      ) : !videoError ? (
        <Image
          src="/images/onboarding-hero.png"
          alt="Surfer riding the Great Wave"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-cover object-center"
          onError={() => setVideoError(true)}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #1A3A5C 0%, #2C4A5E 40%, #3A5A6E 70%, #1A3A5C 100%)",
          }}
        />
      )}

      {/* Bottom gradient fade into body */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, #2C4A5E 100%)",
        }}
      />
    </div>
  );
}
