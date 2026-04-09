import { InfoIcon, ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WaveHeightDisplay } from "@/components/ui/wave-height-display";

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
}

const PREFERRED_TIME_TO_HOUR: Record<string, string> = {
  dawn_patrol: "5am",
  morning: "8am",
  lunch: "11am",
  afternoon: "2pm",
  evening: "5pm",
};

/**
 * Build compact condition segments (swell, wind, tide) from a TimeWindow.
 * Returns an array of display strings like ["14s WNW", "8mph NW", "3.2ft Rising"].
 */
function buildConditionSegments(w: TimeWindow): string[] {
  const segments: string[] = [];

  if (w.swellPeriod || w.swellDirection) {
    segments.push([w.swellPeriod, w.swellDirection].filter(Boolean).join(" "));
  }

  if (w.windSpeed || w.windDirection) {
    if (w.windSpeed && /^0\s*(mph|kn)/i.test(w.windSpeed)) {
      segments.push("Calm");
    } else {
      const spd = w.windSpeed
        ? /mph|kn/i.test(w.windSpeed) ? w.windSpeed : `${w.windSpeed}mph`
        : null;
      segments.push([spd, w.windDirection].filter(Boolean).join(" "));
    }
  }

  if (w.tideHeight || w.tideStatus) {
    const ht = w.tideHeight
      ? /ft|m\b/i.test(w.tideHeight) ? w.tideHeight : `${w.tideHeight}ft`
      : null;
    segments.push([ht, w.tideStatus].filter(Boolean).join(" "));
  }

  return segments;
}

export function TodaysWindows({ windows, preferredTime, forecastUrl, isTomorrow }: TodaysWindowsProps) {
  const preferredHour = preferredTime ? PREFERRED_TIME_TO_HOUR[preferredTime] ?? null : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-heading text-lg font-semibold text-white">
          {isTomorrow ? "Tomorrow's Windows" : "Today's Windows"}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">
                  Wave heights show face height range — from average waves to
                  set waves (larger waves that come in groups).
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h2>
        {forecastUrl && (
          <Link href={forecastUrl} className="text-sm font-medium text-[#4A70D9] hover:text-[#4A70D9]/80 inline-flex items-center gap-0.5">
            Full forecast <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="noise-texture rounded-xl border border-[#404C92] bg-[#2D357D] p-5">
        <div className="flex flex-col gap-2">
          {windows.map((window) => {
            const isPreferred = preferredHour !== null && window.time === preferredHour;
            const barWidthPercent = Math.round(window.quality * 100);
            const conditionSegments = buildConditionSegments(window);

            return (
              <div
                key={window.time}
                className={
                  isPreferred
                    ? "rounded-lg p-1 ring-1 ring-[#FDB84B]/20"
                    : "rounded-lg p-1"
                }
              >
                <div className="flex items-center gap-3">
                  {/* Time label — 48px fixed width */}
                  <span
                    className={
                      window.isBest
                        ? "w-12 shrink-0 font-heading text-sm font-bold text-[#FDB84B]"
                        : "w-12 shrink-0 font-heading text-sm text-medium"
                    }
                  >
                    {window.time}
                  </span>

                  {/* Quality bar container */}
                  <div className="relative flex min-w-0 flex-1 items-center h-7 overflow-hidden">
                    {/* Background bar — absolute, width driven by quality */}
                    <div
                      className={
                        window.isBest
                          ? "absolute inset-y-0 left-0 rounded-md bg-success/30 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                          : "absolute inset-y-0 left-0 rounded-md bg-[#2D357D]"
                      }
                      style={{ width: `${barWidthPercent}%` }}
                    />
                    {/* Label — sits on top, left-aligned, truncates when space is tight */}
                    <span
                      className={
                        window.isBest
                          ? "relative z-10 min-w-0 truncate px-2 text-xs font-semibold text-white"
                          : "relative z-10 min-w-0 truncate px-2 text-xs font-semibold text-medium"
                      }
                    >
                      {window.label}
                    </span>
                    {/* Conditions — inline right-aligned, hidden on very small screens */}
                    {conditionSegments.length > 0 && (
                      <span className="relative z-10 ml-auto hidden gap-2 px-2 text-[10px] leading-tight text-medium/50 whitespace-nowrap sm:flex">
                        {conditionSegments.map((seg, i) => (
                          <span key={i}>{seg}</span>
                        ))}
                      </span>
                    )}
                  </div>

                  {/* Wave height — 48px fixed width */}
                  {window.height === "—" && !window.isBest ? (
                    <span className="w-12 shrink-0 text-right text-sm font-semibold text-white/30">
                      —
                    </span>
                  ) : (
                    <WaveHeightDisplay
                      height={window.height}
                      showTooltip={false}
                      className="w-12 shrink-0 text-right text-sm font-semibold text-high"
                      isCalibrated={window.isCalibrated}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {windows.filter(w => w.height === "—").length >= 4 && (
          <p className="text-white/40 text-xs text-center mt-3">
            Set your home beach for full forecast windows
          </p>
        )}
      </div>
    </div>
  );
}
