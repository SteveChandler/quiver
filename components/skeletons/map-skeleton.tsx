import { Skeleton } from "@/components/ui/skeleton";
import { LoaderCircle } from "lucide-react";

export function MapSkeleton() {
  return (
    <div
      className="relative flex min-h-[400px] flex-1 overflow-hidden bg-[#80C8E2]"
      data-testid="map-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Loading surf map and nearby conditions"
    >
      <div className="absolute bottom-[9rem] left-3 w-[calc(100%-1.5rem)] max-w-[27rem] rounded-lg border border-black/15 bg-[#F5ECD8]/95 p-3 shadow-md sm:w-auto sm:min-w-[23rem]">
        <Skeleton className="mb-3 h-3 w-36 bg-black/15 motion-reduce:animate-none" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-8 bg-black/10 motion-reduce:animate-none"
            />
          ))}
        </div>
        <div className="mt-3 border-t border-black/10 pt-3">
          <Skeleton className="mb-2 h-3 w-20 bg-black/15 motion-reduce:animate-none" />
          <Skeleton className="mb-2 h-4 w-full bg-black/10 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-56 bg-black/10 motion-reduce:animate-none" />
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-lg border border-white/25 bg-[#151C36]/90 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <LoaderCircle
            className="h-4 w-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
          Charting nearby breaks…
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 w-[min(64rem,calc(100%-24px))] -translate-x-1/2 rounded-lg border border-black/15 bg-[#F5ECD8]/95 p-3 shadow-md">
        <Skeleton className="mb-2 h-3 w-24 bg-black/15 motion-reduce:animate-none" />
        <Skeleton className="h-8 w-full bg-black/10 motion-reduce:animate-none" />
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
