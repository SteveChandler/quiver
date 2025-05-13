import { SessionDetailView } from "@/components/session-detail-view"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col min-h-screen">
      <SessionDetailView id={params.id} />
      <BottomNavigation />
    </div>
  )
}
