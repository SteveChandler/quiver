"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { beachNavigation } from "@/lib/navigation-utils";
import { cn } from "@/lib/utils";
import type { Beach } from "@/types/database";

interface MapEntryOverlayProps {
  onDismiss: () => void;
}

const DESKTOP_MIN_WIDTH = 768;
const SOURCE = "map-entry-overlay";

/**
 * Search-first entry overlay for /map.
 *
 * Real users arrive with a specific spot in mind, not to wander. This overlay
 * surfaces a hoisted BeachSearchAutocomplete above the Mapbox view; "Or browse
 * the map" dismisses it for the rare wanderer. Session-scoped — does not
 * persist beyond the current visit.
 */
export function MapEntryOverlay({ onDismiss }: MapEntryOverlayProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [autoFocus, setAutoFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Autofocus only on desktop — on mobile this pops the keyboard immediately,
  // which is bad UX.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia(
      `(min-width: ${DESKTOP_MIN_WIDTH}px)`
    ).matches;
    setAutoFocus(isDesktop);
  }, []);

  // Programmatically focus the autocomplete input on desktop after mount.
  // BeachSearchAutocomplete doesn't expose an autoFocus prop, so we query the
  // rendered input from our scoped container.
  useEffect(() => {
    if (!autoFocus) return;
    const input = containerRef.current?.querySelector<HTMLInputElement>(
      "input[type='search'], input[cmdk-input], input"
    );
    if (input) {
      input.focus();
      inputRef.current = input;
    }
  }, [autoFocus]);

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      // Conversion path: route to beach detail. The autocomplete fires
      // beach_search_result_click before this runs.
      beachNavigation.navigateToBeach(router, beach);
    },
    [router]
  );

  const handleBrowseMap = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const transitionClass = reducedMotion
    ? ""
    : "transition-opacity duration-200 ease-out";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-start justify-center",
        "px-4 pt-[calc(64px+1.5rem)] sm:pt-[calc(64px+3rem)] pb-6",
        "overflow-y-auto",
        "bg-[#252D6B]/85 backdrop-blur-md",
        transitionClass
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-entry-overlay-headline"
      data-testid="map-entry-overlay"
    >
      <div
        ref={containerRef}
        className={cn(
          "w-full max-w-xl",
          "rounded-2xl border border-white/10",
          "bg-[#1B2253]/95 shadow-2xl",
          "p-6 sm:p-8",
          transitionClass
        )}
      >
        <div className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#F78E42] font-mono">
            Quiver / Map
          </p>
          <h2
            id="map-entry-overlay-headline"
            className="font-heading text-3xl sm:text-4xl font-bold text-white leading-tight"
          >
            Pick your home break.
          </h2>
          <p className="text-sm sm:text-base text-white/75 leading-relaxed">
            Search for the spot you check most. Forecasts dial in from there.
          </p>
        </div>

        <BeachSearchAutocomplete
          onSelect={handleBeachSelect}
          placeholder="Search surf spots..."
          source={SOURCE}
          showCurrentConditions={false}
          className="w-full"
        />

        <div className="mt-6 flex items-center justify-center">
          <button
            type="button"
            onClick={handleBrowseMap}
            className={cn(
              "text-sm text-white/70 hover:text-white",
              "underline-offset-4 hover:underline",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-[#F78E42] focus-visible:ring-offset-2",
              "focus-visible:ring-offset-[#1B2253]",
              "rounded px-1 py-1",
              transitionClass
            )}
            data-testid="map-entry-overlay-browse"
          >
            Or browse the map →
          </button>
        </div>
      </div>
    </div>
  );
}
