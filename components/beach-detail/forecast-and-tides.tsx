"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { TideChart } from "@/components/forecast/tide-chart-recharts";
import {
  SimplifiedForecastTable,
  MultiDayForecastTable,
} from "@/components/forecast/forecast-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Globe2, Sun, Waves, Wind } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { track, slugify } from "@/lib/analytics";
import { BestSurfWindow } from "./best-surf-window";

interface ForecastAndTidesProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[] | null;
}

export function ForecastAndTides({ beach, forecasts }: ForecastAndTidesProps) {
  // Ensure forecasts is always a stable array reference
  const safeForecasts = useMemo(() => forecasts || [], [forecasts]);
  // Default to showing the 5-day tide chart
  const [subTab, setSubTab] = useState<"today" | "tides" | "conditions">(
    "tides"
  );

  const tabOptions: {
    value: typeof subTab;
    label: string;
    icon: LucideIcon;
  }[] = [
    { value: "today", label: "Today", icon: Sun },
    { value: "tides", label: "Tides", icon: Waves },
    { value: "conditions", label: "Conditions", icon: Globe2 },
  ];

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

      {/* Sub-tabs for Forecast section */}
      {safeForecasts.length > 0 && (
        <Tabs
          value={subTab}
          onValueChange={(v) => setSubTab(v as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 gap-2 rounded-full bg-blue-100/60 p-1">
            {tabOptions.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                onClick={() =>
                  track("forecast_tab_click", {
                    beach_slug: slugify(beach.name),
                    tab: value,
                  })
                }
                className="flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-ocean-blue data-[state=active]:shadow-md"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="today" className="mt-4">
            {/* Best Surf Window Intel */}
            <BestSurfWindow beachId={beach.id} beachName={beach.name} />

            {/* Collapsible Detailed Forecast Table */}
            <Collapsible className="mt-4">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between rounded-2xl hover:bg-blue-50/50"
                >
                  <span className="text-sm font-medium">
                    View Detailed Forecast
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg mt-2">
                  <CardContent className="p-6">
                    <SimplifiedForecastTable forecasts={todaysForecasts} />
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="tides" className="mt-4">
            <Card className="rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg">
              <CardContent className="p-6">
                <TideChart forecasts={safeForecasts} now={new Date()} compact />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conditions" className="mt-4">
            <Card className="rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg">
              <CardContent className="p-6">
                {/* Combined view: table already includes swell + wind */}
                <SimplifiedForecastTable forecasts={safeForecasts} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
