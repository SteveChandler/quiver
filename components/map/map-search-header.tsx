import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapIcon, List } from "lucide-react";

interface MapSearchHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  viewMode: "map" | "list";
  onViewModeChange: (mode: "map" | "list") => void;
}

export function MapSearchHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  viewMode,
  onViewModeChange,
}: MapSearchHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
          />
          {searchQuery && (
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
          )}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex mt-3 bg-muted rounded-lg p-1">
        <Button
          variant={viewMode === "map" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("map")}
          className="flex-1"
        >
          <MapIcon className="h-4 w-4 mr-1" />
          Map
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("list")}
          className="flex-1"
        >
          <List className="h-4 w-4 mr-1" />
          List
        </Button>
      </div>
    </div>
  );
}
