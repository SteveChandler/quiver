import { InfoIcon, ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";
import { buildCompactSurfSummary } from "@/lib/surf-summary-display";
import type { EveningTransition } from "@/types/personalization";

export interface TimeWindow {
  time: string;
  label: string;
  height: string;
  quality: number;
  isBest: boolean;
  /** Primary swell period, e.g. "14s" */
  swellPeriod?: string;
  /** Primary swell direction, e.g. "WNW" */
  swellDirection?: string;
  /** Wind speed, e.g. "8 mph" */
  windSpeed?: string;
  /** Wind direction, e.g. "NW" */
  windDirection?: string;
  /** Tide height, e.g. "3.2 ft" */
  tideHeight?: string;
  /** Tide status, e.g. "Rising" or "Falling" */
  tideStatus?: string;
  /**
   * True when this window's source beach has an empirical shoaling
   * calibration (`beaches.shoaling_factors IS NOT NULL`). Drives the
   * WaveHeightDisplay honesty-layer render (~ prefix + dotted underline).
   * Undefined for synthetic/fallback slots that have no backing forecast.
   */
  isCalibrated?: boolean;
}

export interface TodaysWindowsProps {
  windows: TimeWindow[];
  preferredTime: string | null;
  forecastUrl?: string;
  isTomorrow?: boolean;
  eveningTransition?: EveningTransition;
}

const INK = "#11100D";
const STAMP_BLUE = "#0B3A75";
/** Marker yellow, matching `.hl` in zine.css. */
const HIGHLIGHT = "rgba(242,201,76,0.85)";

const PREFERRED_TIME_TO_HOUR: Record<string, string> = {
  dawn_patrol: "5am",
  morning: "8am",
  lunch: "11am",
  afternoon: "2pm",
  evening: "5pm",
};

/**
 * Build compact condition segments (swell, wind, tide) from a TimeWindow.
 * Returns display strings like ["Wind NW 8 mph", "Swell WNW @ 14s", "Tide 3.2 ft Rising"].
 */
function buildConditionSegments(w: TimeWindow): string[] {
  return buildCompactSurfSummary({
    waveHeight: w.height,
    windSpeed: w.windSpeed,
    windDirection: w.windDirection,
    swellPeriod: w.swellPeriod,
    swellDirection: w.swellDirection,
    tideHeight: w.tideHeight,
    tideStatus: w.tideStatus,
  }).supportingSegments;
}

export function TodaysWindows({ windows, preferredTime, forecastUrl, isTomorrow, eveningTransition }: TodaysWindowsProps) {
  const preferredHour = preferredTime ? PREFERRED_TIME_TO_HOUR[preferredTime] ?? null : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {/* The info affordance sits beside the black label, not inside it —
            `.label-black` is an inline-block ink block, and an icon within it
            wraps onto its own line. */}
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="label-black">
            {isTomorrow ? "Tomorrow's Windows" : "Today's Windows"}
          </h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon
                  className="h-3.5 w-3.5 shrink-0 cursor-help"
                  style={{ color: INK, opacity: 0.5 }}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">
                  Wave heights show face height range — from average waves to
                  set waves (larger waves that come in groups).
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {forecastUrl && (
          <Link
            href={forecastUrl}
            className="inline-flex items-center gap-0.5"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: STAMP_BLUE,
            }}
          >
            Full forecast <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {eveningTransition?.active && eveningTransition.restOfToday.summary !== 'Done for today' && (
        <div className="mb-4">
          <h3 className="typewriter mb-2" style={{ opacity: 0.7 }}>
            Rest of Today
          </h3>
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              background: "#F0E5CC",
              boxShadow: "2px 3px 0 rgba(0,0,0,0.16)",
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: INK }}>
                {eveningTransition.restOfToday.summary}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: INK, opacity: 0.7 }}>
                {eveningTransition.restOfToday.conditions}
              </p>
            </div>
            <span
              className="ml-3 shrink-0"
              style={{
                fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                fontSize: 18,
                color: STAMP_BLUE,
              }}
            >
              {eveningTransition.restOfToday.waveHeight}
            </span>
          </div>
        </div>
      )}

      <div className="notebook">
        <div className="flex flex-col gap-2">
          {windows.map((window) => {
            const isPreferred = preferredHour !== null && window.time === preferredHour;
            const barWidthPercent = Math.round(window.quality * 100);
            const conditionSegments = buildConditionSegments(window);
            const compactSummary = buildCompactSurfSummary({
              waveHeight: window.height,
              windSpeed: window.windSpeed,
              windDirection: window.windDirection,
              swellPeriod: window.swellPeriod,
              swellDirection: window.swellDirection,
              tideHeight: window.tideHeight,
              tideStatus: window.tideStatus,
            });
            const height = compactSummary.waveHeightHeadline ?? window.height;

            return (
              <div
                key={window.time}
                className="p-1"
                data-preferred={isPreferred ? "true" : undefined}
                style={
                  isPreferred
                    ? { boxShadow: `inset 0 0 0 1.5px ${HIGHLIGHT}` }
                    : undefined
                }
              >
                <div className="flex items-center gap-3">
                  {/* Time label — 48px fixed width */}
                  <span
                    className="w-12 shrink-0 text-sm"
                    data-best={window.isBest ? "true" : undefined}
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontWeight: 700,
                      color: INK,
                      opacity: window.isBest ? 1 : 0.6,
                    }}
                  >
                    {window.time}
                  </span>

                  {/* Quality bar container */}
                  <div className="relative flex h-7 min-w-0 flex-1 items-center overflow-hidden">
                    {/* Background bar — absolute, width driven by quality.
                        Ink wash on paper; the best slot gets the marker
                        highlight rather than a glow. */}
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${barWidthPercent}%`,
                        background: window.isBest
                          ? "rgba(242,201,76,0.62)"
                          : "rgba(17,16,13,0.10)",
                      }}
                    />
                    {/* Label — sits on top, left-aligned, truncates when space is tight */}
                    <span
                      className="relative z-10 min-w-0 truncate px-2 text-xs font-semibold"
                      style={{ color: INK, opacity: window.isBest ? 1 : 0.72 }}
                    >
                      {window.label}
                    </span>
                    {/* Conditions — inline right-aligned, hidden on very small screens */}
                    {conditionSegments.length > 0 && (
                      <span
                        className="relative z-10 ml-auto hidden gap-2 whitespace-nowrap px-2 text-[10px] leading-tight sm:flex"
                        style={{ color: INK, opacity: 0.5 }}
                      >
                        {conditionSegments.map((seg, i) => (
                          <span key={i}>{seg}</span>
                        ))}
                      </span>
                    )}
                  </div>

                  {/* Wave height — 64px fixed width, nowrap so decimal
                      ranges like "1.5-2.5ft" don't wrap. The wider column
                      keeps visual rhythm consistent across all 5 cards
                      regardless of which range string the slot displays. */}
                  {window.height === "—" && !window.isBest ? (
                    <span
                      className="w-16 shrink-0 whitespace-nowrap text-right text-sm font-semibold"
                      style={{ color: INK, opacity: 0.3 }}
                    >
                      —
                    </span>
                  ) : (
                    <WaveHeightDisplay
                      height={height}
                      showTooltip={false}
                      className="w-16 shrink-0 whitespace-nowrap text-right text-sm font-semibold text-[#0B3A75]"
                      isCalibrated={window.isCalibrated}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {windows.filter(w => w.height === "—").length >= 4 && (
          <p
            className="mt-3 text-center text-xs"
            style={{ color: INK, opacity: 0.55 }}
          >
            Set your home beach for full forecast windows
          </p>
        )}
      </div>
    </div>
  );
}
