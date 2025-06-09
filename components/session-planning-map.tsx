"use client";

import { useState } from "react";
import { InteractiveMap } from "@/components/map/interactive-map";
import { BuoyConditions } from "@/components/buoy-conditions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Waves } from "lucide-react";
import type { Beach } from "@/types/database";

interface SessionPlanningMapProps {
  onLocationSelect?: (beach: Beach, conditions: any) => void;
}

export function SessionPlanningMap({
  onLocationSelect,
}: SessionPlanningMapProps) {
  const [selectedLocation, setSelectedLocation] = useState<Beach | null>(null);
  const [currentConditions, setCurrentConditions] = useState<any>(null);
  const [isPlanning, setIsPlanning] = useState(false);

  const handleLocationClick = (beach: Beach) => {
    setSelectedLocation(beach);
    setIsPlanning(true);
  };

  const handleConditionsUpdate = (conditions: any) => {
    setCurrentConditions(conditions);
  };

  const getWaveQuality = (conditions: any) => {
    if (!conditions?.wave_height) return null;

    const height = conditions.wave_height;
    if (height < 2) return { label: "Small", color: "bg-yellow-500" };
    if (height < 4) return { label: "Good", color: "bg-green-500" };
    if (height < 6) return { label: "Great", color: "bg-blue-500" };
    return { label: "Epic", color: "bg-purple-500" };
  };

  const handlePlanSession = () => {
    if (selectedLocation && currentConditions && onLocationSelect) {
      onLocationSelect(selectedLocation, currentConditions);
    }
  };

  const quality = getWaveQuality(currentConditions);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      {/* Map Section */}
      <div className="flex-1 min-h-[400px] lg:min-h-full">
        <InteractiveMap
          onLocationClick={handleLocationClick}
          onBuoyConditions={handleConditionsUpdate}
          className="h-full w-full rounded-lg overflow-hidden border"
        />
      </div>

      {/* Planning Panel */}
      <div className="w-full lg:w-96 space-y-4">
        {/* Location Info */}
        {selectedLocation && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {selectedLocation.name}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {selectedLocation.location || "San Diego County"}
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  {new Date().toLocaleDateString()}
                </span>
                <Clock className="h-4 w-4 text-gray-500 ml-2" />
                <span className="text-sm">
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {quality && (
                <div className="flex items-center gap-2 mb-3">
                  <Waves className="h-4 w-4" />
                  <Badge className={`${quality.color} text-white`}>
                    {quality.label} Conditions
                  </Badge>
                </div>
              )}

              <Button
                onClick={handlePlanSession}
                disabled={!currentConditions}
                className="w-full"
                size="sm"
              >
                Plan Session Here
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Current Conditions */}
        {currentConditions ? (
          <BuoyConditions conditions={currentConditions} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-gray-500">
                <Waves className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Click on a beach or buoy</p>
                <p className="text-xs">to see current conditions</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Planning Tips */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Session Planning Tips</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="text-sm space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Check wind direction vs. wave direction
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Best waves 2-3 hours before/after tide changes
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                Water temp helps choose wetsuit thickness
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
