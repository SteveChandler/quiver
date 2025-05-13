import { ProfileView } from "@/components/profile-view"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function ProfilePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <ProfileView />
      <BottomNavigation />
    </div>
  )
}
