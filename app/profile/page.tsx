import type { Metadata } from "next";
import { Suspense } from "react";
import { buildPageMetadata } from "@/lib/seo/meta";
import { ProfileView } from "@/components/profile-view";
import { ZineSurface } from "@/components/zine";

// Force dynamic rendering for this page since it uses useSearchParams
export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "My Profile - Manage Your Surf Profile",
  description:
    "Manage your surf profile, update settings, view your sessions, and track your surfing journey. Sign in to access your personal surf journal and profile settings.",
  path: "/profile",
  keywords: [
    "surf profile",
    "my profile",
    "surf settings",
    "user profile",
    "surf account",
  ],
});

// Loading skeleton for profile
function ProfileSkeleton() {
  return (
    <ZineSurface
      sectionLabel="Profile"
      editionLabel="Private logbook"
      paperClassName="min-h-[calc(100vh-9rem)]"
      data-testid="profile-skeleton-zine-surface"
    >
      <div
        className="space-y-6 animate-pulse"
        role="status"
        aria-label="Loading profile"
      >
        <span className="sr-only">Loading profile...</span>

        {/* Header skeleton */}
        <div className="torn torn-tb border-2 border-[#11100D] bg-[#FBF6E8] p-5">
          <div className="flex items-center space-x-4">
            <div className="h-20 w-20 rounded-full border-2 border-[#11100D] bg-[#D9C49C]"></div>
            <div className="flex-1 space-y-3">
              <div className="h-6 w-48 rounded bg-[#11100D]/20"></div>
              <div className="h-4 w-32 rounded bg-[#11100D]/15"></div>
            </div>
          </div>
        </div>

        {/* Tab skeleton */}
        <div className="border-y-2 border-[#11100D] bg-[#FBF6E8] px-4 py-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 rounded border-2 border-[#11100D]/40 bg-[#11100D]/10"></div>
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-sm border-2 border-[#11100D]/30 bg-[#FBF6E8]"
            ></div>
          ))}
        </div>

        {/* Loading indicator */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 border-2 border-[#11100D] bg-[#F78E42] px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)]">
            <div className="h-5 w-5 rounded-full border-2 border-[#11100D] border-t-transparent animate-spin"></div>
            <span>
              Loading Profile...
            </span>
          </div>
        </div>
      </div>
    </ZineSurface>
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
    </div>
  );
}
