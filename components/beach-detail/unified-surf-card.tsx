"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, Share2, TrendingUp, TrendingDown, Waves, Zap } from "lucide-react";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { TrendTag } from "@/lib/scoring";
import type { ConditionCharacterCategory } from "@/lib/scoring/types";
import { formatTimeInTimezone, formatTimeCasual } from "@/lib/utils/date-time";
import { ShareSheet } from "@/components/share/share-sheet";
import { buildSurfCallShareUrl } from "@/lib/share/build-share-card-url";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import { buildCompactSurfSummary } from "@/lib/surf-summary-display";
import { cn } from "@/lib/utils";

const TREND_TAG_STYLES: Record<TrendTag, { bg: string; text: string }> = {
  "Winds Dropping": { bg: "bg-green-100", text: "text-green-700" },
  "Winds Building": { bg: "bg-orange-100", text: "text-orange-700" },
  "Winds Cleaning Up": { bg: "bg-emerald-100", text: "text-emerald-700" },
  "Tide Filling In": { bg: "bg-blue-100", text: "text-blue-700" },
  "Tide Draining": { bg: "bg-cyan-100", text: "text-cyan-700" },
  "Clean Swell": { bg: "bg-purple-100", text: "text-purple-700" },
};

// ------------------------------------------------------------------
// Character category → color mapping
// Mirrors the same mapping in PersonalizedBadge for consistency.
// ------------------------------------------------------------------

function getCharacterLabelColor(category: ConditionCharacterCategory): string {
  switch (category) {
    case "small-quality":
      return "text-amber-600 dark:text-amber-400";
    case "small-clean":
      return "text-yellow-600 dark:text-yellow-400";
    case "medium-clean":
    case "medium-mixed":
      return "text-blue-600 dark:text-blue-400";
    case "large-clean":
      return "text-blue-700 dark:text-blue-300";
    case "large-rough":
      return "text-orange-600 dark:text-orange-400";
    case "flat":
    case "small-weak":
      return "text-gray-500 dark:text-gray-400";
    case "skip":
    default:
      return "text-gray-400 dark:text-gray-500";
  }
}

// ------------------------------------------------------------------
// ContextChip — sticker-style relative context badge.
// Replicates the same component in best-surf-window.tsx for use here.
// Rotation uses inline style (not dynamic Tailwind) to avoid purging.
// ------------------------------------------------------------------

type ContextChipVariant = "gold" | "up" | "down" | "stable" | "swell" | "neutral";

const CONTEXT_CHIP_VARIANT_CLASSES: Record<ContextChipVariant, string> = {
  gold: "bg-amber-100/80 text-amber-800 border border-amber-300/60 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
  up: "bg-emerald-100/80 text-emerald-800 border border-emerald-300/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
  down: "bg-rose-100/80 text-rose-800 border border-rose-300/60 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/40",
  stable: "bg-gray-100/80 text-gray-700 border border-gray-300/60 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-600/40",
  swell: "bg-blue-100/80 text-blue-800 border border-blue-300/60 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
  neutral: "bg-gray-100/60 text-gray-600 border border-gray-200/60 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700/40",
};

function ContextChip({
  children,
  variant = "neutral",
  rotate = 0,
  className,
}: {
  children: React.ReactNode;
  variant?: ContextChipVariant;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px_10px_8px_10px] px-2.5 py-1 text-xs font-medium",
        CONTEXT_CHIP_VARIANT_CLASSES[variant],
        // Cancel rotation for users who prefer reduced motion
        "motion-reduce:!transform-none",
        className
      )}
      // Inline style for rotation — avoids dynamic Tailwind class purging.
      style={rotate !== 0 ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {children}
    </span>
  );
}

