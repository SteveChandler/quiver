import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapIcon, List } from "lucide-react";
import { motion } from "framer-motion";
import { PHASE2_ANIMATIONS } from "@/lib/constants/animations";
import { useState } from "react";

interface MapSearchHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  viewMode: "map" | "list";
  onViewModeChange: (mode: "map" | "list") => void;
  onNearMe?: () => void;
  suggestions?: Array<{ id: string; name: string; location?: string }>; // Kept for backward compatibility
  onResultSelect?: (id: string) => void; // Kept for backward compatibility
}

export function MapSearchHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  viewMode,
  onViewModeChange,
  onNearMe,
  suggestions = [],
  onResultSelect,
}: MapSearchHeaderProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const locationSelectionMotion =
    PHASE2_ANIMATIONS.mapDiscovery.locationSelection;

  return (
    <motion.div
      className="sticky top-0 z-10 bg-background border-b p-4"
      data-testid="location-selector"
      variants={locationSelectionMotion}
      animate={
        isSelecting ? "selecting" : selectedLocation ? "selected" : "initial"
      }
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1 z-20">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <motion.div
            whileFocus={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <Input
              placeholder="Search beaches..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              autoComplete="off"
              data-testid="search-input"
            />
          </motion.div>

          {searchQuery && (
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded-full p-0"
                onClick={onClearSearch}
                aria-label="Clear search"
              >
                <span className="sr-only">Clear</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </Button>
            </motion.div>
          )}
        </div>
        {/* Near me chip */}
        {onNearMe && (
          <Button variant="secondary" size="sm" onClick={onNearMe}>
            Use Near Me
          </Button>
        )}
      </div>

      {/* View Mode Toggle with Motion */}
      <div className="flex mt-3 bg-muted rounded-lg p-1">
        <motion.div
          className="flex-1"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          tabIndex={-1}
        >
          <Button
            variant={viewMode === "map" ? "default" : "ghost"}
            size="sm"
            data-testid="view-mode-map"
            onClick={() => onViewModeChange("map")}
            className="w-full"
          >
            <MapIcon className="h-4 w-4 mr-1" />
            Map
          </Button>
        </motion.div>
        <motion.div
          className="flex-1"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          tabIndex={-1}
        >
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            data-testid="view-mode-list"
            onClick={() => onViewModeChange("list")}
            className="w-full"
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
