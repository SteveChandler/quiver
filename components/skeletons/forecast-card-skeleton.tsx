"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ForecastCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <WaveShimmer width={120} height={32} />
        </div>
      </CardContent>
    </Card>
  );
}

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
