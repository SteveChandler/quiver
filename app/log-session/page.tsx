"use client";

import { SessionForm } from "@/components/session-forms/SessionForm";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function LogSessionPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <SessionForm initialMode="log" />
      <BottomNavigation />
    </div>
  );
}
