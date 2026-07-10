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
  SWELL_MAP_CTA_CLASS,
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
import type { MapRegionPill } from "@/components/map/map-regions";

interface MapToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onClearSearch: () => void;
  suggestions: Beach[];
  onSuggestionSelect: (beach: Beach) => void;
  regions: MapRegionPill[];
  onRegionSelect: (region: MapRegionPill) => void;
  onUseMyLocation: () => void;
  filters: { beginnerFriendly: boolean; breakTypes: Set<string> };
  onToggleBeginner: () => void;
  onToggleBreakType: (type: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  showSwellField: boolean;
  onToggleSwellField: () => void;
  fieldGuideVisible?: boolean;
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
    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-white/15 bg-white/5 text-white hover:bg-white/10",
  ].join(" ");

const toolbarActionClass =
  "h-10 w-full min-w-0 justify-center whitespace-nowrap px-2 text-xs sm:px-3 sm:text-sm lg:w-auto";

export function MapToolbar({
  searchQuery,
  onSearchChange,
  searchInputRef,
  onClearSearch,
  suggestions,
  onSuggestionSelect,
  regions,
  onRegionSelect,
  onUseMyLocation,
  filters,
  onToggleBeginner,
  onToggleBreakType,
  onClearAll,
  hasActiveFilters,
  showSwellField,
  onToggleSwellField,
  fieldGuideVisible = false,
  onOpenFieldGuide,
}: MapToolbarProps) {
  const showSuggestions = searchQuery.trim().length > 0 && suggestions.length > 0;
  const suggestionsListId = useId();
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const activeSuggestion =
    activeSuggestionIndex >= 0 ? suggestions[activeSuggestionIndex] : undefined;

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [searchQuery, suggestions.length]);

  const selectSuggestion = (index: number): void => {
    const suggestion = suggestions[index];
    if (!suggestion) return;

    onSuggestionSelect(suggestion);
  };

  return (
    <div
      data-testid="map-controls"
      className="sticky top-0 z-20 border-b bg-background px-3 py-3 sm:px-4"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
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
              className="h-10 w-full rounded-md border border-input bg-background py-2 pl-9 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear map search"
                onClick={onClearSearch}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {showSuggestions && (
              <div
                id={suggestionsListId}
                role="listbox"
                data-testid="map-search-suggestions"
                className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border bg-background shadow-lg"
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
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-selected:bg-muted"
                    >
                      <span className="font-medium">{beach.name}</span>
                      {location && (
                        <span className="text-xs text-muted-foreground">
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
                  aria-label="Regions and filters"
                  variant="secondary"
                  size="sm"
                  className={toolbarActionClass}
                >
                  <SlidersHorizontal
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="sm:hidden">Filters</span>
                  <span className="hidden sm:inline">Regions and filters</span>
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
                className="w-[calc(100vw-2rem)] max-w-md space-y-4 border-white/15 bg-[#252D70] p-4 text-white shadow-2xl sm:w-[28rem]"
              >
                <section
                  className="space-y-2"
                  aria-labelledby="map-regions-label"
                >
                  <div
                    id="map-regions-label"
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-[#C8D0FF]"
                  >
                    Regions
                  </div>
                  <nav aria-label="Map regions">
                    <div className="flex flex-wrap gap-2">
                      {regions.map((region) => (
                        <button
                          key={region.id}
                          type="button"
                          data-testid={`map-region-pill-${region.id}`}
                          onClick={() => onRegionSelect(region)}
                          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
                        >
                          {region.label}
                        </button>
                      ))}
                    </div>
                  </nav>
                </section>

                <section
                  className="space-y-2"
                  aria-labelledby="map-filters-label"
                >
                  <div
                    id="map-filters-label"
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-[#C8D0FF]"
                  >
                    Filters
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onToggleBeginner}
                      className={filterChipClass(filters.beginnerFriendly)}
                    >
                      Beginner-friendly
                    </button>
                    {BREAK_TYPE_FILTERS.map((type) => (
                      <button
                        key={type}
                        type="button"
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
                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
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
              className={`${toolbarActionClass} inline-flex items-center gap-2 rounded-md py-1.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${
                showSwellField
                  ? "text-[#161A40] shadow-inner ring-1 ring-black/20"
                  : SWELL_MAP_CTA_CLASS
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
