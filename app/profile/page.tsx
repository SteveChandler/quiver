import { Suspense, lazy } from "react";
import { BottomNavigation } from "@/components/bottom-navigation";

// Lazy load heavy profile component
const ProfileView = lazy(() =>
  import("@/components/profile-view").then((m) => ({ default: m.ProfileView }))
);

// Loading skeleton for profile
function ProfileSkeleton() {
  return (
    <div className="flex-1 bg-background">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 bg-white/20 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-white/20 rounded w-48"></div>
            <div className="h-4 bg-white/20 rounded w-32"></div>
          </div>
        </div>
      </div>

      {/* Tab skeleton */}
      <div className="border-b bg-white animate-pulse">
        <div className="flex space-x-8 px-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-20 bg-gray-200 rounded-t"></div>
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-6 space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg"></div>
        ))}
      </div>

      {/* Loading indicator */}
      <div className="fixed inset-0 bg-black/5 flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-700 font-medium">
              Loading Profile...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  // Auth check is handled by middleware for protected routes
  // No need for redundant server-side auth check here

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileView />
      </Suspense>
      <BottomNavigation />
    </div>
  );
}
