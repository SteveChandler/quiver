"use client";

import { useState } from "react";
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
}

export function BeachActions({
  beach,
  onPlanSession,
  onLogSession,
  className,
}: BeachActionsProps) {
  const handleGetDirections = () => {
    if (beach.latitude && beach.longitude) {
      // Open Google Maps with coordinates
      const url = `https://www.google.com/maps/dir/?api=1&destination=${beach.latitude},${beach.longitude}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Primary Action Buttons - Phase 3 Spec Compliance */}
      {/* Grid: 4 cols desktop, 2 cols mobile | Gap: 12px | Margin: 20px 0 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
        {/* Get Directions - Secondary Action */}
        {/* Spec: 48px height, white bg, gray-700 text, 1px gray-300 border, 8px radius, 16px font, 500 weight, 0 20px padding */}
        <Button
          variant="outline"
          onClick={handleGetDirections}
          disabled={!beach.latitude || !beach.longitude}
          className="h-12 px-5 text-base font-medium rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all"
        >
          <Navigation className="h-5 w-5 mr-2" />
          Get directions
        </Button>

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
          className="h-12 px-6 text-base font-semibold rounded-md bg-ocean-blue hover:bg-ocean-blue-dark active:scale-[0.98] transition-all col-span-2 md:col-span-1"
        >
          <BookOpen className="h-5 w-5 mr-2" />
          Plan Session
        </Button>

        {/* Favorite Button - Secondary Action */}
        <FavoriteButton
          beachId={beach.id}
          variant="outline"
          className="h-12 text-base font-medium rounded-md hover:bg-gray-50 active:scale-[0.98] transition-all hidden md:block"
        />
      </div>

      {/* Mobile-only Favorite & Home Beach Row */}
      <div className="flex flex-wrap items-center gap-3 md:hidden">
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
