import { Button } from "@/components/ui/button";
import { MapIcon, List } from "lucide-react";
import { motion } from "framer-motion";

interface MapSearchHeaderProps {
  viewMode: "map" | "list";
  onViewModeChange: (mode: "map" | "list") => void;
  onNearMe?: () => void;
  // Deprecated props kept for backward compatibility during transition
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onClearSearch?: () => void;
  suggestions?: Array<{ id: string; name: string; location?: string }>;
  onResultSelect?: (id: string) => void;
}

/**
 * MapSearchHeader - Map View Controls
 *
 * NOTE: Search functionality has been moved to the global app header.
 * This component now only handles view mode toggle and location controls.
 *
 * @deprecated searchQuery, onSearchChange, onClearSearch props - use global header search
 */
export function MapSearchHeader({
  viewMode,
  onViewModeChange,
  onNearMe,
}: MapSearchHeaderProps) {
  return (
    <div
      className="sticky top-0 z-10 bg-background border-b p-4"
      data-testid="map-controls"
    >
      <div className="flex items-center gap-2 justify-between">
        {/* Near me button */}
        {onNearMe && (
          <Button variant="secondary" size="sm" onClick={onNearMe}>
            Use Near Me
          </Button>
        )}

        {/* View Mode Toggle with Motion */}
        <div className="flex bg-muted rounded-lg p-1">
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
      </div>
    </div>
  );
}
