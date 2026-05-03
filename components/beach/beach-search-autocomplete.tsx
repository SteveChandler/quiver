"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, MapPin, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBeachAutocomplete } from "@/hooks/use-beach-autocomplete";
import { useTrackEvent } from "@/hooks/use-track-event";
import type { Beach } from "@/types/database";
import type {
  BeachSearchMetadata,
  BeachSearchResultClickMetadata,
} from "@/types/implicit-preferences";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import { beachNavigation } from "@/lib/navigation-utils";

interface BeachSearchAutocompleteProps {
  onSelect?: (beach: Beach) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showCurrentConditions?: boolean;
  maxResults?: number;
  /**
   * Initial value for the search input.
   * Used by lazy-loading wrapper to preserve user input across component load.
   */
  initialValue?: string;
  /**
   * Optional callback invoked when the user presses Enter but no beach
   * selection is made or no suggestions are available. This is primarily
   * used by the landing hero to fall back to the map search with the
   * free-typed query.
   */
  onFallback?: (query: string) => void;
  /**
   * @deprecated This prop no longer affects Enter key behavior.
   * The component now always navigates to the highlighted suggestion on Enter.
   * Kept for backwards compatibility but has no effect.
   */
  requireExplicitSelection?: boolean;
  /**
   * Controls whether a single matching result should automatically be
   * selected on Enter. Defaults to true for backwards compatibility.
   */
  autoNavigateSingleResult?: boolean;
  /**
   * Optional listener for query changes so parents (like the landing hero)
   * can mirror the current search string for secondary actions.
   */
  onQueryChange?: (query: string) => void;
  /**
   * Analytics surface identifier for beach_search / beach_search_result_click
   * events (e.g., "home", "landing_hero", "tool_dawn_patrol"). Best-effort —
   * used to distinguish where a search originated.
   */
  source?: string;
}

/**
 * Beach Search Autocomplete Component
 *
 * Provides AllTrails-style autocomplete search with:
 * - Debounced search (300ms)
 * - Beach preview cards with conditions
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click to navigate to beach detail page
 */
