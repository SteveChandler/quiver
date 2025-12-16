"use client";

import { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Lazy load the heavy BeachSearchAutocomplete component
// This defers ~300KB (cmdk package) until user interaction
const BeachSearchAutocomplete = lazy(() =>
  import("@/components/beach/beach-search-autocomplete").then((mod) => ({
    default: mod.BeachSearchAutocomplete,
  }))
);

/**
 * Hero Search with Lazy Loading
 *
 * Renders a simple input placeholder immediately, then lazy-loads
 * the full BeachSearchAutocomplete component on:
 * - User focus (click/tap on input)
 * - Idle time (requestIdleCallback)
 * - After initial render (fallback timeout)
 *
 * Performance Benefits:
 * - Reduces initial bundle by ~300KB (cmdk package)
 * - Improves TBT (Total Blocking Time) by -50ms
 * - Faster time to interactive for landing page visitors
 *
 * Architecture:
 * - Simple placeholder input (immediate render, no dependencies)
 * - Lazy loads on idle using requestIdleCallback
 * - Preserves search state when full component loads
 * - Graceful fallback for browsers without requestIdleCallback
 *
 * @example
 * ```tsx
 * <HeroSearchLazy onQueryChange={setSearchQuery} onFallback={navigateToMap} />
 * ```
 */
export default function HeroSearchLazy({
  onQueryChange,
  onFallback,
  onSelect,
}: {
  onQueryChange?: (query: string) => void;
  onFallback?: (query: string) => void;
  onSelect?: (beach: import("@/types/database").Beach) => void;
}) {
  const [showFullSearch, setShowFullSearch] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();

  // Detect test environment using multiple methods for reliability
  const isTest = useMemo(() => {
    return (
      (typeof process !== "undefined" &&
        (process.env.NODE_ENV === "test" ||
          process.env.PLAYWRIGHT_TEST === "true")) ||
      (typeof window !== "undefined" &&
        (window.navigator.webdriver ||
          (window as any).Cypress ||
          typeof (globalThis as any).__PLAYWRIGHT__ !== "undefined"))
    );
  }, []);

  // Lazy load on idle time (after critical paint)
  // This ensures fast initial load while pre-loading search for users who need it
  useEffect(() => {
    if (isTest) {
      // In tests, load immediately to avoid waiting
      setShowFullSearch(true);
      return;
    }

    if (typeof window === "undefined") return;

    // Use requestIdleCallback for optimal performance
    // Loads when browser is idle, not blocking critical rendering
    if (typeof requestIdleCallback !== "undefined") {
      const handle = requestIdleCallback(
        () => {
          setShowFullSearch(true);
        },
        { timeout: 2000 } // Fallback timeout if browser never idle
      );

      return () => cancelIdleCallback(handle);
    } else {
      // Fallback for browsers without requestIdleCallback (Safari < 15)
      const timeout = setTimeout(() => {
        setShowFullSearch(true);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [isTest]);

  // Handle placeholder input changes
  const handlePlaceholderChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setSearchValue(value);
    onQueryChange?.(value);
  };

  // Load full search immediately when user focuses
  const handlePlaceholderFocus = () => {
    setShowFullSearch(true);
  };

  // Handle Enter key in placeholder
  const handlePlaceholderKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter" && onFallback && searchValue.trim()) {
      event.preventDefault();
      onFallback(searchValue.trim());
    }
  };

  /**
   * Simple Placeholder Component
   *
   * Lightweight input that renders immediately with no dependencies.
   * Provides instant interaction while full search component loads.
   * AllTrails style: left-aligned search icon, generous height.
   */
  const SearchPlaceholder = () => (
    <div className="relative w-full">
      {/* Search icon - left side */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        placeholder="Search by beach, spot, or region"
        className="w-full h-14 md:h-16 pl-12 pr-6 text-lg bg-white/95 text-dark-grey rounded-full
                   shadow-lg border-0 focus:outline-none focus:ring-2 focus:ring-ocean-blue
                   placeholder:text-slate-500 transition-all duration-200"
        value={searchValue}
        onChange={handlePlaceholderChange}
        onFocus={handlePlaceholderFocus}
        onKeyDown={handlePlaceholderKeyDown}
        aria-label="Search for beaches"
        data-testid="hero-search-input"
      />
    </div>
  );

  /**
   * Loading Fallback
   *
   * Shows while full search component is being loaded.
   * Maintains UX continuity with spinner indicator on left.
   */
  const LoadingFallback = () => (
    <div className="relative w-full">
      {/* Loading spinner - left side */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" aria-label="Loading search" />
      </div>
      <input
        type="text"
        placeholder="Search by beach, spot, or region"
        className="w-full h-14 md:h-16 pl-12 pr-6 text-lg bg-white/95 text-dark-grey rounded-full
                   shadow-lg border-0 focus:outline-none focus:ring-2 focus:ring-ocean-blue
                   placeholder:text-slate-500 transition-all duration-200"
        value={searchValue}
        disabled
        aria-label="Search loading"
      />
    </div>
  );

  // Render full search component if loaded, otherwise placeholder
  if (!showFullSearch) {
    return <SearchPlaceholder />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <BeachSearchAutocomplete
        initialValue={searchValue}
        placeholder="Search by beach, spot, or region"
        className="w-full h-14 md:h-16 pl-12 pr-6 text-lg bg-white/95 text-dark-grey rounded-full shadow-lg border-0 [&_[cmdk-input-wrapper]]:border-0 focus-within:ring-2 focus-within:ring-ocean-blue overflow-hidden placeholder:text-slate-500"
        maxResults={8}
        requireExplicitSelection
        onFallback={onFallback}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
      />
    </Suspense>
  );
}
