"use client";

import { useState, memo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Star, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { MapImage } from "@/components/map-image";
import { useForecastPreview } from "@/hooks/use-forecast-preview";
import { ForecastPreview } from "@/components/ui/forecast-preview";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { formatRatingSimple } from "@/lib/utils/rating-formatters";

interface BeachCardProps {
  id?: string;
  name: string;
  distance?: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  latitude?: number;
  longitude?: number;
  // New props for hierarchical URLs
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  onViewDetails?: () => void;
  onMapClick?: () => void;
  onReviewsClick?: () => void;
  showForecastPreview?: boolean;
}

const BeachCardComponent = function BeachCard({
  id,
  name,
  distance,
  rating,
  reviewCount,
  imageUrl,
  latitude,
  longitude,
  slug,
  city,
  state,
  onViewDetails,
  onMapClick,
  onReviewsClick,
  showForecastPreview = false,
}: BeachCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate beach URL (hierarchical if slug/city/state available, otherwise fallback to ID)
  const beachUrl = getBeachUrlSafe({ id, slug, city, state });

  const beachReviewsUrl = beachUrl ? `${beachUrl}?tab=reviews` : null;

  // Use shared forecast preview hook
  const {
    forecastPreview,
    loading: loadingForecast,
    error: forecastError,
  } = useForecastPreview({
    enabled: showForecastPreview || isExpanded,
    beachId: id,
  });

  const handleMapClick = () => {
    if (onMapClick) {
      onMapClick();
    } else if (beachUrl) {
      // Default behavior - navigate to beach details
      router.push(beachUrl);
    }
  };

  const handleReviewsClick = () => {
    if (onReviewsClick) {
      onReviewsClick();
    } else if (beachReviewsUrl) {
      // Default behavior - navigate to beach details reviews tab
      router.push(beachReviewsUrl);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      whileHover={{
        scale: 1.02,
        y: -4,
        boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
        transition: { duration: 0.3 },
      }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <Card
        className="overflow-hidden"
        data-testid="beach-card"
        data-beach-id={id}
      >
        <motion.div
          className="relative h-48 cursor-pointer"
          onClick={handleMapClick}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3 }}
        >
          <MapImage
            src={imageUrl || "/placeholder.svg"}
            alt={`Map showing ${name} surf spot location`}
            latitude={latitude}
            longitude={longitude}
            fill
            className="object-cover"
            beachName={name}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <motion.div
            className="absolute bottom-0 left-0 p-3 text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h3 className="font-semibold text-lg">{name}</h3>
            {distance ? (
              <div className="flex items-center text-sm">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{distance}</span>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
        <CardContent className="p-3">
          <div className="flex justify-between items-center">
            <motion.div
              className="flex items-center cursor-pointer"
              onClick={handleReviewsClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Star className="h-4 w-4 text-yellow-500 mr-1 fill-yellow-500" />
              <span className="font-medium">
                {formatRatingSimple(rating)}
              </span>
              <span className="text-muted-foreground text-sm ml-1 hidden sm:inline">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </motion.div>

            <div className="flex items-center gap-2">
              {/* Expand/Collapse Button */}
              <motion.button
                onClick={toggleExpanded}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </motion.button>

              {beachUrl ? (
                <Link
                  href={beachUrl}
                  className="text-primary text-sm font-medium"
                >
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    View Details
                  </motion.span>
                </Link>
              ) : (
                <motion.button
                  onClick={onViewDetails}
                  className="text-primary text-sm font-medium"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  View Details
                </motion.button>
              )}
            </div>
          </div>

          {/* Expandable Forecast Preview */}
          <AnimatePresence>
            {(showForecastPreview || isExpanded) && (
              <motion.div
                className="mt-3 pt-3 border-t"
                data-testid="expanded-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <motion.div
                  className="forecast-info"
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Current Conditions
                  </h4>
                  <ForecastPreview
                    forecastPreview={forecastPreview}
                    loading={loadingForecast}
                    error={forecastError}
                    variant="grid"
                  />
                </motion.div>
                <motion.div
                  className="conditions-grid mt-3"
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 p-2 rounded">
                      <div className="text-blue-600 font-medium">
                        Wave Height
                      </div>
                      <div className="text-blue-800">
                        {forecastPreview?.wave_height || "N/A"}
                      </div>
                    </div>
                    <div className="bg-green-50 p-2 rounded">
                      <div className="text-green-600 font-medium">
                        Wind Speed
                      </div>
                      <div className="text-green-800">
                        {forecastPreview?.wind_speed || "N/A"}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Export memoized component for performance optimization
export const BeachCard = memo(BeachCardComponent);
BeachCard.displayName = 'BeachCard';
