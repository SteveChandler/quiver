import { InfoIcon } from "lucide-react";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TimeWindow {
  time: string;
  label: string;
  height: string;
  quality: number;
  isBest: boolean;
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
          <Link
            href={forecastUrl}
            className="text-sm font-medium text-[#4A70D9] hover:text-[#4A70D9]/80"
          >
            Full forecast &gt;
          </Link>
        )}
      </div>

      <div className="noise-texture rounded-xl border border-[#404C92] bg-[#2D357D] p-5">
        <div className="flex flex-col gap-2">
          {windows.map((window) => {
            const isPreferred = preferredHour !== null && window.time === preferredHour;
            const barWidthPercent = Math.round(window.quality * 100);

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
                  <div className="relative flex min-w-0 flex-1 items-center h-7">
                    {/* Background bar — absolute, width driven by quality */}
                    <div
                      className={
                        window.isBest
                          ? "absolute inset-y-0 left-0 rounded-md bg-success/30 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                          : "absolute inset-y-0 left-0 rounded-md bg-[#2D357D]"
                      }
                      style={{ width: `${barWidthPercent}%` }}
                    />
                    {/* Label — sits on top, full container width */}
                    <span
                      className={
                        window.isBest
                          ? "relative z-10 truncate px-2 text-xs font-semibold text-white"
                          : "relative z-10 truncate px-2 text-xs font-semibold text-medium"
                      }
                    >
                      {window.label}
                    </span>
                  </div>

                  {/* Wave height — 48px fixed width */}
                  <span className="w-12 shrink-0 text-right text-sm font-semibold text-high">
                    {window.height}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
