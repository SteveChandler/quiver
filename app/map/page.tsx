import { MapView } from "@/components/map-view"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function MapPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MapView />
      <BottomNavigation />
    </div>
  )
}
