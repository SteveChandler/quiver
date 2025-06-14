import { SessionForm } from "@/components/session-forms/SessionForm";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function LogSessionPage() {
  // Auth check is handled by middleware for protected routes
  // No need for redundant client-side auth check here

  return (
    <div className="flex flex-col min-h-screen">
      <SessionForm initialMode="log" />
      <BottomNavigation />
    </div>
  );
}
