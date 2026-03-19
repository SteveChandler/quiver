"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface HeroImageSlotProps {
  className?: string;
}

export function HeroImageSlot({ className }: HeroImageSlotProps) {
  const reducedMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      {/* Image or gradient fallback */}
      {!imgError ? (
        <Image
          src="/images/onboarding-hero.png"
          alt="Godzilla surfing the Great Wave"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className={cn(
            "object-cover object-center",
            !reducedMotion && "animate-formgrid-ken-burns"
          )}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0",
            !reducedMotion && "animate-formgrid-ken-burns"
          )}
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
