"use client";

import { cn } from "@/lib/utils";

interface HorizonStripSkeletonProps {
  /** Number of skeleton cards to show */
  count?: number;
}

/**
 * Skeleton loading state for the Horizon Strip
 * Shows animated placeholders while forecast data loads
 */
export function HorizonStripSkeleton({ count = 7 }: HorizonStripSkeletonProps) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-hidden pb-2",
        "-mx-4 px-4 sm:-mx-6 sm:px-6"
      )}
      role="status"
      aria-label="Loading forecast days"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex-shrink-0 sm:flex-1 sm:min-w-0 w-[72px] sm:w-auto h-[88px] rounded-xl",
            "bg-slate-100 border-2 border-slate-200",
            "flex flex-col items-center justify-between p-2",
            "animate-pulse"
          )}
        >
          {/* Day name placeholder */}
          <div className="h-3 w-10 rounded bg-slate-200" />

          {/* Wave height placeholder */}
          <div className="flex flex-col items-center gap-1">
            <div className="h-5 w-12 rounded bg-slate-200" />
            <div className="h-2 w-8 rounded bg-slate-200" />
          </div>

          {/* Date placeholder */}
          <div className="h-3 w-10 rounded bg-slate-200" />
        </div>
      ))}

      {/* Right spacer for mobile scroll */}
      <div className="shrink-0 w-1 sm:hidden" aria-hidden="true" />

      <span className="sr-only">Loading forecast days...</span>
    </div>
  );
}
