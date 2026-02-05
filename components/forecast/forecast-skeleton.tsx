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
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Individual card skeleton
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>

        {/* Sparkline placeholder */}
        <div className="mt-4">
          <WaveShimmer width={120} height={32} />
        </div>
      </CardContent>
    </Card>
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
 * Wave-shaped shimmer animation
 * Creates a wave-like shimmer effect
 */
export function WaveShimmer({
  width = 120,
  height = 32,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-gray-100",
        className
      )}
      style={{ width, height }}
    >
      {/* Wave shape mask */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0"
      >
        <defs>
          <linearGradient id="shimmer-wave" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(229, 231, 235)" />
            <stop offset="50%" stopColor="rgb(243, 244, 246)" />
            <stop offset="100%" stopColor="rgb(229, 231, 235)" />
          </linearGradient>
        </defs>
        <path
          d={`M 0,${height / 2} Q ${width / 4},${height * 0.3} ${width / 2},${height / 2} T ${width},${height / 2} L ${width},${height} L 0,${height} Z`}
          fill="url(#shimmer-wave)"
          className="animate-shimmer"
          style={{
            backgroundSize: "200% 100%",
          }}
        />
      </svg>

      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 animate-shimmer"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
        }}
      />
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
