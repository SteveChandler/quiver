"use client";

import { Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TideConditionsCardProps {
  prose: string | null;
  preferredDirection: string | null;
}

const directionLabels: Record<string, string> = {
  rising: "Rising tide preferred",
  falling: "Falling tide preferred",
  slack: "Mid-tide preferred",
  either: "Works on any tide",
};

export function TideConditionsCard({
  prose,
  preferredDirection,
}: TideConditionsCardProps) {
  if (!prose) return null;

  const directionLabel = preferredDirection
    ? directionLabels[preferredDirection] || preferredDirection
    : null;

  return (
    <section
      data-testid="tide-conditions-card"
      className="mt-6 overflow-hidden rounded-[8px] border-2 border-[#11100D] bg-[#F4EBD8] shadow-[3px_3px_0_#11100D]"
    >
      <header className="border-b-2 border-[#11100D] bg-[#0B3A75] px-4 py-3">
        <h3 className="flex items-center gap-2 font-heading text-lg font-black uppercase text-[#F4EBD8]">
          <Waves className="h-5 w-5 text-[#F78E42]" />
          Best Tide Conditions
        </h3>
      </header>
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm font-medium leading-relaxed text-[#11100D]">
          {prose}
        </p>
        {directionLabel && (
          <Badge
            variant="secondary"
            className="rounded-full border-2 border-[#11100D] bg-[#F78E42] font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#11100D] hover:bg-[#F78E42]"
          >
            {directionLabel}
          </Badge>
        )}
      </div>
    </section>
  );
}
