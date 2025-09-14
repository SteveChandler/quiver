"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { TideChart } from "@/components/forecast/tide-chart-recharts";
import { SimplifiedForecastTable, MultiDayForecastTable } from "@/components/forecast/forecast-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sun, Waves, Wind } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { CoachCard } from "@/components/recommendations/coach-card";
import { track, slugify } from "@/lib/analytics";

interface ForecastAndTidesProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[] | null;
}

export function ForecastAndTides({ beach, forecasts }: ForecastAndTidesProps) {
  // Ensure forecasts is always an array
  const safeForecasts = forecasts || [];
  const [subTab, setSubTab] = useState<"today" | "tides" | "wind" | "swell" | "week">("today");

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const todaysForecasts = useMemo(
    () => safeForecasts.filter((f) => f.forecast_date === todayStr),
    [safeForecasts, todayStr]
  );

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
          className="w-full"
        />
      </div>

      {/* Sub-tabs for Forecast section */}
      {safeForecasts.length > 0 && (
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            {(["today", "tides", "wind", "swell", "week"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                onClick={() =>
                  track("forecast_tab_click", {
                    beach_slug: slugify(beach.name),
                    tab,
                  })
                }
              >
                {tab === "today" && "Today"}
                {tab === "tides" && "Tides"}
                {tab === "wind" && "Wind"}
                {tab === "swell" && "Swell"}
                {tab === "week" && "Week"}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="today" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <SimplifiedForecastTable forecasts={todaysForecasts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tides" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <TideChart forecasts={safeForecasts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wind" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {/* For now, reuse simplified table; wind column is included */}
                <SimplifiedForecastTable forecasts={safeForecasts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="swell" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {/* For now, reuse simplified table; swell columns are included */}
                <SimplifiedForecastTable forecasts={safeForecasts} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="week" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <MultiDayForecastTable forecasts={safeForecasts} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
