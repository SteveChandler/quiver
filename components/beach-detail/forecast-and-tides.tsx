"use client";

import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { TideChart } from "@/components/forecast/tide-chart-recharts";
import { Sun, Clock, Waves, Wind } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { fetchBestTimes } from "@/lib/bestTimes";
import { createClient } from "@/lib/supabase/client";

interface ForecastAndTidesProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", hour12: true }).replace(":00", "");
  return `${fmt(start)}–${fmt(end)}`;
}

export function ForecastAndTides({ beach, forecasts }: ForecastAndTidesProps) {
  const today = useMemo(() => {
    return (
      forecasts?.[0]?.forecast_date || new Date().toISOString().slice(0, 10)
    );
  }, [forecasts]);

  const fetchBest = useCallback(async () => {
    const supabase = createClient();
    // Primary: standout windows (RPC already filters >=55)
    const primary = await fetchBestTimes(supabase as any, beach.id, 48, 6);
    if (primary.data && primary.data.length > 0) {
      return primary.data.map((w) => ({
        label: `${formatTimeRange(w.start_ts, w.end_ts)} — ${w.label}`,
        score: w.score,
      }));
    }

    // Fallback: compute next three windows from view when no standout windows
    const start = new Date();
    const end = new Date(Date.now() + 12 * 3600 * 1000); // next 12h
    const { data: rows } = await (supabase as any)
      .from("v_beach_hourly_scores")
      .select("ts_utc,score_0_100")
      .eq("beach_id", beach.id)
      .gte("ts_utc", start.toISOString())
      .lte("ts_utc", end.toISOString())
      .order("ts_utc", { ascending: true });

    if (!rows || rows.length === 0) return [];

    // Build rolling 2h windows (ts plus following hour) and take top 3
    const byTs: Record<string, number> = Object.fromEntries(
      rows.map((r: any) => [r.ts_utc, r.score_0_100])
    );
    const tsList = rows.map((r: any) => new Date(r.ts_utc)).sort((a, b) => +a - +b);
    const windows: Array<{ start: Date; end: Date; score: number }> = [];

    for (let i = 0; i < tsList.length; i++) {
      const t1 = tsList[i];
      const t2 = new Date(t1.getTime() + 60 * 60 * 1000);
      const s1 = byTs[t1.toISOString()] ?? null;
      const s2 = byTs[t2.toISOString()] ?? null;
      if (s1 == null || s2 == null) continue;
      windows.push({ start: t1, end: new Date(t1.getTime() + 2 * 60 * 60 * 1000), score: Math.round((s1 + s2) / 2) });
    }

    windows.sort((a, b) => b.score - a.score || +a.start - +b.start);
    const top3 = windows.slice(0, 3);

    return top3.map((w) => ({
      label: `${formatTimeRange(w.start.toISOString(), w.end.toISOString())} — ${w.score >= 85 ? "epic" : w.score >= 70 ? "good" : w.score >= 55 ? "fair" : "poor"} (${w.score})`,
      score: w.score,
    }));
  }, [beach.id, today]);

  const { data: bestWindows, loading } = useDataFetcher(fetchBest, {
    immediate: true,
  });

  const hasStandout = (bestWindows || []).some((w: any) => w.score >= 55);

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Best Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!bestWindows || bestWindows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recommendations yet</div>
          ) : (
            <div className="space-y-2">
              {!hasStandout && (
                <div className="text-sm text-muted-foreground">No standout windows</div>
              )}
              <div className="flex flex-wrap gap-2">
                {(hasStandout ? bestWindows.slice(0, 4) : bestWindows.slice(0, 3)).map(
                  (t: any, i: number) => (
                    <div key={i} className="px-3 py-1 rounded-full border text-sm">
                      {t.label}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tide Chart */}
      {forecasts && forecasts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <TideChart forecasts={forecasts} />
          </CardContent>
        </Card>
      )}

      {/* Forecast table/summary */}
      <BeachesEnhancedForecast
        beachId={beach.id}
        beachName={beach.name}
        showHeader={false}
        showTransparency={true}
        showQualitySummary={true}
        allowToggleTransparency={true}
        highlightQualityVariations={true}
      />
    </div>
  );
}
