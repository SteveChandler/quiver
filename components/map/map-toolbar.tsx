"use client";

import { Button } from "@/components/ui/button";
import {
  SWELL_LAYER_COLOR,
  SWELL_MAP_CTA_CLASS,
} from "@/components/map/swell-map-theme";
import { List, MapIcon, MapPin, Search, X } from "lucide-react";
import type { Beach } from "@/types/database";
import type { MapRegionPill } from "@/components/map/map-regions";

interface MapToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  suggestions: Beach[];
  onSuggestionSelect: (beach: Beach) => void;
  regions: MapRegionPill[];
  onRegionSelect: (region: MapRegionPill) => void;
  onUseMyLocation: () => void;
  viewMode: "map" | "list";
  onViewModeChange: (mode: "map" | "list") => void;
  filters: { beginnerFriendly: boolean; breakTypes: Set<string> };
  onToggleBeginner: () => void;
  onToggleBreakType: (type: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  showSwellField: boolean;
  onToggleSwellField: () => void;
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
      : "border-border bg-background text-foreground hover:bg-muted",
  ].join(" ");

export function MapToolbar({
  searchQuery,
  onSearchChange,
  onClearSearch,
  suggestions,
  onSuggestionSelect,
  regions,
  onRegionSelect,
  onUseMyLocation,
  viewMode,
  onViewModeChange,
  filters,
  onToggleBeginner,
  onToggleBreakType,
  onClearAll,
  hasActiveFilters,
  showSwellField,
  onToggleSwellField,
}: MapToolbarProps) {
  const showSuggestions = searchQuery.trim().length > 0 && suggestions.length > 0;

  return (
    <div
      data-testid="map-controls"
      className="sticky top-0 z-20 border-b bg-background px-3 py-3 sm:px-4"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              data-testid="map-toolbar-search"
              role="searchbox"
              aria-label="Search beaches, spots, or cities"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && searchQuery) {
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
                data-testid="map-search-suggestions"
                className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-md border bg-background shadow-lg"
              >
                {suggestions.map((beach) => {
                  const location = [beach.city, beach.state]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <button
                      key={beach.id}
                      type="button"
                      onClick={() => onSuggestionSelect(beach)}
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
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

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onUseMyLocation}
              className="shrink-0"
            >
              <MapPin className="mr-1 h-4 w-4" aria-hidden="true" />
              Use Near Me
            </Button>

            <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-1">
              <Button
                type="button"
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                data-testid="view-mode-map"
                onClick={() => onViewModeChange("map")}
                className="min-w-[74px]"
              >
                <MapIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                Map
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                data-testid="view-mode-list"
                onClick={() => onViewModeChange("list")}
                className="min-w-[74px]"
              >
                <List className="mr-1 h-4 w-4" aria-hidden="true" />
                List
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            aria-label="Map regions"
          >
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                data-testid={`map-region-pill-${region.id}`}
                onClick={() => onRegionSelect(region)}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              >
                {region.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 xl:justify-end">
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
                className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B]"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              aria-pressed={showSwellField}
              data-testid="swell-field-toggle"
              onClick={onToggleSwellField}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDB84B] ${
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
              {showSwellField ? "Hide swell field" : "Show swell field"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
