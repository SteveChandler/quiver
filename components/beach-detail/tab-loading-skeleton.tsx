/**
 * Tab Loading Skeleton Component
 *
 * Displays a loading skeleton while tab content is being lazy-loaded.
 * Improves perceived performance by providing visual feedback.
 */

import { Skeleton } from "@/components/ui/skeleton";

export function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 py-4">
      {/* Title skeleton */}
      <Skeleton className="h-6 w-48" />

      {/* Content blocks */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>

      {/* Additional content blocks */}
      <div className="space-y-3 mt-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
