"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BeachCard } from "@/components/beach-card";
import { BeachCardListSkeleton } from "@/components/skeletons/beach-card-skeleton";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import { prepareMultipleBeachCardData } from "@/lib/utils/beach-card-utils";
import {
  COVERAGE_MESSAGES,
  isLikelyOutOfAreaSearch,
} from "@/lib/constants/coverage-areas";
import { Info } from "lucide-react";
import type { Beach } from "@/types/database";

interface BeachListProps {
  filteredBeaches: Beach[];
  searchQuery: string;
  userLocation: { lat: number; lng: number } | null;
  usingDefaultLocation: boolean;
  loading?: boolean;
  onBeachSelect: (beach: Beach) => void;
  onClearSearch: () => void;
  onGetUserLocation: () => void;
  onLoadBeaches: () => void;
  getDistanceFromUser: (beachLat: number, beachLng: number) => string;
}

export function BeachList({
  filteredBeaches,
  searchQuery,
  userLocation,
  usingDefaultLocation,
  loading = false,
  onBeachSelect,
  onClearSearch,
  onGetUserLocation,
  onLoadBeaches,
  getDistanceFromUser,
}: BeachListProps) {
  const [selectedBeachId, setSelectedBeachId] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [displayedBeaches, setDisplayedBeaches] = useState<Beach[]>([]);
  
  // Memoize beach IDs to ensure stable dependencies
  const beachIds = useMemo(
    () => filteredBeaches.map((beach) => beach.id),
    [filteredBeaches]
  );

  const { reviewStats, loading: reviewsLoading } =
    useMultipleBeachReviews(beachIds);
    
  // Filter beaches based on local filter
  useEffect(() => {
    let filtered = filteredBeaches;
    if (filterValue) {
      filtered = filteredBeaches.filter(beach =>
        beach.name.toLowerCase().includes(filterValue.toLowerCase()) ||
        (beach.location && beach.location.toLowerCase().includes(filterValue.toLowerCase()))
      );
    }
    setDisplayedBeaches(filtered);
  }, [filteredBeaches, filterValue]);
  
  const handleBeachSelect = (beach: Beach) => {
    setSelectedBeachId(beach.id);
    onBeachSelect(beach);
  };
  
  const handleFilter = (value: string) => {
    setFilterValue(value);
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <BeachCardListSkeleton count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" data-testid="beach-list">
      <div className="p-4 space-y-4">
        {/* Filter Input */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <input
              type="text"
              placeholder="Filter beaches..."
              aria-label="Filter beaches"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filterValue}
              onChange={(e) => handleFilter(e.target.value)}
              data-testid="filter-input"
            />
            {filterValue && (
              <motion.button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => handleFilter("")}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Clear filter"
              >
                ×
              </motion.button>
            )}
          </div>
        </motion.div>
        {displayedBeaches.length === 0 && !loading ? (
          <div className="text-center py-8">
            {searchQuery ? (
              <>
                {/* Check if this might be an out-of-area search */}
                {isLikelyOutOfAreaSearch(searchQuery) ? (
                  <div className="text-left max-w-md mx-auto">
                    <div className="flex items-start gap-2 text-amber-700 text-sm p-4 bg-amber-50 rounded-lg mb-4 border border-amber-200">
                      <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium mb-2">
                          {COVERAGE_MESSAGES.OUT_OF_AREA_TITLE}
                        </p>
                        <p className="text-amber-700/80 mb-2">
                          {COVERAGE_MESSAGES.getOutOfAreaMessage(searchQuery)}
                        </p>
                        <p className="text-amber-700/80 mb-3 text-xs">
                          {COVERAGE_MESSAGES.COVERAGE_AREA_INFO}
                        </p>
                        <p className="text-xs text-amber-700/70">
                          {COVERAGE_MESSAGES.getCoverageExpansionMessage()}
                        </p>
                      </div>
                    </div>
                    <div className="text-center">
                      <Button onClick={onClearSearch} variant="outline">
                        Show San Diego Beaches
                      </Button>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-lg font-medium mb-2">
                      {filterValue ? `No beaches match "${filterValue}"` : "No beaches found"}
                    </p>
                    <p className="text-muted-foreground mb-2">
                      {searchQuery && `No beaches match "${searchQuery}"`}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {COVERAGE_MESSAGES.COVERAGE_AREA_INFO}
                    </p>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button onClick={onClearSearch} variant="outline">
                        Clear Search
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </>
            ) : !userLocation ? (
              <div>
                <p className="text-lg font-medium mb-2">No location set</p>
                <p className="text-muted-foreground mb-4">
                  We need your location to find nearby beaches
                </p>
                <Button onClick={onGetUserLocation}>Get My Location</Button>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">No beaches found</p>
                <p className="text-muted-foreground mb-4">
                  No beaches found in your area
                </p>
                <Button onClick={onLoadBeaches} variant="outline">
                  Try Again
                </Button>
              </div>
            )}
          </div>
        ) : (
          <motion.div
            className="space-y-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
          >
            {(() => {
              const beachCardData = prepareMultipleBeachCardData(
                displayedBeaches,
                userLocation,
                reviewStats,
                "BEACH_CARD_LIST"
              );

              return beachCardData.map((beachData, index) => {
                const isSelected = selectedBeachId === beachData.id;
                
                return (
                  <motion.div 
                    key={beachData.id} 
                    data-testid="beach-item" 
                    className="relative"
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { 
                        opacity: 1, 
                        x: 0,
                        transition: {
                          duration: 0.4,
                          ease: "easeOut"
                        }
                      }
                    }}
                    whileHover={{ 
                      scale: 1.02, 
                      y: -2,
                      transition: { duration: 0.2 }
                    }}
                    layout
                  >
                    {/* Selection indicator */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div 
                          className="absolute top-2 right-2 z-10" 
                          data-testid="selection-indicator"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", bounce: 0.3 }}
                        >
                          <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-lg">
                            ✓
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <motion.div
                      className={`transition-all duration-200 ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' 
                          : ''
                      }`}
                    >
                      <BeachCard
                        id={beachData.id}
                        name={beachData.name}
                        distance={beachData.distance}
                        rating={beachData.rating}
                        reviewCount={beachData.reviewCount}
                        imageUrl={beachData.mapImageUrl}
                        latitude={beachData.latitude}
                        longitude={beachData.longitude}
                        onViewDetails={() => {
                          handleBeachSelect(
                            displayedBeaches.find((b) => b.id === beachData.id)!
                          );
                        }}
                      />
                    </motion.div>
                  </motion.div>
                );
              });
            })()}
          </motion.div>
        )}
      </div>
    </div>
  );
}
