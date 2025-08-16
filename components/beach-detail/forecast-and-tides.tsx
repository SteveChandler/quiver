"use client";

import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BeachesEnhancedForecast } from "@/components/beaches-enhanced-forecast";
import { TideChart } from "@/components/forecast/tide-chart-recharts";
import {
  MultiDayForecastTable,
  SimplifiedForecastTable,
} from "@/components/forecast/forecast-table";
import { Sun, Clock, Waves, Wind } from "lucide-react";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getMarineForecastRange, getTideForecastRange } from "@/lib/surf/data";
import { topWindowsInRange, windowBlurbDetailed } from "@/lib/surf/windows";
import type { BeachMeta } from "@/lib/surf/scoring";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { fetchBestTimesApi, fetchBestTimes } from "@/lib/bestTimes";

interface ForecastAndTidesProps {
  beach: Beach;
  forecasts: EnhancedForecastEntity[] | null;
}

function formatTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) =>
    d
      .toLocaleTimeString(undefined, { hour: "numeric", hour12: true })
      .replace(":00", "");
  return `${fmt(start)}–${fmt(end)}`;
}

type WindowWithWhy = {
  label: string;
  score: number;
  why?: {
    ts_utc: string;
    wind: number; // 0..1
    tide: number; // 0..1
    swell: number; // 0..1
    period: number; // 0..1
    height: number; // 0..1
  } | null;
};

