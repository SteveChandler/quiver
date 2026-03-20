"use client";

import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function TrustStrip() {
  const { user, isLoading } = useAuth();

  // Only show for anonymous visitors
  if (user || isLoading) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2.5 px-4">
      <ShieldCheck className="h-3.5 w-3.5 text-ocean-blue/60 flex-shrink-0" />
      <span>ML-corrected forecasts</span>
      <span className="text-gray-400">&middot;</span>
      <span>Trained on 30K+ buoy observations</span>
      <span className="text-gray-400">&middot;</span>
      <span>Updated every 3 hours</span>
    </div>
  );
}
