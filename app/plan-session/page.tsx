import { PlanSessionForm } from "@/components/plan-session-form"
import { BottomNavigation } from "@/components/bottom-navigation"

export default function PlanSessionPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <PlanSessionForm />
      <BottomNavigation />
    </div>
  )
}
