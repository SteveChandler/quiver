/**
 * Loading state for location pages
 */

export default function LocationLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Skeleton Breadcrumb */}
      <div className="mb-6 h-5 w-64 bg-gray-200 animate-pulse rounded" />

      {/* Skeleton Header */}
      <div className="mb-8">
        <div className="h-10 w-96 bg-gray-200 animate-pulse rounded mb-4" />
        <div className="flex gap-4">
          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded" />
          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded" />
        </div>
      </div>

      {/* Skeleton Beach List */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="h-6 w-64 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-96 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
