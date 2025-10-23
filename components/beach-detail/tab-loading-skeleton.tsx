/**
 * Tab Loading Skeleton Component
 *
 * Displays a loading skeleton while tab content is being lazy-loaded.
 * Improves perceived performance by providing visual feedback.
 */

export function TabLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 py-4">
      {/* Title skeleton */}
      <div className="h-6 w-48 bg-gray-200 rounded" />

      {/* Content blocks */}
      <div className="space-y-3">
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-5/6 bg-gray-200 rounded" />
        <div className="h-4 w-4/6 bg-gray-200 rounded" />
      </div>

      {/* Additional content blocks */}
      <div className="space-y-3 mt-6">
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
        <div className="h-4 w-5/6 bg-gray-200 rounded" />
      </div>
    </div>
  );
}
