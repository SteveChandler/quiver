"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";

interface HomeBeachSelectorProps {
  value?: string; // Beach ID
  onValueChange: (beachId: string | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function HomeBeachSelector({
  value,
  onValueChange,
  placeholder = "Select your home beach",
  className,
  disabled = false,
}: HomeBeachSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);

  // Fetch all beaches for the initial dropdown options
  const fetchBeaches = useCallback(async () => {
    const result = await getBeaches();
    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to load beaches");
    }

    // Sort beaches by name and prioritize popular SD beaches
    const beaches = result.data as Beach[];
    const popularBeaches = [
      "Pacific Beach",
      "Ocean Beach",
      "Mission Beach",
      "La Jolla Shores",
      "Windansea",
      "Scripps Pier",
      "Sunset Cliffs",
      "Cardiff",
      "Swami's",
      "Tourmaline",
    ];

    return beaches.sort((a, b) => {
      const aPopular = popularBeaches.includes(a.name);
      const bPopular = popularBeaches.includes(b.name);

      if (aPopular && !bPopular) return -1;
      if (!aPopular && bPopular) return 1;

      return a.name.localeCompare(b.name);
    });
  }, []);

  const {
    data: allBeaches = [],
    loading: beachesLoading,
    error,
    retry,
  } = useDataFetcher(fetchBeaches);

  // Filter beaches based on search locally instead of server search
  const filteredBeaches = React.useMemo(() => {
    if (!allBeaches) return [];

    if (!searchQuery.trim()) {
      return allBeaches.slice(0, 20); // Limit to first 20 for performance
    }

    const query = searchQuery.toLowerCase();
    return allBeaches
      .filter(
        (beach) =>
          beach.name.toLowerCase().includes(query) ||
          (beach.location && beach.location.toLowerCase().includes(query))
      )
      .slice(0, 20);
  }, [allBeaches, searchQuery]);

  // Find the selected beach based on value prop
  useEffect(() => {
    if (value && allBeaches && allBeaches.length > 0) {
      const beach = allBeaches.find((b) => b.id === value);
      setSelectedBeach(beach || null);
    } else {
      setSelectedBeach(null);
    }
  }, [value, allBeaches]);

  const handleSelect = (beach: Beach) => {
    setSelectedBeach(beach);
    console.debug("[HomeBeach/UI] change", { selectedId: beach.id });
    onValueChange(beach.id);
    setOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    setSelectedBeach(null);
    console.debug("[HomeBeach/UI] change", { selectedId: undefined });
    onValueChange(undefined);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            data-testid="home-beach-select"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-left font-normal",
              !selectedBeach && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <div className="flex items-center">
              <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
              {selectedBeach ? (
                <div className="flex items-center gap-2">
                  <span>{selectedBeach.name}</span>
                  {selectedBeach.location && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedBeach.location}
                    </Badge>
                  )}
                </div>
              ) : (
                placeholder
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedBeach && !disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                >
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search beaches..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandEmpty>
              {error ? (
                <div className="p-3 text-center flex flex-col items-center gap-2">
                  <div className="text-sm text-destructive">
                    Error loading beaches
                  </div>
                  <Button size="sm" variant="outline" onClick={retry}>
                    Retry
                  </Button>
                </div>
              ) : (
                "No beaches found."
              )}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {beachesLoading ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm">Loading beaches...</span>
                </div>
              ) : (
                filteredBeaches.map((beach) => (
                  <CommandItem
                    key={beach.id}
                    value={beach.id}
                    onSelect={() => {
                      handleSelect(beach);
                    }}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center">
                      <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{beach.name}</div>
                        {beach.location && (
                          <div className="text-xs text-muted-foreground">
                            {beach.location}
                          </div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        selectedBeach?.id === beach.id
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
