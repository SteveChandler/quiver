"use client";

import { Navigation, Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/favorite-button";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";
import type { Beach } from "@/types/database";

interface BeachActionsProps {
  beach: Beach;
  onPlanSession?: () => void;
  onLogSession?: () => void;
  className?: string;
  onGetDirections?: () => void;
  canGetDirections?: boolean;
}

export function BeachActions({
  beach,
  onPlanSession,
  onLogSession,
  className,
  onGetDirections,
  canGetDirections,
}: BeachActionsProps) {
  const hasCoordinates = Boolean(beach.latitude && beach.longitude);
  const directionsEnabled = canGetDirections ?? hasCoordinates;

  const handleDirectionsClick = () => {
    if (onGetDirections) {
      onGetDirections();
      return;
    }
    if (!hasCoordinates) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${beach.latitude},${beach.longitude}`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Primary Action Buttons - Phase 3 Spec Compliance */}
      {/* Grid: 2 cols mobile and up | Gap: 12px | Margin: 20px 0 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
        {/* Log Session - Primary Action */}
        {/* Spec: 48px height, #0077B6 bg, white text, 8px radius, 16px font, 600 weight, 0 24px padding, #006699 hover */}
        <Button
          variant="default"
          onClick={onLogSession}
          className="h-12 px-6 text-base font-semibold rounded-md bg-ocean-blue hover:bg-ocean-blue-dark active:scale-[0.98] transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Log Session
        </Button>

        {/* Plan Session - Primary Action */}
        {/* Spec: 48px height, #0077B6 bg, white text, 8px radius, 16px font, 600 weight, 0 24px padding, #006699 hover */}
        <Button
          variant="default"
          onClick={onPlanSession}
          className="h-12 px-6 text-base font-semibold rounded-md bg-ocean-blue hover:bg-ocean-blue-dark active:scale-[0.98] transition-all sm:col-span-2"
        >
          <BookOpen className="h-5 w-5 mr-2" />
          Plan Session
        </Button>
      </div>

      {/* Mobile-only Directions, Favorite & Home Beach Row */}
      <div className="flex flex-wrap items-center gap-3 md:hidden">
        <Button
          variant="outline"
          onClick={handleDirectionsClick}
          disabled={!directionsEnabled}
          className="h-10 px-4 text-sm font-medium rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all"
        >
          <Navigation className="mr-2 h-4 w-4" />
          Get directions
        </Button>
        <FavoriteButton
          beachId={beach.id}
          variant="outline"
          size="sm"
        />
        <HomeBeachBanner
          selectedBeachId={beach.id}
          selectedBeachName={beach.name}
        />
      </div>

      {/* Desktop Home Beach Banner */}
      <div className="hidden md:block">
        <HomeBeachBanner
          selectedBeachId={beach.id}
          selectedBeachName={beach.name}
        />
      </div>
    </div>
  );
}
