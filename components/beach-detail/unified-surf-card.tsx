"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, Share2 } from "lucide-react";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { TrendTag } from "@/lib/scoring";
import { formatTimeInTimezone, formatTimeCasual } from "@/lib/utils/time-formatting";
import { ShareSheet } from "@/components/share/share-sheet";
import { buildSurfCallShareUrl } from "@/lib/share/build-share-card-url";

const TREND_TAG_STYLES: Record<TrendTag, { bg: string; text: string }> = {
  "Winds Dropping": { bg: "bg-green-100", text: "text-green-700" },
  "Winds Building": { bg: "bg-orange-100", text: "text-orange-700" },
  "Winds Cleaning Up": { bg: "bg-emerald-100", text: "text-emerald-700" },
  "Tide Filling In": { bg: "bg-blue-100", text: "text-blue-700" },
  "Tide Draining": { bg: "bg-cyan-100", text: "text-cyan-700" },
  "Clean Swell": { bg: "bg-purple-100", text: "text-purple-700" },
};

interface UnifiedSurfCardProps {
  surfCall: SurfCallResult;
  beachTimezone?: string | null;
  beachName: string;
  beachSlug?: string;
  isTomorrow?: boolean;
}

export function UnifiedSurfCard({
  surfCall,
  beachTimezone,
  beachName,
  beachSlug,
  isTomorrow,
}: UnifiedSurfCardProps) {
  const [shareOpen, setShareOpen] = useState(false);

  const updatedTime = useMemo(
    () => formatTimeInTimezone(surfCall.updatedAt, beachTimezone),
    [surfCall.updatedAt, beachTimezone]
  );

  // Handle NO verdict or missing window
  if (
    surfCall.verdict === "NO" ||
    !surfCall.bestWindowStart ||
    !surfCall.bestWindowEnd
  ) {
    return (
      <Card className="rounded-3xl border-yellow-100/60 bg-yellow-50/50">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium mb-1">
              No good surf window {isTomorrow ? "tomorrow" : "today"}
            </p>
            <p className="text-xs text-yellow-700">{surfCall.whySentence}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // YES or MAYBE verdict with valid window
  const windowStart = formatTimeInTimezone(
    surfCall.bestWindowStart,
    beachTimezone
  );
  const windowEnd = formatTimeInTimezone(surfCall.bestWindowEnd, beachTimezone);
  const peakTimeCasual = formatTimeCasual(surfCall.peakTime, beachTimezone);

  // Show "Best at X" only for windows > 3 hours (180 minutes)
  const showBestAtTag = surfCall.windowMinutes != null && surfCall.windowMinutes > 180 && peakTimeCasual;

  return (
    <Card className="rounded-3xl border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-blue-900">
              {isTomorrow ? "🌊 Best Time to Surf Tomorrow" : "🌊 Best Time to Surf Today"}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Based on forecast scoring · Updated {updatedTime}
            </p>
          </div>
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 -m-1 rounded-full text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            aria-label="Share surf call"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Window Time Range */}
        <div className="bg-gradient-to-br from-blue-50/80 to-green-50/50 rounded-2xl p-4 border border-blue-200/60">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Window</h4>
            {surfCall.shortWindow && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Short window
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-blue-600 mb-1">
            {windowStart} - {windowEnd}
          </p>
          {showBestAtTag && (
            <p className="text-sm text-blue-700">Best at {peakTimeCasual}</p>
          )}
        </div>

        {/* Trend Tags */}
        {surfCall.trendTags.length > 0 && (
          <ul
            aria-label="Condition trends"
            className="flex flex-wrap gap-2 list-none p-0 m-0"
          >
            {surfCall.trendTags.map((tag) => {
              const style = TREND_TAG_STYLES[tag];
              return (
                <li key={tag}>
                  <span
                    className={`text-xs font-medium px-3 py-1.5 rounded-full ${style.bg} ${style.text}`}
                  >
                    {tag}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Key Conditions */}
        <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
          <p className="text-sm text-gray-700 font-medium mb-1">Conditions</p>
          <p className="text-sm text-gray-600">
            {surfCall.waveHeight && `${surfCall.waveHeight} · `}
            {surfCall.windDescription && `${surfCall.windDescription} · `}
            {surfCall.tidePhase &&
              surfCall.tidePhase.charAt(0).toUpperCase() +
                surfCall.tidePhase.slice(1)}
          </p>
        </div>

        {/* Why Sentence */}
        <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
          <p className="text-sm text-gray-700 leading-relaxed">
            {surfCall.whySentence}
          </p>
        </div>

        {/* Low Confidence Badge */}
        {surfCall.lowForecastConfidence && (
          <div className="bg-yellow-50/50 rounded-xl p-3 border border-yellow-100/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-xs text-yellow-800 font-medium">
                Low Confidence - Forecast data may be less reliable
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        imageUrl={buildSurfCallShareUrl({
          beach: beachName,
          verdict: surfCall.verdict,
          window: `${windowStart} - ${windowEnd}`,
          waveHeight: surfCall.waveHeight || "",
          wind: surfCall.windDescription || "",
          tags: surfCall.trendTags.length > 0 ? surfCall.trendTags.join(",") : undefined,
        })}
        type="wave"
        filename={`quiver-surf-call-${beachSlug || "beach"}`}
        title={`🌊 ${beachName}: ${windowStart} - ${windowEnd}`}
        text={surfCall.whySentence}
      />
    </Card>
  );
}
