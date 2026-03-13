"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";

// Lazy load TideChart since it uses recharts (heavy library)
const TideChart = dynamic(
  () =>
    import("@/components/forecast/tide-chart-recharts").then((m) => m.TideChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
    ),
  }
);
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
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { BestSurfWindow } from "./best-surf-window";
import { PublicContentGate } from "@/components/ui/public-content-gate";
import { resolveBeachTimezone, getLocalDateString } from "@/lib/utils/timezone-utils";
import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";

interface ForecastAndTidesProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[] | null;
  beachTimezone?: string | null;
  surfCall?: SurfCallResult | null;
}

export function ForecastAndTides({
  beach,
  forecasts,
  beachTimezone,
  surfCall,
}: ForecastAndTidesProps) {
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
    return getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone));
  }, [beachTimezone]);

  const todaysForecasts = useMemo(
    () => {
      const tz = resolveBeachTimezone(beachTimezone);
      return safeForecasts.filter((f) => extractForecastDate(f.forecast_at, tz) === todayStr);
    },
    [safeForecasts, todayStr, beachTimezone]
  );

  // No need to transform - TideChart accepts forecasts directly

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
            <PublicContentGate
              ctaTitle={`See today's surf call for ${beach.name}`}
              ctaDescription="Sign up to get personalized surf calls and best time to paddle out"
              source="surf-call-conditions"
            >
              <BestSurfWindow
                beachId={beach.id}
                beachName={beach.name}
                beachTimezone={beachTimezone}
                forecasts={todaysForecasts}
                surfCall={surfCall}
              />
            </PublicContentGate>

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
                    <SimplifiedForecastTable forecasts={todaysForecasts} beachTimezone={beachTimezone} />
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="tides" className="mt-4">
            <TideChart forecasts={safeForecasts} compact now={new Date()} />
          </TabsContent>

          <TabsContent value="conditions" className="mt-4">
            <Card className="rounded-3xl border border-blue-100/60 bg-white/95 shadow-lg">
              <CardContent className="p-6">
                {/* Combined view: table already includes swell + wind */}
                <SimplifiedForecastTable forecasts={safeForecasts} beachTimezone={beachTimezone} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
