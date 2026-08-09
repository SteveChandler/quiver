"use client";

/**
 * Forecast Skeleton Components
 *
 * Enhanced loading states with wave-shaped shimmer patterns
 * for forecast pages. Multiple variants for different content types.
 *
 * @module components/forecast/forecast-skeleton
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ForecastCardSkeleton,
  WaveShimmer,
} from "@/components/skeletons/forecast-card-skeleton";

export { ForecastCardSkeleton as CardSkeleton, WaveShimmer } from "@/components/skeletons/forecast-card-skeleton";

/**
 * Wave-shaped shimmer skeleton for hero sections
 */
export function HeroSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Title area */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-3/4 max-w-md" />
        <Skeleton className="h-5 w-1/2 max-w-xs" />
      </div>

      {/* Hero card */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Score gauge skeleton */}
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Content area */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Card grid skeleton for regional forecast cards
 */
export function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ForecastCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Table skeleton for beach conditions grid
 */
export function TableSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-5 gap-4 py-3 border-b">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="hidden md:grid grid-cols-5 gap-4 py-3 border-b border-gray-100"
        >
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}

      {/* Mobile cards */}
      <div className="md:hidden grid gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-16" />
                  <div className="flex gap-3 mt-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Timeline skeleton for swell events
 */
export function TimelineSkeleton({
  count = 2,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className="h-6 w-40" />

      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="text-center space-y-1">
                  <Skeleton className="h-3 w-12 mx-auto" />
                  <Skeleton className="h-6 w-16 mx-auto" />
                </div>
              ))}
            </div>

            {/* Wave chart placeholder */}
            <WaveShimmer width={80} height={40} className="mx-auto mb-3" />

            {/* Timeline bar */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


/**
 * Full page skeleton for forecast pages
 */
export function ForecastPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-7xl space-y-12", className)}>
      {/* Hero section */}
      <HeroSkeleton />

      {/* Cards section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <CardGridSkeleton count={6} />
      </div>

      {/* Table section */}
      <TableSkeleton rows={6} />
    </div>
  );
}
