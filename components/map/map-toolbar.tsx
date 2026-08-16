"use client";

import { type RefObject, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SWELL_LAYER_COLOR,
  SWELL_MAP_LEGEND_SURFACE,
  SWELL_MAP_STICKER_RADIUS,
  SWELL_MAP_STICKER_SHADOW,
} from "@/components/map/swell-map-theme";
import {
  BookOpen,
  MapPin,
  Search,
  SlidersHorizontal,
  Waves,
  X,
} from "lucide-react";
import type { Beach } from "@/types/database";

interface MapToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onClearSearch: () => void;
  suggestions: Beach[];
  onSuggestionSelect: (beach: Beach) => void;
  onUseMyLocation: () => void;
  filters: { beginnerFriendly: boolean; breakTypes: Set<string> };
  onToggleBeginner: () => void;
  onToggleBreakType: (type: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  showSwellField: boolean;
  onToggleSwellField: () => void;
  fieldGuideVisible?: boolean;
  fieldGuideTriggerRef?: RefObject<HTMLButtonElement | null>;
  onOpenFieldGuide?: () => void;
}

const BREAK_TYPE_FILTERS = [
  "beach",
  "point",
  "reef",
  "longboard",
  "bodyboard",
] as const;

const filterChipClass = (active: boolean): string =>
  [
    "min-h-11 rounded-full border-2 border-[#11100D] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.04em] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]",
    active
      ? "bg-[#F78E42] text-[#11100D]"
      : "bg-[#F5EEDC] text-[#11100D] hover:bg-[#E9DEC7]",
  ].join(" ");

const toolbarActionClass =
  "h-11 w-full min-w-0 justify-center whitespace-nowrap rounded-[8px_3px_9px_4px] border-2 border-[#11100D] bg-[#F5EEDC] px-2 text-xs font-bold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] hover:bg-[#E9DEC7] sm:px-3 sm:text-sm lg:w-auto";

