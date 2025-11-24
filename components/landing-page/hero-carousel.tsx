"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";

const OCEAN_BLUE = "#0077B6";

const DEFAULT_SLIDES: HeroCarouselImage[] = [
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

const FOCAL_TO_POSITION: Record<
  HeroCarouselImage["focal"],
  CSSProperties["objectPosition"]
> = {
  left: "center left",
  center: "center",
  right: "center right",
};

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
  const slides = useMemo<HeroCarouselImage[]>(
    () => (images && images.length > 0 ? images : DEFAULT_SLIDES),
    [images]
  );

  const [index, setIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [loaded, setLoaded] = useState<boolean[]>(() =>
    slides.map((_, slideIndex) => slideIndex === 0)
  );

  // Reset state whenever the slide data changes
  useEffect(() => {
    setIndex(0);
    setDisplayIndex(0);
    setLoaded(slides.map((_, slideIndex) => slideIndex === 0));
  }, [slides]);

  // Continuous autoplay - non-interactive
  useEffect(() => {
    if (slides.length <= 1) return;

    const id = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, intervalMs);

    return () => clearInterval(id);
  }, [slides.length, intervalMs]);

  // Advance the visible slide only after the target slide has loaded
  useEffect(() => {
    if (loaded[index]) {
      setDisplayIndex(index);
    }
  }, [index, loaded]);

  const handleLoad = useCallback((loadedIndex: number) => {
    setLoaded((prev) => {
      if (prev[loadedIndex]) return prev;
      const next = [...prev];
      next[loadedIndex] = true;
      return next;
    });
  }, []);

  const activeSlide = slides[displayIndex];

  return (
    <div
      className={`absolute inset-0 w-full h-full overflow-hidden z-10 ${className}`}
      aria-roledescription="carousel"
      aria-live="off"
    >
      {/* Slides */}
      {slides.map((slide, slideIndex) => {
        const objectPosition = FOCAL_TO_POSITION[slide.focal];
        const isFirstSlide = slideIndex === 0;
        const isActive = slideIndex === displayIndex;
        return (
          <div
            key={`${slide.src}-${slideIndex}`}
            className={`absolute inset-0 h-full w-full pointer-events-none transition-opacity duration-[900ms] ease-out ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={isFirstSlide}
              loading={isFirstSlide ? undefined : "lazy"}
              quality={85}
              className={`object-cover transition-opacity duration-700 ${
                loaded[slideIndex] ? "opacity-100" : "opacity-0"
              }`}
              style={{ objectPosition, backgroundColor: "#000" }}
              sizes="100vw"
              onLoadingComplete={() => handleLoad(slideIndex)}
            />
          </div>
        );
      })}

      {/* Optional gradient overlay for text legibility */}
      {overlay && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 z-[5]" />
      )}

      {/* Blue edge line (per-slide position) */}
      <div
        aria-hidden
        className={[
          "absolute z-[6]",
          activeSlide.edge === "left" && "left-0 top-0 h-full w-[6px]",
          activeSlide.edge === "right" && "right-0 top-0 h-full w-[6px]",
          activeSlide.edge === "top" && "top-0 left-0 w-full h-[6px]",
          activeSlide.edge === "bottom" && "bottom-0 left-0 w-full h-[6px]",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ backgroundColor: OCEAN_BLUE }}
      />
    </div>
  );
}
