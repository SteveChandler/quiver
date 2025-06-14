import { ProfileView } from "@/components/profile-view";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function ProfilePage() {
  // Auth check is handled by middleware for protected routes
  // No need for redundant server-side auth check here

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileView />
      <BottomNavigation />
    </div>
  );
}
