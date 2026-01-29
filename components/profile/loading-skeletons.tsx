"use client";

/**
 * Profile Page Loading Skeletons
 *
 * Shared loading skeleton components for the profile page tabs
 * and sections. Used during lazy loading of tab content.
 */

/**
 * Loading skeleton for sessions/journal tab content
 */
export function SessionsLoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading sessions">
      <span className="sr-only">Loading sessions...</span>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 bg-gray-100 rounded-lg animate-pulse"
        ></div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton for generic tab content with a spinner
 */
export function TabLoadingSkeleton({ type }: { type: string }) {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-label={`Loading ${type}`}>
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-gray-600">Loading {type}...</p>
        </div>
      </div>
      <div className="grid gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the profile header/hero section
 */
export function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading profile header">
      <span className="sr-only">Loading profile...</span>
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        {/* Avatar skeleton */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gray-200"></div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="h-6 bg-gray-200 rounded w-32 mx-auto sm:mx-0"></div>
          <div className="h-4 bg-gray-100 rounded w-48 mx-auto sm:mx-0"></div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
            <div className="h-5 bg-gray-100 rounded-full w-20"></div>
            <div className="h-5 bg-gray-100 rounded-full w-24"></div>
          </div>
        </div>
        {/* Edit button skeleton */}
        <div className="flex-shrink-0">
          <div className="h-8 w-16 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the quick-glance preferences badges
 */
export function PreferencesQuickGlanceSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading preferences">
      <span className="sr-only">Loading preferences...</span>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-6 bg-gray-100 rounded-full"
            style={{ width: `${60 + (i % 3) * 20}px` }}
          ></div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the stats section
 */
export function StatsSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-2 gap-4 md:grid-cols-4" role="status" aria-label="Loading stats">
      <span className="sr-only">Loading stats...</span>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-lg p-4 shadow">
          <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-12"></div>
        </div>
      ))}
    </div>
  );
}
