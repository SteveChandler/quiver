"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const OCEAN_BLUE = "#0077B6";

export type HeroCarouselImage = {
  src: string;
  alt: string;
  focal: "left" | "center" | "right";
  edge: "left" | "right" | "top" | "bottom";
};

export type HeroCarouselProps = {
  images?: HeroCarouselImage[];
  intervalMs?: number;
  className?: string;
  overlay?: boolean;
};

export function HeroCarousel({
  images,
  intervalMs = 6000,
  className = "",
  overlay = true,
}: HeroCarouselProps) {
  const slides: HeroCarouselImage[] = images ?? [
    {
      src: "/3sunset.jpg",
      alt: "Surfers walking at golden hour",
      focal: "left",
      edge: "right",
    },
    {
      src: "/4groms.jpg",
      alt: "Group of surfers at the beach",
      focal: "center",
      edge: "right",
    },
    {
      src: "/oneChic.jpg",
      alt: "Surfer walking to the beach with surfboard",
      focal: "left",
      edge: "right",
    },
    {
      src: "/sunsetBeach.jpg",
      alt: "Lone surfer at sunset",
      focal: "right",
      edge: "right",
    },
  ];

  const [index, setIndex] = useState(0);

  // Continuous autoplay - non-interactive
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [slides.length, intervalMs]);

  const current = slides[index];

  const objectPosition = {
    left: "center left",
    center: "center",
    right: "center right",
  }[current.focal] as React.CSSProperties["objectPosition"];

  return (
    <div
      className={`absolute inset-0 w-full h-full overflow-hidden z-10 ${className}`}
      aria-roledescription="carousel"
      aria-live="off"
    >
      {/* Slides */}
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={index}
          className="absolute inset-0 h-full w-full"
          initial={{ opacity: 1, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 1, scale: 1.02 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <Image
            src={current.src}
            alt={current.alt}
            fill
            priority={index === 0}
            quality={85}
            className="object-cover"
            style={{ objectPosition }}
            sizes="100vw"
          />
        </motion.div>
      </AnimatePresence>

      {/* Optional gradient overlay for text legibility */}
      {overlay && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 z-[5]" />
      )}

      {/* Blue edge line (per-slide position) */}
      <div
        aria-hidden
        className={[
          "absolute z-[6]",
          current.edge === "left" && "left-0 top-0 h-full w-[6px]",
          current.edge === "right" && "right-0 top-0 h-full w-[6px]",
          current.edge === "top" && "top-0 left-0 w-full h-[6px]",
          current.edge === "bottom" && "bottom-0 left-0 w-full h-[6px]",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ backgroundColor: OCEAN_BLUE }}
      />
    </div>
  );
}
