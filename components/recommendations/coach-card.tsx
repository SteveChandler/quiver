"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Recommendation = {
  spotId: string;
  name: string;
  distance_km: number | null;
  score: number;
  reasons: string[];
  rank?: number;
  isTopPick?: boolean;
  wave?: {
    ht_ft: number | null;
    period_s: number | null;
  };
  wind?: {
    dir_deg: number | null;
    kts: number | null;
  };
  tide?: {
    height_ft: number | null;
    status: string | null;
  };
};

export function CoachCard({
  beachId,
  lat,
  lon,
  regionId,
  timeIso,
  title = "Coach Pick",
  className,
  initialResponse,
}: {
  beachId?: string;
  lat: number;
  lon: number;
  regionId?: string;
  timeIso?: string;
  title?: string;
  className?: string;
  initialResponse?: {
    top_picks?: Recommendation[];
    recommendations?: Recommendation[];
  };
}) {
  // Require valid beach context; avoid any leaked global state or fallbacks
  const hasValidContext = Boolean(
    beachId && Number.isFinite(lat) && Number.isFinite(lon)
  );
  if (!hasValidContext) return null;
  const [showExplanation, setShowExplanation] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<{
    [key: string]: boolean;
  }>({});

  const fetchRecs = useCallback(async () => {
    const uniqueBySpot = (items: Recommendation[]) => {
      const seen = new Set<string>();
      return items.filter((p) => {
        const key = p.spotId || p.name;
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    // Try beach-scoped picks first
    try {
      const res = await fetch(
        `/api/coach-picks?beachId=${encodeURIComponent(beachId!)}&radiusKm=30`
      );
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const picks = (json?.data?.picks || json?.picks || []).map(
          (row: any) => ({
            spotId: row.beach_id,
            name: row.name,
            distance_km: row.distance_km ?? null,
            score: row.score ?? 0,
            reasons: [],
            rank: row.pick_rank,
          })
        ) as Recommendation[];
        // Enforce strict distance filter: only numeric distances within 30 km
        const filtered = picks.filter(
          (p) => typeof p.distance_km === "number" && p.distance_km <= 30
        );
        const deduped = uniqueBySpot(filtered);
        if (filtered.length > 0) {
          return { top_picks: deduped.slice(0, 3), recommendations: deduped };
        }
      }
    } catch (e) {
      // swallow and fall back
    }

    // Fallback: general recommendations by lat/lon
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
    });
    const res2 = await fetch(`/api/v1/recommendations?${params.toString()}`);
    const json2 = await res2.json().catch(() => ({}));
    if (!res2.ok) {
      const message =
        json2?.error || json2?.message || "Failed to fetch recommendations";
      throw new Error(message);
    }
    const picks2 = (json2?.top_picks || json2?.data?.top_picks || []) as any[];
    const recs2 = (json2?.recommendations ||
      json2?.data?.recommendations ||
      []) as any[];
    const mapRow = (row: any, idx?: number) => ({
      spotId: row.spotId || row.beach_id,
      name: row.name,
      distance_km: row.distance_km ?? null,
      score: row.score ?? 0,
      reasons: row.reasons || [],
      rank: row.rank ?? (typeof idx === "number" ? idx + 1 : undefined),
      wave: row.wave,
      wind: row.wind,
      tide: row.tide,
    });
    const mappedTop = picks2.length
      ? picks2.map(mapRow)
      : recs2.slice(0, 3).map(mapRow);
    const mappedAll = recs2.length ? recs2.map(mapRow) : mappedTop;
    const top = uniqueBySpot(
      mappedTop.filter(
        (p) => typeof p.distance_km === "number" && p.distance_km <= 30
      )
    );
    const all = uniqueBySpot(
      mappedAll.filter(
        (p) => typeof p.distance_km === "number" && p.distance_km <= 30
      )
    );
    return { top_picks: top, recommendations: all };
  }, [beachId, lat, lon]);

  const {
    data: response,
    loading,
    error,
    refetch,
  } = useDataFetcher<{
    top_picks?: Recommendation[];
    recommendations?: Recommendation[];
  }>(fetchRecs, {
    immediate: !initialResponse,
    initialData: initialResponse
      ? {
          top_picks: (() => {
            const list = (initialResponse.top_picks || []) as Recommendation[];
            const filtered = list.filter(
              (p) => typeof p.distance_km === "number" && p.distance_km <= 30
            );
            const seen = new Set<string>();
            return filtered.filter((p) => {
              const key = p.spotId || p.name;
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          })(),
          recommendations: (() => {
            const list = (initialResponse.recommendations ||
              []) as Recommendation[];
            const filtered = list.filter(
              (p) => typeof p.distance_km === "number" && p.distance_km <= 30
            );
            const seen = new Set<string>();
            return filtered.filter((p) => {
              const key = p.spotId || p.name;
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          })(),
        }
      : {},
  });

  const topPicks = response?.top_picks || [];
  const allRecs = response?.recommendations || [];
  const hasAny = topPicks.length > 0 || allRecs.length > 0;
  const top = topPicks.length
    ? topPicks[0]
    : allRecs.length
    ? allRecs[0]
    : null;

  const submitFeedback = async (
    spotId: string,
    accurate: boolean,
    reasons: string[] = []
  ) => {
    try {
      await fetch("/api/v1/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spot_id: spotId,
          accurate,
          reasons,
        }),
      });
      setFeedbackGiven((prev) => ({ ...prev, [spotId]: true }));
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  // Hide the card if the RPC returned no results
  if (!error && !loading && !hasAny) return null;

  return (
    <Card
      className={cn(
        "w-full border-primary/10 bg-gradient-to-b from-background to-muted/30 shadow-sm",
        className
      )}
    >
      <CardHeader className="pb-3 bg-primary/5 rounded-t-md">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-primary">{title}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
            className="min-w-[80px]"
          >
            <RefreshCw
              className={loading ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"}
            />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-red-600">
            {error instanceof Error ? error.message : String(error)}
          </div>
        )}
        {!error && loading && (
          <div className="text-sm text-muted-foreground">
            Loading coach pick…
          </div>
        )}
        {!error && !loading && top && (
          <div className="space-y-3">
            {/* Top pick summary */}
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">{top.name}</div>
              {top.score >= 75 ? (
                <Badge className="bg-emerald-600 text-white border-emerald-600">
                  {top.score}
                </Badge>
              ) : top.score >= 50 ? (
                <Badge className="bg-amber-500 text-white border-amber-500">
                  {top.score}
                </Badge>
              ) : (
                <Badge variant="outline">{top.score}</Badge>
              )}
            </div>

            {/* Show top 3 picks if available */}
            {topPicks.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-medium">
                  Top Picks:
                </div>
                {topPicks.slice(0, 3).map((pick, index) => (
                  <div
                    key={pick.spotId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-1">
                        #{index + 1}
                      </span>
                      <span className="text-sm">{pick.name}</span>
                    </span>
                    <Badge variant="outline">{pick.score}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsible explanation */}
            <Collapsible
              open={showExplanation}
              onOpenChange={setShowExplanation}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-sm text-muted-foreground hover:text-primary"
                >
                  Why this pick?{" "}
                  {showExplanation ? (
                    <ChevronUp className="ml-1 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-2 text-sm">
                  <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                    {top.reasons.map((r, i) => (
                      <li key={i} className="text-sm">
                        {r.replaceAll("_", " ")}
                      </li>
                    ))}
                  </ul>
                  {top.wave && (
                    <div className="grid grid-cols-3 gap-2 text-sm bg-muted p-3 rounded">
                      <div>
                        <div className="font-medium">Wave</div>
                        <div className="text-xs text-muted-foreground">
                          {top.wave.ht_ft}ft • {top.wave.period_s}s
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Wind</div>
                        <div className="text-xs text-muted-foreground">
                          {top.wind?.kts}kts • {top.wind?.dir_deg}°
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Tide</div>
                        <div className="text-xs text-muted-foreground">
                          {top.tide?.height_ft}ft
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Feedback buttons */}
            <div className="flex gap-2 pt-2">
              {!feedbackGiven[top.spotId] ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      submitFeedback(top.spotId, true, ["accurate"])
                    }
                    className="text-sm"
                  >
                    ✓ Accurate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      submitFeedback(top.spotId, false, [
                        "conditions_different",
                      ])
                    }
                    className="text-sm"
                  >
                    ✗ Off
                  </Button>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Thanks for the feedback!
                </div>
              )}
            </div>
          </div>
        )}
        {!error && !loading && !top && (
          <div className="text-sm text-muted-foreground">
            No confident call for tomorrow morning yet. Check full forecast.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
