import { Skeleton } from "@/components/ui/skeleton";

export function MapSkeleton() {
  return (
    <div className="flex-1 relative overflow-hidden min-h-[400px]">
      {/* Map area skeleton */}
      <Skeleton className="w-full h-full" />

      {/* Map overlay skeleton */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md max-w-xs">
        <Skeleton className="h-4 w-48 mb-1" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Location control skeleton */}
      <div className="absolute top-4 right-4">
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  );
}

export function SelectedBeachCardSkeleton() {
  return (
    <div className="px-4 py-3 bg-background border-t">
      <div className="border-2 border-muted rounded-lg p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-1">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-3 w-3" />
                ))}
              <Skeleton className="h-3 w-8 ml-1" />
            </div>
          </div>
          <div className="text-right">
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NearbyBeachScrollSkeleton() {
  return (
    <div className="bg-background border-t">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="flex-shrink-0 w-48">
                <div className="overflow-hidden rounded-lg border">
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
