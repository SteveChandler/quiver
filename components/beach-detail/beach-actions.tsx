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
      {/* Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Get Directions - Secondary Action */}
        <Button
          variant="outline"
          size="lg"
          onClick={handleGetDirections}
          disabled={!beach.latitude || !beach.longitude}
          className="flex-1 sm:flex-none"
        >
          <Navigation className="h-4 w-4 mr-2" />
          Get directions
        </Button>

        {/* Session Planning - Primary Action (Blue) */}
        <div className="flex gap-2 flex-1">
          <Button
            variant="default"
            size="lg"
            onClick={onLogSession}
            className="flex-1 bg-ocean-blue hover:bg-ocean-blue/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Log Session
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={onPlanSession}
            className="flex-1 bg-ocean-blue hover:bg-ocean-blue/90"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Plan Session
          </Button>
        </div>
      </div>

      {/* Secondary Actions: Favorite & Home Beach */}
      <div className="flex flex-wrap items-center gap-3">
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
    </div>
  );
}