export function MapToolbar({
  searchQuery,
  onSearchChange,
  searchInputRef,
  onClearSearch,
  suggestions,
  onSuggestionSelect,
  onUseMyLocation,
  filters,
  onToggleBeginner,
  onToggleBreakType,
  onClearAll,
  hasActiveFilters,
  showSwellField,
  onToggleSwellField,
  fieldGuideVisible = false,
  fieldGuideTriggerRef,
  onOpenFieldGuide,
}: MapToolbarProps) {
  const suggestionsListId = useId();
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const showSuggestions =
    !suggestionsDismissed &&
    searchQuery.trim().length > 0 &&
    suggestions.length > 0;
  const activeSuggestion =
    activeSuggestionIndex >= 0 ? suggestions[activeSuggestionIndex] : undefined;

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [searchQuery, suggestions.length]);

  useEffect(() => {
    setSuggestionsDismissed(false);
  }, [searchQuery]);

  const selectSuggestion = (index: number): void => {
    const suggestion = suggestions[index];
    if (!suggestion) return;

    setSuggestionsDismissed(true);
    setActiveSuggestionIndex(-1);
    onSuggestionSelect(suggestion);
  };

  return (
    <div
      data-testid="map-controls"
      className="sticky top-0 z-20 border-b-2 border-[#11100D] px-3 py-3 sm:px-4"
      style={{
        background: SWELL_MAP_LEGEND_SURFACE.paper,
        boxShadow: SWELL_MAP_STICKER_SHADOW,
        color: SWELL_MAP_LEGEND_SURFACE.ink,
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#11100D]/65"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              data-zine-input="true"
              data-testid="map-toolbar-search"
              role="combobox"
              aria-label="Search beaches, spots, or cities"
              aria-autocomplete="list"
              aria-controls={showSuggestions ? suggestionsListId : undefined}
              aria-expanded={showSuggestions}
              aria-activedescendant={
                activeSuggestion
                  ? `${suggestionsListId}-option-${activeSuggestion.id}`
                  : undefined
              }
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && showSuggestions) {
                  event.preventDefault();
                  setActiveSuggestionIndex((current) =>
                    current + 1 >= suggestions.length ? 0 : current + 1,
                  );
                  return;
                }
                if (event.key === "ArrowUp" && showSuggestions) {
                  event.preventDefault();
                  setActiveSuggestionIndex((current) =>
                    current <= 0 ? suggestions.length - 1 : current - 1,
                  );
                  return;
                }
                if (
                  event.key === "Enter" &&
                  showSuggestions &&
                  activeSuggestionIndex >= 0
                ) {
                  event.preventDefault();
                  selectSuggestion(activeSuggestionIndex);
                  return;
                }
                if (event.key === "Escape" && searchQuery) {
                  setActiveSuggestionIndex(-1);
                  onClearSearch();
                }
              }}
              placeholder="Search beaches, spots, or cities"
              className="h-11 w-full rounded-[9px_4px_10px_5px] border-2 !border-[#11100D] border-[#11100D] !bg-[#F5EEDC] bg-[#F5EEDC] py-2 pl-9 pr-11 text-sm font-medium !text-[#11100D] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.2)] outline-none transition-colors placeholder:!text-[#11100D]/55 focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              style={{
                background: SWELL_MAP_LEGEND_SURFACE.paperRaised,
                borderColor: SWELL_MAP_LEGEND_SURFACE.border,
                boxShadow: "2px 2px 0 rgba(17,16,13,0.2)",
                color: SWELL_MAP_LEGEND_SURFACE.ink,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear map search"
                onClick={onClearSearch}
                className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[#11100D]/65 hover:bg-[#E9DEC7] hover:text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {showSuggestions && (
              <div
                id={suggestionsListId}
                role="listbox"
                data-testid="map-search-suggestions"
                className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-[9px_4px_10px_5px] border-2 border-[#11100D] bg-[#F5EEDC] text-[#11100D] shadow-[3px_4px_0_rgba(17,16,13,0.28)]"
              >
                {suggestions.map((beach, index) => {
                  const location = [beach.city, beach.state]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <button
                      key={beach.id}
                      id={`${suggestionsListId}-option-${beach.id}`}
                      role="option"
                      aria-selected={index === activeSuggestionIndex}
                      type="button"
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      onClick={() => selectSuggestion(index)}
                      className="flex min-h-11 w-full flex-col justify-center px-3 py-2 text-left text-sm hover:bg-[#E9DEC7] focus-visible:bg-[#E9DEC7] focus-visible:outline-none aria-selected:bg-[#E9DEC7]"
                    >
                      <span className="font-medium">{beach.name}</span>
                      {location && (
                        <span className="text-xs text-[#11100D]/65">
                          {location}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            data-testid="map-toolbar-actions"
            className={`grid w-full gap-2 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end ${
              onOpenFieldGuide ? "grid-cols-4" : "grid-cols-3"
            }`}
          >
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  aria-label="Filters"
                  variant="secondary"
                  size="sm"
                  className={toolbarActionClass}
                >
                  <SlidersHorizontal
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Filters</span>
                  {hasActiveFilters && (
                    <span
                      className="ml-1 h-2 w-2 rounded-full bg-[#F78E42]"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[calc(100vw-2rem)] max-w-md space-y-4 border-2 border-[#11100D] bg-[#F4EBD8] p-4 text-[#11100D] shadow-[4px_5px_0_rgba(17,16,13,0.32)] sm:w-[28rem]"
                style={{ borderRadius: SWELL_MAP_STICKER_RADIUS }}
              >
                <section
                  className="space-y-2"
                  aria-labelledby="map-filters-label"
                >
                  <div
                    id="map-filters-label"
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#11100D]/70"
                  >
                    Filters
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={filters.beginnerFriendly}
                      onClick={onToggleBeginner}
                      className={filterChipClass(filters.beginnerFriendly)}
                    >
                      Beginner-friendly
                    </button>
                    {BREAK_TYPE_FILTERS.map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={filters.breakTypes.has(type)}
                        onClick={() => onToggleBreakType(type)}
                        className={filterChipClass(filters.breakTypes.has(type))}
                      >
                        {type}
                      </button>
                    ))}
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={onClearAll}
                        data-testid="map-clear-all"
                        className="min-h-11 rounded-full border-2 border-[#11100D] bg-[#E9DEC7] px-3 py-1.5 text-xs font-bold text-[#11100D] transition-colors hover:bg-[#D9C49C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </section>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label="Use Near Me"
              onClick={onUseMyLocation}
              className={toolbarActionClass}
            >
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Near Me</span>
              <span className="hidden sm:inline">Use Near Me</span>
            </Button>

            <button
              type="button"
              aria-label={showSwellField ? "Hide swell field" : "Show swell field"}
              aria-pressed={showSwellField}
              data-testid="swell-field-toggle"
              onClick={onToggleSwellField}
              className={`${toolbarActionClass} inline-flex items-center gap-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${
                showSwellField ? "bg-[#F78E42]" : ""
              }`}
              style={
                showSwellField
                  ? { background: SWELL_LAYER_COLOR.s1 }
                  : undefined
              }
            >
              <Waves className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">
                {showSwellField ? "Swell on" : "Swell off"}
              </span>
              <span className="hidden sm:inline">
                {showSwellField ? "Hide swell field" : "Show swell field"}
              </span>
            </button>

            {onOpenFieldGuide && (
              <Button
                ref={fieldGuideTriggerRef}
                type="button"
                variant="secondary"
                size="sm"
                aria-expanded={fieldGuideVisible}
                aria-controls="map-field-guide-panel"
                data-testid="map-field-guide-toggle"
                onClick={onOpenFieldGuide}
                className={toolbarActionClass}
              >
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">Guide</span>
                <span className="hidden sm:inline">How to read this map</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
