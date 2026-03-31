"use client";

import { useCallback } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Loader2, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBeachAutocomplete } from "@/hooks/use-beach-autocomplete";
import type { Beach } from "@/types/database";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

interface BeachToolSearchProps {
  onSelect: (beach: Beach) => void;
  placeholder?: string;
  className?: string;
  maxResults?: number;
}

/**
 * Beach search for free tools — fires onSelect callback instead of navigating.
 * Used by Tide Clock and Dawn Patrol Calculator.
 */
export function BeachToolSearch({
  onSelect,
  placeholder = "Find your beach...",
  className,
  maxResults = 6,
}: BeachToolSearchProps) {
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
      onSelect(beach);
    },
    [handleSelect, onSelect]
  );

  const handleEnterKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (!isOpen || suggestions.length === 0) return;
      e.preventDefault();
      if (suggestions.length === 1) {
        handleBeachSelect(suggestions[0]);
      } else {
        handleBeachSelect(suggestions[selectedIndex]);
      }
    },
    [handleBeachSelect, isOpen, selectedIndex, suggestions]
  );

  return (
    <Command
      shouldFilter={false}
      className={cn(
        "rounded-xl border shadow-lg",
        "bg-[#1A2158] border-[rgba(64,76,146,0.6)]",
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
          className="border-none focus:ring-0 text-white placeholder:text-[#7A8CC0] bg-transparent"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#7A8CC0]" />
        )}
      </div>

      <CommandList>
        {isOpen && query.length >= 2 && (
          <>
            {!loading && suggestions.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm text-[#7A8CC0]">
                  No beaches found for &quot;{query}&quot;
                </p>
              </div>
            )}
            {suggestions.length > 0 && (
              <CommandGroup>
                {suggestions.map((beach, index) => (
                  <CommandItem
                    key={beach.id}
                    onSelect={() => handleBeachSelect(beach)}
                    className={cn(
                      "cursor-pointer text-white",
                      index === selectedIndex && "bg-[#2F3978]"
                    )}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#F78E42] shrink-0" aria-hidden="true" />
                          <span className="font-medium truncate">{beach.name}</span>
                        </div>
                        <p className="text-xs text-[#7A8CC0] truncate ml-5">
                          {getBeachLocation(beach)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[#7A8CC0] shrink-0" aria-hidden="true" />
                    </div>
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