export function BeachSearchAutocomplete({
  onSelect,
  placeholder = "Search surf spots...",
  className,
  inputClassName,
  showCurrentConditions = false,
  maxResults = 5,
  initialValue = "",
  onFallback,
  requireExplicitSelection = false,
  autoNavigateSingleResult = true,
  onQueryChange,
  source = "unknown",
}: BeachSearchAutocompleteProps) {
  const router = useRouter();
  const { track } = useTrackEvent();
  const {
    query,
    debouncedQuery,
    suggestions,
    loading,
    error,
    isOpen,
    selectedIndex,
    setQuery,
    handleKeyDown,
    handleSelect,
  } = useBeachAutocomplete({ maxResults, initialQuery: initialValue });

  // Fire beach_search AFTER the debounced fetch resolves (not on every keystroke).
  // We track prev loading state and emit when loading transitions true -> false
  // for any query of minimum length.
  const prevLoadingRef = useRef<boolean>(false);
  const lastEmittedQueryRef = useRef<string>("");
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    if (!wasLoading || loading) return;
    if (debouncedQuery.length < 2) return;
    // Debounce-identical emissions: don't re-fire for the same resolved query
    if (lastEmittedQueryRef.current === debouncedQuery) return;
    lastEmittedQueryRef.current = debouncedQuery;

    const resultCount = suggestions.length;
    const metadata: BeachSearchMetadata = {
      result_count: resultCount,
      query_length: debouncedQuery.length,
      zero_results: resultCount === 0,
      source,
    };
    // Raw query is deliberately NOT included (PII concerns)
    void track("beach_search", { metadata });
  }, [loading, debouncedQuery, suggestions, source, track]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      onQueryChange?.(value);
    },
    [onQueryChange, setQuery]
  );

  const handleBeachSelect = useCallback(
    (beach: Beach, position: number) => {
      // Emit result click BEFORE navigation so the event isn't cancelled by
      // page unload. beach_view fires separately when the user lands on the
      // target beach page — these are distinct events.
      const metadata: BeachSearchResultClickMetadata = {
        beach_id: beach.id,
        position,
        result_count: suggestions.length,
        query_length: debouncedQuery.length,
        source,
      };
      void track("beach_search_result_click", {
        beachId: beach.id,
        metadata,
      });

      handleSelect(beach);

      if (onSelect) {
        onSelect(beach);
      } else {
        // Default behavior: navigate to beach detail page using hierarchical URLs
        beachNavigation.navigateToBeach(router, beach);
      }
    },
    [
      debouncedQuery.length,
      handleSelect,
      onSelect,
      router,
      source,
      suggestions.length,
      track,
    ]
  );

  const handleEnterKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;

      const trimmedQuery = query.trim();

      // If there are no suggestions (or dropdown is closed), allow parents
      // to handle the query via fallback (e.g., map search) while still
      // preserving free-typed behavior.
      if (!isOpen || suggestions.length === 0) {
        if (onFallback && trimmedQuery) {
          e.preventDefault();
          onFallback(trimmedQuery);
        }
        return;
      }

      // Exactly one result: optionally auto-navigate for smooth flows.
      if (suggestions.length === 1 && autoNavigateSingleResult) {
        e.preventDefault();
        handleBeachSelect(suggestions[0], 0);
        return;
      }

      // Multiple results: navigate to the highlighted/first result
      // When requireExplicitSelection is true (landing page), still allow
      // Enter key navigation to provide better UX
      e.preventDefault();
      handleBeachSelect(suggestions[selectedIndex], selectedIndex);
    },
    [
      autoNavigateSingleResult,
      handleBeachSelect,
      isOpen,
      onFallback,
      query,
      selectedIndex,
      suggestions,
    ]
  );

  const showDropdown = isOpen && query.length >= 2;

  return (
    <Command
      shouldFilter={false}
      className={cn(
        "relative overflow-visible bg-transparent",
        className
      )}
      onKeyDown={(e) => {
        handleKeyDown(e);
        handleEnterKey(e);
      }}
    >
      <div className="relative rounded-lg border bg-background shadow-sm">
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={handleQueryChange}
          className={cn("border-none focus:ring-0", inputClassName)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <CommandList
          className={cn(
            "absolute top-full inset-x-0 z-50 mt-1",
            "max-h-[min(60vh,480px)] overflow-y-auto",
            "rounded-lg border bg-background shadow-lg"
          )}
        >
          {/* Error state — distinct from empty state. Surfaced when the
              search API errored (e.g. transient 5xx, rate limit) so users
              don't see a misleading "No beaches found" for a fetch failure. */}
          {!loading && error && (
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t search right now.
              </p>
              <Link
                href="/beaches/usa"
                prefetch={false}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Browse all beaches by state
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          {/* Custom empty state - don't use CommandEmpty as it conflicts with shouldFilter={false} */}
          {!loading && !error && suggestions.length === 0 && (
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                No beaches found matching &quot;{query}&quot;
              </p>
              <Link
                href="/beaches/usa"
                prefetch={false}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Don&apos;t see your spot? Browse all beaches by state
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          {suggestions.length > 0 && (
            <CommandGroup heading="Surf Spots">
              {suggestions.map((beach, index) => (
                <CommandItem
                  key={beach.id}
                  onSelect={() => handleBeachSelect(beach, index)}
                  className={cn(
                    "cursor-pointer",
                    index === selectedIndex && "bg-accent"
                  )}
                >
                  <BeachSuggestionCard
                    beach={beach}
                    showCurrentConditions={showCurrentConditions}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Always-visible footer escape hatch — keeps "browse by state"
              reachable even when results are showing. Plain Link rather
              than a CommandItem so cmdk's keyboard navigation doesn't
              treat it as a result and so the user gets a real anchor
              focus ring. Hidden when the empty-state or error-state branch
              already renders its own browse link to avoid duplication. */}
          {!error && !(suggestions.length === 0 && !loading) && (
            <>
              <CommandSeparator />
              <div className="p-2">
                <Link
                  href="/beaches/usa"
                  prefetch={false}
                  className="flex items-center justify-between gap-2 rounded-sm px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Don&apos;t see your spot? Browse by state
                  </span>
                  <ChevronRight
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </>
          )}
        </CommandList>
      )}
    </Command>
  );
}

/**
 * Beach Suggestion Card - Internal component for preview display
 */
function BeachSuggestionCard({
  beach,
  showCurrentConditions = false,
}: {
  beach: Beach;
  showCurrentConditions?: boolean;
}) {
  // Calculate condition indicator based on average rating
  const getConditionBadge = () => {
    if (!showCurrentConditions || !beach.average_rating) return null;

    const rating = beach.average_rating;
    let variant: "default" | "secondary" | "destructive" = "default";
    let label = "";

    if (rating >= 4.0) {
      variant = "default"; // Green
      label = "GOOD";
    } else if (rating >= 3.0) {
      variant = "secondary"; // Yellow
      label = "FAIR";
    } else {
      variant = "destructive"; // Red
      label = "POOR";
    }

    return (
      <Badge variant={variant} className="ml-2 text-xs">
        {label}
      </Badge>
    );
  };

  return (
    <div className="flex items-center justify-between w-full gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="font-medium truncate">{beach.name}</p>
          {getConditionBadge()}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {getBeachLocation(beach)} ·
          {beach.break_type && `${beach.break_type} · `}⭐{" "}
          {beach.average_rating?.toFixed(1) || "N/A"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
