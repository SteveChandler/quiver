"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { TideChart } from "@/components/forecast/tide-chart-recharts";
import { SimplifiedForecastTable } from "@/components/forecast/forecast-table";
import { Sun, Waves, Wind } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { CoachCard } from "@/components/recommendations/coach-card";

interface ForecastAndTidesProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[] | null;
}

export function ForecastAndTides({ beach, forecasts }: ForecastAndTidesProps) {
  // Ensure forecasts is always an array
  const safeForecasts = forecasts || [];

  // Early return if no beach data
  if (!beach || !beach.id) {
    return (
      <div className="text-sm text-muted-foreground">
        Beach data unavailable
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview chips */}
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
          <Sun className="h-4 w-4" /> Sunrise/Sunset shown in charts
        </div>
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
          <Waves className="h-4 w-4" /> Tide chart included
        </div>
        <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded">
          <Wind className="h-4 w-4" /> Wind in forecast table
        </div>
      </div>

      {/* Coach Pick (replaces Best Times) */}
      <div>
        <CoachCard
          beachId={beach.id as string}
          lat={(beach as any).latitude as number}
          lon={(beach as any).longitude as number}
          className="max-w-2xl"
        />
      </div>

      {/* Tide Chart */}
      {safeForecasts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <TideChart forecasts={safeForecasts} />
          </CardContent>
        </Card>
      )}

      {/* Simplified forecast table (kept); detailed multi-day table removed */}
      {safeForecasts.length > 0 && (
        <div className="space-y-4">
          <SimplifiedForecastTable forecasts={safeForecasts} />
        </div>
      )}
    </div>
  );
}