interface UnifiedSurfCardProps {
  surfCall: SurfCallResult;
  beachTimezone?: string | null;
  beachName: string;
  beachSlug?: string;
  isTomorrow?: boolean;
  /**
   * Qualitative character of the conditions, e.g. "Small but powerful — long-period energy".
   * Rendered below the window time in Space Mono with category-appropriate color.
   */
  character?: { label: string; category: string };
  /**
   * Board recommendation from the user's quiver.
   * Shown as a subtle callout: "Grab your [boardName]".
   */
  boardPick?: { boardName: string; boardType: string; reason: string } | null;
  /**
   * Relative context: best-of-week flag, trend, and incoming swell.
   * Shown as sticker-style chips (max 2) below the main card content.
   * Priority: isBestOfWeek > incomingSwell > trend.
   */
  relativeContext?: {
    isBestOfWeek: boolean;
    trend: "improving" | "declining" | "stable";
    incomingSwell?: { date: string; description: string } | null;
  };
}

export function UnifiedSurfCard({
  surfCall,
  beachTimezone,
  beachName,
  beachSlug,
  isTomorrow,
  character,
  boardPick,
  relativeContext,
}: UnifiedSurfCardProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const cautions = surfCall.cautions ?? [];
  const primaryCaution = cautions[0] ?? null;
  const cautionIsPrimaryReason =
    primaryCaution != null && surfCall.whySentence.includes(primaryCaution);

  const updatedTime = useMemo(
    () => formatTimeInTimezone(surfCall.updatedAt, beachTimezone),
    [surfCall.updatedAt, beachTimezone]
  );
  const compactSummary = useMemo(
    () =>
      buildCompactSurfSummary({
        waveHeight: surfCall.waveHeight,
        windSummary: surfCall.windDescription,
        tideStatus: surfCall.tidePhase
          ? surfCall.tidePhase.charAt(0).toUpperCase() + surfCall.tidePhase.slice(1)
          : surfCall.tideDescription,
        tideHeight: surfCall.tideHeight,
        why: surfCall.whySentence,
      }),
    [
      surfCall.waveHeight,
      surfCall.windDescription,
      surfCall.tidePhase,
      surfCall.tideDescription,
      surfCall.tideHeight,
      surfCall.whySentence,
    ]
  );

  // Build relative context badges (max 2), priority: best-of-week > swell > trend
  const contextBadges = useMemo(() => {
    if (!relativeContext) return [];

    const badges: Array<{
      key: string;
      variant: ContextChipVariant;
      rotate: number;
      content: React.ReactNode;
    }> = [];

    if (relativeContext.isBestOfWeek) {
      badges.push({
        key: "best-week",
        variant: "gold",
        rotate: -1,
        content: (
          <>
            <Zap className="h-3 w-3" aria-hidden="true" />
            Best conditions this week
          </>
        ),
      });
    }

    if (relativeContext.incomingSwell) {
      const swellDate = (() => {
        try {
          return new Date(relativeContext.incomingSwell.date).toLocaleDateString([], {
            weekday: "short",
          });
        } catch {
          return relativeContext.incomingSwell.date;
        }
      })();
      badges.push({
        key: "swell-incoming",
        variant: "swell",
        rotate: 1,
        content: (
          <>
            <Waves className="h-3 w-3" aria-hidden="true" />
            Swell incoming {swellDate}
          </>
        ),
      });
    } else if (badges.length < 2) {
      if (relativeContext.trend === "improving") {
        badges.push({
          key: "trend-up",
          variant: "up",
          rotate: 0,
          content: (
            <>
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              Conditions improving
            </>
          ),
        });
      } else if (relativeContext.trend === "declining") {
        badges.push({
          key: "trend-down",
          variant: "down",
          rotate: 0,
          content: (
            <>
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
              Conditions declining
            </>
          ),
        });
      }
    }

    return badges.slice(0, 2);
  }, [relativeContext]);

  // Handle NO verdict or missing window
  if (
    surfCall.verdict === "NO" ||
    !surfCall.bestWindowStart ||
    !surfCall.bestWindowEnd
  ) {
    return (
      <Card data-tier="hero" className="noise-texture overflow-hidden rounded-3xl border-yellow-100/60 bg-yellow-50/50">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-900 font-semibold mb-1">
              No good surf window {isTomorrow ? "tomorrow" : "today"}
            </p>
            {!cautionIsPrimaryReason && (
              <p className="text-sm text-amber-800">{surfCall.whySentence}</p>
            )}
            {cautions.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-100/60 px-3 py-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-800 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-950">
                    {primaryCaution}
                  </p>
                </div>
              </div>
            )}
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
    <Card data-tier="hero" className="noise-texture overflow-hidden rounded-3xl border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white shadow-lg animate-container-fade-slide-up motion-reduce:animate-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-blue-900">
              {isTomorrow ? "🌊 Best Surf Window Tomorrow" : "🌊 Best Surf Window Today"}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Based on tide, swell, wind, and spot fit · Updated {updatedTime}
            </p>
            <div className="h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-[#F78E42] to-transparent motion-safe:animate-shimmer mt-1" style={{ backgroundSize: "200% 100%" }} />
          </div>
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 -m-1 rounded-full text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors focus-ring"
            aria-label="Share surf call"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Window Time Range */}
        <div className="rounded-2xl p-4 border border-blue-200/60" style={{ background: 'linear-gradient(135deg, rgba(247,142,66,0.06), rgba(74,112,217,0.08))' }}>
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

          {/* Condition character label — sticker aesthetic, Space Mono, category-colored */}
          {character && (
            <p
              className={cn(
                "font-mono text-sm leading-snug tracking-tight mt-2",
                getCharacterLabelColor(character.category as ConditionCharacterCategory)
              )}
            >
              {character.label}
            </p>
          )}
        </div>

        {/* Board pick — subtle callout, only when available */}
        {boardPick && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 truncate">
                Grab your {boardPick.boardName}
              </p>
              {boardPick.reason && (
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 truncate">
                  {boardPick.reason}
                </p>
              )}
            </div>
          </div>
        )}

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
        <div className="bg-white/80 dark:bg-[#354090]/50 rounded-xl p-3 border border-gray-200/60 dark:border-[#404C92]/60">
          <p className="text-sm text-gray-700 font-medium mb-1">Conditions</p>
          <div className="flex flex-wrap items-baseline gap-x-1 text-sm text-gray-600">
            {compactSummary.waveHeightHeadline && (
              <>
                <WaveHeightDisplay
                  height={compactSummary.waveHeightHeadline}
                  isCalibrated={surfCall.isCalibrated}
                  showTooltip={true}
                  className="text-sm text-gray-600"
                />
                {(compactSummary.supportingSegments.length > 0 ||
                  (surfCall.rideableWavesPerHour != null &&
                    surfCall.rideableWavesPerHour > 0)) && <span>·</span>}
              </>
            )}
            {compactSummary.supportingSegments.map((segment, index) => (
              <React.Fragment key={segment}>
                <span>{segment}</span>
                {(index < compactSummary.supportingSegments.length - 1 ||
                  (surfCall.rideableWavesPerHour != null &&
                    surfCall.rideableWavesPerHour > 0)) && <span>·</span>}
              </React.Fragment>
            ))}
            {surfCall.rideableWavesPerHour != null && surfCall.rideableWavesPerHour > 0 && (
              <>
                <span>~{surfCall.rideableWavesPerHour} waves/hr</span>
              </>
            )}
          </div>
        </div>

        {/* Why Sentence */}
        <div className="bg-blue-50/50 dark:bg-[#354090]/30 rounded-xl p-3 border border-gray-200/40 dark:border-[#404C92]/40">
          <p className="text-sm text-gray-700 leading-relaxed">
            {surfCall.whySentence}
          </p>
        </div>

        {cautions.length > 0 && (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 dark:border-amber-800/40 dark:bg-amber-900/10">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {cautions[0]}
              </p>
            </div>
          </div>
        )}

        {/* Relative context chips — max 2, sticker-style */}
        {contextBadges.length > 0 && (
          <div
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Condition context"
          >
            {contextBadges.map((badge) => (
              <div key={badge.key} role="listitem">
                <ContextChip variant={badge.variant} rotate={badge.rotate}>
                  {badge.content}
                </ContextChip>
              </div>
            ))}
          </div>
        )}

        {/* Low Confidence Badge */}
        {surfCall.lowForecastConfidence && (
          <div className="bg-yellow-50/50 rounded-xl p-3 border border-yellow-100/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700" />
              <p className="text-xs text-amber-900 font-semibold">
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
