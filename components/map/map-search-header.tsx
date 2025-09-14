import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapIcon, List } from "lucide-react";
import { motion } from "framer-motion";
import { PHASE2_ANIMATIONS } from "@/lib/constants/animations";
import { useState } from "react";
import { track } from "@/lib/analytics";

interface MapSearchHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  viewMode: "map" | "list";
  onViewModeChange: (mode: "map" | "list") => void;
}

interface SearchResult {
  id: string;
  name: string;
  location?: string;
}

export function MapSearchHeader({
  searchQuery,
  onSearchChange,
  onClearSearch,
  viewMode,
  onViewModeChange,
}: MapSearchHeaderProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  const locationSelectionMotion = PHASE2_ANIMATIONS.mapDiscovery.locationSelection;
  const searchResultsMotion = PHASE2_ANIMATIONS.mapDiscovery.searchResults;

  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    
    if (value.length > 2) {
      // Simulate search results (in real app, this would be an API call)
      const mockResults: SearchResult[] = [
        { id: "1", name: "Ocean Beach", location: "San Diego" },
        { id: "2", name: "Pacific Beach", location: "San Diego" },
        { id: "3", name: "La Jolla Shores", location: "La Jolla" },
        { id: "4", name: "Mission Beach", location: "San Diego" },
      ].filter(result => 
        result.name.toLowerCase().includes(value.toLowerCase())
      );
      
      setSearchResults(mockResults);
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleLocationSelect = (result: SearchResult) => {
    setIsSelecting(true);
    setSelectedLocation(result.name);
    onSearchChange(result.name);
    // Track search selection in map context
    track("beach_search", {
      query: searchQuery,
      result_count: searchResults.length,
      source: "map",
    });
    
    // Excitement animation
    setTimeout(() => {
      setIsSelecting(false);
      setShowResults(false);
    }, 300);
  };

  return (
    <motion.div 
      className="sticky top-0 z-10 bg-background border-b p-4" 
      data-testid="location-selector"
      variants={locationSelectionMotion}
      animate={isSelecting ? "selecting" : selectedLocation ? "selected" : "initial"}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <motion.div
            whileFocus={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
          >
            <Input
              placeholder="Search beaches..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
              onFocus={() => setShowResults(searchResults.length > 0)}
              onBlur={() => {
                // Delay hiding results to allow click
                setTimeout(() => setShowResults(false), 150);
              }}
              data-testid="search-input"
            />
          </motion.div>
          
          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <motion.ul
              role="listbox"
              className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50"
              variants={searchResultsMotion}
              initial="initial"
              animate="animate"
              exit="initial"
            >
              {searchResults.map((result, index) => (
                <motion.li
                  key={result.id}
                  role="option"
                  className="border-b border-gray-100 last:border-b-0"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.2 }}
                >
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-gray-50"
                    onClick={() => handleLocationSelect(result)}
                  >
                    <div className="font-medium text-gray-900">{result.name}</div>
                    {result.location && (
                      <div className="text-sm text-gray-500">{result.location}</div>
                    )}
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
          
          {searchQuery && (
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
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
