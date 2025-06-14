import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function BeachCardSkeleton() {
  return (
    <Card className="overflow-hidden mb-4">
      <div className="flex">
        {/* Image skeleton */}
        <Skeleton className="w-32 h-24 flex-shrink-0" />

        {/* Content skeleton */}
        <CardContent className="flex-1 p-4">
          <div className="space-y-2">
            {/* Beach name */}
            <Skeleton className="h-5 w-48" />

            {/* Distance */}
            <div className="flex items-center gap-1">
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Rating */}
            <div className="flex items-center gap-1">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-3 w-3" />
                ))}
              <Skeleton className="h-3 w-8 ml-1" />
            </div>

            {/* Conditions */}
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

export function BeachCardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <BeachCardSkeleton key={index} />
        ))}
    </div>
  );
}
