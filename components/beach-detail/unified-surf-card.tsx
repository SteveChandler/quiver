"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, ArrowUp, ArrowDown, Share2, TrendingUp, TrendingDown, Waves, Zap } from "lucide-react";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import type { TrendTag } from "@/lib/scoring";
import type { ConditionCharacterCategory } from "@/lib/scoring/types";
import { formatTimeInTimezone, formatTimeCasual } from "@/lib/utils/date-time";
import { ShareSheet } from "@/components/share/share-sheet";
import { buildSurfCallShareUrl } from "@/lib/share/build-share-card-url";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import { buildCompactSurfSummary } from "@/lib/surf-summary-display";
import { cn } from "@/lib/utils";
import { getSurfCallVerdictCall, SCORE_LABEL_PAPER_WASH } from "@/components/forecast/score-band-call";

const EYEBROW =
  "font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#8A5E00]";
const CELL_LABEL =
  "font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#11100D]";

const TREND_TAG_STYLES: Record<TrendTag, { bg: string; text: string }> = {
  "Winds Dropping": { bg: "bg-green-100", text: "text-green-700" },
  "Winds Building": { bg: "bg-orange-100", text: "text-orange-800" },
  "Winds Cleaning Up": { bg: "bg-emerald-100", text: "text-emerald-700" },
  "Tide Filling In": { bg: "bg-[#F6E9CE]", text: "text-[#11100D]" },
  "Tide Draining": { bg: "bg-cyan-100", text: "text-cyan-900" },
  "Clean Swell": { bg: "bg-purple-100", text: "text-purple-800" },
};

// ------------------------------------------------------------------
// Character category → color mapping
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
  gold: "bg-[#F6E9CE] text-[#7A4B00] border border-[#8A5E00]/40",
  up: "bg-emerald-100/80 text-emerald-800 border border-emerald-300/60",
  down: "bg-rose-100/80 text-rose-800 border border-rose-300/60",
  stable: "bg-[#F0E5CC] text-[#4B4030] border border-[#11100D]/25",
  swell: "bg-[#F6E9CE] text-[#11100D] border border-[#8A5E00]/40",
  neutral: "bg-[#F0E5CC] text-[#4B4030] border border-[#11100D]/20",
};

