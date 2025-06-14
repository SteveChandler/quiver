import { SessionFormWrapper } from "@/components/session-forms/SessionFormWrapper";
import { BottomNavigation } from "@/components/bottom-navigation";

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
