"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  lat,
  lon,
  timeIso,
  title = "Coach Pick",
  className,
}: {
  lat: number;
  lon: number;
  timeIso?: string;
  title?: string;
  className?: string;
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<{[key: string]: boolean}>({});

  const fetchRecs = useCallback(async () => {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    if (timeIso) params.set("time", timeIso);
    const res = await fetch(`/api/v1/recommendations?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to fetch recs");
    return json.data || json;
  }, [lat, lon, timeIso]);

  const {
    data: response,
    loading,
    error,
    refetch,
  } = useDataFetcher<{top_picks?: Recommendation[], recommendations?: Recommendation[]}>(fetchRecs, {
    immediate: true,
    initialData: {},
  });

  const topPicks = response?.top_picks || [];
  const allRecs = response?.recommendations || [];
  const top = topPicks.length ? topPicks[0] : (allRecs.length ? allRecs[0] : null);

  const submitFeedback = async (spotId: string, accurate: boolean, reasons: string[] = []) => {
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
      setFeedbackGiven(prev => ({ ...prev, [spotId]: true }));
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3 flex items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={loading}
        >
          <RefreshCw
            className={loading ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"}
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!error && loading && (
          <div className="text-sm text-muted-foreground">
            Loading coach pick…
          </div>
        )}
        {!error && !loading && top && (
          <div className="space-y-3">
            {/* Top pick summary */}
            <div className="flex items-center justify-between">
              <div className="font-medium">{top.name}</div>
              <Badge variant={top.score >= 75 ? "default" : top.score >= 50 ? "secondary" : "outline"}>
                {top.score}
              </Badge>
            </div>

            {/* Show top 3 picks if available */}
            {topPicks.length > 1 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground font-medium">Top Picks:</div>
                {topPicks.slice(0, 3).map((pick, index) => (
                  <div key={pick.spotId} className="flex items-center justify-between text-sm">
                    <span>#{index + 1} {pick.name}</span>
                    <Badge variant="outline" size="sm">{pick.score}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsible explanation */}
            <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
                  Why this pick? {showExplanation ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-2 text-xs">
                  <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                    {top.reasons.map((r, i) => (
                      <li key={i}>{r.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                  {top.wave && (
                    <div className="grid grid-cols-3 gap-2 text-xs bg-muted p-2 rounded">
                      <div>
                        <div className="font-medium">Wave</div>
                        <div>{top.wave.ht_ft}ft • {top.wave.period_s}s</div>
                      </div>
                      <div>
                        <div className="font-medium">Wind</div>
                        <div>{top.wind?.kts}kts • {top.wind?.dir_deg}°</div>
                      </div>
                      <div>
                        <div className="font-medium">Tide</div>
                        <div>{top.tide?.height_ft}ft</div>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Feedback buttons */}
            <div className="flex gap-2 pt-1">
              {!feedbackGiven[top.spotId] ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => submitFeedback(top.spotId, true, ["accurate"])}
                    className="text-xs"
                  >
                    ✓ Accurate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => submitFeedback(top.spotId, false, ["conditions_different"])}
                    className="text-xs"
                  >
                    ✗ Off
                  </Button>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Thanks for the feedback!</div>
              )}
            </div>
          </div>
        )}
        {!error && !loading && !top && (
          <div className="text-sm text-muted-foreground">
            No recommendations yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
