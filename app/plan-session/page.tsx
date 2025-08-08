import { SessionFormWrapper } from "@/components/session-forms/SessionFormWrapper";
import { BottomNavigation } from "@/components/bottom-navigation";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";

export default function PlanSessionPage() {
  // Auth check is handled by middleware for protected routes
  // No need for redundant client-side auth check here

  return (
    <div className="flex flex-col min-h-screen">
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
