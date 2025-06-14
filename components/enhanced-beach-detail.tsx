"use client";

import { useState, useEffect } from "react";
import { BeachDetailView } from "@/components/beach-detail-view";
import { BuoyConditions } from "@/components/buoy-conditions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves } from "lucide-react";

interface BuoyConditionsData {
  water_temperature?: number;
  air_temperature?: number;
  wind_speed?: number;
  wind_direction?: number;
  wind_direction_name?: string;
  wind_gust?: number;
  wave_height?: number;
  wave_period?: number;
  tides?: Array<{
    time: number;
    height: number;
    name: string;
  }>;
}

interface EnhancedBeachDetailProps {
  id: string;
  beachData?: {
    name: string;
    latitude: number;
    longitude: number;
    location?: string;
  };
}

export function EnhancedBeachDetail({
  id,
  beachData,
}: EnhancedBeachDetailProps) {
  const [conditions, setConditions] = useState<BuoyConditionsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch buoy conditions for this specific beach
  useEffect(() => {
    if (beachData?.latitude && beachData?.longitude) {
      fetchLocalConditions(beachData.latitude, beachData.longitude);
    }
  }, [beachData]);

  const fetchLocalConditions = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/buoys/conditions?latitude=${latitude}&longitude=${longitude}`,
        { headers: { Accept: "application/json" } }
      );

      if (response.ok) {
        const buoy = await response.json();
        setConditions({
          water_temperature: buoy.measurements?.water_temperature,
          air_temperature: buoy.measurements?.air_temperature,
          wind_speed: buoy.measurements?.wind_speed,
          wind_direction: buoy.measurements?.wind_direction,
          wind_direction_name: buoy.measurements?.wind_direction_name,
          wind_gust: buoy.measurements?.wind_gust,
          wave_height: buoy.measurements?.wave_height,
          wave_period: buoy.measurements?.wave_period,
          tides: buoy.measurements?.tides || [],
        });
      }
    } catch (error) {
      console.error("Error fetching local conditions:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Original Beach Detail */}
      <BeachDetailView id={id} />

      {/* Local Marine Conditions */}
      <div className="px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="h-5 w-5" />
              Local Marine Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600">
                  Loading conditions...
                </span>
              </div>
            ) : conditions ? (
              <BuoyConditions conditions={conditions} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">
                  No buoy data available for this location
                </p>
                <p className="text-xs mt-1">
                  Try the map view for nearby conditions
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
