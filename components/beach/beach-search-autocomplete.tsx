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

interface BeachSearchAutocompleteProps {
  onSelect?: (beach: Beach) => void;
  placeholder?: string;
  className?: string;
  showCurrentConditions?: boolean;
  maxResults?: number;
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
  } = useBeachAutocomplete({ maxResults });

  const handleBeachSelect = useCallback(
    (beach: Beach) => {
      handleSelect(beach);

      if (onSelect) {
        onSelect(beach);
      } else {
        // Default behavior: navigate to beach detail page
        router.push(`/beach/${beach.slug || beach.id}`);
      }
    },
    [handleSelect, onSelect, router]
  );

  const handleEnterKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && isOpen && suggestions.length > 0) {
        e.preventDefault();
        handleBeachSelect(suggestions[selectedIndex]);
      }
    },
    [isOpen, suggestions, selectedIndex, handleBeachSelect]
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
          onValueChange={setQuery}
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
