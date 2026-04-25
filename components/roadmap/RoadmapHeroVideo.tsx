"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const DIORAMA_VIDEOS = [
  "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/diorama-videos/trestles/medium_overcast.mp4",
  "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/diorama-videos/tourmaline/large_day.mp4",
  "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/diorama-videos/rincon/small_day.mp4",
  "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/diorama-videos/malibu-surfrider/medium_day.mp4",
];

const DISPLAY_DURATION_MS = 7000;
const TOTAL = DIORAMA_VIDEOS.length;

interface Props {
  // Caller (server component) picks a random start index so server and client
  // hydrate with the same value. Picking it inside useState here would call
  // Math.random() twice and produce a hydration mismatch.
  startIndex?: number;
}

export function RoadmapHeroVideo({ startIndex = 0 }: Props) {
  const reducedMotion = useReducedMotion();

  // activeIndex: the video currently shown at full opacity.
  // nextIndex: the video being preloaded (shown at opacity-0, will become active).
  const [activeIndex, setActiveIndex] = useState<number>(startIndex);
  const [nextIndex, setNextIndex] = useState<number>((startIndex + 1) % TOTAL);

  // Track which indices have errored so we skip them.
  const erroredRef = useRef<Set<number>>(new Set());

  // Timer ref for the 7s rotation interval.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After activeIndex changes, schedule the next transition.
  useEffect(() => {
    if (reducedMotion) return;

    timerRef.current = setTimeout(() => {
      // Find the next non-errored index after nextIndex.
      let candidate = (nextIndex + 1) % TOTAL;
      // Walk forward (up to TOTAL steps) to skip errored indices.
      for (let i = 0; i < TOTAL; i++) {
        if (!erroredRef.current.has(candidate)) break;
        candidate = (candidate + 1) % TOTAL;
      }
      // Swap: next becomes active, candidate becomes preloading next.
      setActiveIndex(nextIndex);
      setNextIndex(candidate);
    }, DISPLAY_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Intentionally exclude nextIndex from deps so the effect re-fires only
    // when activeIndex changes, not when we update nextIndex mid-cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, reducedMotion]);

  const handleError = (index: number) => {
    erroredRef.current.add(index);
  };

  // Reduced-motion: single static video, no rotation, no crossfade.
  if (reducedMotion) {
    return (
      <video
        src={DIORAMA_VIDEOS[startIndex]}
        className="absolute inset-0 h-full w-full object-cover opacity-100"
        autoPlay
        muted
        playsInline
        loop
        preload="metadata"
        role="presentation"
        aria-hidden="true"
        onError={() => handleError(startIndex)}
      />
    );
  }

  // Two stacked videos: one active (opacity-100), one preloading (opacity-0).
  // They share the absolute inset-0 so they overlap perfectly.
  // CSS transition-opacity handles the 600ms ease-out crossfade.
  return (
    <>
      {/* Active video — full opacity */}
      <video
        key={`active-${activeIndex}`}
        src={DIORAMA_VIDEOS[activeIndex]}
        className="absolute inset-0 h-full w-full object-cover opacity-100 transition-opacity duration-[600ms] ease-out"
        autoPlay
        muted
        playsInline
        loop
        preload="metadata"
        role="presentation"
        aria-hidden="true"
        onError={() => handleError(activeIndex)}
      />
      {/* Next video — preloading at opacity-0, fades in on next swap */}
      <video
        key={`next-${nextIndex}`}
        src={DIORAMA_VIDEOS[nextIndex]}
        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-[600ms] ease-out"
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        role="presentation"
        aria-hidden="true"
        onError={() => handleError(nextIndex)}
      />
    </>
  );
}
