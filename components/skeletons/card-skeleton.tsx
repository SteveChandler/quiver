"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton({
  count = 1,
  showImage = true,
  className = "",
}: {
  count?: number;
  showImage?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex space-x-4">
              {showImage && <Skeleton className="h-16 w-16 rounded-md" />}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
