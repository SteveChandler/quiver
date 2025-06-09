"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Waves, MapIcon } from "lucide-react";
import Link from "next/link";
import { BuoyCard } from "@/components/buoy";
import { BuoyConditionsSkeleton } from "@/components/skeletons/buoy-conditions-skeleton";

// San Diego Ocean Beach coordinates as default
const DEFAULT_LAT = 32.7503;
const DEFAULT_LNG = -117.2534;

interface QuickConditions {
  water_temperature?: number;
  air_temperature?: number;
  wind_speed?: number;
  wind_direction_name?: string;
  wind_gust?: number;
  wave_height?: number;
  wave_period?: number;
  pressure?: number;
  updated_at?: number;
}

export function HomeConditionsWidget() {
  const [conditions, setConditions] = useState<QuickConditions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuickConditions();
  }, []);

  const fetchQuickConditions = async () => {
    try {
      const response = await fetch(
        `/api/buoys/conditions?latitude=${DEFAULT_LAT}&longitude=${DEFAULT_LNG}`,
        { headers: { Accept: "application/json" } }
      );

      if (response.ok) {
        const buoy = await response.json();
        setConditions({
          water_temperature: buoy.measurements?.water_temperature,
          air_temperature: buoy.measurements?.air_temperature,
          wind_speed: buoy.measurements?.wind_speed,
          wind_direction_name: buoy.measurements?.wind_direction_name,
          wind_gust: buoy.measurements?.wind_gust,
          wave_height: buoy.measurements?.wave_height,
          wave_period: buoy.measurements?.wave_period,
          pressure: buoy.measurements?.pressure,
          updated_at: buoy.measurements?.updated_at,
        });
      }
    } catch (error) {
      console.error("Error fetching conditions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <BuoyConditionsSkeleton />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5" />
            Current Conditions
          </div>
          <span className="text-sm text-gray-500 font-normal">Ocean Beach</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {conditions ? (
          <div className="space-y-3">
            <BuoyCard
              buoyName="Ocean Beach Conditions"
              conditions={conditions}
              variant="compact"
              showLocation={false}
              showStatus={true}
            />

            {/* View Map Link */}
            <div className="pt-2 border-t">
              <Link href="/map">
                <Button variant="outline" size="sm" className="w-full">
                  <MapIcon className="h-4 w-4 mr-2" />
                  View Interactive Map
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">Conditions unavailable</p>
            <Link href="/map">
              <Button variant="outline" size="sm" className="mt-2">
                <MapIcon className="h-4 w-4 mr-2" />
                View Map
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
