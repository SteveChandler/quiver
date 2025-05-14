import { LogSessionForm } from "@/components/log-session-form";
import { BottomNavigation } from "@/components/bottom-navigation";
import { Suspense } from "react";

export default function LogSessionPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            Loading...
          </div>
        }
      >
        <LogSessionForm />
      </Suspense>
      <BottomNavigation />
    </div>
  );
}
