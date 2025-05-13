import { SessionsView } from "@/components/sessions-view"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function SessionsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SessionsView />
      <BottomNavigation />
    </div>
  )
}
