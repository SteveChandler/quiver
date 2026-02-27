"use client";

import { useState, memo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Star, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { MapImage } from "@/components/map-image";
import { useForecastPreview } from "@/hooks/use-forecast-preview";
import { ForecastPreview } from "@/components/ui/forecast-preview";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { formatRatingSimple } from "@/lib/utils/rating-formatters";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { MatchScoreTeaser } from "@/components/recommendations/match-score-teaser";
import { FavoriteButton } from "@/components/favorite-button";
import { useAuth } from "@/context/auth-context";
import { UnifiedAuthModal } from "@/components/auth/unified-auth-modal";

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

  // Personalization props
  personalizedScore?: number;
  baseScore?: number;
  personalized?: boolean;
  scoreBreakdown?: {
    base: number;
    onboardingPrefs: number;
    learnedPrefs: number;
    affinity: number;
  };
  affinityData?: {
    sessionCount: number;
    lastSurfed: Date | string;
  };
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
  personalizedScore,
  baseScore,
  personalized,
  scoreBreakdown,
  affinityData,
}: BeachCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionAuthModalOpen, setSessionAuthModalOpen] = useState(false);
  const { user } = useAuth();

  // Generate beach URL (hierarchical if slug/city/state available, otherwise fallback to ID)
  const beachUrl = getBeachHrefSafe({ id, slug, city, state });

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

          {/* Personalization badge area */}
          {user && personalized && personalizedScore ? (
            <div className="absolute top-2 left-2 z-10">
              <PersonalizedBadge
                personalized={personalized}
                score={personalizedScore}
                breakdown={scoreBreakdown}
                affinityData={
                  affinityData
                    ? {
                        sessionCount: affinityData.sessionCount,
                        lastSurfed:
                          typeof affinityData.lastSurfed === "string"
                            ? new Date(affinityData.lastSurfed)
                            : affinityData.lastSurfed,
                      }
                    : undefined
                }
                displayMode="score"
                size="sm"
                className="shadow-md backdrop-blur-sm bg-white/95"
              />
            </div>
          ) : !user && id ? (
            <div className="absolute top-2 left-2 z-10">
              <MatchScoreTeaser beachId={id} beachName={name} />
            </div>
          ) : null}

          {/* Favorite Button - top-right, opposite corner from PersonalizedBadge */}
          {id && (
            <div className="absolute top-2 right-2 z-10">
              <FavoriteButton
                beachId={id}
                beachName={name}
                variant="ghost"
                size="sm"
                className="text-white drop-shadow-md hover:text-white"
              />
            </div>
          )}

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

          {/* Session CTA - subtle link to encourage session logging */}
          {user ? (
            <Link
              href={`/sessions/new?beach=${id}`}
              className="block mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline text-center"
            >
              Log a session here
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setSessionAuthModalOpen(true)}
              className="block w-full mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline text-center cursor-pointer"
            >
              Log a session here
            </button>
          )}

          {/* Auth modal for session CTA (guests only) */}
          {!user && sessionAuthModalOpen && (
            <UnifiedAuthModal
              isOpen={sessionAuthModalOpen}
              onClose={() => setSessionAuthModalOpen(false)}
              mode="signup"
              source="session-log-cta"
              returnTo={pathname}
              contextMessage={{
                title: "Track Your Sessions",
                description: `Track your sessions at ${name} and get personalized recommendations`,
              }}
            />
          )}

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

/**
 * Custom comparison function for BeachCard memoization
 * Only re-renders when critical props change
 *
 * Props NOT compared (stable via parent's useCallback):
 * - onViewDetails, onMapClick, onReviewsClick (expected to be stable)
 */
const areBeachCardPropsEqual = (
  prev: BeachCardProps,
  next: BeachCardProps
): boolean => {
  // Core beach identity
  if (prev.id !== next.id) return false;
  if (prev.name !== next.name) return false;
  if (prev.slug !== next.slug) return false;

  // Visual/display props
  if (prev.distance !== next.distance) return false;
  if (prev.rating !== next.rating) return false;
  if (prev.reviewCount !== next.reviewCount) return false;
  if (prev.imageUrl !== next.imageUrl) return false;

  // Location (for map)
  if (prev.latitude !== next.latitude) return false;
  if (prev.longitude !== next.longitude) return false;

  // Feature flags
  if (prev.showForecastPreview !== next.showForecastPreview) return false;

  // Personalization data
  if (prev.personalized !== next.personalized) return false;
  if (prev.personalizedScore !== next.personalizedScore) return false;
  if (prev.baseScore !== next.baseScore) return false;

  // Score breakdown - compare deeply
  if (prev.scoreBreakdown && next.scoreBreakdown) {
    if (
      prev.scoreBreakdown.base !== next.scoreBreakdown.base ||
      prev.scoreBreakdown.onboardingPrefs !== next.scoreBreakdown.onboardingPrefs ||
      prev.scoreBreakdown.learnedPrefs !== next.scoreBreakdown.learnedPrefs ||
      prev.scoreBreakdown.affinity !== next.scoreBreakdown.affinity
    ) {
      return false;
    }
  } else if (prev.scoreBreakdown !== next.scoreBreakdown) {
    // One is defined, the other isn't
    return false;
  }

  // Affinity data - compare deeply
  if (prev.affinityData && next.affinityData) {
    if (
      prev.affinityData.sessionCount !== next.affinityData.sessionCount ||
      prev.affinityData.lastSurfed !== next.affinityData.lastSurfed
    ) {
      return false;
    }
  } else if (prev.affinityData !== next.affinityData) {
    // One is defined, the other isn't
    return false;
  }

  // All checks passed - props are equal
  return true;
};

// Export memoized component for performance optimization
// Uses custom comparison to handle complex object props correctly
export const BeachCard = memo(BeachCardComponent, areBeachCardPropsEqual);
BeachCard.displayName = 'BeachCard';
