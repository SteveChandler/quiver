"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBeachAutocomplete } from "@/hooks/use-beach-autocomplete";
import type { Beach } from "@/types/database";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import { beachNavigation } from "@/lib/navigation-utils";

interface BeachSearchAutocompleteProps {
  onSelect?: (beach: Beach) => void;
  placeholder?: string;
  className?: string;
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
  showCurrentConditions = false,
  maxResults = 5,
  initialValue = "",
  onFallback,
  requireExplicitSelection = false,
  autoNavigateSingleResult = true,
  onQueryChange,
}: BeachSearchAutocompleteProps) {
  const router = useRouter();
  const {
    query,
    suggestions,
    loading,
    isOpen,
    selectedIndex,
    setQuery,
    handleKeyDown,
    handleSelect,
  } = useBeachAutocomplete({ maxResults, initialQuery: initialValue });

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      onQueryChange?.(value);
    },
    [onQueryChange, setQuery]
  );

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      handleSelect(beach);

      if (onSelect) {
        onSelect(beach);
      } else {
        // Default behavior: navigate to beach detail page using hierarchical URLs
        beachNavigation.navigateToBeach(router, beach);
      }
    },
    [handleSelect, onSelect, router]
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
        handleBeachSelect(suggestions[0]);
        return;
      }

      // Multiple results: navigate to the highlighted/first result
      // When requireExplicitSelection is true (landing page), still allow
      // Enter key navigation to provide better UX
      e.preventDefault();
      handleBeachSelect(suggestions[selectedIndex]);
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

  return (
    <Command
      className={cn(
        "rounded-lg border shadow-md bg-background",
        className
      )}
      onKeyDown={(e) => {
        handleKeyDown(e);
        handleEnterKey(e);
      }}
    >
      <div className="relative">
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={handleQueryChange}
          className="border-none focus:ring-0"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <CommandList>
        {isOpen && query.length >= 2 && (
          <>
            <CommandEmpty>
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No beaches found matching &quot;{query}&quot;
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Try searching for a specific beach name like &quot;Swami&apos;s&quot; or &quot;Ocean Beach&quot;
                </p>
              </div>
            </CommandEmpty>

            {suggestions.length > 0 && (
              <CommandGroup heading="Surf Spots">
                {suggestions.map((beach, index) => (
                  <CommandItem
                    key={beach.id}
                    onSelect={() => handleBeachSelect(beach)}
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
          </>
        )}
      </CommandList>
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
          {beach.break_type && `${beach.break_type} · `}
          ⭐ {beach.average_rating?.toFixed(1) || "N/A"}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
