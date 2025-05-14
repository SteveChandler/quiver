import { BeachDetailView } from "@/components/beach-detail-view"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function BeachDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col min-h-screen">
      <BeachDetailView id={params.id} />
      <BottomNavigation />
    </div>
  )
}