function ContextChip({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: ContextChipVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px_10px_8px_10px] px-2.5 py-1 text-xs font-medium",
        CONTEXT_CHIP_VARIANT_CLASSES[variant],
        className
      )}
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
  const tideStatus = surfCall.tidePhase
    ? surfCall.tidePhase.charAt(0).toUpperCase() + surfCall.tidePhase.slice(1)
    : surfCall.tideDescription;
  const compactSummary = useMemo(
    () =>
      buildCompactSurfSummary({
        waveHeight: surfCall.waveHeight,
        windSummary: surfCall.windDescription,
        tideStatus,
        tideHeight: surfCall.tideHeight,
        why: surfCall.whySentence,
      }),
    [
      surfCall.waveHeight,
      surfCall.windDescription,
      tideStatus,
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
      content: React.ReactNode;
    }> = [];

    if (relativeContext.isBestOfWeek) {
      badges.push({
        key: "best-week",
        variant: "gold",
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
  const verdictCall = getSurfCallVerdictCall(surfCall.verdict, surfCall.score);
  const hasWaves = Boolean(compactSummary.waveHeightHeadline);
  const hasWind = Boolean(compactSummary.windSummary);
  const hasTide = Boolean(compactSummary.tideSummary);
  const conditionCount = Number(hasWaves) + Number(hasWind) + Number(hasTide);
  const windText = compactSummary.windSummary?.replace(/^Wind\s+/i, "") ?? null;
  const windQualityMatch = windText?.match(
    /^(.*\S)\s*\((offshore|onshore|cross-shore)\)$/i
  );
  const windQuality =
    windQualityMatch?.[2].toLowerCase() === surfCall.windType?.toLowerCase()
      ? windQualityMatch?.[2] ?? null
      : null;
  const windValue = windQuality ? windQualityMatch?.[1] : windText;
  const tideHeight = surfCall.tideHeight?.trim() || null;
  const tideState = tideStatus?.trim() || null;
  const tideValue = tideHeight || tideState;

  // Show "Best at X" only for windows > 3 hours (180 minutes)
  const showBestAtTag =
    surfCall.windowMinutes != null && surfCall.windowMinutes > 180 && peakTimeCasual;

  return (
    <Card className="overflow-hidden rounded-[8px] border-2 border-[#11100D] shadow-[4px_4px_0_#11100D] animate-container-fade-slide-up motion-reduce:animate-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="font-heading text-xl font-black uppercase leading-tight text-[#11100D]">
              {isTomorrow ? "Best Surf Window Tomorrow" : "Best Surf Window Today"}
            </CardTitle>
            <p className="mt-1 text-xs text-[#4B4030]">
              Based on tide, swell, wind, and spot fit · Updated {updatedTime}
            </p>
            <div className="h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-[#F78E42] to-transparent motion-safe:animate-shimmer mt-1" style={{ backgroundSize: "200% 100%" }} />
          </div>
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 -m-1 rounded-full text-[#11100D] hover:bg-[#F6E9CE] transition-colors focus-ring"
            aria-label="Share surf call"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-8 lg:gap-y-5">
        {/* Window Time Range */}
        <div
          className="rounded-[12px_4px_14px_6px] border-[2.5px] border-[#11100D] p-4 shadow-[3px_3px_0_#11100D] sm:p-5"
          style={{ backgroundColor: SCORE_LABEL_PAPER_WASH[verdictCall.label] }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 text-[#8A5E00]" aria-hidden="true" />
            <h4 className={EYEBROW}>Window</h4>
            {surfCall.shortWindow && (
              <span className="rounded-[6px_10px_8px_10px] border border-[#11100D] bg-[#F4EBD8] px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#11100D]">
                Short window
              </span>
            )}
          </div>
          <p className="mt-2 font-[family-name:var(--font-zine-display)] text-[2.5rem] leading-[0.95] tracking-[-0.02em] text-[#11100D] tabular-nums sm:text-5xl lg:text-[3.25rem]">
            <span className="whitespace-nowrap">{windowStart}{" –"}</span>{" "}
            <span className="whitespace-nowrap">{windowEnd}</span>
          </p>
          {showBestAtTag && (
            <p className="mt-3 font-mono text-sm font-bold text-[#11100D]">Best at {peakTimeCasual}</p>
          )}

          {/* Condition character label — sticker aesthetic, Space Mono, category-colored */}
          {character && (
            <p
              className={cn(
                "mt-2 font-mono text-sm leading-snug tracking-tight",
                getCharacterLabelColor(character.category as ConditionCharacterCategory)
              )}
            >
              {character.label}
            </p>
          )}
        </div>

        {/* Key Conditions */}
        <div>
          <p className={EYEBROW}>Conditions</p>
          {conditionCount > 0 && (
            <div className={cn(
              "mt-2 grid border-y-2 border-[#11100D]",
              conditionCount === 3
                ? "grid-cols-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]"
                : conditionCount === 2 ? "grid-cols-2" : "grid-cols-1"
            )}>
              {compactSummary.waveHeightHeadline && (
                <div className={cn(
                  "py-3",
                  conditionCount === 3
                    ? "col-span-2 border-b border-[#11100D]/25 sm:col-span-1 sm:border-b-0 sm:border-r sm:pl-0 sm:pr-4"
                    : conditionCount === 2 ? "border-r border-[#11100D]/25 pr-3" : ""
                )}>
                  <WaveHeightDisplay
                    height={compactSummary.waveHeightHeadline}
                    isCalibrated={surfCall.isCalibrated}
                    showTooltip={true}
                    className="font-[family-name:var(--font-zine-display)] text-4xl leading-none text-[#11100D] tabular-nums sm:text-[2.75rem]"
                  />
                  {surfCall.rideableWavesPerHour != null && surfCall.rideableWavesPerHour > 0 && (
                    <p className="mt-2 font-mono text-xs font-bold text-[#4B4030]">~{surfCall.rideableWavesPerHour} waves/hr</p>
                  )}
                </div>
              )}
              {compactSummary.windSummary && (
                <div className={cn(
                  "py-3",
                  conditionCount === 3
                    ? "border-r border-[#11100D]/25 pr-3 sm:px-4"
                    : conditionCount === 2 && hasWaves
                      ? "pl-3"
                      : conditionCount === 2
                        ? "border-r border-[#11100D]/25 pr-3"
                        : ""
                )}>
                  <p className={CELL_LABEL}>Wind</p>
                  <p className="mt-1 font-[family-name:var(--font-zine-display)] text-xl leading-tight text-[#11100D] sm:text-2xl">{windValue}</p>
                  {windQuality && (
                    <span className={cn(
                      "mt-2 inline-flex items-center rounded-[6px_10px_8px_10px] border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em]",
                      windQuality.toLowerCase() === "offshore"
                        ? "border-[#06765F]/50 bg-[#E6EAD4] text-[#06765F]"
                        : windQuality.toLowerCase() === "cross-shore"
                          ? "border-[#8A5E00]/40 bg-[#F6E9CE] text-[#8A5E00]"
                          : "border-[#8A5E00]/60 bg-[#F6E9CE] text-[#8A5E00]"
                    )}>{windQuality}</span>
                  )}
                </div>
              )}
              {compactSummary.tideSummary && (
                <div className={cn(
                  "py-3",
                  conditionCount > 1 ? "pl-3" : "",
                  conditionCount === 3 ? "sm:px-4" : ""
                )}>
                  <p className={CELL_LABEL}>Tide</p>
                  <p className="mt-1 font-[family-name:var(--font-zine-display)] text-xl leading-tight text-[#11100D] sm:text-2xl">{tideValue}</p>
                  {tideHeight && tideState && (
                    <p className="mt-2 inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#4B4030]">
                      {/^rising/i.test(tideState) && <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
                      {/^falling/i.test(tideState) && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
                      {tideState}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trend Tags */}
        {surfCall.trendTags.length > 0 && (
          <ul
            aria-label="Condition trends"
            className="flex flex-wrap gap-2 list-none p-0 m-0 lg:col-span-2"
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

        {/* Board pick — subtle callout, only when available */}
        {boardPick && (
          <div className="flex items-center gap-2 rounded-lg border border-[#8A5E00]/40 bg-[#F6E9CE] px-3 py-2 lg:col-span-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#11100D] truncate">
                Grab your {boardPick.boardName}
              </p>
              {boardPick.reason && (
                <p className="text-xs text-[#4B4030] truncate">
                  {boardPick.reason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Why Sentence */}
        <p className="lg:col-span-2 border-t-2 border-dashed border-[#11100D]/30 pt-4 text-sm leading-relaxed text-[#4B4030]">{surfCall.whySentence}</p>

        {cautions.length > 0 && (
          <div className="rounded-xl border border-[#8A5E00]/40 bg-[#F6E9CE] p-3 lg:col-span-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[#8A5E00] mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-[#11100D]">
                {cautions[0]}
              </p>
            </div>
          </div>
        )}

        {/* Relative context chips — max 2, sticker-style */}
        {contextBadges.length > 0 && (
          <div
            className="flex flex-wrap gap-2 lg:col-span-2"
            role="list"
            aria-label="Condition context"
          >
            {contextBadges.map((badge) => (
              <div key={badge.key} role="listitem">
                <ContextChip variant={badge.variant}>
                  {badge.content}
                </ContextChip>
              </div>
            ))}
          </div>
        )}

        {/* Low Confidence Badge */}
        {surfCall.lowForecastConfidence && (
          <div className="bg-yellow-50/50 rounded-xl p-3 border border-yellow-100/50 lg:col-span-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-900" />
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