function FactorBars({ why }: { why: NonNullable<WindowWithWhy["why"]> }) {
  const rows = [
    { name: "Wind", v: why.wind },
    { name: "Tide", v: why.tide },
    { name: "Swell", v: why.swell },
    { name: "Period", v: why.period },
    { name: "Height", v: why.height },
  ];
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 text-muted-foreground">{r.name}</span>
          <div className="h-1.5 w-28 bg-muted rounded">
            <div
              className="h-1.5 bg-primary rounded"
              style={{ width: `${Math.max(0, Math.min(1, r.v)) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ForecastAndTides({ beach, forecasts }: ForecastAndTidesProps) {
  // Ensure forecasts is always an array
  const safeForecasts = forecasts || [];
  
  const today = useMemo(() => {
    if (safeForecasts.length === 0) {
      return new Date().toISOString().slice(0, 10);
    }
    const forecastDate = safeForecasts[0]?.forecast_date;
    if (!forecastDate) {
      return new Date().toISOString().slice(0, 10);
    }
    return forecastDate;
  }, [safeForecasts]);

  const fetchBest = useCallback(async () => {
    const supabase = createClient();

    // Helper to fetch the highest-scored hour breakdown inside a window
    const fetchWhy = async (startIso: string, endIso: string) => {
      const { data, error } = await (supabase as any)
        .from("v_beach_hourly_scores")
        .select(
          "ts_utc, wind_score, tide_score, swell_dir_score, period_score, height_score, score_0_100"
        )
        .eq("beach_id", beach.id)
        .gte("ts_utc", startIso)
        .lt("ts_utc", endIso)
        .order("score_0_100", { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) return null;
      const r = data[0] as any;
      return {
        ts_utc: r.ts_utc as string,
        wind: Number(r.wind_score ?? 0),
        tide: Number(r.tide_score ?? 0),
        swell: Number(r.swell_dir_score ?? 0),
        period: Number(r.period_score ?? 0),
        height: Number(r.height_score ?? 0),
      };
    };

    // Primary: use API (edge cached, prefers materialized view). Fallback to RPC if needed.
    try {
      const api = await fetchBestTimesApi(beach.id, 48, 6);
      if (api.windows && api.windows.length > 0) {
        return api.windows.map((w: any) => ({
          label: `${formatTimeRange(w.start_ts, w.end_ts)} — ${w.grade} (${
            w.score
          })${(w as any).advanced_only ? " · Advanced only" : ""}`,
          score: w.score,
        }));
      }
    } catch (e) {
      console.warn("BestTimes API failed, falling back to RPC/view", e);
    }

    const primary = await fetchBestTimes(supabase as any, beach.id, 48, 6);
    if (primary.data && primary.data.length > 0) {
      const enriched = await Promise.all(
        primary.data.map(async (w) => {
          const why = await fetchWhy(w.start_ts, w.end_ts);
          return {
            label: `${formatTimeRange(w.start_ts, w.end_ts)} — ${w.label}`,
            score: w.score,
            why,
          } as WindowWithWhy;
        })
      );
      return enriched;
    }

    // Fallback: compute top three windows from view for the rest of TODAY, daylight only
    const start = new Date();
    const startDate = start.toISOString().slice(0, 10);
    const endOfDay = new Date(start);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch today's sunrise/sunset (UTC) from API to filter daylight
    let sunriseUtc: string | null = null;
    let sunsetUtc: string | null = null;
    try {
      const params = new URLSearchParams({
        beachId: beach.id,
        start: `${startDate}T00:00:00.000Z`,
        end: `${startDate}T23:59:59.999Z`,
      });
      const res = await fetch(`/api/forecasts/window?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      const sun = (json?.data?.sun || [])[0];
      sunriseUtc = sun?.sunrise_utc || null;
      sunsetUtc = sun?.sunset_utc || null;
    } catch {}

    const dayStart = sunriseUtc
      ? new Date(sunriseUtc)
      : new Date(startDate + "T06:00:00.000Z");
    const dayEnd = sunsetUtc
      ? new Date(sunsetUtc)
      : new Date(startDate + "T20:00:00.000Z");
    const { data: rows } = await (supabase as any)
      .from("v_beach_hourly_scores")
      .select("ts_utc,score_0_100")
      .eq("beach_id", beach.id)
      .gte("ts_utc", dayStart.toISOString())
      .lte("ts_utc", dayEnd.toISOString())
      .order("ts_utc", { ascending: true });

    if (!rows || rows.length === 0) return [] as WindowWithWhy[];

    // Build rolling 2h windows (ts plus following hour) across daylight and take top 3 unconditionally
    const byTs: Record<string, number> = Object.fromEntries(
      rows.map((r: any) => [r.ts_utc, r.score_0_100])
    );
    const tsList = rows
      .map((r: any) => new Date(r.ts_utc))
      .sort((a, b) => +a - +b);
    const windows: Array<{ start: Date; end: Date; score: number }> = [];

    for (let i = 0; i < tsList.length; i++) {
      const t1 = tsList[i];
      const t2 = new Date(t1.getTime() + 60 * 60 * 1000);
      const s1 = byTs[t1.toISOString()] ?? null;
      const s2 = byTs[t2.toISOString()] ?? null;
      if (s1 == null || s2 == null) continue;
      windows.push({
        start: t1,
        end: new Date(t1.getTime() + 2 * 60 * 60 * 1000),
        score: Math.round((s1 + s2) / 2),
      });
    }

    windows.sort((a, b) => b.score - a.score || +a.start - +b.start);
    const top3 = windows.slice(0, 3);

    const enrichedFallback: WindowWithWhy[] = [];
    for (const w of top3) {
      const why = await fetchWhy(w.start.toISOString(), w.end.toISOString());
      enrichedFallback.push({
        label: `${formatTimeRange(
          w.start.toISOString(),
          w.end.toISOString()
        )} — ${w.score} score`,
        score: w.score,
        why,
      });
    }

    return enrichedFallback;
  }, [beach.id]);

  const { data: bestWindows, loading: bestLoading } = useDataFetcher(
    fetchBest,
    {
      immediate: true,
      initialData: [] as WindowWithWhy[],
    }
  );

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
            <div className="text-sm text-muted-foreground">
              No recommendations yet
            </div>
          ) : (
            <div className="space-y-2">
              {!hasStandout && (
                <div className="text-sm text-muted-foreground">
                  No standout windows
                </div>
              )}
              <TooltipProvider>
                <div className="flex flex-wrap gap-2">
                  {(hasStandout
                    ? (bestWindows as WindowWithWhy[]).slice(0, 4)
                    : (bestWindows as WindowWithWhy[]).slice(0, 3)
                  ).map((t, i) => (
                    <Tooltip key={`${t.label}-${t.score}-${i}`}>
                      <TooltipTrigger asChild>
                        <div className="px-3 py-1 rounded-full border text-sm cursor-default">
                          {t.label}
                        </div>
                      </TooltipTrigger>
                      {t.why && (
                        <TooltipContent side="top">
                          <div className="mb-1 text-xs text-muted-foreground">
                            Why (peak hour:{" "}
                            {t.why.ts_utc ? new Date(t.why.ts_utc)
                              .toLocaleTimeString(undefined, {
                                hour: "numeric",
                                hour12: true,
                              })
                              .replace(":00", "") : "N/A"}
                            ):
                          </div>
                          <FactorBars why={t.why} />
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tide Chart */}
      {safeForecasts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <TideChart forecasts={safeForecasts} />
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

      {/* Also show simplified table plus a collapsed multi-day table */}
      {safeForecasts.length > 0 && (
        <div className="space-y-4">
          <SimplifiedForecastTable forecasts={safeForecasts} />

          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Show detailed multi-day forecast table
            </summary>
            <div className="mt-3">
              <MultiDayForecastTable forecasts={safeForecasts} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
