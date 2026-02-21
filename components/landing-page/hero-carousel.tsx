"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
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

  // Prevent hydration mismatches by buffering any "image loaded" updates that
  // might fire before the first client effect has run.
  const hasHydratedRef = useRef(false);
  const pendingLoadedIndicesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    hasHydratedRef.current = true;

    if (pendingLoadedIndicesRef.current.size === 0) return;

    const indices = Array.from(pendingLoadedIndicesRef.current);
    pendingLoadedIndicesRef.current.clear();

    setLoaded((prev) => {
      const next = [...prev];
      for (const i of indices) next[i] = true;
      return next;
    });
  }, []);

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
    if (!hasHydratedRef.current) {
      pendingLoadedIndicesRef.current.add(loadedIndex);
      return;
    }

    setLoaded((prev) => {
      if (prev[loadedIndex]) return prev;
      const next = [...prev];
      next[loadedIndex] = true;
      return next;
    });
  }, []);

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
              onLoad={() => handleLoad(slideIndex)}
            />
          </div>
        );
      })}

      {/* Neutral gradient overlay for text legibility - AllTrails style */}
      {overlay && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/50 z-[5]" />
      )}

      {/* Ocean-blue brand arc shapes - AllTrails swoosh style */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-20 w-[400px] h-[400px] z-[6] opacity-30 hidden md:block"
        viewBox="0 0 400 400"
        fill="none"
      >
        <path
          d="M400 0C400 220.914 220.914 400 0 400"
          stroke={OCEAN_BLUE}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M400 60C400 247.777 247.777 400 60 400"
          stroke={OCEAN_BLUE}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-16 w-[300px] h-[300px] z-[6] opacity-25 hidden md:block"
        viewBox="0 0 300 300"
        fill="none"
      >
        <path
          d="M0 300C0 134.315 134.315 0 300 0"
          stroke={OCEAN_BLUE}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M0 240C0 107.452 107.452 0 240 0"
          stroke={OCEAN_BLUE}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}
