import { SessionFormWrapper } from "@/components/session-forms/SessionFormWrapper";
import { BottomNavigation } from "@/components/bottom-navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { CoachCard } from "@/components/recommendations/coach-card";

export default function PlanSessionPage() {
  // Auth check is handled by middleware for protected routes
  // No need for redundant client-side auth check here

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-4 pt-4">
        {/* Default to downtown SD; form can replace later when user selects a beach */}
        <CoachCard
          lat={32.7157}
          lon={-117.1611}
          className="max-w-2xl mx-auto"
        />
      </div>
      <SessionFormWrapper initialMode="plan" />
      <BottomNavigation />
    </div>
  );
}

export const metadata: Metadata = buildPageMetadata({
  title: "Plan Your Surf Session | Quiver",
  description:
    "Plan the perfect surf session with forecast insights, gear picks, and group invites.",
  path: "/plan-session",
});
