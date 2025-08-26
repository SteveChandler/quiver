import { SessionFormWrapper } from "@/components/session-forms/SessionFormWrapper";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";

export default function LogSessionPage() {
  // Auth check is handled by middleware for protected routes
  // No need for redundant client-side auth check here

  return (
    <div className="flex flex-col min-h-screen">
      <SessionFormWrapper initialMode="log" />
      {/* BottomNavigation is automatically hidden for /log-session path */}
    </div>
  );
}

export const metadata: Metadata = buildPageMetadata({
  title: "Log Your Surf Session | Quiver",
  description:
    "Log and share your surf sessions. Track your progress with Quiver.",
  path: "/log-session",
});
