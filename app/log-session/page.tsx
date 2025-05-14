import { LogSessionForm } from "@/components/log-session-form"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function LogSessionPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <LogSessionForm />
      <BottomNavigation />
    </div>
  )
}
